import { Router } from 'express';
import { ffDb } from '../facultyDb/database.ts';
import {
  computeEffectiveFacultyStatus,
  emitCollegeEvent,
  hashFfPassword,
  pushFfNotification,
  requireFfAuth,
  requireFfRole,
  type FfAuthedRequest,
} from '../facultyAuth/security.ts';

export const facultyFinderRoutes = Router();

const VALID_STATUSES = ['Available', 'In Lecture', 'In Meeting', 'Temporarily Away', 'Busy', 'On Leave'];
const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const VALID_ACTIVITIES = ['Lecture', 'Lab', 'Office Hours', 'Meeting'];

function hydrateFacultyList(collegeId: number) {
  const facultyRows = ffDb
    .prepare(
      `SELECT
         u.id, u.full_name, u.email, u.identifier, u.designation, u.subjects_json,
         u.cabin_number, u.working_hours,
         d.id AS department_id, d.name AS department_name, d.code AS department_code,
         b.id AS building_id, b.name AS building_name, b.code AS building_code, b.lat, b.lng, b.floors
       FROM ff_users u
       LEFT JOIN ff_departments d ON d.id = u.department_id
       LEFT JOIN ff_buildings b ON b.id = u.building_id
       WHERE u.college_id = ? AND u.role = 'faculty' AND u.is_active = 1
       ORDER BY u.full_name ASC`
    )
    .all(collegeId) as any[];

  const statusRows = ffDb
    .prepare('SELECT * FROM ff_faculty_status WHERE college_id = ?')
    .all(collegeId) as any[];
  const statusMap = new Map(statusRows.map((s) => [s.faculty_id, s]));

  const ttRows = ffDb
    .prepare('SELECT * FROM ff_faculty_timetable WHERE college_id = ? ORDER BY start_time ASC')
    .all(collegeId) as any[];
  const ttMap = new Map<number, any[]>();
  for (const row of ttRows) {
    const arr = ttMap.get(row.faculty_id) || [];
    arr.push(row);
    ttMap.set(row.faculty_id, arr);
  }

  const queueCounts = ffDb
    .prepare(
      `SELECT faculty_id, COUNT(*) AS waiting_count
       FROM ff_virtual_queue
       WHERE college_id = ? AND status IN ('Waiting', 'Called')
       GROUP BY faculty_id`
    )
    .all(collegeId) as { faculty_id: number; waiting_count: number }[];
  const queueMap = new Map(queueCounts.map((q) => [q.faculty_id, q.waiting_count]));

  return facultyRows.map((f) => {
    const statusRow = statusMap.get(f.id);
    const timetable = ttMap.get(f.id) || [];
    const computed = computeEffectiveFacultyStatus(statusRow, timetable);
    let subjects: string[] = [];
    try {
      subjects = JSON.parse(f.subjects_json || '[]');
    } catch {
      subjects = [];
    }

    return {
      id: f.id,
      full_name: f.full_name,
      email: f.email,
      identifier: f.identifier,
      designation: f.designation || 'Faculty Member',
      subjects,
      cabin_number: f.cabin_number || 'TBD',
      working_hours: f.working_hours || '09:00 AM - 05:00 PM',
      department_id: f.department_id,
      department_name: f.department_name || 'General',
      department_code: f.department_code || 'GEN',
      building_id: f.building_id,
      building_name: f.building_name || 'Main Block',
      building_code: f.building_code || 'MAIN',
      lat: f.lat,
      lng: f.lng,
      floors: f.floors,
      manual_status: statusRow?.manual_status || 'Available',
      effective_status: computed.effective_status,
      is_expired: computed.is_expired,
      timetable_suggestion: computed.timetable_suggestion,
      status_message: statusRow?.status_message || '',
      expected_return_time: statusRow?.expected_return_time || '',
      location_label: statusRow?.location_label || f.building_name || '',
      expires_at: statusRow?.expires_at || null,
      queue_open: statusRow ? Boolean(statusRow.queue_open) : true,
      waiting_count: queueMap.get(f.id) || 0,
      updated_at: statusRow?.updated_at || null,
      timetable,
    };
  });
}

// ======================= STUDENT ROUTES =======================

facultyFinderRoutes.get('/student/overview', requireFfAuth, requireFfRole('student'), (req: FfAuthedRequest, res) => {
  const user = req.ffUser!;
  const faculty = hydrateFacultyList(user.college_id);

  const activeQueues = ffDb
    .prepare(
      `SELECT q.*, f.full_name AS faculty_name, f.cabin_number, b.name AS building_name
       FROM ff_virtual_queue q
       JOIN ff_users f ON f.id = q.faculty_id
       LEFT JOIN ff_buildings b ON b.id = f.building_id
       WHERE q.college_id = ? AND q.student_id = ? AND q.status IN ('Waiting', 'Called')
       ORDER BY q.created_at DESC`
    )
    .all(user.college_id, user.id) as any[];

  const enrichedQueues = activeQueues.map((q) => {
    const ahead = ffDb
      .prepare(
        `SELECT COUNT(*) AS cnt FROM ff_virtual_queue
         WHERE faculty_id = ? AND status IN ('Waiting', 'Called') AND token_number < ?`
      )
      .get(q.faculty_id, q.token_number) as { cnt: number };
    return {
      ...q,
      position_ahead: ahead.cnt,
    };
  });

  const appointments = ffDb
    .prepare(
      `SELECT a.*, f.full_name AS faculty_name, f.cabin_number, d.name AS department_name, b.name AS building_name
       FROM ff_appointments a
       JOIN ff_users f ON f.id = a.faculty_id
       LEFT JOIN ff_departments d ON d.id = f.department_id
       LEFT JOIN ff_buildings b ON b.id = f.building_id
       WHERE a.college_id = ? AND a.student_id = ?
       ORDER BY a.requested_date ASC, a.created_at DESC`
    )
    .all(user.college_id, user.id);

  const recentlyViewed = ffDb
    .prepare(
      `SELECT rv.faculty_id, rv.viewed_at
       FROM ff_recently_viewed rv
       WHERE rv.college_id = ? AND rv.student_id = ?
       ORDER BY rv.viewed_at DESC
       LIMIT 4`
    )
    .all(user.college_id, user.id) as { faculty_id: number; viewed_at: string }[];

  const facultyMap = new Map(faculty.map((f) => [f.id, f]));
  const recentFaculty = recentlyViewed
    .map((r) => facultyMap.get(r.faculty_id))
    .filter(Boolean);

  const buildings = ffDb
    .prepare('SELECT * FROM ff_buildings WHERE college_id = ? ORDER BY name ASC')
    .all(user.college_id);

  const college = ffDb
    .prepare('SELECT id, name, code, city, center_lat, center_lng FROM ff_colleges WHERE id = ?')
    .get(user.college_id);

  const counts = {
    total: faculty.length,
    available: faculty.filter((f) => f.effective_status === 'Available').length,
    inLecture: faculty.filter((f) => f.effective_status === 'In Lecture').length,
    inMeeting: faculty.filter((f) => f.effective_status === 'In Meeting').length,
    awayOrLeave: faculty.filter(
      (f) => f.effective_status === 'Temporarily Away' || f.effective_status === 'On Leave' || f.effective_status === 'Busy'
    ).length,
  };

  res.json({
    college,
    counts,
    faculty,
    activeQueues: enrichedQueues,
    appointments,
    recentFaculty,
    buildings,
  });
});

facultyFinderRoutes.post('/student/faculty/:id/view', requireFfAuth, requireFfRole('student'), (req: FfAuthedRequest, res) => {
  const user = req.ffUser!;
  const facultyId = Number(req.params.id);
  const fac = ffDb
    .prepare("SELECT id FROM ff_users WHERE id = ? AND college_id = ? AND role = 'faculty'")
    .get(facultyId, user.college_id);
  if (!fac) {
    res.status(404).json({ error: 'Faculty member not found in your college.' });
    return;
  }

  ffDb
    .prepare(
      `INSERT INTO ff_recently_viewed (college_id, student_id, faculty_id, viewed_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(student_id, faculty_id) DO UPDATE SET viewed_at = datetime('now')`
    )
    .run(user.college_id, user.id, facultyId);

  res.json({ ok: true });
});

facultyFinderRoutes.post('/student/queue/join', requireFfAuth, requireFfRole('student'), (req: FfAuthedRequest, res) => {
  const user = req.ffUser!;
  const { facultyId, reason } = req.body as { facultyId?: number; reason?: string };
  const cleanReason = (reason || '').trim();
  if (!facultyId || cleanReason.length < 3) {
    res.status(400).json({ error: 'Please provide a brief reason for your visit.' });
    return;
  }

  const faculty = ffDb
    .prepare("SELECT id, full_name FROM ff_users WHERE id = ? AND college_id = ? AND role = 'faculty'")
    .get(Number(facultyId), user.college_id) as { id: number; full_name: string } | undefined;
  if (!faculty) {
    res.status(404).json({ error: 'Faculty member not found in your college.' });
    return;
  }

  const statusRow = ffDb
    .prepare('SELECT queue_open FROM ff_faculty_status WHERE faculty_id = ?')
    .get(faculty.id) as { queue_open: number } | undefined;
  if (statusRow && !statusRow.queue_open) {
    res.status(400).json({ error: `${faculty.full_name} has currently closed their virtual queue.` });
    return;
  }

  const duplicate = ffDb
    .prepare(
      "SELECT id FROM ff_virtual_queue WHERE faculty_id = ? AND student_id = ? AND status IN ('Waiting', 'Called')"
    )
    .get(faculty.id, user.id);
  if (duplicate) {
    res.status(409).json({ error: 'You are already in this faculty member’s virtual queue.' });
    return;
  }

  const maxRow = ffDb
    .prepare(
      "SELECT COALESCE(MAX(token_number), 0) AS max_token FROM ff_virtual_queue WHERE faculty_id = ? AND date(created_at) = date('now')"
    )
    .get(faculty.id) as { max_token: number };
  const tokenNumber = maxRow.max_token + 1;

  const result = ffDb
    .prepare(
      `INSERT INTO ff_virtual_queue (college_id, faculty_id, student_id, token_number, reason, status)
       VALUES (?, ?, ?, ?, ?, 'Waiting')`
    )
    .run(user.college_id, faculty.id, user.id, tokenNumber, cleanReason);

  pushFfNotification(
    user.college_id,
    faculty.id,
    'Student Joined Virtual Queue',
    `${user.full_name} (${user.identifier}) joined queue #${tokenNumber}: ${cleanReason}`
  );
  emitCollegeEvent(user.college_id, 'queue:updated', { facultyId: faculty.id });

  res.status(201).json({ id: Number(result.lastInsertRowid), token_number: tokenNumber });
});

facultyFinderRoutes.post('/student/queue/:id/cancel', requireFfAuth, requireFfRole('student'), (req: FfAuthedRequest, res) => {
  const user = req.ffUser!;
  const queueId = Number(req.params.id);
  const row = ffDb
    .prepare('SELECT * FROM ff_virtual_queue WHERE id = ? AND student_id = ? AND college_id = ?')
    .get(queueId, user.id, user.college_id) as any;
  if (!row) {
    res.status(404).json({ error: 'Queue ticket not found.' });
    return;
  }

  ffDb
    .prepare("UPDATE ff_virtual_queue SET status = 'Cancelled', updated_at = datetime('now') WHERE id = ?")
    .run(queueId);
  emitCollegeEvent(user.college_id, 'queue:updated', { facultyId: row.faculty_id });
  res.json({ ok: true });
});

facultyFinderRoutes.post('/student/appointments', requireFfAuth, requireFfRole('student'), (req: FfAuthedRequest, res) => {
  const user = req.ffUser!;
  const { facultyId, requestedDate, requestedTime, reason } = req.body as {
    facultyId?: number;
    requestedDate?: string;
    requestedTime?: string;
    reason?: string;
  };
  if (!facultyId || !requestedDate || !requestedTime || !(reason || '').trim()) {
    res.status(400).json({ error: 'Faculty, date, time, and reason are required to book an appointment.' });
    return;
  }

  const faculty = ffDb
    .prepare("SELECT id, full_name FROM ff_users WHERE id = ? AND college_id = ? AND role = 'faculty'")
    .get(Number(facultyId), user.college_id) as { id: number; full_name: string } | undefined;
  if (!faculty) {
    res.status(404).json({ error: 'Faculty member not found in your college.' });
    return;
  }

  const info = ffDb
    .prepare(
      `INSERT INTO ff_appointments (college_id, faculty_id, student_id, requested_date, requested_time, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Pending')`
    )
    .run(user.college_id, faculty.id, user.id, requestedDate, requestedTime, reason!.trim());

  pushFfNotification(
    user.college_id,
    faculty.id,
    'New Appointment Request',
    `${user.full_name} requested an appointment on ${requestedDate} at ${requestedTime}.`
  );
  emitCollegeEvent(user.college_id, 'appointment:updated', { facultyId: faculty.id });

  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

// ======================= FACULTY ROUTES =======================

facultyFinderRoutes.get('/faculty/overview', requireFfAuth, requireFfRole('faculty'), (req: FfAuthedRequest, res) => {
  const user = req.ffUser!;
  const allFaculty = hydrateFacultyList(user.college_id);
  const profile = allFaculty.find((f) => f.id === user.id);

  const queue = ffDb
    .prepare(
      `SELECT q.*, s.full_name AS student_name, s.identifier AS student_identifier, d.name AS department_name
       FROM ff_virtual_queue q
       JOIN ff_users s ON s.id = q.student_id
       LEFT JOIN ff_departments d ON d.id = s.department_id
       WHERE q.college_id = ? AND q.faculty_id = ? AND q.status IN ('Waiting', 'Called')
       ORDER BY CASE WHEN q.status = 'Called' THEN 0 ELSE 1 END, q.token_number ASC`
    )
    .all(user.college_id, user.id);

  const appointments = ffDb
    .prepare(
      `SELECT a.*, s.full_name AS student_name, s.identifier AS student_identifier, d.name AS department_name
       FROM ff_appointments a
       JOIN ff_users s ON s.id = a.student_id
       LEFT JOIN ff_departments d ON d.id = s.department_id
       WHERE a.college_id = ? AND a.faculty_id = ?
       ORDER BY CASE WHEN a.status = 'Pending' THEN 0 WHEN a.status IN ('Accepted', 'Suggested') THEN 1 ELSE 2 END, a.requested_date ASC`
    )
    .all(user.college_id, user.id);

  const buildings = ffDb
    .prepare('SELECT id, name, code FROM ff_buildings WHERE college_id = ? ORDER BY name ASC')
    .all(user.college_id);

  res.json({ profile, queue, appointments, buildings });
});

facultyFinderRoutes.put('/faculty/status', requireFfAuth, requireFfRole('faculty'), (req: FfAuthedRequest, res) => {
  const user = req.ffUser!;
  const {
    manualStatus,
    statusMessage,
    expectedReturnTime,
    locationLabel,
    durationMinutes,
    closeQueueWhenUnavailable,
  } = req.body as {
    manualStatus?: string;
    statusMessage?: string;
    expectedReturnTime?: string;
    locationLabel?: string;
    durationMinutes?: number | null;
    closeQueueWhenUnavailable?: boolean;
  };

  if (!manualStatus || !VALID_STATUSES.includes(manualStatus)) {
    res.status(400).json({ error: 'Please select a valid availability status.' });
    return;
  }

  const expiresAt =
    durationMinutes && durationMinutes > 0
      ? new Date(Date.now() + Number(durationMinutes) * 60 * 1000).toISOString()
      : null;

  const isUnavailable = manualStatus !== 'Available';
  const queueOpen = closeQueueWhenUnavailable && isUnavailable ? 0 : manualStatus === 'On Leave' ? 0 : 1;

  ffDb
    .prepare(
      `INSERT INTO ff_faculty_status (
         faculty_id, college_id, manual_status, status_message, expected_return_time,
         location_label, expires_at, queue_open, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(faculty_id) DO UPDATE SET
         manual_status = excluded.manual_status,
         status_message = excluded.status_message,
         expected_return_time = excluded.expected_return_time,
         location_label = excluded.location_label,
         expires_at = excluded.expires_at,
         queue_open = excluded.queue_open,
         updated_at = datetime('now')`
    )
    .run(
      user.id,
      user.college_id,
      manualStatus,
      (statusMessage || '').trim(),
      (expectedReturnTime || '').trim(),
      (locationLabel || '').trim(),
      expiresAt,
      queueOpen
    );

  emitCollegeEvent(user.college_id, 'faculty:status-updated', { facultyId: user.id, manualStatus });
  res.json({ ok: true });
});

facultyFinderRoutes.post('/faculty/queue/toggle', requireFfAuth, requireFfRole('faculty'), (req: FfAuthedRequest, res) => {
  const user = req.ffUser!;
  const { open } = req.body as { open?: boolean };
  const nextVal = open ? 1 : 0;

  ffDb
    .prepare("UPDATE ff_faculty_status SET queue_open = ?, updated_at = datetime('now') WHERE faculty_id = ?")
    .run(nextVal, user.id);

  if (!open) {
    ffDb
      .prepare(
        "UPDATE ff_virtual_queue SET status = 'Cancelled', updated_at = datetime('now') WHERE faculty_id = ? AND status IN ('Waiting', 'Called')"
      )
      .run(user.id);
  }

  emitCollegeEvent(user.college_id, 'queue:updated', { facultyId: user.id });
  emitCollegeEvent(user.college_id, 'faculty:status-updated', { facultyId: user.id });
  res.json({ ok: true, queue_open: Boolean(nextVal) });
});

facultyFinderRoutes.post('/faculty/queue/:id/action', requireFfAuth, requireFfRole('faculty'), (req: FfAuthedRequest, res) => {
  const user = req.ffUser!;
  const queueId = Number(req.params.id);
  const { action } = req.body as { action?: 'call' | 'skip' | 'complete' | 'cancel' };

  const ticket = ffDb
    .prepare('SELECT * FROM ff_virtual_queue WHERE id = ? AND faculty_id = ? AND college_id = ?')
    .get(queueId, user.id, user.college_id) as any;
  if (!ticket) {
    res.status(404).json({ error: 'Queue entry not found.' });
    return;
  }

  const nextStatusMap: Record<string, string> = {
    call: 'Called',
    skip: 'Skipped',
    complete: 'Completed',
    cancel: 'Cancelled',
  };
  const nextStatus = action ? nextStatusMap[action] : undefined;
  if (!nextStatus) {
    res.status(400).json({ error: 'Invalid queue action.' });
    return;
  }

  ffDb
    .prepare("UPDATE ff_virtual_queue SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(nextStatus, queueId);

  const notifCopy: Record<string, string> = {
    Called: `${user.full_name} is calling Token #${ticket.token_number}. Please proceed to cabin ${user.cabin_number || ''}.`,
    Skipped: `Token #${ticket.token_number} was marked skipped by ${user.full_name}.`,
    Completed: `Your meeting with ${user.full_name} (Token #${ticket.token_number}) has been marked completed.`,
    Cancelled: `Your queue token #${ticket.token_number} with ${user.full_name} was cancelled.`,
  };
  pushFfNotification(user.college_id, ticket.student_id, `Queue ${nextStatus}`, notifCopy[nextStatus]);
  emitCollegeEvent(user.college_id, 'queue:updated', { facultyId: user.id });

  res.json({ ok: true });
});

facultyFinderRoutes.post('/faculty/appointments/:id/action', requireFfAuth, requireFfRole('faculty'), (req: FfAuthedRequest, res) => {
  const user = req.ffUser!;
  const apptId = Number(req.params.id);
  const { action, facultyNote, suggestedTime } = req.body as {
    action?: 'accept' | 'reject' | 'suggest' | 'complete';
    facultyNote?: string;
    suggestedTime?: string;
  };

  const appt = ffDb
    .prepare('SELECT * FROM ff_appointments WHERE id = ? AND faculty_id = ? AND college_id = ?')
    .get(apptId, user.id, user.college_id) as any;
  if (!appt) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }

  const statusMap: Record<string, string> = {
    accept: 'Accepted',
    reject: 'Rejected',
    suggest: 'Suggested',
    complete: 'Completed',
  };
  const nextStatus = action ? statusMap[action] : undefined;
  if (!nextStatus) {
    res.status(400).json({ error: 'Invalid appointment action.' });
    return;
  }
  if (action === 'reject' && !(facultyNote || '').trim()) {
    res.status(400).json({ error: 'Please include a short reason when declining an appointment.' });
    return;
  }
  if (action === 'suggest' && !(suggestedTime || '').trim()) {
    res.status(400).json({ error: 'Please enter a suggested alternate time.' });
    return;
  }

  ffDb
    .prepare(
      `UPDATE ff_appointments
       SET status = ?, faculty_note = ?, suggested_time = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(nextStatus, (facultyNote || '').trim(), (suggestedTime || '').trim(), apptId);

  const summary =
    action === 'suggest'
      ? `${user.full_name} suggested an alternate time: ${suggestedTime}.`
      : `${user.full_name} marked your appointment (${appt.requested_date} ${appt.requested_time}) as ${nextStatus}.`;
  pushFfNotification(user.college_id, appt.student_id, `Appointment ${nextStatus}`, summary);
  emitCollegeEvent(user.college_id, 'appointment:updated', { facultyId: user.id });

  res.json({ ok: true });
});

facultyFinderRoutes.post('/faculty/timetable', requireFfAuth, requireFfRole('faculty'), (req: FfAuthedRequest, res) => {
  const user = req.ffUser!;
  const { dayOfWeek, startTime, endTime, subject, room, activityType } = req.body as {
    dayOfWeek?: string;
    startTime?: string;
    endTime?: string;
    subject?: string;
    room?: string;
    activityType?: string;
  };

  if (
    !dayOfWeek ||
    !VALID_DAYS.includes(dayOfWeek) ||
    !startTime ||
    !endTime ||
    startTime >= endTime ||
    !(subject || '').trim() ||
    !(room || '').trim() ||
    !activityType ||
    !VALID_ACTIVITIES.includes(activityType)
  ) {
    res.status(400).json({ error: 'Please enter a valid day, start/end time range, subject, room, and activity.' });
    return;
  }

  const overlap = ffDb
    .prepare(
      `SELECT id FROM ff_faculty_timetable
       WHERE faculty_id = ? AND day_of_week = ? AND NOT (end_time <= ? OR start_time >= ?)`
    )
    .get(user.id, dayOfWeek, startTime, endTime);
  if (overlap) {
    res.status(409).json({ error: 'This slot overlaps with an existing timetable entry on the same day.' });
    return;
  }

  const info = ffDb
    .prepare(
      `INSERT INTO ff_faculty_timetable (college_id, faculty_id, day_of_week, start_time, end_time, subject, room, activity_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(user.college_id, user.id, dayOfWeek, startTime, endTime, subject!.trim(), room!.trim(), activityType);

  emitCollegeEvent(user.college_id, 'faculty:status-updated', { facultyId: user.id });
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

facultyFinderRoutes.delete('/faculty/timetable/:id', requireFfAuth, requireFfRole('faculty'), (req: FfAuthedRequest, res) => {
  const user = req.ffUser!;
  const slotId = Number(req.params.id);
  const existing = ffDb
    .prepare('SELECT id FROM ff_faculty_timetable WHERE id = ? AND faculty_id = ?')
    .get(slotId, user.id);
  if (!existing) {
    res.status(404).json({ error: 'Timetable entry not found.' });
    return;
  }
  ffDb.prepare('DELETE FROM ff_faculty_timetable WHERE id = ?').run(slotId);
  emitCollegeEvent(user.college_id, 'faculty:status-updated', { facultyId: user.id });
  res.json({ ok: true });
});

// ======================= ADMIN ROUTES (COLLEGE-ISOLATED) =======================

facultyFinderRoutes.get('/admin/overview', requireFfAuth, requireFfRole('admin'), (req: FfAuthedRequest, res) => {
  const user = req.ffUser!;
  const faculty = hydrateFacultyList(user.college_id);
  const students = ffDb
    .prepare(
      `SELECT u.id, u.full_name, u.email, u.identifier, u.semester, d.name AS department_name
       FROM ff_users u
       LEFT JOIN ff_departments d ON d.id = u.department_id
       WHERE u.college_id = ? AND u.role = 'student'
       ORDER BY u.full_name ASC`
    )
    .all(user.college_id);
  const departments = ffDb
    .prepare('SELECT * FROM ff_departments WHERE college_id = ? ORDER BY name ASC')
    .all(user.college_id);
  const buildings = ffDb
    .prepare('SELECT * FROM ff_buildings WHERE college_id = ? ORDER BY name ASC')
    .all(user.college_id);
  const college = ffDb
    .prepare('SELECT id, name, code, city, center_lat, center_lng FROM ff_colleges WHERE id = ?')
    .get(user.college_id);

  const activeQueuesCount = (
    ffDb
      .prepare("SELECT COUNT(*) AS cnt FROM ff_virtual_queue WHERE college_id = ? AND status IN ('Waiting', 'Called')")
      .get(user.college_id) as { cnt: number }
  ).cnt;
  const pendingApptsCount = (
    ffDb
      .prepare("SELECT COUNT(*) AS cnt FROM ff_appointments WHERE college_id = ? AND status = 'Pending'")
      .get(user.college_id) as { cnt: number }
  ).cnt;

  res.json({
    college,
    faculty,
    students,
    departments,
    buildings,
    metrics: {
      facultyCount: faculty.length,
      studentCount: students.length,
      availableNow: faculty.filter((f) => f.effective_status === 'Available').length,
      activeQueuesCount,
      pendingApptsCount,
    },
  });
});

facultyFinderRoutes.post('/admin/faculty', requireFfAuth, requireFfRole('admin'), (req: FfAuthedRequest, res) => {
  const user = req.ffUser!;
  const { fullName, email, identifier, departmentId, designation, subjects, cabinNumber, buildingId, workingHours, password } =
    req.body as {
      fullName?: string;
      email?: string;
      identifier?: string;
      departmentId?: number;
      designation?: string;
      subjects?: string;
      cabinNumber?: string;
      buildingId?: number;
      workingHours?: string;
      password?: string;
    };

  if (!fullName || !email || !identifier || !password || password.length < 6) {
    res.status(400).json({ error: 'Name, email, faculty ID, and password (6+ chars) are required.' });
    return;
  }

  const subjectsList = (subjects || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const { hash, salt } = hashFfPassword(password);

  try {
    const info = ffDb
      .prepare(
        `INSERT INTO ff_users (
           college_id, email, identifier, full_name, role,
           department_id, designation, subjects_json, cabin_number, building_id, working_hours,
           password_hash, password_salt
         ) VALUES (?, ?, ?, ?, 'faculty', ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        user.college_id,
        email.trim().toLowerCase(),
        identifier.trim().toUpperCase(),
        fullName.trim(),
        departmentId ? Number(departmentId) : null,
        (designation || 'Assistant Professor').trim(),
        JSON.stringify(subjectsList),
        (cabinNumber || 'TBD').trim(),
        buildingId ? Number(buildingId) : null,
        (workingHours || '09:00 AM - 05:00 PM').trim(),
        hash,
        salt
      );
    const newId = Number(info.lastInsertRowid);
    ffDb
      .prepare(
        "INSERT INTO ff_faculty_status (faculty_id, college_id, manual_status, status_message, queue_open) VALUES (?, ?, 'Available', '', 1)"
      )
      .run(newId, user.college_id);
    emitCollegeEvent(user.college_id, 'faculty:status-updated', { facultyId: newId });
    res.status(201).json({ id: newId });
  } catch (err: any) {
    res.status(409).json({ error: 'A user with that email or faculty ID already exists.' });
  }
});

facultyFinderRoutes.post('/admin/buildings', requireFfAuth, requireFfRole('admin'), (req: FfAuthedRequest, res) => {
  const user = req.ffUser!;
  const { name, code, lat, lng, floors, description } = req.body as {
    name?: string;
    code?: string;
    lat?: number;
    lng?: number;
    floors?: string;
    description?: string;
  };
  if (!name || !code || typeof lat !== 'number' || typeof lng !== 'number') {
    res.status(400).json({ error: 'Building name, code, latitude, and longitude are required.' });
    return;
  }

  try {
    const info = ffDb
      .prepare(
        'INSERT INTO ff_buildings (college_id, name, code, lat, lng, floors, description) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(user.college_id, name.trim(), code.trim().toUpperCase(), lat, lng, (floors || 'G + 2 Floors').trim(), (description || '').trim());
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  } catch {
    res.status(409).json({ error: 'Building code already exists in your college.' });
  }
});

// ======================= NOTIFICATIONS =======================

facultyFinderRoutes.get('/notifications', requireFfAuth, (req: FfAuthedRequest, res) => {
  const user = req.ffUser!;
  const notifications = ffDb
    .prepare(
      'SELECT * FROM ff_notifications WHERE college_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 30'
    )
    .all(user.college_id, user.id) as any[];
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  res.json({ notifications, unreadCount });
});

facultyFinderRoutes.patch('/notifications/:id/read', requireFfAuth, (req: FfAuthedRequest, res) => {
  const user = req.ffUser!;
  ffDb
    .prepare('UPDATE ff_notifications SET is_read = 1 WHERE id = ? AND user_id = ? AND college_id = ?')
    .run(Number(req.params.id), user.id, user.college_id);
  res.json({ ok: true });
});

facultyFinderRoutes.post('/notifications/read-all', requireFfAuth, (req: FfAuthedRequest, res) => {
  const user = req.ffUser!;
  ffDb
    .prepare('UPDATE ff_notifications SET is_read = 1 WHERE user_id = ? AND college_id = ?')
    .run(user.id, user.college_id);
  res.json({ ok: true });
});
