import crypto from 'crypto';
import { Router } from 'express';
import {
  createSessionToken,
  hashPassword,
  hashToken,
  logActivity,
  requireAuth,
  verifyPassword,
} from '../auth/security.ts';
import { getDb } from '../db/database.ts';

export const authRoutes = Router();

authRoutes.post('/login', (req, res) => {
  const { identifier, password, role } = req.body || {};
  if (!identifier || !password) {
    res.status(400).json({ error: 'College email/ID and password are required.' });
    return;
  }

  const db = getDb();
  const normalized = String(identifier).trim().toLowerCase();
  const user = db
    .prepare(
      `SELECT u.*, c.name AS college_name, c.code AS college_code, d.name AS department_name
       FROM users u
       JOIN colleges c ON c.id = u.college_id
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE lower(u.email) = ? OR lower(u.identifier) = ?`
    )
    .get(normalized, normalized) as any;

  if (!user || !verifyPassword(String(password), user.password_hash)) {
    res.status(401).json({ error: 'Invalid credentials. Check your email/ID and password.' });
    return;
  }

  if (!user.is_active) {
    res.status(403).json({ error: 'Account is deactivated. Contact your college administrator.' });
    return;
  }

  if (role && ['student', 'faculty', 'admin'].includes(role) && user.role !== role) {
    res.status(403).json({
      error: `This account is registered as ${user.role.toUpperCase()}, not ${String(role).toUpperCase()}.`,
    });
    return;
  }

  const token = createSessionToken(user.id);
  logActivity(user.college_id, user.id, 'LOGIN', `${user.role} signed in`);

  res.json({
    token,
    user: {
      id: user.id,
      college_id: user.college_id,
      college_name: user.college_name,
      college_code: user.college_code,
      role: user.role,
      full_name: user.full_name,
      identifier: user.identifier,
      email: user.email,
      department_id: user.department_id,
      department_name: user.department_name,
      student_semester: user.student_semester,
      avatar_url: user.avatar_url || '',
    },
  });
});

authRoutes.post('/forgot-password', (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    res.status(400).json({ error: 'College email is required.' });
    return;
  }
  const db = getDb();
  const user = db
    .prepare('SELECT id, college_id FROM users WHERE lower(email) = ?')
    .get(String(email).trim().toLowerCase()) as { id: number; college_id: number } | undefined;

  if (!user) {
    res.json({
      message: 'If that email exists in Campusmitra, a 6-digit verification code has been issued.',
      demoResetCode: null,
    });
    return;
  }

  const code = String(crypto.randomInt(100000, 999999));
  const codeHash = hashToken(code);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO password_resets (user_id, code_hash, expires_at) VALUES (?, ?, ?)').run(
    user.id,
    codeHash,
    expiresAt
  );

  res.json({
    message: 'Verification code generated. Use it within 15 minutes to reset your password.',
    demoResetCode: process.env.NODE_ENV === 'production' ? null : code,
  });
});

authRoutes.post('/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body || {};
  if (!email || !code || !newPassword || String(newPassword).length < 6) {
    res.status(400).json({ error: 'Email, 6-digit code, and new password (min 6 chars) are required.' });
    return;
  }
  const db = getDb();
  const user = db
    .prepare('SELECT id FROM users WHERE lower(email) = ?')
    .get(String(email).trim().toLowerCase()) as { id: number } | undefined;

  if (!user) {
    res.status(400).json({ error: 'Invalid verification details.' });
    return;
  }

  const resetRow = db
    .prepare(
      `SELECT id, expires_at FROM password_resets
       WHERE user_id = ? AND code_hash = ? AND used = 0
       ORDER BY id DESC LIMIT 1`
    )
    .get(user.id, hashToken(String(code).trim())) as { id: number; expires_at: string } | undefined;

  if (!resetRow || new Date(resetRow.expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: 'Verification code is invalid or expired.' });
    return;
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(String(newPassword)), user.id);
  db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRow.id);
  res.json({ message: 'Password updated successfully. You can now sign in.' });
});

authRoutes.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

authRoutes.post('/logout', requireAuth, (req, res) => {
  if (req.tokenHash) {
    getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.tokenHash);
  }
  res.json({ ok: true });
});

authRoutes.get('/notifications', requireAuth, (req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT id, title, message, category, is_read, created_at
       FROM notifications
       WHERE user_id = ? AND college_id = ?
       ORDER BY id DESC LIMIT 50`
    )
    .all(req.user!.id, req.user!.college_id);
  const unreadCount = (rows as any[]).filter((r) => !r.is_read).length;
  res.json({ notifications: rows, unreadCount });
});

authRoutes.patch('/notifications/:id/read', requireAuth, (req, res) => {
  getDb()
    .prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ? AND college_id = ?')
    .run(Number(req.params.id), req.user!.id, req.user!.college_id);
  res.json({ ok: true });
});

authRoutes.post('/notifications/read-all', requireAuth, (req, res) => {
  getDb()
    .prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND college_id = ?')
    .run(req.user!.id, req.user!.college_id);
  res.json({ ok: true });
});
