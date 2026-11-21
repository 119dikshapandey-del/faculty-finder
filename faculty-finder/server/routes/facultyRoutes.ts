import { Router } from 'express';
import {
  computeEffectiveFacultyStatus,
  createNotification,
  emitCollegeEvent,
  logActivity,
  requireAuth,
  requireRole,
} from '../auth/security.ts';
import { getDb } from '../db/database.ts';

export const facultyRoutes = Router();
facultyRoutes.use(requireAuth, requireRole('faculty'));

const ALLOWED_STATUSES = [
  'Available',
  'In Lecture',
  'In Meeting',
  'Temporarily Away',
  'Busy',
  'On Leave',
];

facultyRoutes.get('/dashboard', (req, res) => {
  const db = getDb();
  const facultyId = req.user!.id;
  const collegeId = req.user!.college_id;

  const profile = db
    .prepare(
      `SELECT fp.*, b.name AS building_name, b.code AS building_code
       FROM faculty_profiles fp
       LEFT JOIN buildings b ON b.id = fp.building_id
       WHERE fp.user_id = ? AND fp.college_id = ?`
    )
    .get(facultyId, collegeId) as any;

  const statusInfo = profile
    ? computeEffectiveFacultyStatus(facultyId, profile.availability_status, profile.status_expires_at)
    : { effectiveStatus: 'Status Not Confirmed', isExpired: true, timetableSuggestion: null };

  const queue = db
    .prepare(
      `SELECT vq.*, u.full_name AS student_name, u.identifier AS student_identifier,
              d.name AS student_department
       FROM virtual_queues vq
       JOIN users u ON u.id = vq.student_user_id
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE vq.faculty_user_id = ? AND vq.college_id = ?
         AND vq.status IN ('waiting', 'called')
       ORDER BY CASE WHEN vq.status = 'called' THEN 0 ELSE 1 END, vq.id ASC`
    )
    .all(facultyId, collegeId);

  const appointments = db
    .prepare(
      `SELECT a.*, u.full_name AS student_name, u.identifier AS student_identifier,
              u.email AS student_email, d.name AS student_department
       FROM appointments a
       JOIN users u ON u.id = a.student_user_id
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE a.faculty_user_id = ? AND a.college_id = ?
       ORDER BY CASE WHEN a.status = 'pending' THEN 0 ELSE 1 END, a.requested_date ASC, a.id DESC`
    )
    .all(facultyId, collegeId);

  const timetable = db
    .prepare(
      `SELECT * FROM faculty_timetable
       WHERE faculty_user_id = ? AND college_id = ?
       ORDER BY day_of_week ASC, start_time ASC`
    )
    .all(facultyId, collegeId);

  const buildings = db
    .prepare('SELECT id, name, code, floors FROM buildings WHERE college_id = ? ORDER BY name ASC')
    .all(collegeId);

  res.json({
    profile: profile
      ? {
          ...profile,
          effective_status: statusInfo.effectiveStatus,
          is_status_expired: statusInfo.isExpired,
          timetable_suggestion: statusInfo.timetableSuggestion,
        }
      : null,
    queue,
    appointments,
    timetable,
    buildings,
  });
});

facultyRoutes.put('/availability', (req, res) => {
  const db = getDb();
  const {
    availabilityStatus,
    statusMessage,
    approvedLocation,
    expectedReturnTime,
    durationMinutes,
    queueOpen,
    workingHours,
  } = req.body || {};

  if (!ALLOWED_STATUSES.includes(availabilityStatus)) {
    res.status(400).json({ error: 'Invalid availability status.' });
    return;
  }

  const mins = Number(durationMinutes || 120);
  const statusExpiresAt = mins > 0 ? new Date(Date.now() + mins * 60 * 1000).toISOString() : null;
  const shouldQueueOpen = queueOpen ? 1 : 0;

  db.prepare(
    `UPDATE faculty_profiles
     SET availability_status = ?,
         status_message = ?,
         approved_location = ?,
         expected_return_time = ?,
         status_expires_at = ?,
         queue_open = ?,
         working_hours = COALESCE(?, working_hours),
         last_updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND college_id = ?`
  ).run(
    availabilityStatus,
    String(statusMessage || '').trim(),
    String(approvedLocation || '').trim(),
    String(expectedReturnTime || '').trim(),
    statusExpiresAt,
    shouldQueueOpen,
    workingHours ? String(workingHours).trim() : null,
    req.user!.id,
    req.user!.college_id
  );

  logActivity(
    req.user!.college_id,
    req.user!.id,
    'FACULTY_STATUS_UPDATE',
    `${req.user!.full_name} updated status to ${availabilityStatus}`
  );
  emitCollegeEvent(req.user!.college_id, 'faculty:updated', { facultyUserId: req.user!.id });

  res.json({ ok: true });
});

facultyRoutes.post('/queue/call-next', (req, res) => {
  const db = getDb();
  const facultyId = req.user!.id;
  const collegeId = req.user!.college_id;

  const currentCalled = db
    .prepare(
      `SELECT id FROM virtual_queues
       WHERE faculty_user_id = ? AND college_id = ? AND status = 'called'`
    )
    .get(facultyId, collegeId) as { id: number } | undefined;

  if (currentCalled) {
    db.prepare("UPDATE virtual_queues SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
      currentCalled.id
    );
  }

  const nextWaiting = db
    .prepare(
      `SELECT id, student_user_id, token_number FROM virtual_queues
       WHERE faculty_user_id = ? AND college_id = ? AND status = 'waiting'
       ORDER BY id ASC LIMIT 1`
    )
    .get(facultyId, collegeId) as { id: number; student_user_id: number; token_number: number } | undefined;

  if (!nextWaiting) {
    emitCollegeEvent(collegeId, 'queue:updated', { facultyUserId: facultyId });
    res.json({ called: null, message: 'No students waiting in queue.' });
    return;
  }

  db.prepare("UPDATE virtual_queues SET status = 'called', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
    nextWaiting.id
  );
  createNotification(
    collegeId,
    nextWaiting.student_user_id,
    'Your Queue Turn Has Arrived',
    `${req.user!.full_name} is calling Token #${nextWaiting.token_number}. Please proceed to their cabin.`,
    'queue'
  );
  emitCollegeEvent(collegeId, 'queue:updated', { facultyUserId: facultyId });

  res.json({ called: nextWaiting });
});

facultyRoutes.post('/queue/:id/action', (req, res) => {
  const db = getDb();
  const { action } = req.body || {};
  if (!['completed', 'skipped', 'called'].includes(action)) {
    res.status(400).json({ error: 'Invalid queue action.' });
    return;
  }

  const entry = db
    .prepare('SELECT id, student_user_id, token_number FROM virtual_queues WHERE id = ? AND faculty_user_id = ? AND college_id = ?')
    .get(Number(req.params.id), req.user!.id, req.user!.college_id) as
    | { id: number; student_user_id: number; token_number: number }
    | undefined;

  if (!entry) {
    res.status(404).json({ error: 'Queue entry not found.' });
    return;
  }

  db.prepare('UPDATE virtual_queues SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(action, entry.id);
  if (action === 'skipped') {
    createNotification(
      req.user!.college_id,
      entry.student_user_id,
      'Queue Token Skipped',
      `Your Token #${entry.token_number} with ${req.user!.full_name} was marked skipped.`,
      'queue'
    );
  }
  emitCollegeEvent(req.user!.college_id, 'queue:updated', { facultyUserId: req.user!.id });
  res.json({ ok: true });
});

facultyRoutes.post('/queue/close-clear', (req, res) => {
  const db = getDb();
  const { closeQueue, cancelWaiting } = req.body || {};

  if (typeof closeQueue === 'boolean') {
    db.prepare('UPDATE faculty_profiles SET queue_open = ? WHERE user_id = ? AND college_id = ?').run(
      closeQueue ? 0 : 1,
      req.user!.id,
      req.user!.college_id
    );
  }

  if (cancelWaiting) {
    const waiting = db
      .prepare(
        `SELECT id, student_user_id, token_number FROM virtual_queues
         WHERE faculty_user_id = ? AND college_id = ? AND status IN ('waiting', 'called')`
      )
      .all(req.user!.id, req.user!.college_id) as { id: number; student_user_id: number; token_number: number }[];

    db.prepare(
      `UPDATE virtual_queues SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE faculty_user_id = ? AND college_id = ? AND status IN ('waiting', 'called')`
    ).run(req.user!.id, req.user!.college_id);

    for (const w of waiting) {
      createNotification(
        req.user!.college_id,
        w.student_user_id,
        'Virtual Queue Closed',
        `${req.user!.full_name} closed their virtual queue (Token #${w.token_number}).`,
        'queue'
      );
    }
  }

  emitCollegeEvent(req.user!.college_id, 'queue:updated', { facultyUserId: req.user!.id });
  emitCollegeEvent(req.user!.college_id, 'faculty:updated', { facultyUserId: req.user!.id });
  res.json({ ok: true });
});

facultyRoutes.patch('/appointments/:id', (req, res) => {
  const db = getDb();
  const { status, facultyNote, suggestedSlot } = req.body || {};
  if (!['approved', 'rejected', 'rescheduled', 'completed'].includes(status)) {
    res.status(400).json({ error: 'Invalid appointment status.' });
    return;
  }

  const appt = db
    .prepare('SELECT id, student_user_id, requested_date, requested_slot FROM appointments WHERE id = ? AND faculty_user_id = ? AND college_id = ?')
    .get(Number(req.params.id), req.user!.id, req.user!.college_id) as any;

  if (!appt) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }

  if (status === 'rejected' && (!facultyNote || !String(facultyNote).trim())) {
    res.status(400).json({ error: 'Please provide a reason when rejecting an appointment.' });
    return;
  }

  if (status === 'rescheduled' && (!suggestedSlot || !String(suggestedSlot).trim())) {
    res.status(400).json({ error: 'Please suggest another time slot.' });
    return;
  }

  db.prepare(
    `UPDATE appointments
     SET status = ?, faculty_note = ?, suggested_slot = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(status, String(facultyNote || '').trim(), String(suggestedSlot || '').trim(), appt.id);

  createNotification(
    req.user!.college_id,
    appt.student_user_id,
    `Appointment ${status.charAt(0).toUpperCase() + status.slice(1)}`,
    `${req.user!.full_name} marked your appointment (${appt.requested_date} · ${appt.requested_slot}) as ${status}.${
      suggestedSlot ? ` Suggested slot: ${suggestedSlot}.` : ''
    }${facultyNote ? ` Note: ${facultyNote}` : ''}`,
    'appointment'
  );
  emitCollegeEvent(req.user!.college_id, 'appointments:updated', { facultyUserId: req.user!.id });

  res.json({ ok: true });
});

facultyRoutes.post('/timetable', (req, res) => {
  const db = getDb();
  const { dayOfWeek, startTime, endTime, subjectName, roomLabel, suggestedStatus } = req.body || {};
  const day = Number(dayOfWeek);

  if (Number.isNaN(day) || day < 0 || day > 6 || !startTime || !endTime || !subjectName || !roomLabel) {
    res.status(400).json({ error: 'Day, start time, end time, subject, and room are required.' });
    return;
  }
  if (String(startTime) >= String(endTime)) {
    res.status(400).json({ error: 'End time must be after start time.' });
    return;
  }

  const overlap = db
    .prepare(
      `SELECT id FROM faculty_timetable
       WHERE faculty_user_id = ? AND day_of_week = ? AND NOT (end_time <= ? OR start_time >= ?)`
    )
    .get(req.user!.id, day, String(startTime), String(endTime));

  if (overlap) {
    res.status(400).json({ error: 'This time slot overlaps with an existing timetable entry.' });
    return;
  }

  const inserted = db
    .prepare(
      `INSERT INTO faculty_timetable (faculty_user_id, college_id, day_of_week, start_time, end_time, subject_name, room_label, suggested_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user!.id,
      req.user!.college_id,
      day,
      String(startTime),
      String(endTime),
      String(subjectName).trim(),
      String(roomLabel).trim(),
      String(suggestedStatus || 'In Lecture')
    );

  res.status(201).json({ id: Number(inserted.lastInsertRowid) });
});

facultyRoutes.delete('/timetable/:id', (req, res) => {
  getDb()
    .prepare('DELETE FROM faculty_timetable WHERE id = ? AND faculty_user_id = ? AND college_id = ?')
    .run(Number(req.params.id), req.user!.id, req.user!.college_id);
  res.json({ ok: true });
});
