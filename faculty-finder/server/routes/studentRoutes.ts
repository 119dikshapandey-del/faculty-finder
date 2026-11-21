import { Router } from 'express';
import {
  computeEffectiveFacultyStatus,
  createNotification,
  emitCollegeEvent,
  requireAuth,
  requireRole,
} from '../auth/security.ts';
import { getDb } from '../db/database.ts';

export const studentRoutes = Router();
studentRoutes.use(requireAuth, requireRole('student'));

studentRoutes.get('/faculty', (req, res) => {
  const db = getDb();
  const collegeId = req.user!.college_id;

  const rows = db
    .prepare(
      `SELECT u.id AS user_id, u.full_name, u.identifier, u.email, u.avatar_url,
              d.name AS department_name, d.code AS department_code,
              fp.designation, fp.subjects, fp.cabin_number, fp.building_id,
              b.name AS building_name, b.code AS building_code, b.latitude, b.longitude,
              fp.working_hours, fp.availability_status, fp.status_message,
              fp.approved_location, fp.expected_return_time, fp.status_expires_at,
              fp.queue_open, fp.last_updated_at
       FROM users u
       JOIN faculty_profiles fp ON fp.user_id = u.id
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN buildings b ON b.id = fp.building_id
       WHERE u.college_id = ? AND u.role = 'faculty' AND u.is_active = 1
       ORDER BY u.full_name ASC`
    )
    .all(collegeId) as any[];

  const queueCounts = db
    .prepare(
      `SELECT faculty_user_id, COUNT(*) AS waiting_count
       FROM virtual_queues
       WHERE college_id = ? AND status IN ('waiting', 'called')
       GROUP BY faculty_user_id`
    )
    .all(collegeId) as { faculty_user_id: number; waiting_count: number }[];
  const countMap = new Map(queueCounts.map((q) => [q.faculty_user_id, q.waiting_count]));

  const faculty = rows.map((row) => {
    const statusInfo = computeEffectiveFacultyStatus(
      row.user_id,
      row.availability_status,
      row.status_expires_at
    );
    return {
      ...row,
      effective_status: statusInfo.effectiveStatus,
      is_status_expired: statusInfo.isExpired,
      timetable_suggestion: statusInfo.timetableSuggestion,
      waiting_count: countMap.get(row.user_id) || 0,
    };
  });

  res.json({ faculty });
});

studentRoutes.get('/faculty/:facultyUserId', (req, res) => {
  const db = getDb();
  const facultyUserId = Number(req.params.facultyUserId);
  const collegeId = req.user!.college_id;

  const row = db
    .prepare(
      `SELECT u.id AS user_id, u.full_name, u.identifier, u.email, u.avatar_url,
              d.name AS department_name, d.code AS department_code,
              fp.designation, fp.subjects, fp.cabin_number, fp.building_id,
              b.name AS building_name, b.code AS building_code, b.latitude, b.longitude,
              fp.working_hours, fp.availability_status, fp.status_message,
              fp.approved_location, fp.expected_return_time, fp.status_expires_at,
              fp.queue_open, fp.last_updated_at
       FROM users u
       JOIN faculty_profiles fp ON fp.user_id = u.id
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN buildings b ON b.id = fp.building_id
       WHERE u.id = ? AND u.college_id = ? AND u.role = 'faculty'`
    )
    .get(facultyUserId, collegeId) as any;

  if (!row) {
    res.status(404).json({ error: 'Faculty member not found in your college.' });
    return;
  }

  const statusInfo = computeEffectiveFacultyStatus(
    row.user_id,
    row.availability_status,
    row.status_expires_at
  );

  const timetable = db
    .prepare(
      `SELECT id, day_of_week, start_time, end_time, subject_name, room_label, suggested_status
       FROM faculty_timetable
       WHERE faculty_user_id = ? AND college_id = ?
       ORDER BY day_of_week ASC, start_time ASC`
    )
    .all(facultyUserId, collegeId);

  const waitingCount = (
    db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM virtual_queues
         WHERE faculty_user_id = ? AND college_id = ? AND status IN ('waiting', 'called')`
      )
      .get(facultyUserId, collegeId) as { cnt: number }
  ).cnt;

  res.json({
    faculty: {
      ...row,
      effective_status: statusInfo.effectiveStatus,
      is_status_expired: statusInfo.isExpired,
      timetable_suggestion: statusInfo.timetableSuggestion,
      waiting_count: waitingCount,
    },
    timetable,
  });
});

studentRoutes.get('/overview', (req, res) => {
  const db = getDb();
  const collegeId = req.user!.college_id;
  const studentId = req.user!.id;

  const queues = db
    .prepare(
      `SELECT vq.*, u.full_name AS faculty_name, fp.cabin_number, b.name AS building_name
       FROM virtual_queues vq
       JOIN users u ON u.id = vq.faculty_user_id
       JOIN faculty_profiles fp ON fp.user_id = u.id
       LEFT JOIN buildings b ON b.id = fp.building_id
       WHERE vq.student_user_id = ? AND vq.college_id = ?
       ORDER BY vq.id DESC LIMIT 20`
    )
    .all(studentId, collegeId) as any[];

  const enrichedQueues = queues.map((q) => {
    let position = 0;
    if (q.status === 'waiting') {
      const ahead = db
        .prepare(
          `SELECT COUNT(*) AS cnt FROM virtual_queues
           WHERE faculty_user_id = ? AND college_id = ? AND status = 'waiting' AND id < ?`
        )
        .get(q.faculty_user_id, collegeId, q.id) as { cnt: number };
      position = ahead.cnt + 1;
    } else if (q.status === 'called') {
      position = 0;
    }
    return { ...q, position };
  });

  const appointments = db
    .prepare(
      `SELECT a.*, u.full_name AS faculty_name, fp.cabin_number, b.name AS building_name
       FROM appointments a
       JOIN users u ON u.id = a.faculty_user_id
       JOIN faculty_profiles fp ON fp.user_id = u.id
       LEFT JOIN buildings b ON b.id = fp.building_id
       WHERE a.student_user_id = ? AND a.college_id = ?
       ORDER BY a.requested_date ASC, a.id DESC`
    )
    .all(studentId, collegeId);

  const buildings = db
    .prepare('SELECT * FROM buildings WHERE college_id = ? ORDER BY name ASC')
    .all(collegeId);

  const college = db
    .prepare('SELECT id, name, code, city, center_lat, center_lng FROM colleges WHERE id = ?')
    .get(collegeId);

  res.json({ queues: enrichedQueues, appointments, buildings, college });
});

studentRoutes.post('/queue/join', (req, res) => {
  const db = getDb();
  const { facultyUserId, reason } = req.body || {};
  const collegeId = req.user!.college_id;
  const studentId = req.user!.id;

  if (!facultyUserId || !reason || !String(reason).trim()) {
    res.status(400).json({ error: 'Faculty member and reason for visit are required.' });
    return;
  }

  const fp = db
    .prepare(
      `SELECT fp.queue_open, u.full_name
       FROM faculty_profiles fp
       JOIN users u ON u.id = fp.user_id
       WHERE fp.user_id = ? AND fp.college_id = ?`
    )
    .get(Number(facultyUserId), collegeId) as { queue_open: number; full_name: string } | undefined;

  if (!fp) {
    res.status(404).json({ error: 'Faculty member not found.' });
    return;
  }
  if (!fp.queue_open) {
    res.status(400).json({ error: `${fp.full_name}'s virtual queue is currently closed.` });
    return;
  }

  const existing = db
    .prepare(
      `SELECT id FROM virtual_queues
       WHERE faculty_user_id = ? AND student_user_id = ? AND status IN ('waiting', 'called')`
    )
    .get(Number(facultyUserId), studentId);

  if (existing) {
    res.status(400).json({ error: 'You already have an active token in this faculty queue.' });
    return;
  }

  const lastToken = db
    .prepare(
      `SELECT COALESCE(MAX(token_number), 0) AS max_token
       FROM virtual_queues
       WHERE faculty_user_id = ? AND date(created_at) = date('now')`
    )
    .get(Number(facultyUserId)) as { max_token: number };
  const nextToken = lastToken.max_token + 1;

  const insertRes = db
    .prepare(
      `INSERT INTO virtual_queues (college_id, faculty_user_id, student_user_id, token_number, reason, status)
       VALUES (?, ?, ?, ?, ?, 'waiting')`
    )
    .run(collegeId, Number(facultyUserId), studentId, nextToken, String(reason).trim());

  createNotification(
    collegeId,
    Number(facultyUserId),
    'New Queue Token',
    `${req.user!.full_name} joined your virtual queue (Token #${nextToken}).`,
    'queue'
  );
  emitCollegeEvent(collegeId, 'queue:updated', { facultyUserId: Number(facultyUserId) });

  res.status(201).json({ id: Number(insertRes.lastInsertRowid), tokenNumber: nextToken });
});

studentRoutes.post('/queue/:id/cancel', (req, res) => {
  const db = getDb();
  const row = db
    .prepare('SELECT id, faculty_user_id FROM virtual_queues WHERE id = ? AND student_user_id = ? AND college_id = ?')
    .get(Number(req.params.id), req.user!.id, req.user!.college_id) as
    | { id: number; faculty_user_id: number }
    | undefined;

  if (!row) {
    res.status(404).json({ error: 'Queue entry not found.' });
    return;
  }

  db.prepare("UPDATE virtual_queues SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(row.id);
  emitCollegeEvent(req.user!.college_id, 'queue:updated', { facultyUserId: row.faculty_user_id });
  res.json({ ok: true });
});

studentRoutes.post('/appointments', (req, res) => {
  const db = getDb();
  const { facultyUserId, requestedDate, requestedSlot, reason } = req.body || {};
  const collegeId = req.user!.college_id;

  if (!facultyUserId || !requestedDate || !requestedSlot || !reason) {
    res.status(400).json({ error: 'Faculty, date, time slot, and reason are required.' });
    return;
  }

  const faculty = db
    .prepare("SELECT id, full_name FROM users WHERE id = ? AND college_id = ? AND role = 'faculty'")
    .get(Number(facultyUserId), collegeId) as { id: number; full_name: string } | undefined;

  if (!faculty) {
    res.status(404).json({ error: 'Faculty member not found.' });
    return;
  }

  const result = db
    .prepare(
      `INSERT INTO appointments (college_id, faculty_user_id, student_user_id, requested_date, requested_slot, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    )
    .run(
      collegeId,
      faculty.id,
      req.user!.id,
      String(requestedDate),
      String(requestedSlot).trim(),
      String(reason).trim()
    );

  createNotification(
    collegeId,
    faculty.id,
    'New Appointment Request',
    `${req.user!.full_name} requested an appointment on ${requestedDate} (${requestedSlot}).`,
    'appointment'
  );
  emitCollegeEvent(collegeId, 'appointments:updated', { facultyUserId: faculty.id });

  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

studentRoutes.post('/appointments/:id/cancel', (req, res) => {
  const db = getDb();
  const row = db
    .prepare('SELECT id, faculty_user_id FROM appointments WHERE id = ? AND student_user_id = ? AND college_id = ?')
    .get(Number(req.params.id), req.user!.id, req.user!.college_id) as
    | { id: number; faculty_user_id: number }
    | undefined;

  if (!row) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }

  db.prepare("UPDATE appointments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(row.id);
  emitCollegeEvent(req.user!.college_id, 'appointments:updated', { facultyUserId: row.faculty_user_id });
  res.json({ ok: true });
});
