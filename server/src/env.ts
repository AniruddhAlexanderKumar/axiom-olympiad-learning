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

const isRender = Boolean(trim(process.env.RENDER));
const isVercel = Boolean(trim(process.env.VERCEL) || trim(process.env.VERCEL_ENV));
// Hosted production deployments are treated as production even if NODE_ENV was
// not explicitly set, so required secrets are still validated on those hosts.
const isProduction =
  process.env.NODE_ENV === 'production' ||
  isRender ||
  isVercel;

export const config = {
  port: num(process.env.PORT, 4000),
  host: trim(process.env.HOST) || '0.0.0.0',
  databaseUrl,
  databaseSsl: needsSsl(databaseUrl),
  // Development keeps a clearly-labelled fallback so the app runs without
  // configuration. Production must provide JWT_SECRET (validated below).
  jwtSecret: trim(process.env.JWT_SECRET) || 'insecure-development-secret-change-me',
  isProduction,
  isRender,
  isVercel,
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

if (config.isProduction) {
  const jwtSecretRaw = process.env.JWT_SECRET;
  const jwtSecretAliases = ['JWT_KEY', 'AUTH_SECRET', 'SESSION_SECRET', 'JWT_TOKEN_SECRET'].filter(
    (name) => trim(process.env[name]),
  );
  if (!jwtSecretRaw || !jwtSecretRaw.trim()) {
    if (jwtSecretAliases.length > 0) {
      throw new Error(
        `JWT_SECRET must be set in production. Found ${jwtSecretAliases.join(', ')} but this app only reads JWT_SECRET; ` +
          'rename that variable to JWT_SECRET. Generate a value with `openssl rand -hex 32` and add it as JWT_SECRET ' +
          'in your host dashboard (Vercel: Project Settings -> Environment Variables; Render: service Environment). ' +
          'Never commit the value.',
      );
    }
    throw new Error(
      'JWT_SECRET must be set in production. Generate a value with `openssl rand -hex 32` ' +
        '(or `node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"`) and add it as an environment ' +
        'variable named JWT_SECRET in your host dashboard (Vercel: Project Settings -> Environment Variables; ' +
        'Render: service Environment). Never commit the value or reuse a placeholder.',
    );
  }

  const normalizedSecret = jwtSecretRaw.trim().toLowerCase();
  const placeholderSecrets = new Set([
    'change-me',
    'changeme',
    'secret',
    'test-secret',
    'insecure-development-secret-change-me',
  ]);
  if (
    placeholderSecrets.has(normalizedSecret) ||
    normalizedSecret.includes('change-me') ||
    normalizedSecret.includes('replace-with') ||
    normalizedSecret.length < 32
  ) {
    throw new Error(
      'JWT_SECRET is set but looks like a placeholder or is too short. Replace it with a strong random value ' +
        '(`openssl rand -hex 32`) in your host dashboard and redeploy. Never commit the value.',
    );
  }
}

// Render and Vercel have ephemeral/read-only filesystems, so the embedded PGlite
// database would be lost (or fail to start) on every deploy. Fail fast instead
// of silently losing student data.
if (config.isProduction && (config.isRender || config.isVercel) && !config.databaseUrl) {
  throw new Error(
    'DATABASE_URL must be set on Render/Vercel. Attach or point at a PostgreSQL database ' +
      '(Render Postgres, Neon or Supabase) so progress survives redeploys. Local production builds can leave it unset.',
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
