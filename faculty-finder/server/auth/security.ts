import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { getDb } from '../db/database.ts';

export type UserRole = 'student' | 'faculty' | 'admin';

export interface AuthenticatedUser {
  id: number;
  college_id: number;
  college_name: string;
  college_code: string;
  role: UserRole;
  full_name: string;
  identifier: string;
  email: string;
  department_id: number | null;
  department_name: string | null;
  student_semester: number | null;
  avatar_url: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      tokenHash?: string;
    }
  }
}

let ioInstance: SocketIOServer | null = null;

export function setSocketServer(io: SocketIOServer): void {
  ioInstance = io;
}

export function emitCollegeEvent(collegeId: number, event: string, payload: Record<string, unknown>): void {
  if (ioInstance) {
    ioInstance.to(`college:${collegeId}`).emit(event, payload);
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(hash, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSessionToken(userId: number): string {
  const db = getDb();
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    tokenHash,
    userId,
    expiresAt
  );
  return rawToken;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const db = getDb();
  const tokenHash = hashToken(token);
  const row = db
    .prepare(
      `SELECT u.id, u.college_id, c.name AS college_name, c.code AS college_code,
              u.role, u.full_name, u.identifier, u.email, u.department_id,
              d.name AS department_name, u.student_semester, u.avatar_url,
              u.is_active, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN colleges c ON c.id = u.college_id
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE s.token_hash = ?`
    )
    .get(tokenHash) as (AuthenticatedUser & { is_active: number; expires_at: string }) | undefined;

  if (!row || !row.is_active) {
    res.status(401).json({ error: 'Invalid or inactive session.' });
    return;
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
    return;
  }

  req.user = {
    id: row.id,
    college_id: row.college_id,
    college_name: row.college_name,
    college_code: row.college_code,
    role: row.role,
    full_name: row.full_name,
    identifier: row.identifier,
    email: row.email,
    department_id: row.department_id,
    department_name: row.department_name,
    student_semester: row.student_semester,
    avatar_url: row.avatar_url,
  };
  req.tokenHash = tokenHash;
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Access denied for your account role.' });
      return;
    }
    next();
  };
}

export function createNotification(
  collegeId: number,
  userId: number,
  title: string,
  message: string,
  category = 'general'
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO notifications (college_id, user_id, title, message, category)
     VALUES (?, ?, ?, ?, ?)`
  ).run(collegeId, userId, title, message, category);

  emitCollegeEvent(collegeId, 'notification:new', { userId, title, message, category });
}

export function logActivity(collegeId: number, actorUserId: number | null, action: string, details = ''): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO activity_logs (college_id, actor_user_id, action, details)
     VALUES (?, ?, ?, ?)`
  ).run(collegeId, actorUserId, action, details);
}

export function computeEffectiveFacultyStatus(
  facultyUserId: number,
  manualStatus: string,
  statusExpiresAt: string | null
): {
  effectiveStatus: string;
  isExpired: boolean;
  timetableSuggestion: string | null;
} {
  const db = getDb();
  const now = new Date();
  const day = now.getDay();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const currentHHMM = `${hh}:${mm}`;

  const activeSlot = db
    .prepare(
      `SELECT subject_name, room_label, suggested_status
       FROM faculty_timetable
       WHERE faculty_user_id = ? AND day_of_week = ? AND start_time <= ? AND end_time >= ?
       LIMIT 1`
    )
    .get(facultyUserId, day, currentHHMM, currentHHMM) as
    | { subject_name: string; room_label: string; suggested_status: string }
    | undefined;

  const timetableSuggestion = activeSlot
    ? `${activeSlot.suggested_status}: ${activeSlot.subject_name} (${activeSlot.room_label})`
    : null;

  if (statusExpiresAt) {
    const expMs = new Date(statusExpiresAt).getTime();
    if (!Number.isNaN(expMs) && expMs < now.getTime()) {
      return {
        effectiveStatus: 'Status Not Confirmed',
        isExpired: true,
        timetableSuggestion,
      };
    }
  }

  return {
    effectiveStatus: manualStatus,
    isExpired: false,
    timetableSuggestion,
  };
}
