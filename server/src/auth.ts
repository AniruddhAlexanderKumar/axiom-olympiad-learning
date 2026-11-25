import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import type { RequestHandler } from 'express';
import { queryOne } from './db.js';
import { config } from './env.js';
import { HttpError } from './http.js';

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  onboardingComplete: boolean;
  language: string;
  goal: string | null;
  placementSkillId: string | null;
  dailyGoalXp: number;
}

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(payload: string): string {
  return createHmac('sha256', config.jwtSecret).update(payload).digest('base64url');
}

export function issueToken(userId: string): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(JSON.stringify({ sub: userId, iat: now, exp: now + TOKEN_TTL_SECONDS }));
  return `${header}.${body}.${sign(`${header}.${body}`)}`;
}

export function verifyToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = sign(`${header}.${body}`);
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      sub?: string;
      exp?: number;
    };
    if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')): string {
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, salt, digest] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !digest) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function loadUser(userId: string): Promise<SessionUser | null> {
  return queryOne<SessionUser>(
    `SELECT id, email, display_name AS "displayName", onboarding_complete AS "onboardingComplete",
            language, goal, placement_skill_id AS "placementSkillId", daily_goal_xp AS "dailyGoalXp"
       FROM users WHERE id = $1`,
    [userId],
  );
}

export interface AuthedRequest extends Express.Request {
  user?: SessionUser;
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const userId = token ? verifyToken(token) : null;
    if (!userId) throw new HttpError(401, 'Sign in to continue.');
    const user = await loadUser(userId);
    if (!user) throw new HttpError(401, 'This account no longer exists.');
    (req as AuthedRequest).user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export function currentUser(req: Express.Request): SessionUser {
  const user = (req as AuthedRequest).user;
  if (!user) throw new HttpError(401, 'Sign in to continue.');
  return user;
}
