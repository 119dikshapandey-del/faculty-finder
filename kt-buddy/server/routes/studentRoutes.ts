import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { db } from '../db/database.ts';
import {
  type AuthedRequest,
  isValidDateYYYYMMDD,
  logActivity,
  requireAuth,
  requireRole,
  sanitizeText,
} from '../auth/security.ts';
import {
  ALLOWED_DOC_EXTENSIONS,
  buildSimplePdfBuffer,
  MAX_UPLOAD_SIZE_BYTES,
  saveBufferToUploads,
} from '../utils/fileStorage.ts';

export const studentRoutes = Router();

studentRoutes.use(requireAuth, requireRole('student'));

const supportingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
});

function getStudentContext(userId: number, collegeId: number) {
  return db
    .prepare(
      `SELECT
         s.*, u.full_name, u.email, u.identifier, u.is_active,
         d.name AS department_name, d.code AS department_code,
         cr.name AS course_name, cr.code AS course_code,
         c.name AS college_name, c.code AS college_code
       FROM students s
       JOIN users u ON u.id = s.user_id
       JOIN departments d ON d.id = s.department_id
       JOIN courses cr ON cr.id = s.course_id
       JOIN colleges c ON c.id = s.college_id
       WHERE s.user_id = ? AND s.college_id = ?`
    )
    .get(userId, collegeId) as Record<string, any> | undefined;
}

studentRoutes.get('/profile', (req: AuthedRequest, res) => {
  const user = req.user!;
  const profile = getStudentContext(user.id, user.college_id);
  if (!profile) {
    res.status(404).json({ error: 'Student profile not found.' });
    return;
  }
  res.json({ profile });
});

studentRoutes.get('/dashboard', (req: AuthedRequest, res) => {
  const user = req.user!;
  const studentId = user.student_id!;
  const profile = getStudentContext(user.id, user.college_id);
  if (!profile) {
    res.status(404).json({ error: 'Student profile not found.' });
    return;
  }

  const ktSubjects = db
    .prepare(
      `SELECT
         sk.*,
         sub.subject_code, sub.subject_name, sub.credits,
         vu.full_name AS verified_by_name,
         (
           SELECT MIN(es.exam_date)
           FROM exam_schedules es
           WHERE es.college_id = sk.college_id
             AND es.subject_id = sk.subject_id
             AND es.exam_date >= date('now')
         ) AS next_exam_date
       FROM student_kt sk
       JOIN subjects sub ON sub.id = sk.subject_id
       LEFT JOIN users vu ON vu.id = sk.verified_by
       WHERE sk.student_id = ? AND sk.college_id = ?
       ORDER BY
         CASE sk.clearance_status
           WHEN 'KT' THEN 1
           WHEN 'Revaluation Pending' THEN 2
           WHEN 'Under Verification' THEN 3
           WHEN 'Result Awaited' THEN 4
           WHEN 'Cleared' THEN 5
           ELSE 6
         END,
         sk.semester ASC,
         sub.subject_code ASC`
    )
    .all(studentId, user.college_id) as Array<Record<string, any>>;

  const totalKtSubjects = ktSubjects.length;
  const clearedSubjects = ktSubjects.filter((s) => s.clearance_status === 'Cleared').length;
  const remainingSubjects = ktSubjects.filter((s) => s.clearance_status !== 'Cleared').length;
  const confirmedActiveKt = ktSubjects.filter((s) => s.clearance_status === 'KT').length;
  const clearanceProgressPercent = totalKtSubjects > 0 ? Math.round((clearedSubjects / totalKtSubjects) * 100) : 100;

  // Upcoming KT exams relevant to student's non-cleared KT subjects or course
  const upcomingExams = db
    .prepare(
      `SELECT
         es.*,
         sub.subject_code, sub.subject_name,
         CASE WHEN EXISTS (
           SELECT 1 FROM student_kt sk
           WHERE sk.student_id = ? AND sk.subject_id = es.subject_id AND sk.clearance_status != 'Cleared'
         ) THEN 1 ELSE 0 END AS is_personal_kt
       FROM exam_schedules es
       JOIN subjects sub ON sub.id = es.subject_id
       WHERE es.college_id = ?
         AND es.course_id = ?
         AND es.exam_date >= date('now')
       ORDER BY is_personal_kt DESC, es.exam_date ASC, es.start_time ASC
       LIMIT 8`
    )
    .all(studentId, user.college_id, profile.course_id) as Array<Record<string, any>>;

  const personalUpcomingExamCount = upcomingExams.filter((e) => e.is_personal_kt === 1).length;

  const announcements = db
    .prepare(
      `SELECT a.*, d.name AS department_name, cr.name AS course_name
       FROM announcements a
       LEFT JOIN departments d ON d.id = a.target_department_id
       LEFT JOIN courses cr ON cr.id = a.target_course_id
       WHERE a.college_id = ?
         AND a.publish_date <= date('now')
         AND (a.expiry_date IS NULL OR a.expiry_date >= date('now'))
         AND (a.target_department_id IS NULL OR a.target_department_id = ?)
         AND (a.target_course_id IS NULL OR a.target_course_id = ?)
         AND (a.target_semester IS NULL OR a.target_semester = ?)
       ORDER BY a.publish_date DESC, a.id DESC
       LIMIT 5`
    )
    .all(user.college_id, profile.department_id, profile.course_id, profile.semester);

  const recentMaterials = db
    .prepare(
      `SELECT sm.*, sub.subject_code, sub.subject_name
       FROM study_materials sm
       JOIN subjects sub ON sub.id = sm.subject_id
       WHERE sm.college_id = ? AND sm.course_id = ?
       ORDER BY sm.created_at DESC, sm.id DESC
       LIMIT 5`
    )
    .all(user.college_id, profile.course_id);

  const latestResults = db
    .prepare(
      `SELECT rr.*, vu.full_name AS verified_by_name
       FROM result_records rr
       LEFT JOIN users vu ON vu.id = rr.verified_by
       WHERE rr.college_id = ? AND rr.student_id = ?
       ORDER BY rr.updated_at DESC, rr.id DESC
       LIMIT 6`
    )
    .all(user.college_id, studentId);

  res.json({
    profile,
    stats: {
      totalKtSubjects,
      clearedSubjects,
      remainingSubjects,
      confirmedActiveKt,
      upcomingExamsCount: personalUpcomingExamCount || upcomingExams.length,
      clearanceProgressPercent,
    },
    ktSubjects,
    upcomingExams,
    announcements,
    recentMaterials,
    latestResults,
  });
});

studentRoutes.get('/kt-subjects', (req: AuthedRequest, res) => {
  const user = req.user!;
  const studentId = user.student_id!;
  const semester = req.query.semester ? Number(req.query.semester) : null;
  const status = sanitizeText(req.query.status, 40);
  const q = sanitizeText(req.query.q, 80).toLowerCase();

  let sql = `
    SELECT
      sk.*,
      sub.subject_code, sub.subject_name, sub.credits,
      d.name AS department_name, cr.name AS course_name,
      vu.full_name AS verified_by_name,
      (SELECT COUNT(*) FROM syllabus syl WHERE syl.subject_id = sk.subject_id AND syl.college_id = sk.college_id) AS syllabus_count,
      (SELECT COUNT(*) FROM study_materials sm WHERE sm.subject_id = sk.subject_id AND sm.college_id = sk.college_id) AS material_count,
      (SELECT MIN(es.exam_date) FROM exam_schedules es WHERE es.subject_id = sk.subject_id AND es.college_id = sk.college_id AND es.exam_date >= date('now')) AS next_exam_date
    FROM student_kt sk
    JOIN subjects sub ON sub.id = sk.subject_id
    JOIN departments d ON d.id = sub.department_id
    JOIN courses cr ON cr.id = sub.course_id
    LEFT JOIN users vu ON vu.id = sk.verified_by
    WHERE sk.student_id = ? AND sk.college_id = ?
  `;
  const params: Array<string | number> = [studentId, user.college_id];

  if (semester && Number.isInteger(semester)) {
    sql += ' AND sk.semester = ?';
    params.push(semester);
  }
  if (status && status !== 'All') {
    sql += ' AND sk.clearance_status = ?';
    params.push(status);
  }
  if (q) {
    sql += ' AND (LOWER(sub.subject_name) LIKE ? OR LOWER(sub.subject_code) LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  sql += ' ORDER BY sk.semester ASC, sub.subject_code ASC';
  const subjects = db.prepare(sql).all(...params);
  res.json({ subjects });
});

studentRoutes.get('/results', (req: AuthedRequest, res) => {
  const user = req.user!;
  const studentId = user.student_id!;

  const subjectResults = db
    .prepare(
      `SELECT
         sk.*,
         sub.subject_code, sub.subject_name, sub.credits,
         vu.full_name AS verified_by_name
       FROM student_kt sk
       JOIN subjects sub ON sub.id = sk.subject_id
       LEFT JOIN users vu ON vu.id = sk.verified_by
       WHERE sk.student_id = ? AND sk.college_id = ?
       ORDER BY sk.semester ASC, sub.subject_code ASC`
    )
    .all(studentId, user.college_id) as Array<Record<string, any>>;

  const history = db
    .prepare(
      `SELECT rr.*, vu.full_name AS verified_by_name
       FROM result_records rr
       LEFT JOIN users vu ON vu.id = rr.verified_by
       WHERE rr.student_id = ? AND rr.college_id = ?
       ORDER BY rr.created_at DESC, rr.id DESC`
    )
    .all(studentId, user.college_id);

  const total = subjectResults.length;
  const cleared = subjectResults.filter((r) => r.clearance_status === 'Cleared').length;
  const remaining = total - cleared;
  const progressPercent = total > 0 ? Math.round((cleared / total) * 100) : 100;

  // Subjects in student's course for optional supporting result submission dropdown
  const courseSubjects = db
    .prepare(
      `SELECT id, subject_code, subject_name, semester
       FROM subjects
       WHERE college_id = ? AND course_id = ?
       ORDER BY semester ASC, subject_code ASC`
    )
    .all(user.college_id, user.course_id || 0);

  res.json({
    summary: { total, cleared, remaining, progressPercent },
    subjectResults,
    history,
    courseSubjects,
  });
});

// Optional student supporting result submission — strictly labeled 'Pending Verification' until Admin verifies
studentRoutes.post('/supporting-result', supportingUpload.single('supportingFile'), (req: AuthedRequest, res) => {
  const user = req.user!;
  const studentId = user.student_id!;
  const subjectCode = sanitizeText(req.body?.subjectCode, 30).toUpperCase();
  const academicYear = sanitizeText(req.body?.academicYear, 20) || '2025-26';
  const attemptNumber = Math.min(Math.max(Number(req.body?.attemptNumber || 1), 1), 10);
  const claimedStatus = sanitizeText(req.body?.claimedStatus, 30);
  const declarationDate = sanitizeText(req.body?.declarationDate, 20);
  const remarks = sanitizeText(req.body?.remarks, 300);

  const ALLOWED_CLAIMS = ['Cleared', 'Revaluation Pending', 'Result Awaited', 'KT'];
  if (!subjectCode || !ALLOWED_CLAIMS.includes(claimedStatus)) {
    res.status(400).json({ error: 'Valid subject code and claimed result status are required.' });
    return;
  }
  if (declarationDate && !isValidDateYYYYMMDD(declarationDate)) {
    res.status(400).json({ error: 'Declaration date must be in YYYY-MM-DD format.' });
    return;
  }

  const subject = db
    .prepare('SELECT id, subject_code, subject_name, semester FROM subjects WHERE college_id = ? AND UPPER(subject_code) = ?')
    .get(user.college_id, subjectCode) as
    | { id: number; subject_code: string; subject_name: string; semester: number }
    | undefined;

  if (!subject) {
    res.status(404).json({ error: 'Subject code not found in your college catalog.' });
    return;
  }

  let storedPath: string | null = null;
  if (req.file) {
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!ALLOWED_DOC_EXTENSIONS.has(ext)) {
      res.status(400).json({ error: 'Unsupported file type. Upload PDF, DOC, DOCX, PNG, or JPG.' });
      return;
    }
    const saved = saveBufferToUploads(req.file.buffer, req.file.originalname);
    storedPath = saved.storedPath;
  }

  const existingKt = db
    .prepare('SELECT id, clearance_status FROM student_kt WHERE student_id = ? AND subject_id = ? ORDER BY id DESC LIMIT 1')
    .get(studentId, subject.id) as { id: number; clearance_status: string } | undefined;

  const insert = db
    .prepare(
      `INSERT INTO result_records
       (college_id, student_id, student_kt_id, roll_number, subject_code, subject_name, semester, academic_year, attempt_number, raw_result_status, mapped_status, previous_status, result_declaration_date, verification_status, supporting_file_path, imported_by, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Verification', ?, ?, ?)`
    )
    .run(
      user.college_id,
      studentId,
      existingKt?.id || null,
      user.roll_number || user.identifier,
      subject.subject_code,
      subject.subject_name,
      subject.semester,
      academicYear,
      attemptNumber,
      `STUDENT_SUBMITTED:${claimedStatus.toUpperCase()}`,
      claimedStatus,
      existingKt?.clearance_status || null,
      declarationDate || null,
      storedPath,
      user.id,
      remarks || 'Student supporting result document submitted — Pending Verification by Admin'
    );

  logActivity(
    user.college_id,
    user.id,
    'STUDENT_SUPPORTING_RESULT',
    'result_records',
    insert.lastInsertRowid as number,
    `${user.roll_number} submitted ${subject.subject_code} (${claimedStatus}) — Pending Verification`
  );

  res.status(201).json({
    message: 'Supporting result submitted as Pending Verification. Only an administrator can update your official KT status.',
    recordId: insert.lastInsertRowid,
  });
});

studentRoutes.get('/timetable', (req: AuthedRequest, res) => {
  const user = req.user!;
  const studentId = user.student_id!;
  const semester = req.query.semester ? Number(req.query.semester) : null;
  const upcomingOnly = req.query.upcomingOnly === 'true';

  let sql = `
    SELECT
      es.*,
      sub.subject_code, sub.subject_name,
      cr.name AS course_name,
      CASE WHEN EXISTS (
        SELECT 1 FROM student_kt sk
        WHERE sk.student_id = ? AND sk.subject_id = es.subject_id AND sk.clearance_status != 'Cleared'
      ) THEN 1 ELSE 0 END AS is_personal_kt
    FROM exam_schedules es
    JOIN subjects sub ON sub.id = es.subject_id
    JOIN courses cr ON cr.id = es.course_id
    WHERE es.college_id = ? AND es.course_id = ?
  `;
  const params: Array<string | number> = [studentId, user.college_id, user.course_id || 0];

  if (semester && Number.isInteger(semester)) {
    sql += ' AND es.semester = ?';
    params.push(semester);
  }
  if (upcomingOnly) {
    sql += " AND es.exam_date >= date('now')";
  }

  sql += ' ORDER BY es.exam_date ASC, es.start_time ASC';
  const schedules = db.prepare(sql).all(...params);
  res.json({ schedules });
});

studentRoutes.get('/timetable/pdf', (req: AuthedRequest, res) => {
  const user = req.user!;
  const studentId = user.student_id!;

  const schedules = db
    .prepare(
      `SELECT es.*, sub.subject_code, sub.subject_name,
              CASE WHEN EXISTS (
                SELECT 1 FROM student_kt sk
                WHERE sk.student_id = ? AND sk.subject_id = es.subject_id AND sk.clearance_status != 'Cleared'
              ) THEN 'PERSONAL KT' ELSE 'COURSE SCHEDULE' END AS tag
       FROM exam_schedules es
       JOIN subjects sub ON sub.id = es.subject_id
       WHERE es.college_id = ? AND es.course_id = ?
       ORDER BY es.exam_date ASC, es.start_time ASC`
    )
    .all(studentId, user.college_id, user.course_id || 0) as Array<Record<string, any>>;

  const lines = [
    `Student: ${user.full_name} (${user.roll_number || user.identifier})`,
    `Course: ${user.course_name || 'N/A'} | Current Semester: ${user.semester || '-'}`,
    '------------------------------------------------------------------------',
    ...schedules.map(
      (s) =>
        `[${s.tag}] ${s.exam_date} ${s.start_time}-${s.end_time} | ${s.subject_code} ${s.subject_name} (Sem ${s.semester}) | ${s.venue || 'TBA'}`
    ),
  ];

  const pdfBuffer = buildSimplePdfBuffer('KT Buddy - Personal KT Examination Timetable', lines);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="KT_Timetable_${user.roll_number || 'Student'}.pdf"`);
  res.send(pdfBuffer);
});

studentRoutes.get('/timetable/ics', (req: AuthedRequest, res) => {
  const user = req.user!;
  const studentId = user.student_id!;

  const schedules = db
    .prepare(
      `SELECT es.*, sub.subject_code, sub.subject_name
       FROM exam_schedules es
       JOIN subjects sub ON sub.id = es.subject_id
       WHERE es.college_id = ? AND es.course_id = ?
         AND (
           EXISTS (SELECT 1 FROM student_kt sk WHERE sk.student_id = ? AND sk.subject_id = es.subject_id AND sk.clearance_status != 'Cleared')
           OR es.semester = ?
         )
       ORDER BY es.exam_date ASC`
    )
    .all(user.college_id, user.course_id || 0, studentId, user.semester || 0) as Array<Record<string, any>>;

  const events = schedules
    .map((s) => {
      const yyyymmdd = String(s.exam_date).replace(/-/g, '');
      const startHHMM = String(s.start_time).replace(':', '') + '00';
      const endHHMM = String(s.end_time).replace(':', '') + '00';
      return [
        'BEGIN:VEVENT',
        `UID:ktbuddy-exam-${s.id}@ktbuddy.local`,
        `DTSTART:${yyyymmdd}T${startHHMM}`,
        `DTEND:${yyyymmdd}T${endHHMM}`,
        `SUMMARY:KT Exam - ${s.subject_code} ${s.subject_name}`,
        `LOCATION:${(s.venue || 'TBA').replace(/[,;]/g, ' ')}`,
        `DESCRIPTION:${(s.exam_session || 'KT Examination').replace(/[\r\n]/g, ' ')}`,
        'END:VEVENT',
      ].join('\r\n');
    })
    .join('\r\n');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KT Buddy//Examination Timetable//EN',
    events,
    'END:VCALENDAR',
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="KT_Exams_${user.roll_number || 'Student'}.ics"`);
  res.send(icsContent);
});
