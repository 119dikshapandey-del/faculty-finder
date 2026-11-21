import http from 'http';
import path from 'path';
import express from 'express';
import { initializeDatabase } from './server/db/database.ts';
import { seedDatabaseIfEmpty } from './server/db/seed.ts';
import { authRoutes } from './server/routes/authRoutes.ts';
import { studentRoutes } from './server/routes/studentRoutes.ts';
import { academicResourcesRoutes } from './server/routes/academicResourcesRoutes.ts';
import { resultImportRoutes } from './server/routes/resultImportRoutes.ts';
import { adminRoutes } from './server/routes/adminRoutes.ts';
import { notificationRoutes } from './server/routes/notificationRoutes.ts';

async function startServer() {
  // 1. Initialize SQLite database schema and seed realistic KT Buddy academic data
  initializeDatabase();
  seedDatabaseIfEmpty();

  const app = express();
  const httpServer = http.createServer(app);

  // 2. Security & JSON middleware
  app.use(express.json({ limit: '2mb' }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // 3. Mount modular API routes
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'kt-buddy', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/student', studentRoutes);
  app.use('/api/resources', academicResourcesRoutes);
  app.use('/api/admin', resultImportRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/notifications', notificationRoutes);

  // 4. Vite middleware in dev or static dist in production
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

  // Global error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[KT Buddy Server Error]', err);
    res.status(500).json({ error: err.message || 'An unexpected server error occurred.' });
  });

  const PORT = Number(process.env.PORT || 3000);
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`KT Buddy server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start KT Buddy server:', err);
  process.exit(1);
});
