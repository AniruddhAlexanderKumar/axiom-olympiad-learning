import express from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { config } from './env.js';

/** Locate the exported Expo web build (app/dist) regardless of the working directory. */
export function resolveWebDir(): string | null {
  const candidates = [
    config.webDir,
    resolve(process.cwd(), '../app/dist'),
    resolve(process.cwd(), 'app/dist'),
    resolve(process.cwd(), 'dist'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const dir = resolve(candidate);
    if (existsSync(resolve(dir, 'index.html'))) return dir;
  }
  return null;
}

/**
 * Serve the single-page web client. API routes are mounted under /api before
 * this runs, so a hard refresh on a client route still returns index.html.
 * The shell is read once at boot: it is a few kilobytes and never changes
 * without a redeploy.
 */
export function mountWeb(app: express.Express, webDir: string | null): void {
  if (!webDir) {
    console.log('[api] no web build found (run `npm run build`); serving the API only');
    return;
  }

  let shell: string;
  try {
    shell = readFileSync(resolve(webDir, 'index.html'), 'utf8');
  } catch (error) {
    console.error('[api] could not read the web client shell', error);
    return;
  }
  console.log(`[api] serving the web client from ${webDir}`);

  app.use(
    express.static(webDir, {
      index: false,
      maxAge: '1h',
      setHeaders: (res, path) => {
        if (path.includes('_expo')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    // Never let an unmatched API call fall through to the HTML shell.
    if (req.path === '/api' || req.path.startsWith('/api/')) return next();
    // A missing asset should 404 instead of returning HTML.
    if (extname(req.path)) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(shell);
  });
}
