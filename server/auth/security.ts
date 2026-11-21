import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from '../db/database.ts';

export interface AuthUser {
  id: number;
  college_id: number;
  college_name: string;
  college_code: string;
  email: string;
  identifier: string;
  full_name: string;
  role: 'student' | 'admin';
  is_active: number;
  student_id?: number;
  roll_number?: string;
  department_id?: number;
  department_name?: string;
  course_id?: number;
  course_name?: string;
  year_of_study?: number;
  semester?: number;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
  sessionTokenHash?: string;
}

export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash: derived, salt };
}

export function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
  const { hash } = hashPassword(password, storedSalt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Sliding-window login rate limiter (15 attempts per 15 minutes per IP+identifier)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkLoginRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 15) {
    return false;
  }
  entry.count += 1;
  return true;
}

export function clearLoginRateLimit(key: string): void {
  loginAttempts.delete(key);
}

export function resolveUserFromToken(rawToken: string): { user: AuthUser; tokenHash: string } | null {
  if (!rawToken || rawToken.length < 20) return null;
  const tokenHash = hashToken(rawToken);
  const row = db
    .prepare(
      `SELECT
         u.id, u.college_id, c.name AS college_name, c.code AS college_code,
         u.email, u.identifier, u.full_name, u.role, u.is_active,
         s.id AS student_id, s.roll_number, s.department_id, d.name AS department_name,
         s.course_id, cr.name AS course_name, s.year_of_study, s.semester,
         sess.expires_at
       FROM sessions sess
       JOIN users u ON u.id = sess.user_id
       JOIN colleges c ON c.id = u.college_id
       LEFT JOIN students s ON s.user_id = u.id
       LEFT JOIN departments d ON d.id = s.department_id
       LEFT JOIN courses cr ON cr.id = s.course_id
       WHERE sess.token_hash = ?`
    )
    .get(tokenHash) as (AuthUser & { expires_at: string }) | undefined;

  if (!row) return null;
  if (!row.is_active) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }

  return {
    tokenHash,
    user: {
      id: row.id,
      college_id: row.college_id,
      college_name: row.college_name,
      college_code: row.college_code,
      email: row.email,
      identifier: row.identifier,
      full_name: row.full_name,
      role: row.role,
      is_active: row.is_active,
      student_id: row.student_id || undefined,
      roll_number: row.roll_number || undefined,
      department_id: row.department_id || undefined,
      department_name: row.department_name || undefined,
      course_id: row.course_id || undefined,
      course_name: row.course_name || undefined,
      year_of_study: row.year_of_study || undefined,
      semester: row.semester || undefined,
    },
  };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const resolved = resolveUserFromToken(token);
  if (!resolved) {
    res.status(401).json({ error: 'Your session has expired or is invalid. Please log in again.' });
    return;
  }
  req.user = resolved.user;
  req.sessionTokenHash = resolved.tokenHash;
  next();
}

export function requireRole(...allowedRoles: Array<'student' | 'admin'>) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Access denied. You do not have permission for this module.' });
      return;
    }
    next();
  };
}

export function sanitizeText(value: unknown, maxLength = 300): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidDateYYYYMMDD(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isValidTimeHHMM(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function logActivity(
  collegeId: number,
  actorUserId: number | null,
  action: string,
  targetType: string,
  targetId: number | null,
  details?: string
): void {
  db.prepare(
    `INSERT INTO activity_logs (college_id, actor_user_id, action, target_type, target_id, details)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(collegeId, actorUserId, action, targetType, targetId, details || null);
}

export function createNotificationForUser(
  collegeId: number,
  userId: number,
  type: string,
  title: string,
  message: string,
  relatedEntity?: string
): void {
  db.prepare(
    `INSERT INTO notifications (college_id, user_id, type, title, message, related_entity)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(collegeId, userId, type, title, message, relatedEntity || null);
}

export function notifyTargetedStudents(
  collegeId: number,
  filters: { departmentId?: number | null; courseId?: number | null; semester?: number | null; subjectId?: number | null },
  type: string,
  title: string,
  message: string,
  relatedEntity?: string
): number {
  let sql = `
    SELECT DISTINCT u.id AS user_id
    FROM students s
    JOIN users u ON u.id = s.user_id
    WHERE s.college_id = ? AND u.is_active = 1
  `;
  const params: Array<number> = [collegeId];

  if (filters.departmentId) {
    sql += ' AND s.department_id = ?';
    params.push(filters.departmentId);
  }
  if (filters.courseId) {
    sql += ' AND s.course_id = ?';
    params.push(filters.courseId);
  }
  if (filters.semester) {
    // Include students currently in or above that semester (since students carry previous semester KTs) or specifically students with a KT in that semester/subject
    sql += ' AND (s.semester >= ? OR EXISTS (SELECT 1 FROM student_kt sk WHERE sk.student_id = s.id AND sk.semester = ?))';
    params.push(filters.semester, filters.semester);
  }
  if (filters.subjectId) {
    sql += ' AND (EXISTS (SELECT 1 FROM student_kt sk WHERE sk.student_id = s.id AND sk.subject_id = ?) OR s.course_id IN (SELECT course_id FROM subjects WHERE id = ?))';
    params.push(filters.subjectId, filters.subjectId);
  }

  const targets = db.prepare(sql).all(...params) as Array<{ user_id: number }>;
  const insert = db.prepare(
    `INSERT INTO notifications (college_id, user_id, type, title, message, related_entity)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const t of targets) {
    insert.run(collegeId, t.user_id, type, title, message, relatedEntity || null);
  }
  return targets.length;
}
