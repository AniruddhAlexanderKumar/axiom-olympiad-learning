import { mkdirSync } from 'node:fs';

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  port: num(process.env.PORT, 4000),
  databaseUrl: process.env.DATABASE_URL?.trim() ?? '',
  jwtSecret: process.env.JWT_SECRET?.trim() || 'insecure-development-secret-change-me',
  isProduction: process.env.NODE_ENV === 'production',
  judge0: {
    url: process.env.JUDGE0_URL?.trim().replace(/\/$/, '') ?? '',
    key: process.env.JUDGE0_KEY?.trim() ?? '',
    host: process.env.JUDGE0_HOST?.trim() ?? '',
  },
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() ?? '',
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  contentDir: process.env.CONTENT_DIR?.trim() ?? '',
};

if (config.isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production.');
}

export function ensureDataDir(): string {
  const dir = '.data';
  mkdirSync(dir, { recursive: true });
  return dir;
}
