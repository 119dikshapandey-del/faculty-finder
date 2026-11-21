import crypto from 'crypto';
import { Router } from 'express';
import { db } from '../db/database.ts';
import {
  type AuthedRequest,
  checkLoginRateLimit,
  clearLoginRateLimit,
  generateSessionToken,
  hashPassword,
  hashToken,
  isValidEmail,
  logActivity,
  requireAuth,
  sanitizeText,
  verifyPassword,
} from '../auth/security.ts';

export const authRoutes = Router();

// Short-lived in-memory reset verification codes (10 min TTL)
const resetCodes = new Map<string, { code: string; userId: number; expiresAt: number }>();

authRoutes.get('/colleges-public', (_req, res) => {
  const colleges = db.prepare('SELECT id, name, code, city FROM colleges ORDER BY id ASC').all();
  res.json({ colleges });
});

authRoutes.get('/colleges-public/:collegeId/catalog', (req, res) => {
  const collegeId = Number(req.params.collegeId);
  if (!Number.isInteger(collegeId) || collegeId <= 0) {
    res.status(400).json({ error: 'Invalid college ID' });
    return;
  }
  const departments = db
    .prepare('SELECT id, name, code FROM departments WHERE college_id = ? ORDER BY name ASC')
    .all(collegeId);
  const courses = db
    .prepare('SELECT id, department_id, name, code, total_semesters FROM courses WHERE college_id = ? ORDER BY name ASC')
    .all(collegeId);
  res.json({ departments, courses });
});

authRoutes.post('/login', (req, res) => {
  const identifier = sanitizeText(req.body?.identifier, 120).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const requestedRole = sanitizeText(req.body?.role, 20);

  if (!identifier || !password) {
    res.status(400).json({ error: 'College email or Student ID and password are required.' });
    return;
  }

  const rateKey = `${req.ip || 'local'}:${identifier}`;
  if (!checkLoginRateLimit(rateKey)) {
    res.status(429).json({ error: 'Too many login attempts. Please wait 15 minutes before trying again.' });
    return;
  }

  const userRow = db
    .prepare(
      `SELECT u.*, c.name AS college_name, c.code AS college_code
       FROM users u
       JOIN colleges c ON c.id = u.college_id
       WHERE LOWER(u.email) = ? OR LOWER(u.identifier) = ?
       LIMIT 1`
    )
    .get(identifier, identifier) as
    | {
        id: number;
        college_id: number;
        college_name: string;
        college_code: string;
        email: string;
        identifier: string;
        full_name: string;
        role: 'student' | 'admin';
        password_hash: string;
        password_salt: string;
        is_active: number;
      }
    | undefined;

  if (!userRow || !verifyPassword(password, userRow.password_hash, userRow.password_salt)) {
    res.status(401).json({ error: 'Invalid credentials. Please check your email / ID and password.' });
    return;
  }

  if (requestedRole && (requestedRole === 'student' || requestedRole === 'admin') && userRow.role !== requestedRole) {
    res.status(403).json({ error: `This account is registered as ${userRow.role}, not ${requestedRole}.` });
    return;
  }

  if (!userRow.is_active) {
    res.status(403).json({ error: 'Your account has been deactivated by the administrator.' });
    return;
  }

  clearLoginRateLimit(rateKey);

  const rawToken = generateSessionToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.prepare('INSERT INTO sessions (token_hash, user_id, college_id, expires_at) VALUES (?, ?, ?, ?)').run(
    tokenHash,
    userRow.id,
    userRow.college_id,
    expiresAt
  );

  const studentMeta =
    userRow.role === 'student'
      ? (db
          .prepare(
            `SELECT s.id AS student_id, s.roll_number, s.department_id, d.name AS department_name,
                    s.course_id, cr.name AS course_name, s.year_of_study, s.semester
             FROM students s
             JOIN departments d ON d.id = s.department_id
             JOIN courses cr ON cr.id = s.course_id
             WHERE s.user_id = ?`
          )
          .get(userRow.id) as Record<string, unknown> | undefined)
      : undefined;

  res.json({
    token: rawToken,
    user: {
      id: userRow.id,
      college_id: userRow.college_id,
      college_name: userRow.college_name,
      college_code: userRow.college_code,
      email: userRow.email,
      identifier: userRow.identifier,
      full_name: userRow.full_name,
      role: userRow.role,
      is_active: userRow.is_active,
      ...(studentMeta || {}),
    },
  });
});

// Public registration strictly creates Student accounts only (Admin accounts cannot be self-registered)
authRoutes.post('/register', (req, res) => {
  const rawCollegeId = Number(req.body?.collegeId);
  const fullName = sanitizeText(req.body?.fullName, 120);
  const email = sanitizeText(req.body?.email, 140).toLowerCase();
  const rollNumber = sanitizeText(req.body?.rollNumber, 40).toUpperCase();
  const departmentId = Number(req.body?.departmentId);
  const courseId = Number(req.body?.courseId);
  const yearOfStudy = Math.min(Math.max(Number(req.body?.yearOfStudy || 1), 1), 6);
  const semester = Math.min(Math.max(Number(req.body?.semester || 1), 1), 12);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!fullName || !email || !rollNumber || !password || !Number.isInteger(departmentId) || !Number.isInteger(courseId)) {
    res.status(400).json({ error: 'All student registration fields are required.' });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Please enter a valid college email address.' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    return;
  }

  const college = (
    Number.isInteger(rawCollegeId) && rawCollegeId > 0
      ? db.prepare('SELECT id, name, code FROM colleges WHERE id = ?').get(rawCollegeId)
      : db.prepare('SELECT id, name, code FROM colleges ORDER BY id ASC LIMIT 1').get()
  ) as { id: number; name: string; code: string } | undefined;

  if (!college) {
    res.status(400).json({ error: 'Selected college was not found.' });
    return;
  }

  const validDept = db
    .prepare('SELECT id, name FROM departments WHERE id = ? AND college_id = ?')
    .get(departmentId, college.id) as { id: number; name: string } | undefined;
  const validCourse = db
    .prepare('SELECT id, name FROM courses WHERE id = ? AND college_id = ?')
    .get(courseId, college.id) as { id: number; name: string } | undefined;

  if (!validDept || !validCourse) {
    res.status(400).json({ error: 'Selected department or course does not belong to the chosen college.' });
    return;
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE LOWER(email) = ? OR (college_id = ? AND LOWER(identifier) = ?)')
    .get(email, college.id, rollNumber.toLowerCase());
  if (existing) {
    res.status(409).json({ error: 'An account with this email or student ID already exists.' });
    return;
  }

  const { hash, salt } = hashPassword(password);

  const tx = db.transaction(() => {
    const userRes = db
      .prepare(
        `INSERT INTO users (college_id, email, identifier, full_name, role, password_hash, password_salt)
         VALUES (?, ?, ?, ?, 'student', ?, ?)`
      )
      .run(college.id, email, rollNumber, fullName, hash, salt);
    const userId = userRes.lastInsertRowid as number;

    const studRes = db
      .prepare(
        `INSERT INTO students (user_id, college_id, department_id, course_id, roll_number, year_of_study, semester)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(userId, college.id, validDept.id, validCourse.id, rollNumber, yearOfStudy, semester);

    logActivity(college.id, userId, 'STUDENT_SELF_REGISTERED', 'students', studRes.lastInsertRowid as number, `${fullName} (${rollNumber})`);
    return { userId, studentId: studRes.lastInsertRowid as number };
  });

  const { userId, studentId } = tx();
  const rawToken = generateSessionToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token_hash, user_id, college_id, expires_at) VALUES (?, ?, ?, ?)').run(
    tokenHash,
    userId,
    college.id,
    expiresAt
  );

  res.status(201).json({
    token: rawToken,
    user: {
      id: userId,
      college_id: college.id,
      college_name: college.name,
      college_code: college.code,
      email,
      identifier: rollNumber,
      full_name: fullName,
      role: 'student',
      is_active: 1,
      student_id: studentId,
      roll_number: rollNumber,
      department_id: validDept.id,
      department_name: validDept.name,
      course_id: validCourse.id,
      course_name: validCourse.name,
      year_of_study: yearOfStudy,
      semester,
    },
  });
});

authRoutes.post('/forgot-password', (req, res) => {
  const email = sanitizeText(req.body?.email, 140).toLowerCase();
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Please provide a valid email address.' });
    return;
  }

  const user = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email) as { id: number } | undefined;
  if (!user) {
    res.json({
      message: 'If your email is registered, a 6-digit password reset code has been generated.',
      demoResetCode: null,
    });
    return;
  }

  const code = String(crypto.randomInt(100000, 999999));
  resetCodes.set(email, { code, userId: user.id, expiresAt: Date.now() + 10 * 60 * 1000 });

  res.json({
    message: 'Verification code generated (valid for 10 minutes).',
    demoResetCode: code,
  });
});

authRoutes.post('/reset-password', (req, res) => {
  const email = sanitizeText(req.body?.email, 140).toLowerCase();
  const code = sanitizeText(req.body?.code, 12);
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  if (!email || !code || newPassword.length < 6) {
    res.status(400).json({ error: 'Valid email, 6-digit code, and new password (min 6 chars) are required.' });
    return;
  }

  const record = resetCodes.get(email);
  if (!record || record.code !== code || Date.now() > record.expiresAt) {
    res.status(400).json({ error: 'Invalid or expired reset code.' });
    return;
  }

  const { hash, salt } = hashPassword(newPassword);
  db.prepare("UPDATE users SET password_hash = ?, password_salt = ?, updated_at = datetime('now') WHERE id = ?").run(
    hash,
    salt,
    record.userId
  );
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(record.userId);
  resetCodes.delete(email);

  res.json({ message: 'Password updated successfully. Please sign in with your new password.' });
});

authRoutes.post('/logout', requireAuth, (req: AuthedRequest, res) => {
  if (req.sessionTokenHash) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.sessionTokenHash);
  }
  res.json({ message: 'Logged out successfully.' });
});

authRoutes.get('/me', requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});
