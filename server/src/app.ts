import express, { Router } from 'express';
import { config } from './env.js';
import { errorHandler } from './http.js';
import { authRouter } from './routes/auth.js';
import { competeRouter } from './routes/compete.js';
import { contestsRouter } from './routes/contests.js';
import { learnRouter } from './routes/learn.js';
import { meRouter } from './routes/me.js';
import { mountWeb, resolveWebDir } from './web.js';

export function createApp({ serveWeb = true } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Render terminates TLS in front of the service.
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '256kb' }));

  app.use((req, res, next) => {
    const origin = req.header('origin');
    const allowed =
      !origin ||
      config.corsOrigins.includes(origin) ||
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
      /^exp:\/\//.test(origin);
    if (origin && allowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  const webDir = serveWeb ? resolveWebDir() : null;
  const health = (_req: express.Request, res: express.Response) => {
    res.json({
      ok: true,
      database: config.databaseUrl ? 'postgres' : 'pglite',
      judge0: Boolean(config.judge0.url),
      web: Boolean(webDir),
    });
  };
  app.get('/health', health);
  app.get('/healthz', health);

  const api = Router();
  api.use('/auth', authRouter);
  api.use(learnRouter);
  api.use(competeRouter);
  api.use(contestsRouter);
  api.use(meRouter);
  app.use('/api', api);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  if (serveWeb) mountWeb(app, webDir);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });
  app.use(errorHandler);
  return app;
}
