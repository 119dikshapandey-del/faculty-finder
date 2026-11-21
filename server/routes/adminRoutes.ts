import ExcelJS from 'exceljs';
import multer from 'multer';
import path from 'path';
import { Router } from 'express';
import { db } from '../db/database.ts';
import {
  type AuthedRequest,
  hashPassword,
  isSafeHttpUrl,
  isValidDateYYYYMMDD,
  isValidEmail,
  isValidTimeHHMM,
  logActivity,
  notifyTargetedStudents,
  requireAuth,
  requireRole,
  sanitizeText,
} from '../auth/security.ts';
import {
  ALLOWED_DOC_EXTENSIONS,
  buildSimplePdfBuffer,
  deleteUploadedFile,
  MAX_UPLOAD_SIZE_BYTES,
  saveBufferToUploads,
} from '../utils/fileStorage.ts';

export const adminRoutes = Router();

adminRoutes.use(requireAuth, requireRole('admin'));

const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
});

// 1. Admin Dashboard Overview & Analytics
adminRoutes.get('/overview', (req: AuthedRequest, res) => {
  const collegeId = req.user!.college_id;

  const totalRegisteredStudents = (
    db.prepare('SELECT COUNT(*) AS count FROM students s JOIN users u ON u.id = s.user_id WHERE s.college_id = ?').get(collegeId) as { count: number }
  ).count;

  const totalStudentsWithKt = (
    db
      .prepare("SELECT COUNT(DISTINCT student_id) AS count FROM student_kt WHERE college_id = ? AND clearance_status != 'Cleared'")
      .get(collegeId) as { count: number }
  ).count;

  const totalVerifiedKtSubjects = (
    db.prepare('SELECT COUNT(*) AS count FROM student_kt WHERE college_id = ? AND is_verified = 1').get(collegeId) as { count: number }
  ).count;

  const totalClearedSubjects = (
    db.prepare("SELECT COUNT(*) AS count FROM student_kt WHERE college_id = ? AND clearance_status = 'Cleared'").get(collegeId) as { count: number }
  ).count;

  const totalRemainingKtSubjects = (
    db.prepare("SELECT COUNT(*) AS count FROM student_kt WHERE college_id = ? AND clearance_status != 'Cleared'").get(collegeId) as { count: number }
  ).count;

  const pendingVerificationCount = (
    db.prepare("SELECT COUNT(*) AS count FROM result_records WHERE college_id = ? AND verification_status = 'Pending Verification'").get(collegeId) as { count: number }
  ).count;

  const deptStats = db
    .prepare(
      `SELECT
         d.id, d.name, d.code,
         COUNT(sk.id) AS total_records,
         SUM(CASE WHEN sk.clearance_status = 'Cleared' THEN 1 ELSE 0 END) AS cleared_count,
         SUM(CASE WHEN sk.clearance_status != 'Cleared' THEN 1 ELSE 0 END) AS remaining_count
       FROM departments d
       LEFT JOIN subjects sub ON sub.department_id = d.id AND sub.college_id = d.college_id
       LEFT JOIN student_kt sk ON sk.subject_id = sub.id AND sk.college_id = d.college_id
       WHERE d.college_id = ?
       GROUP BY d.id
       ORDER BY d.name ASC`
    )
    .all(collegeId);

  const semesterStats = db
    .prepare(
      `SELECT
         sk.semester,
         COUNT(sk.id) AS total_records,
         SUM(CASE WHEN sk.clearance_status = 'Cleared' THEN 1 ELSE 0 END) AS cleared_count,
         SUM(CASE WHEN sk.clearance_status != 'Cleared' THEN 1 ELSE 0 END) AS remaining_count
       FROM student_kt sk
       WHERE sk.college_id = ?
       GROUP BY sk.semester
       ORDER BY sk.semester ASC`
    )
    .all(collegeId);

  const subjectStats = db
    .prepare(
      `SELECT
         sub.id, sub.subject_code, sub.subject_name, sub.semester, d.name AS department_name,
         COUNT(sk.id) AS total_records,
         SUM(CASE WHEN sk.clearance_status = 'Cleared' THEN 1 ELSE 0 END) AS cleared_count,
         SUM(CASE WHEN sk.clearance_status != 'Cleared' THEN 1 ELSE 0 END) AS remaining_count
       FROM subjects sub
       JOIN departments d ON d.id = sub.department_id
       LEFT JOIN student_kt sk ON sk.subject_id = sub.id AND sk.college_id = sub.college_id
       WHERE sub.college_id = ?
       GROUP BY sub.id
       ORDER BY remaining_count DESC, sub.semester ASC`
    )
    .all(collegeId);

  const recentImports = db
    .prepare(
      `SELECT ri.*, u.full_name AS imported_by_name
       FROM result_imports ri
       LEFT JOIN users u ON u.id = ri.imported_by
       WHERE ri.college_id = ?
       ORDER BY ri.created_at DESC, ri.id DESC
       LIMIT 5`
    )
    .all(collegeId);

  const recentAnnouncements = db
    .prepare(
      `SELECT a.*, d.name AS department_name, cr.name AS course_name
       FROM announcements a
       LEFT JOIN departments d ON d.id = a.target_department_id
       LEFT JOIN courses cr ON cr.id = a.target_course_id
       WHERE a.college_id = ?
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT 5`
    )
    .all(collegeId);

  const recentLogs = db
    .prepare(
      `SELECT al.*, u.full_name AS actor_name
       FROM activity_logs al
       LEFT JOIN users u ON u.id = al.actor_user_id
       WHERE al.college_id = ?
       ORDER BY al.created_at DESC, al.id DESC
       LIMIT 15`
    )
    .all(collegeId);

  res.json({
    metrics: {
      totalRegisteredStudents,
      totalStudentsWithKt,
      totalVerifiedKtSubjects,
      totalClearedSubjects,
      totalRemainingKtSubjects,
      pendingVerificationCount,
    },
    deptStats,
    semesterStats,
    subjectStats,
    recentImports,
    recentAnnouncements,
    recentLogs,
  });
});

// 2. Reports Export (CSV or Excel .xlsx)
adminRoutes.get('/reports/export', async (req: AuthedRequest, res) => {
  const collegeId = req.user!.college_id;
  const reportType = sanitizeText(req.query.type, 40) || 'kt-ledger';
  const format = sanitizeText(req.query.format, 10) === 'csv' ? 'csv' : 'xlsx';

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('KT_Buddy_Report');

  if (reportType === 'department') {
    sheet.columns = [
      { header: 'Department Code', key: 'code', width: 16 },
      { header: 'Department Name', key: 'name', width: 28 },
      { header: 'Total KT Records', key: 'total_records', width: 18 },
      { header: 'Cleared Subjects', key: 'cleared_count', width: 18 },
      { header: 'Remaining KT Subjects', key: 'remaining_count', width: 22 },
    ];
    const rows = db
      .prepare(
        `SELECT d.code, d.name,
                COUNT(sk.id) AS total_records,
                SUM(CASE WHEN sk.clearance_status = 'Cleared' THEN 1 ELSE 0 END) AS cleared_count,
                SUM(CASE WHEN sk.clearance_status != 'Cleared' THEN 1 ELSE 0 END) AS remaining_count
         FROM departments d
         LEFT JOIN subjects sub ON sub.department_id = d.id AND sub.college_id = d.college_id
         LEFT JOIN student_kt sk ON sk.subject_id = sub.id AND sk.college_id = d.college_id
         WHERE d.college_id = ?
         GROUP BY d.id ORDER BY d.name ASC`
      )
      .all(collegeId) as Array<Record<string, any>>;
    rows.forEach((r) => sheet.addRow(r));
  } else if (reportType === 'imports') {
    sheet.columns = [
      { header: 'Import ID', key: 'id', width: 12 },
      { header: 'File Name', key: 'file_name', width: 32 },
      { header: 'Total Rows', key: 'total_rows', width: 14 },
      { header: 'Matched', key: 'matched_rows', width: 12 },
      { header: 'Unmatched', key: 'unmatched_rows', width: 12 },
      { header: 'Duplicates', key: 'duplicate_rows', width: 12 },
      { header: 'Invalid', key: 'invalid_rows', width: 12 },
      { header: 'Confirmed', key: 'confirmed_count', width: 12 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Imported By', key: 'imported_by_name', width: 24 },
      { header: 'Timestamp', key: 'created_at', width: 22 },
    ];
    const rows = db
      .prepare(
        `SELECT ri.*, u.full_name AS imported_by_name
         FROM result_imports ri
         LEFT JOIN users u ON u.id = ri.imported_by
         WHERE ri.college_id = ? ORDER BY ri.id DESC`
      )
      .all(collegeId) as Array<Record<string, any>>;
    rows.forEach((r) => sheet.addRow(r));
  } else {
    sheet.columns = [
      { header: 'Roll Number', key: 'roll_number', width: 16 },
      { header: 'Student Name', key: 'student_name', width: 24 },
      { header: 'Department', key: 'department_name', width: 22 },
      { header: 'Course', key: 'course_name', width: 14 },
      { header: 'Subject Code', key: 'subject_code', width: 14 },
      { header: 'Subject Name', key: 'subject_name', width: 28 },
      { header: 'Semester', key: 'semester', width: 12 },
      { header: 'Academic Year', key: 'academic_year', width: 14 },
      { header: 'Attempt', key: 'attempt_number', width: 10 },
      { header: 'Previous Status', key: 'previous_status', width: 16 },
      { header: 'Clearance Status', key: 'clearance_status', width: 18 },
      { header: 'Declaration Date', key: 'result_declaration_date', width: 16 },
    ];
    const rows = db
      .prepare(
        `SELECT s.roll_number, u.full_name AS student_name, d.name AS department_name, cr.name AS course_name,
                sub.subject_code, sub.subject_name, sk.semester, sk.academic_year, sk.attempt_number,
                COALESCE(sk.previous_status, '-') AS previous_status, sk.clearance_status, COALESCE(sk.result_declaration_date, '-') AS result_declaration_date
         FROM student_kt sk
         JOIN students s ON s.id = sk.student_id
         JOIN users u ON u.id = s.user_id
         JOIN departments d ON d.id = s.department_id
         JOIN courses cr ON cr.id = s.course_id
         JOIN subjects sub ON sub.id = sk.subject_id
         WHERE sk.college_id = ?
         ORDER BY s.roll_number ASC, sk.semester ASC`
      )
      .all(collegeId) as Array<Record<string, any>>;
    rows.forEach((r) => sheet.addRow(r));
  }

  if (format === 'csv') {
    const buf = await workbook.csv.writeBuffer();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="KT_Buddy_${reportType}_report.csv"`);
    res.send(Buffer.from(buf));
  } else {
    const buf = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="KT_Buddy_${reportType}_report.xlsx"`);
    res.send(Buffer.from(buf));
  }
});

// 3. Student Management
adminRoutes.get('/students', (req: AuthedRequest, res) => {
  const collegeId = req.user!.college_id;
  const q = sanitizeText(req.query.q, 80).toLowerCase();
  const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;
  const semester = req.query.semester ? Number(req.query.semester) : null;

  let sql = `
    SELECT
      s.*, u.full_name, u.email, u.is_active,
      d.name AS department_name, cr.name AS course_name,
      (SELECT COUNT(*) FROM student_kt sk WHERE sk.student_id = s.id AND sk.clearance_status != 'Cleared') AS active_kt_count,
      (SELECT COUNT(*) FROM student_kt sk WHERE sk.student_id = s.id AND sk.clearance_status = 'Cleared') AS cleared_kt_count
    FROM students s
    JOIN users u ON u.id = s.user_id
    JOIN departments d ON d.id = s.department_id
    JOIN courses cr ON cr.id = s.course_id
    WHERE s.college_id = ?
  `;
  const params: Array<string | number> = [collegeId];

  if (departmentId) {
    sql += ' AND s.department_id = ?';
    params.push(departmentId);
  }
  if (semester) {
    sql += ' AND s.semester = ?';
    params.push(semester);
  }
  if (q) {
    sql += ' AND (LOWER(u.full_name) LIKE ? OR LOWER(s.roll_number) LIKE ? OR LOWER(u.email) LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  sql += ' ORDER BY s.roll_number ASC';
  const students = db.prepare(sql).all(...params);
  res.json({ students });
});

adminRoutes.post('/students', (req: AuthedRequest, res) => {
  const user = req.user!;
  const fullName = sanitizeText(req.body?.fullName, 120);
  const email = sanitizeText(req.body?.email, 140).toLowerCase();
  const rollNumber = sanitizeText(req.body?.rollNumber, 40).toUpperCase();
  const departmentId = Number(req.body?.departmentId);
  const courseId = Number(req.body?.courseId);
  const yearOfStudy = Math.min(Math.max(Number(req.body?.yearOfStudy || 1), 1), 6);
  const semester = Math.min(Math.max(Number(req.body?.semester || 1), 1), 12);
  const password = typeof req.body?.password === 'string' && req.body.password.length >= 6 ? req.body.password : 'KTBuddy@2026';

  if (!fullName || !isValidEmail(email) || !rollNumber || !departmentId || !courseId) {
    res.status(400).json({ error: 'Name, valid email, roll number, department, and course are required.' });
    return;
  }

  const dup = db
    .prepare('SELECT id FROM users WHERE LOWER(email) = ? OR (college_id = ? AND LOWER(identifier) = ?)')
    .get(email, user.college_id, rollNumber.toLowerCase());
  if (dup) {
    res.status(409).json({ error: 'A student with this email or roll number already exists.' });
    return;
  }

  const { hash, salt } = hashPassword(password);
  const tx = db.transaction(() => {
    const uRes = db
      .prepare(
        `INSERT INTO users (college_id, email, identifier, full_name, role, password_hash, password_salt)
         VALUES (?, ?, ?, ?, 'student', ?, ?)`
      )
      .run(user.college_id, email, rollNumber, fullName, hash, salt);
    const sRes = db
      .prepare(
        `INSERT INTO students (user_id, college_id, department_id, course_id, roll_number, year_of_study, semester)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(uRes.lastInsertRowid, user.college_id, departmentId, courseId, rollNumber, yearOfStudy, semester);

    logActivity(user.college_id, user.id, 'ADMIN_CREATE_STUDENT', 'students', sRes.lastInsertRowid as number, `${fullName} (${rollNumber})`);
    return sRes.lastInsertRowid;
  });

  const studentId = tx();
  res.status(201).json({ message: 'Student account created.', studentId });
});

adminRoutes.patch('/students/:studentId', (req: AuthedRequest, res) => {
  const user = req.user!;
  const studentId = Number(req.params.studentId);
  const existing = db
    .prepare('SELECT s.*, u.full_name, u.is_active FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.college_id = ?')
    .get(studentId, user.college_id) as Record<string, any> | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Student not found.' });
    return;
  }

  const fullName = sanitizeText(req.body?.fullName, 120) || existing.full_name;
  const departmentId = Number(req.body?.departmentId || existing.department_id);
  const courseId = Number(req.body?.courseId || existing.course_id);
  const yearOfStudy = Math.min(Math.max(Number(req.body?.yearOfStudy || existing.year_of_study), 1), 6);
  const semester = Math.min(Math.max(Number(req.body?.semester || existing.semester), 1), 12);
  const isActive = typeof req.body?.isActive === 'boolean' ? (req.body.isActive ? 1 : 0) : existing.is_active;

  const tx = db.transaction(() => {
    db.prepare("UPDATE users SET full_name = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?").run(
      fullName,
      isActive,
      existing.user_id
    );
    db.prepare(
      "UPDATE students SET department_id = ?, course_id = ?, year_of_study = ?, semester = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(departmentId, courseId, yearOfStudy, semester, studentId);

    if (!isActive) {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.user_id);
    }
    logActivity(user.college_id, user.id, 'ADMIN_UPDATE_STUDENT', 'students', studentId, `${fullName} (active=${isActive})`);
  });

  tx();
  res.json({ message: 'Student profile updated.' });
});

// 4. Department & Course Management
adminRoutes.get('/departments', (req: AuthedRequest, res) => {
  const collegeId = req.user!.college_id;
  const departments = db
    .prepare(
      `SELECT d.*,
              (SELECT COUNT(*) FROM courses cr WHERE cr.department_id = d.id) AS course_count,
              (SELECT COUNT(*) FROM students s WHERE s.department_id = d.id) AS student_count
       FROM departments d WHERE d.college_id = ? ORDER BY d.name ASC`
    )
    .all(collegeId);
  const courses = db
    .prepare(
      `SELECT cr.*, d.name AS department_name
       FROM courses cr JOIN departments d ON d.id = cr.department_id
       WHERE cr.college_id = ? ORDER BY cr.name ASC`
    )
    .all(collegeId);
  res.json({ departments, courses });
});

adminRoutes.post('/departments', (req: AuthedRequest, res) => {
  const user = req.user!;
  const name = sanitizeText(req.body?.name, 100);
  const code = sanitizeText(req.body?.code, 20).toUpperCase();
  const headName = sanitizeText(req.body?.headName, 100);
  if (!name || !code) {
    res.status(400).json({ error: 'Department name and code are required.' });
    return;
  }
  try {
    const ins = db
      .prepare('INSERT INTO departments (college_id, name, code, head_name) VALUES (?, ?, ?, ?)')
      .run(user.college_id, name, code, headName || null);
    logActivity(user.college_id, user.id, 'CREATE_DEPARTMENT', 'departments', ins.lastInsertRowid as number, `${name} (${code})`);
    res.status(201).json({ message: 'Department added.' });
  } catch (err: any) {
    if (String(err.message).includes('UNIQUE')) {
      res.status(409).json({ error: 'Department code already exists.' });
      return;
    }
    throw err;
  }
});

adminRoutes.patch('/departments/:id', (req: AuthedRequest, res) => {
  const user = req.user!;
  const id = Number(req.params.id);
  const name = sanitizeText(req.body?.name, 100);
  const headName = sanitizeText(req.body?.headName, 100);
  if (!name) {
    res.status(400).json({ error: 'Department name is required.' });
    return;
  }
  db.prepare("UPDATE departments SET name = ?, head_name = ?, updated_at = datetime('now') WHERE id = ? AND college_id = ?").run(
    name,
    headName || null,
    id,
    user.college_id
  );
  res.json({ message: 'Department updated.' });
});

adminRoutes.post('/courses', (req: AuthedRequest, res) => {
  const user = req.user!;
  const departmentId = Number(req.body?.departmentId);
  const name = sanitizeText(req.body?.name, 100);
  const code = sanitizeText(req.body?.code, 20).toUpperCase();
  const totalSemesters = Math.min(Math.max(Number(req.body?.totalSemesters || 6), 1), 12);
  if (!departmentId || !name || !code) {
    res.status(400).json({ error: 'Department, course name, and code are required.' });
    return;
  }
  try {
    const tx = db.transaction(() => {
      const ins = db
        .prepare('INSERT INTO courses (college_id, department_id, name, code, total_semesters) VALUES (?, ?, ?, ?, ?)')
        .run(user.college_id, departmentId, name, code, totalSemesters);
      const courseId = ins.lastInsertRowid as number;
      for (let s = 1; s <= totalSemesters; s++) {
        db.prepare('INSERT INTO semesters (college_id, course_id, semester_number, label) VALUES (?, ?, ?, ?)').run(
          user.college_id,
          courseId,
          s,
          `Semester ${s}`
        );
      }
      logActivity(user.college_id, user.id, 'CREATE_COURSE', 'courses', courseId, `${name} (${code})`);
    });
    tx();
    res.status(201).json({ message: 'Course and semesters created.' });
  } catch (err: any) {
    if (String(err.message).includes('UNIQUE')) {
      res.status(409).json({ error: 'Course code already exists.' });
      return;
    }
    throw err;
  }
});

// 5. Subject Management
adminRoutes.get('/subjects', (req: AuthedRequest, res) => {
  const subjects = db
    .prepare(
      `SELECT sub.*, d.name AS department_name, cr.name AS course_name
       FROM subjects sub
       JOIN departments d ON d.id = sub.department_id
       JOIN courses cr ON cr.id = sub.course_id
       WHERE sub.college_id = ?
       ORDER BY sub.semester ASC, sub.subject_code ASC`
    )
    .all(req.user!.college_id);
  res.json({ subjects });
});

adminRoutes.post('/subjects', (req: AuthedRequest, res) => {
  const user = req.user!;
  const departmentId = Number(req.body?.departmentId);
  const courseId = Number(req.body?.courseId);
  const semester = Math.min(Math.max(Number(req.body?.semester || 1), 1), 12);
  const subjectCode = sanitizeText(req.body?.subjectCode, 30).toUpperCase();
  const subjectName = sanitizeText(req.body?.subjectName, 140);
  const credits = Math.min(Math.max(Number(req.body?.credits || 4), 1), 10);

  if (!departmentId || !courseId || !subjectCode || !subjectName) {
    res.status(400).json({ error: 'Department, course, subject code, and subject name are required.' });
    return;
  }
  try {
    const ins = db
      .prepare(
        `INSERT INTO subjects (college_id, department_id, course_id, semester, subject_code, subject_name, credits)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(user.college_id, departmentId, courseId, semester, subjectCode, subjectName, credits);
    logActivity(user.college_id, user.id, 'CREATE_SUBJECT', 'subjects', ins.lastInsertRowid as number, `${subjectCode} ${subjectName}`);
    res.status(201).json({ message: 'Subject added.' });
  } catch (err: any) {
    if (String(err.message).includes('UNIQUE')) {
      res.status(409).json({ error: 'Subject code already exists in your college.' });
      return;
    }
    throw err;
  }
});

adminRoutes.patch('/subjects/:id', (req: AuthedRequest, res) => {
  const user = req.user!;
  const id = Number(req.params.id);
  const subjectCode = sanitizeText(req.body?.subjectCode, 30).toUpperCase();
  const subjectName = sanitizeText(req.body?.subjectName, 140);
  const semester = Math.min(Math.max(Number(req.body?.semester || 1), 1), 12);
  const credits = Math.min(Math.max(Number(req.body?.credits || 4), 1), 10);

  if (!subjectCode || !subjectName) {
    res.status(400).json({ error: 'Subject code and name are required.' });
    return;
  }
  db.prepare(
    "UPDATE subjects SET subject_code = ?, subject_name = ?, semester = ?, credits = ?, updated_at = datetime('now') WHERE id = ? AND college_id = ?"
  ).run(subjectCode, subjectName, semester, credits, id, user.college_id);
  res.json({ message: 'Subject updated.' });
});

// 6. Syllabus Management (with PDF Upload, Versioning, Replacement & Notifications)
adminRoutes.post('/syllabi', docUpload.single('file'), (req: AuthedRequest, res) => {
  const user = req.user!;
  const subjectId = Number(req.body?.subjectId);
  const academicYear = sanitizeText(req.body?.academicYear, 20) || '2025-26';
  const versionLabel = sanitizeText(req.body?.versionLabel, 60) || 'v1.0 (Official KT Syllabus)';
  const title = sanitizeText(req.body?.title, 180);
  const unitTopicsRaw = sanitizeText(req.body?.unitTopics, 2000);
  const isLatest = req.body?.isLatest === 'false' || req.body?.isLatest === false ? 0 : 1;

  if (!subjectId || !title) {
    res.status(400).json({ error: 'Subject and syllabus title are required.' });
    return;
  }

  const subject = db
    .prepare('SELECT id, department_id, course_id, semester, subject_code, subject_name FROM subjects WHERE id = ? AND college_id = ?')
    .get(subjectId, user.college_id) as Record<string, any> | undefined;

  if (!subject) {
    res.status(404).json({ error: 'Subject not found.' });
    return;
  }

  const unitTopics = unitTopicsRaw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  let fileMeta: { fileName: string; storedPath: string; sizeBytes: number };
  if (req.file) {
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!ALLOWED_DOC_EXTENSIONS.has(ext)) {
      res.status(400).json({ error: 'Allowed file types: PDF, DOC, DOCX, TXT, PNG, JPG.' });
      return;
    }
    fileMeta = saveBufferToUploads(req.file.buffer, req.file.originalname);
  } else {
    const pdfBuf = buildSimplePdfBuffer(title, [
      `Subject: ${subject.subject_code} - ${subject.subject_name} | Semester ${subject.semester}`,
      `Academic Year: ${academicYear} | Version: ${versionLabel}`,
      '------------------------------------------------------------------------',
      ...(unitTopics.length > 0 ? unitTopics : ['Unit topics configured in KT Buddy Syllabus Archive.']),
    ]);
    fileMeta = saveBufferToUploads(pdfBuf, `${subject.subject_code}_Syllabus.pdf`);
  }

  const tx = db.transaction(() => {
    if (isLatest) {
      db.prepare('UPDATE syllabus SET is_latest = 0 WHERE college_id = ? AND subject_id = ?').run(user.college_id, subject.id);
    }

    const ins = db
      .prepare(
        `INSERT INTO syllabus
         (college_id, department_id, course_id, subject_id, semester, academic_year, version_label, title, unit_topics_json, file_name, file_path, file_size_bytes, is_latest, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        user.college_id,
        subject.department_id,
        subject.course_id,
        subject.id,
        subject.semester,
        academicYear,
        versionLabel,
        title,
        JSON.stringify(unitTopics),
        fileMeta.fileName,
        fileMeta.storedPath,
        fileMeta.sizeBytes,
        isLatest,
        user.id
      );

    notifyTargetedStudents(
      user.college_id,
      { departmentId: subject.department_id, courseId: subject.course_id, subjectId: subject.id },
      'syllabus_uploaded',
      `New Syllabus Published: ${subject.subject_name}`,
      `${title} (${versionLabel}, AY ${academicYear}) is now available for download.`,
      'syllabus'
    );

    logActivity(user.college_id, user.id, 'UPLOAD_SYLLABUS', 'syllabus', ins.lastInsertRowid as number, `${subject.subject_code} ${versionLabel}`);
    return ins.lastInsertRowid;
  });

  const syllabusId = tx();
  res.status(201).json({ message: 'Syllabus uploaded and students notified.', syllabusId });
});

adminRoutes.delete('/syllabi/:id', (req: AuthedRequest, res) => {
  const user = req.user!;
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT file_path, title FROM syllabus WHERE id = ? AND college_id = ?').get(id, user.college_id) as
    | { file_path: string; title: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Syllabus not found.' });
    return;
  }
  db.prepare('DELETE FROM syllabus WHERE id = ? AND college_id = ?').run(id, user.college_id);
  deleteUploadedFile(existing.file_path);
  logActivity(user.college_id, user.id, 'DELETE_SYLLABUS', 'syllabus', id, existing.title);
  res.json({ message: 'Syllabus removed.' });
});

// 7. Study Material & PYQ Management
adminRoutes.post('/materials', docUpload.single('file'), (req: AuthedRequest, res) => {
  const user = req.user!;
  const subjectId = Number(req.body?.subjectId);
  const resourceType = sanitizeText(req.body?.resourceType, 40);
  const academicYear = sanitizeText(req.body?.academicYear, 20) || '2025-26';
  const title = sanitizeText(req.body?.title, 180);
  const description = sanitizeText(req.body?.description, 500);
  const externalUrl = sanitizeText(req.body?.externalUrl, 400);

  const ALLOWED_TYPES = ['PYQ', 'Notes', 'Important Questions', 'Unit Material', 'Reference Book', 'Practical Material'];
  if (!subjectId || !ALLOWED_TYPES.includes(resourceType) || !title) {
    res.status(400).json({ error: 'Subject, valid resource type, and title are required.' });
    return;
  }
  if (externalUrl && !isSafeHttpUrl(externalUrl)) {
    res.status(400).json({ error: 'External URL must start with https:// or http://.' });
    return;
  }
  if (!req.file && !externalUrl) {
    res.status(400).json({ error: 'Attach a document/PDF file or provide an external educational link.' });
    return;
  }

  const subject = db
    .prepare('SELECT id, department_id, course_id, semester, subject_code, subject_name FROM subjects WHERE id = ? AND college_id = ?')
    .get(subjectId, user.college_id) as Record<string, any> | undefined;

  if (!subject) {
    res.status(404).json({ error: 'Subject not found.' });
    return;
  }

  let fileName: string | null = null;
  let storedPath: string | null = null;
  let sizeBytes = 0;

  if (req.file) {
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!ALLOWED_DOC_EXTENSIONS.has(ext)) {
      res.status(400).json({ error: 'Allowed file types: PDF, DOC, DOCX, TXT, PNG, JPG.' });
      return;
    }
    const saved = saveBufferToUploads(req.file.buffer, req.file.originalname);
    fileName = saved.fileName;
    storedPath = saved.storedPath;
    sizeBytes = saved.sizeBytes;
  }

  const ins = db
    .prepare(
      `INSERT INTO study_materials
       (college_id, department_id, course_id, subject_id, semester, academic_year, resource_type, title, description, external_url, file_name, file_path, file_size_bytes, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      user.college_id,
      subject.department_id,
      subject.course_id,
      subject.id,
      subject.semester,
      academicYear,
      resourceType,
      title,
      description || null,
      externalUrl || null,
      fileName,
      storedPath,
      sizeBytes,
      user.id
    );

  notifyTargetedStudents(
    user.college_id,
    { departmentId: subject.department_id, courseId: subject.course_id, subjectId: subject.id },
    resourceType === 'PYQ' ? 'pyq_uploaded' : 'resource_uploaded',
    `New ${resourceType}: ${subject.subject_name}`,
    `${title} (${academicYear}) has been uploaded to Study Resources.`,
    'study_materials'
  );

  logActivity(user.college_id, user.id, 'UPLOAD_STUDY_MATERIAL', 'study_materials', ins.lastInsertRowid as number, `${resourceType}: ${title}`);
  res.status(201).json({ message: `${resourceType} published successfully.` });
});

adminRoutes.patch('/materials/:id', (req: AuthedRequest, res) => {
  const user = req.user!;
  const id = Number(req.params.id);
  const title = sanitizeText(req.body?.title, 180);
  const description = sanitizeText(req.body?.description, 500);
  const academicYear = sanitizeText(req.body?.academicYear, 20);
  if (!title) {
    res.status(400).json({ error: 'Title is required.' });
    return;
  }
  db.prepare(
    "UPDATE study_materials SET title = ?, description = ?, academic_year = COALESCE(?, academic_year), updated_at = datetime('now') WHERE id = ? AND college_id = ?"
  ).run(title, description || null, academicYear || null, id, user.college_id);
  res.json({ message: 'Resource details updated.' });
});

adminRoutes.delete('/materials/:id', (req: AuthedRequest, res) => {
  const user = req.user!;
  const id = Number(req.params.id);
  const existing = db
    .prepare('SELECT file_path, title FROM study_materials WHERE id = ? AND college_id = ?')
    .get(id, user.college_id) as { file_path: string | null; title: string } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Resource not found.' });
    return;
  }
  db.prepare('DELETE FROM study_materials WHERE id = ? AND college_id = ?').run(id, user.college_id);
  deleteUploadedFile(existing.file_path);
  logActivity(user.college_id, user.id, 'DELETE_STUDY_MATERIAL', 'study_materials', id, existing.title);
  res.json({ message: 'Resource deleted.' });
});

// 8. Examination Timetable Management
adminRoutes.get('/exams', (req: AuthedRequest, res) => {
  const schedules = db
    .prepare(
      `SELECT es.*, sub.subject_code, sub.subject_name, cr.name AS course_name
       FROM exam_schedules es
       JOIN subjects sub ON sub.id = es.subject_id
       JOIN courses cr ON cr.id = es.course_id
       WHERE es.college_id = ?
       ORDER BY es.exam_date ASC, es.start_time ASC`
    )
    .all(req.user!.college_id);
  res.json({ schedules });
});

adminRoutes.post('/exams', (req: AuthedRequest, res) => {
  const user = req.user!;
  const subjectId = Number(req.body?.subjectId);
  const examSession = sanitizeText(req.body?.examSession, 100) || 'KT Supplementary Cycle';
  const examDate = sanitizeText(req.body?.examDate, 20);
  const startTime = sanitizeText(req.body?.startTime, 10);
  const endTime = sanitizeText(req.body?.endTime, 10);
  const venue = sanitizeText(req.body?.venue, 120);
  const instructions = sanitizeText(req.body?.instructions, 400);

  if (!subjectId || !isValidDateYYYYMMDD(examDate) || !isValidTimeHHMM(startTime) || !isValidTimeHHMM(endTime)) {
    res.status(400).json({ error: 'Valid subject, date (YYYY-MM-DD), start time, and end time (HH:MM) are required.' });
    return;
  }
  if (startTime >= endTime) {
    res.status(400).json({ error: 'End time must be after start time.' });
    return;
  }

  const subject = db
    .prepare('SELECT id, department_id, course_id, semester, subject_code, subject_name FROM subjects WHERE id = ? AND college_id = ?')
    .get(subjectId, user.college_id) as Record<string, any> | undefined;

  if (!subject) {
    res.status(404).json({ error: 'Subject not found.' });
    return;
  }

  // Prevent conflicting exam schedules for the same course + semester on the same date & overlapping time
  const conflict = db
    .prepare(
      `SELECT id FROM exam_schedules
       WHERE college_id = ? AND course_id = ? AND semester = ? AND exam_date = ?
         AND NOT (end_time <= ? OR start_time >= ?)`
    )
    .get(user.college_id, subject.course_id, subject.semester, examDate, startTime, endTime);

  if (conflict) {
    res.status(409).json({
      error: `Time conflict detected: another Semester ${subject.semester} exam in this course is already scheduled during this slot on ${examDate}.`,
    });
    return;
  }

  const ins = db
    .prepare(
      `INSERT INTO exam_schedules
       (college_id, course_id, subject_id, semester, exam_session, exam_date, start_time, end_time, venue, instructions, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      user.college_id,
      subject.course_id,
      subject.id,
      subject.semester,
      examSession,
      examDate,
      startTime,
      endTime,
      venue || null,
      instructions || null,
      user.id
    );

  notifyTargetedStudents(
    user.college_id,
    { departmentId: subject.department_id, courseId: subject.course_id, subjectId: subject.id },
    'exam_published',
    `KT Exam Scheduled: ${subject.subject_name}`,
    `${subject.subject_code} scheduled on ${examDate} (${startTime}–${endTime}) at ${venue || 'TBA'}.`,
    'exam_schedule'
  );

  logActivity(user.college_id, user.id, 'CREATE_EXAM_SCHEDULE', 'exam_schedules', ins.lastInsertRowid as number, `${subject.subject_code} on ${examDate}`);
  res.status(201).json({ message: 'Examination schedule published and students notified.' });
});

adminRoutes.patch('/exams/:id', (req: AuthedRequest, res) => {
  const user = req.user!;
  const id = Number(req.params.id);
  const existing = db
    .prepare(
      `SELECT es.*, sub.department_id, sub.subject_code, sub.subject_name
       FROM exam_schedules es JOIN subjects sub ON sub.id = es.subject_id
       WHERE es.id = ? AND es.college_id = ?`
    )
    .get(id, user.college_id) as Record<string, any> | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Schedule not found.' });
    return;
  }

  const examDate = sanitizeText(req.body?.examDate, 20) || existing.exam_date;
  const startTime = sanitizeText(req.body?.startTime, 10) || existing.start_time;
  const endTime = sanitizeText(req.body?.endTime, 10) || existing.end_time;
  const venue = sanitizeText(req.body?.venue, 120) || existing.venue;
  const instructions = sanitizeText(req.body?.instructions, 400);
  const changeNote = sanitizeText(req.body?.changeNote, 200) || `Updated to ${examDate} (${startTime}–${endTime}) at ${venue || 'TBA'}`;

  if (!isValidDateYYYYMMDD(examDate) || !isValidTimeHHMM(startTime) || !isValidTimeHHMM(endTime) || startTime >= endTime) {
    res.status(400).json({ error: 'Valid date and time range required.' });
    return;
  }

  const dateOrVenueChanged = examDate !== existing.exam_date || startTime !== existing.start_time || venue !== existing.venue;

  db.prepare(
    `UPDATE exam_schedules
     SET exam_date = ?, start_time = ?, end_time = ?, venue = ?, instructions = ?, is_changed = ?, change_note = ?, updated_at = datetime('now')
     WHERE id = ? AND college_id = ?`
  ).run(
    examDate,
    startTime,
    endTime,
    venue || null,
    instructions || existing.instructions,
    dateOrVenueChanged ? 1 : existing.is_changed,
    dateOrVenueChanged ? changeNote : existing.change_note,
    id,
    user.college_id
  );

  if (dateOrVenueChanged) {
    notifyTargetedStudents(
      user.college_id,
      { departmentId: existing.department_id, courseId: existing.course_id, subjectId: existing.subject_id },
      'exam_change',
      `Exam Schedule Changed: ${existing.subject_name}`,
      `${existing.subject_code}: ${changeNote}`,
      'exam_schedule'
    );
  }

  logActivity(user.college_id, user.id, 'UPDATE_EXAM_SCHEDULE', 'exam_schedules', id, `${existing.subject_code}: ${changeNote}`);
  res.json({ message: 'Examination schedule updated.' });
});

adminRoutes.delete('/exams/:id', (req: AuthedRequest, res) => {
  const user = req.user!;
  db.prepare('DELETE FROM exam_schedules WHERE id = ? AND college_id = ?').run(Number(req.params.id), user.college_id);
  res.json({ message: 'Examination schedule removed.' });
});

// 9. Announcement Management
adminRoutes.get('/announcements', (req: AuthedRequest, res) => {
  const announcements = db
    .prepare(
      `SELECT a.*, d.name AS department_name, cr.name AS course_name, u.full_name AS created_by_name
       FROM announcements a
       LEFT JOIN departments d ON d.id = a.target_department_id
       LEFT JOIN courses cr ON cr.id = a.target_course_id
       LEFT JOIN users u ON u.id = a.created_by
       WHERE a.college_id = ?
       ORDER BY a.created_at DESC, a.id DESC`
    )
    .all(req.user!.college_id);
  res.json({ announcements });
});

adminRoutes.post('/announcements', (req: AuthedRequest, res) => {
  const user = req.user!;
  const title = sanitizeText(req.body?.title, 180);
  const content = sanitizeText(req.body?.content, 1200);
  const category = sanitizeText(req.body?.category, 40) || 'Academic';
  const targetDepartmentId = req.body?.targetDepartmentId ? Number(req.body.targetDepartmentId) : null;
  const targetCourseId = req.body?.targetCourseId ? Number(req.body.targetCourseId) : null;
  const targetSemester = req.body?.targetSemester ? Number(req.body.targetSemester) : null;
  const publishDate = sanitizeText(req.body?.publishDate, 20) || new Date().toISOString().slice(0, 10);
  const expiryDate = sanitizeText(req.body?.expiryDate, 20) || null;

  if (!title || !content) {
    res.status(400).json({ error: 'Announcement title and content are required.' });
    return;
  }

  const ins = db
    .prepare(
      `INSERT INTO announcements
       (college_id, title, content, category, target_department_id, target_course_id, target_semester, publish_date, expiry_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      user.college_id,
      title,
      content,
      category,
      targetDepartmentId,
      targetCourseId,
      targetSemester,
      publishDate,
      expiryDate,
      user.id
    );

  const notifiedCount = notifyTargetedStudents(
    user.college_id,
    { departmentId: targetDepartmentId, courseId: targetCourseId, semester: targetSemester },
    'announcement',
    title,
    content.slice(0, 220),
    'announcements'
  );

  logActivity(
    user.college_id,
    user.id,
    'PUBLISH_ANNOUNCEMENT',
    'announcements',
    ins.lastInsertRowid as number,
    `${title} (notified ${notifiedCount} students)`
  );

  res.status(201).json({ message: `Announcement published and delivered to ${notifiedCount} matching student(s).` });
});

adminRoutes.delete('/announcements/:id', (req: AuthedRequest, res) => {
  const user = req.user!;
  db.prepare('DELETE FROM announcements WHERE id = ? AND college_id = ?').run(Number(req.params.id), user.college_id);
  res.json({ message: 'Announcement deleted.' });
});
