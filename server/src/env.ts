import { existsSync, mkdirSync } from 'node:fs';

// Support the documented `cp .env.example .env` flow without adding a dotenv
// dependency. Variables already in the environment always win.
if (typeof process.loadEnvFile === 'function') {
  for (const file of ['.env', '../.env']) {
    if (!existsSync(file)) continue;
    try {
      process.loadEnvFile(file);
    } catch {
      console.warn(`[api] could not read ${file}`);
    }
    break;
  }
}

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function trim(value: string | undefined): string {
  return value?.trim() ?? '';
}

/**
 * Render's internal Postgres hostname has no dots (dpg-xxxx-a); the external
 * hostname does. Docker service names (postgres, judge0-db) and localhost do
 * not need TLS. DATABASE_SSL=true|false overrides the detection.
 */
function needsSsl(url: string): boolean {
  const override = trim(process.env.DATABASE_SSL).toLowerCase();
  if (override) return !['0', 'false', 'off', 'no', 'disable'].includes(override);
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
    return hostname.includes('.');
  } catch {
    return false;
  }
}

const databaseUrl = trim(process.env.DATABASE_URL);
const publicUrl = (trim(process.env.PUBLIC_URL) || trim(process.env.RENDER_EXTERNAL_URL)).replace(/\/+$/, '');
const corsOrigins = (trim(process.env.CORS_ORIGINS) || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

export const config = {
  port: num(process.env.PORT, 4000),
  host: trim(process.env.HOST) || '0.0.0.0',
  databaseUrl,
  databaseSsl: needsSsl(databaseUrl),
  jwtSecret: trim(process.env.JWT_SECRET) || 'insecure-development-secret-change-me',
  isProduction: process.env.NODE_ENV === 'production',
  isRender: Boolean(trim(process.env.RENDER)),
  publicUrl,
  judge0: {
    url: trim(process.env.JUDGE0_URL).replace(/\/$/, ''),
    key: trim(process.env.JUDGE0_KEY),
    host: trim(process.env.JUDGE0_HOST),
  },
  corsOrigins: [...new Set([...corsOrigins, publicUrl].filter(Boolean))],
  contentDir: trim(process.env.CONTENT_DIR),
  webDir: trim(process.env.WEB_DIR),
};

if (config.isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production.');
}

// Render's filesystem is ephemeral, so the embedded PGlite database would be
// wiped on every deploy. Fail fast instead of silently losing student data.
if (config.isProduction && config.isRender && !config.databaseUrl) {
  throw new Error(
    'DATABASE_URL must be set on Render. Attach a Render Postgres database (render.yaml does this) so progress is not lost when the service redeploys.',
  );
}

if (config.isProduction && !config.databaseUrl) {
  console.warn('[api] NODE_ENV=production without DATABASE_URL: using embedded PGlite, which is not durable on most hosts.');
}

export function ensureDataDir(): string {
  const dir = '.data';
  mkdirSync(dir, { recursive: true });
  return dir;
}
