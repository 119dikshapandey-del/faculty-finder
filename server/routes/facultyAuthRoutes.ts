import crypto from 'crypto';
import { Router } from 'express';
import { ffDb } from '../facultyDb/database.ts';
import {
  checkFfLoginRateLimit,
  clearFfLoginRateLimit,
  generateFfSessionToken,
  hashFfPassword,
  hashFfToken,
  requireFfAuth,
  verifyFfPassword,
  type FfAuthedRequest,
} from '../facultyAuth/security.ts';

export const facultyAuthRoutes = Router();

facultyAuthRoutes.post('/login', (req, res) => {
  const { identifier, password, role } = req.body as {
    identifier?: string;
    password?: string;
    role?: string;
  };
  const cleanId = (identifier || '').trim();
  if (!cleanId || !password) {
    res.status(400).json({ error: 'Please enter your college email or ID and password.' });
    return;
  }

  const rateKey = `${req.ip}:${cleanId.toLowerCase()}`;
  if (!checkFfLoginRateLimit(rateKey)) {
    res.status(429).json({ error: 'Too many login attempts. Please wait 15 minutes before trying again.' });
    return;
  }

  const user = ffDb
    .prepare(
      `SELECT
         u.*, c.name AS college_name, c.code AS college_code,
         d.name AS department_name
       FROM ff_users u
       JOIN ff_colleges c ON c.id = u.college_id
       LEFT JOIN ff_departments d ON d.id = u.department_id
       WHERE lower(u.email) = lower(?) OR lower(u.identifier) = lower(?)
       LIMIT 1`
    )
    .get(cleanId, cleanId) as any;

  if (!user || !user.is_active || !verifyFfPassword(password, user.password_hash, user.password_salt)) {
    res.status(401).json({ error: 'Invalid college email/ID or password.' });
    return;
  }

  if (role && ['student', 'faculty', 'admin'].includes(role) && user.role !== role) {
    res.status(403).json({
      error: `This account is registered as ${user.role.toUpperCase()}. Please use the ${user.role} login option.`,
    });
    return;
  }

  clearFfLoginRateLimit(rateKey);

  const rawToken = generateFfSessionToken();
  const tokenHash = hashFfToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  ffDb.prepare('INSERT INTO ff_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(
    user.id,
    tokenHash,
    expiresAt
  );

  res.json({
    token: rawToken,
    user: {
      id: user.id,
      college_id: user.college_id,
      college_name: user.college_name,
      college_code: user.college_code,
      email: user.email,
      identifier: user.identifier,
      full_name: user.full_name,
      role: user.role,
      department_id: user.department_id,
      department_name: user.department_name,
      designation: user.designation,
      cabin_number: user.cabin_number,
      building_id: user.building_id,
      working_hours: user.working_hours,
      semester: user.semester,
    },
  });
});

facultyAuthRoutes.post('/forgot-password', (req, res) => {
  const { email } = req.body as { email?: string };
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) {
    res.status(400).json({ error: 'Please provide your college email address.' });
    return;
  }

  const user = ffDb.prepare('SELECT id FROM ff_users WHERE lower(email) = ?').get(cleanEmail) as
    | { id: number }
    | undefined;
  let demoResetCode: string | null = null;
  if (user) {
    const code = String(crypto.randomInt(100000, 999999));
    const codeHash = hashFfToken(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    ffDb.prepare('INSERT INTO ff_password_resets (user_id, code_hash, expires_at) VALUES (?, ?, ?)').run(
      user.id,
      codeHash,
      expiresAt
    );
    if (process.env.NODE_ENV !== 'production') {
      demoResetCode = code;
    }
  }

  res.json({
    message: 'If an account matches this college email, a 6-digit password reset code has been generated.',
    demoResetCode,
  });
});

facultyAuthRoutes.post('/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body as { email?: string; code?: string; newPassword?: string };
  if (!email || !code || !newPassword || newPassword.length < 6) {
    res.status(400).json({ error: 'Valid email, 6-digit verification code, and password (6+ chars) are required.' });
    return;
  }

  const user = ffDb.prepare('SELECT id FROM ff_users WHERE lower(email) = lower(?)').get(email.trim()) as
    | { id: number }
    | undefined;
  if (!user) {
    res.status(400).json({ error: 'Invalid verification code or email.' });
    return;
  }

  const resetRow = ffDb
    .prepare(
      'SELECT * FROM ff_password_resets WHERE user_id = ? AND used = 0 ORDER BY id DESC LIMIT 1'
    )
    .get(user.id) as any;

  if (!resetRow || new Date(resetRow.expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: 'Verification code is invalid or expired.' });
    return;
  }

  if (hashFfToken(code.trim()) !== resetRow.code_hash) {
    res.status(400).json({ error: 'Incorrect verification code.' });
    return;
  }

  const { hash, salt } = hashFfPassword(newPassword);
  ffDb.prepare('UPDATE ff_users SET password_hash = ?, password_salt = ? WHERE id = ?').run(hash, salt, user.id);
  ffDb.prepare('UPDATE ff_password_resets SET used = 1 WHERE id = ?').run(resetRow.id);
  ffDb.prepare('DELETE FROM ff_sessions WHERE user_id = ?').run(user.id);

  res.json({ message: 'Password updated. Please sign in with your new password.' });
});

facultyAuthRoutes.get('/me', requireFfAuth, (req: FfAuthedRequest, res) => {
  res.json({ user: req.ffUser });
});

facultyAuthRoutes.post('/logout', requireFfAuth, (req: FfAuthedRequest, res) => {
  if (req.ffTokenHash) {
    ffDb.prepare('DELETE FROM ff_sessions WHERE token_hash = ?').run(req.ffTokenHash);
  }
  res.json({ message: 'Signed out.' });
});
