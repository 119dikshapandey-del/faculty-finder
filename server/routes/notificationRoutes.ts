import { Router } from 'express';
import { db } from '../db/database.ts';
import { type AuthedRequest, requireAuth } from '../auth/security.ts';

export const notificationRoutes = Router();

notificationRoutes.use(requireAuth);

notificationRoutes.get('/', (req: AuthedRequest, res) => {
  const user = req.user!;
  const notifications = db
    .prepare(
      `SELECT * FROM notifications
       WHERE college_id = ? AND user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 60`
    )
    .all(user.college_id, user.id);

  const unreadRow = db
    .prepare('SELECT COUNT(*) AS count FROM notifications WHERE college_id = ? AND user_id = ? AND is_read = 0')
    .get(user.college_id, user.id) as { count: number };

  res.json({ notifications, unreadCount: unreadRow.count });
});

notificationRoutes.patch('/:id/read', (req: AuthedRequest, res) => {
  const user = req.user!;
  const id = Number(req.params.id);
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ? AND college_id = ?').run(
    id,
    user.id,
    user.college_id
  );
  res.json({ success: true });
});

notificationRoutes.post('/read-all', (req: AuthedRequest, res) => {
  const user = req.user!;
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND college_id = ?').run(user.id, user.college_id);
  res.json({ success: true });
});
