import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { getDbStatus } from './config/db.ts';
import { getEnv } from './config/env.ts';
import adminRoutes from './routes/admin.ts';
import authRoutes from './routes/auth.ts';
import groupRoutes from './routes/groups.ts';
import matchRoutes from './routes/matches.ts';
import notificationRoutes from './routes/notifications.ts';
import requestRoutes from './routes/requests.ts';
import { corsOptionsDelegate } from './utils/cors.ts';

export function createExpressApp() {
  const app = express();
  const { nodeEnv } = getEnv();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(cors(corsOptionsDelegate));

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  if (nodeEnv !== 'test') {
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many authentication attempts. Please try again shortly.' },
    });
    app.use('/api/auth', authLimiter);

    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 600,
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use('/api', apiLimiter);
  }

  app.get('/api/health', (_req, res) => {
    const db = getDbStatus();
    const ok = db.state === 'connected';
    res.status(200).json({
      service: 'JoinTogether API',
      status: ok ? 'ok' : 'degraded',
      database: db,
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/requests', requestRoutes);
  app.use('/api/matches', matchRoutes);
  app.use('/api/groups', groupRoutes);
  app.use('/api/notifications', notificationRoutes);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err.message === 'Not allowed by CORS') {
      res.status(403).json({ error: 'Origin not permitted by CORS policy' });
      return;
    }
    console.error('Unhandled API error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
