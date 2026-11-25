import { Router } from 'express';
import { query, queryOne } from '../db.js';
import {
  currentUser,
  hashPassword,
  issueToken,
  loadUser,
  requireAuth,
  verifyPassword,
} from '../auth.js';
import { getContent } from '../content.js';
import { HttpError, wrap } from '../http.js';
import { getStats, recordActivity } from '../progress.js';

export const authRouter = Router();

interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  display_name: string;
}

function sessionPayload(userId: string) {
  return loadUser(userId).then((user) => ({ token: issueToken(userId), user }));
}

authRouter.post(
  '/register',
  wrap(async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const displayName = String(req.body?.displayName ?? '').trim() || email.split('@')[0] || 'Learner';

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
    if (password.length < 8) throw new HttpError(400, 'Use at least 8 characters for your password.');

    const existing = await queryOne<UserRow>('SELECT id FROM users WHERE email = $1', [email]);
    if (existing) throw new HttpError(409, 'An account with that email already exists.');

    const created = await queryOne<{ id: string }>(
      'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id',
      [email, hashPassword(password), displayName.slice(0, 40)],
    );
    if (!created) throw new HttpError(500, 'Could not create the account.');
    await getStats(created.id);
    await recordActivity(created.id);
    res.status(201).json(await sessionPayload(created.id));
  }),
);

authRouter.post(
  '/login',
  wrap(async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const user = await queryOne<UserRow>('SELECT id, password_hash FROM users WHERE email = $1', [email]);
    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new HttpError(401, 'That email and password do not match.');
    }
    await recordActivity(user.id);
    res.json(await sessionPayload(user.id));
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  wrap(async (req, res) => {
    res.json({ user: currentUser(req) });
  }),
);

authRouter.get(
  '/onboarding',
  requireAuth,
  wrap(async (req, res) => {
    const content = await getContent();
    res.json({
      user: currentUser(req),
      goals: [
        { id: 'learn', title: 'Learn to code', description: 'Start from zero and build real fluency.' },
        { id: 'compete', title: 'Prepare for contests', description: 'Train for USACO, ACSL and more.' },
        { id: 'both', title: 'Both', description: 'Learn the language, then compete with it.' },
      ],
      tracks: content.learnTracks.map((track) => ({
        id: track.id,
        title: track.title,
        language: track.language,
        description: track.description,
        available: track.available,
      })),
    });
  }),
);

authRouter.post(
  '/onboarding',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const goal = String(req.body?.goal ?? 'both');
    const language = String(req.body?.language ?? 'python');
    const dailyGoalXp = Number(req.body?.dailyGoalXp ?? 50);
    if (!['learn', 'compete', 'both'].includes(goal)) throw new HttpError(400, 'Pick a goal.');

    const content = await getContent();
    const track = content.learnTracks.find((entry) => entry.language === language && entry.available);
    if (!track) throw new HttpError(400, 'That language track is not available yet.');

    await query(
      `UPDATE users SET goal = $2, language = $3, daily_goal_xp = $4 WHERE id = $1`,
      [user.id, goal, language, Math.min(200, Math.max(20, Number.isFinite(dailyGoalXp) ? dailyGoalXp : 50))],
    );
    res.json({ user: await loadUser(user.id) });
  }),
);

authRouter.get(
  '/onboarding/placement',
  requireAuth,
  wrap(async (_req, res) => {
    const content = await getContent();
    res.json({
      questions: content.placement.map((question) => ({
        id: question.id,
        skillId: question.skillId,
        prompt: question.prompt,
        code: question.code,
        options: question.options,
      })),
    });
  }),
);

authRouter.post(
  '/onboarding/placement',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const content = await getContent();
    const answers = (req.body?.answers ?? {}) as Record<string, string>;
    const bySkill = new Map<string, { correct: number; total: number }>();

    for (const question of content.placement) {
      const entry = bySkill.get(question.skillId) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (answers[question.id] === question.answer) entry.correct += 1;
      bySkill.set(question.skillId, entry);
    }

    const track = content.learnTracks.find((entry) => entry.language === user.language) ?? content.learnTracks[0];
    const skillOrder = track?.skills.map((skill) => skill.id) ?? [];
    let startIndex = 0;
    while (startIndex < skillOrder.length) {
      const score = bySkill.get(skillOrder[startIndex] as string);
      if (!score || score.correct / score.total < 0.75) break;
      startIndex += 1;
    }
    const placementSkillId = skillOrder[Math.min(startIndex, skillOrder.length - 1)] ?? null;

    await query('UPDATE users SET placement_skill_id = $2, onboarding_complete = true WHERE id = $1', [
      user.id,
      placementSkillId,
    ]);
    res.json({
      user: await loadUser(user.id),
      placementSkillId,
      recommendation:
        startIndex === 0
          ? 'Start at the beginning of the skill tree.'
          : `You can skip ahead to ${track?.skills[startIndex]?.title ?? 'the next skill'}.`,
    });
  }),
);
