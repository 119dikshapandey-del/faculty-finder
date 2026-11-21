import http from 'http';
import path from 'path';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { hashToken, setSocketServer } from './server/auth/security.ts';
import { getDb, initializeDatabase } from './server/db/database.ts';
import { seedDatabaseIfEmpty } from './server/db/seed.ts';
import { adminRoutes } from './server/routes/adminRoutes.ts';
import { authRoutes } from './server/routes/authRoutes.ts';
import { facultyRoutes } from './server/routes/facultyRoutes.ts';
import { studentRoutes } from './server/routes/studentRoutes.ts';

async function startServer() {
  initializeDatabase();
  seedDatabaseIfEmpty();

  const app = express();
  const httpServer = http.createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
  });

  io.use((socket, next) => {
    const rawToken = String(socket.handshake.auth?.token || '');
    if (!rawToken) {
      next(new Error('Unauthorized'));
      return;
    }
    const row = getDb()
      .prepare(
        `SELECT u.id, u.college_id
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND u.is_active = 1`
      )
      .get(hashToken(rawToken)) as { id: number; college_id: number } | undefined;

    if (!row) {
      next(new Error('Invalid session'));
      return;
    }
    socket.data.userId = row.id;
    socket.data.collegeId = row.college_id;
    next();
  });

  io.on('connection', (socket) => {
    const collegeId = socket.data.collegeId;
    if (collegeId) {
      socket.join(`college:${collegeId}`);
    }
  });

  setSocketServer(io);

  app.use(express.json({ limit: '2mb' }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'campusmitra-faculty-finder', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/student', studentRoutes);
  app.use('/api/faculty', facultyRoutes);
  app.use('/api/admin', adminRoutes);

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Campusmitra Server Error]', err);
    res.status(500).json({ error: err.message || 'An unexpected server error occurred.' });
  });

  const PORT = Number(process.env.PORT || 3001);
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Campusmitra Faculty Finder server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Campusmitra server:', err);
  process.exit(1);
});
