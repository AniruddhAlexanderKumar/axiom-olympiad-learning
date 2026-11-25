import express from 'express';
import { config } from './env.js';
import { errorHandler } from './http.js';
import { authRouter } from './routes/auth.js';
import { competeRouter } from './routes/compete.js';
import { contestsRouter } from './routes/contests.js';
import { learnRouter } from './routes/learn.js';
import { meRouter } from './routes/me.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
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

  app.get('/health', (_req, res) => {
    res.json({ ok: true, judge0: Boolean(config.judge0.url) });
  });

  app.use('/auth', authRouter);
  app.use(learnRouter);
  app.use(competeRouter);
  app.use(contestsRouter);
  app.use(meRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });
  app.use(errorHandler);
  return app;
}
