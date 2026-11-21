import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { ffDb } from '../facultyDb/database.ts';

export type FfRole = 'student' | 'faculty' | 'admin';

export interface FfAuthUser {
  id: number;
  college_id: number;
  college_name: string;
  college_code: string;
  email: string;
  identifier: string;
  full_name: string;
  role: FfRole;
  department_id: number | null;
  department_name: string | null;
  designation: string | null;
  cabin_number: string | null;
  building_id: number | null;
  working_hours: string | null;
  semester: number | null;
  is_active: number;
}

export interface FfAuthedRequest extends Request {
  ffUser?: FfAuthUser;
  ffTokenHash?: string;
}

let ioServer: SocketIOServer | null = null;

export function setFfSocketServer(io: SocketIOServer): void {
  ioServer = io;
}

export function emitCollegeEvent(collegeId: number, event: string, payload: unknown): void {
  if (!ioServer) return;
  ioServer.to(`ff:college:${collegeId}`).emit(event, payload);
}

export function emitUserEvent(userId: number, event: string, payload: unknown): void {
  if (!ioServer) return;
  ioServer.to(`ff:user:${userId}`).emit(event, payload);
}

export function hashFfPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash: derived, salt };
}

export function verifyFfPassword(password: string, storedHash: string, storedSalt: string): boolean {
  const { hash } = hashFfPassword(password, storedSalt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function generateFfSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashFfToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const ffLoginAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkFfLoginRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = ffLoginAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    ffLoginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 15) return false;
  entry.count += 1;
  return true;
}

export function clearFfLoginRateLimit(key: string): void {
  ffLoginAttempts.delete(key);
}

export function resolveFfUserFromToken(rawToken: string): { user: FfAuthUser; tokenHash: string } | null {
  if (!rawToken || rawToken.length < 20) return null;
  const tokenHash = hashFfToken(rawToken);
  const row = ffDb
    .prepare(
      `SELECT
         u.id, u.college_id, c.name AS college_name, c.code AS college_code,
         u.email, u.identifier, u.full_name, u.role,
         u.department_id, d.name AS department_name,
         u.designation, u.cabin_number, u.building_id, u.working_hours, u.semester,
         u.is_active, sess.expires_at
       FROM ff_sessions sess
       JOIN ff_users u ON u.id = sess.user_id
       JOIN ff_colleges c ON c.id = u.college_id
       LEFT JOIN ff_departments d ON d.id = u.department_id
       WHERE sess.token_hash = ?`
    )
    .get(tokenHash) as (FfAuthUser & { expires_at: string }) | undefined;

  if (!row || !row.is_active) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    ffDb.prepare('DELETE FROM ff_sessions WHERE token_hash = ?').run(tokenHash);
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
      department_id: row.department_id,
      department_name: row.department_name,
      designation: row.designation,
      cabin_number: row.cabin_number,
      building_id: row.building_id,
      working_hours: row.working_hours,
      semester: row.semester,
      is_active: row.is_active,
    },
  };
}

export function requireFfAuth(req: FfAuthedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || '';
  const rawToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const resolved = resolveFfUserFromToken(rawToken);
  if (!resolved) {
    res.status(401).json({ error: 'Authentication required. Please sign in to Campusmitra.' });
    return;
  }
  req.ffUser = resolved.user;
  req.ffTokenHash = resolved.tokenHash;
  next();
}

export function requireFfRole(...roles: FfRole[]) {
  return (req: FfAuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.ffUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!roles.includes(req.ffUser.role)) {
      res.status(403).json({ error: 'You do not have permission to access this resource.' });
      return;
    }
    next();
  };
}

export function pushFfNotification(collegeId: number, userId: number, title: string, message: string): void {
  ffDb
    .prepare('INSERT INTO ff_notifications (college_id, user_id, title, message) VALUES (?, ?, ?, ?)')
    .run(collegeId, userId, title, message);
  emitUserEvent(userId, 'notification:created', { title, message });
}

interface TimetableRow {
  day_of_week: string;
  start_time: string;
  end_time: string;
  subject: string;
  room: string;
  activity_type: string;
}

interface StatusRow {
  manual_status: string;
  status_message: string;
  expected_return_time: string;
  location_label: string;
  expires_at: string | null;
  queue_open: number;
  updated_at: string;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function computeEffectiveFacultyStatus(
  statusRow: StatusRow | undefined,
  timetableRows: TimetableRow[]
): {
  effective_status: string;
  is_expired: boolean;
  timetable_suggestion: string | null;
} {
  const now = new Date();
  const dayName = WEEKDAYS[now.getDay()];
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const activeSlot = timetableRows.find(
    (slot) => slot.day_of_week === dayName && slot.start_time <= currentHHMM && currentHHMM < slot.end_time
  );

  const timetable_suggestion = activeSlot
    ? `Timetable: ${activeSlot.activity_type} (${activeSlot.subject} in ${activeSlot.room}, ${activeSlot.start_time}–${activeSlot.end_time})`
    : null;

  if (!statusRow) {
    return {
      effective_status: 'Status Not Confirmed',
      is_expired: true,
      timetable_suggestion,
    };
  }

  const isExpired = Boolean(statusRow.expires_at && new Date(statusRow.expires_at).getTime() < now.getTime());
  return {
    effective_status: isExpired ? 'Status Not Confirmed' : statusRow.manual_status,
    is_expired: isExpired,
    timetable_suggestion,
  };
}
