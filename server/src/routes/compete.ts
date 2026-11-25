import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { currentUser, requireAuth } from '../auth.js';
import { evaluateBadgesSafe } from '../badges.js';
import { getContent, findTopic, type Problem } from '../content.js';
import { query, queryOne } from '../db.js';
import { HttpError, wrap } from '../http.js';
import { gradeChallenge, challengeXp } from '../grade.js';
import { LANGUAGE_LABELS, judgeConfigured, runTests } from '../judge0.js';
import { publicChallenge } from '../serialize.js';
import {
  addXp,
  completedSkills,
  getStats,
  recordActivity,
  recordAttempt,
  tierUnlocked,
} from '../progress.js';

export const competeRouter = Router();

function publicProblem(problem: Problem, extras: Record<string, unknown> = {}) {
  const { tests, editorial, ...rest } = problem;
  return {
    ...rest,
    sampleTest: tests[0] ?? null,
    testCount: tests.length,
    editorial,
    ...extras,
  };
}

competeRouter.get(
  '/compete',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const content = await getContent();
    const skills = await completedSkills(user.id);
    const solvedRows = await query<{ problem_id: string }>(
      'SELECT problem_id FROM problem_progress WHERE user_id = $1 AND solved = true',
      [user.id],
    );
    const solved = new Set(solvedRows.map((row) => row.problem_id));
    const masteryRows = await query<{ topic_id: string; correct: number; total: number }>(
      'SELECT topic_id, correct, total FROM topic_mastery WHERE user_id = $1',
      [user.id],
    );
    const mastery = new Map(masteryRows.map((row) => [row.topic_id, row]));

    const tracks = await Promise.all(
      content.competeTracks.map(async (track) => {
        const tiers = [];
        for (const tier of track.tiers) {
          const unlocked = await tierUnlocked(user.id, tier.unlockSkills);
          tiers.push({
            id: tier.id,
            title: tier.title,
            description: tier.description,
            unlocked,
            unlockSkills: tier.unlockSkills.filter((skill) => !skills.has(skill)),
            topics: tier.topics.map((topic) => {
              const problems = topic.problemIds
                .map((id) => content.problems.get(id))
                .filter((problem): problem is Problem => Boolean(problem));
              const record = mastery.get(topic.id);
              return {
                id: topic.id,
                title: topic.title,
                summary: topic.summary,
                unlocked: unlocked,
                mastery: record && record.total > 0 ? record.correct / record.total : 0,
                problems: problems.length,
                solved: problems.filter((problem) => solved.has(problem.id)).length,
              };
            }),
          });
        }
        return {
          id: track.id,
          title: track.title,
          description: track.description,
          available: track.available,
          tiers,
        };
      }),
    );

    res.json({
      tracks,
      contestLanguages: Object.entries(LANGUAGE_LABELS).map(([id, label]) => ({ id, label })),
      contestLanguage: (await getStats(user.id)).contestLanguage,
      judgeConfigured: judgeConfigured(),
    });
  }),
);

competeRouter.get(
  '/compete/topics/:topicId',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const content = await getContent();
    const found = findTopic(content, String(req.params.topicId));
    if (!found) throw new HttpError(404, 'That topic does not exist.');
    const { track, tier, topic } = found;
    const unlocked = await tierUnlocked(user.id, tier.unlockSkills);
    if (!unlocked) throw new HttpError(403, 'Finish the Learn lessons that unlock this tier first.');

    const solvedRows = await query<{ problem_id: string; solved: boolean; attempts: number }>(
      'SELECT problem_id, solved, attempts FROM problem_progress WHERE user_id = $1',
      [user.id],
    );
    const progress = new Map(solvedRows.map((row) => [row.problem_id, row]));

    res.json({
      track: { id: track.id, title: track.title },
      tier: { id: tier.id, title: tier.title },
      topic: {
        id: topic.id,
        title: topic.title,
        summary: topic.summary,
        explanation: topic.lesson.explanation,
        workedExample: topic.lesson.workedExample,
        editorial: topic.editorial,
        checks: topic.lesson.checks.map(publicChallenge),
        problems: topic.problemIds
          .map((id) => content.problems.get(id))
          .filter((problem): problem is Problem => Boolean(problem))
          .map((problem) => ({
            id: problem.id,
            title: problem.title,
            difficulty: problem.difficulty,
            points: problem.points,
            solved: progress.get(problem.id)?.solved ?? false,
            attempts: progress.get(problem.id)?.attempts ?? 0,
          })),
      },
    });
  }),
);

competeRouter.post(
  '/compete/topics/:topicId/check',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const content = await getContent();
    const found = findTopic(content, String(req.params.topicId));
    if (!found) throw new HttpError(404, 'That topic does not exist.');
    const challenge = found.topic.lesson.checks.find((entry) => entry.id === String(req.body?.challengeId));
    if (!challenge) throw new HttpError(404, 'Unknown question.');

    const graded = gradeChallenge(challenge, req.body?.answer);
    if (!graded) throw new HttpError(400, 'This question needs code to grade.');
    await recordAttempt(user.id, challenge.id, `topic:${found.topic.id}`, graded.correct);
    await query(
      `INSERT INTO topic_mastery (user_id, topic_id, correct, total) VALUES ($1, $2, $3, 1)
       ON CONFLICT (user_id, topic_id) DO UPDATE
         SET correct = topic_mastery.correct + $3, total = topic_mastery.total + 1, last_seen_at = now()`,
      [user.id, found.topic.id, graded.correct ? 1 : 0],
    );
    if (graded.correct) {
      await addXp(user.id, challengeXp(challenge), 'topic-check');
      await recordActivity(user.id);
    }
    res.json({ result: { ...graded, explanation: challenge.explanation } });
  }),
);

async function loadProblemForUser(problemId: string, userId: string) {
  const content = await getContent();
  const problem = content.problems.get(problemId);
  if (!problem) throw new HttpError(404, 'That problem does not exist.');
  const progress = await queryOne<{ attempts: number; solved: boolean }>(
    'SELECT attempts, solved FROM problem_progress WHERE user_id = $1 AND problem_id = $2',
    [userId, problemId],
  );
  const attempts = Number(progress?.attempts ?? 0);
  const solved = Boolean(progress?.solved);
  const editorialUnlocked = solved || attempts >= problem.editorialUnlockAfterAttempts;
  return { problem, attempts, solved, editorialUnlocked };
}

competeRouter.get(
  '/problems/:problemId',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const { problem, attempts, solved, editorialUnlocked } = await loadProblemForUser(
      String(req.params.problemId),
      user.id,
    );
    const stats = await getStats(user.id);
    const { editorial, ...rest } = publicProblem(problem, { attempts, solved, editorialUnlocked });
    res.json({
      ...rest,
      editorial: editorialUnlocked ? editorial : null,
      editorialHint: editorialUnlocked ? null : `Unlocks after ${problem.editorialUnlockAfterAttempts} attempts or one full pass.`,
      contestLanguage: stats.contestLanguage,
      languages: Object.entries(LANGUAGE_LABELS).map(([id, label]) => ({ id, label })),
      judgeConfigured: judgeConfigured(),
    });
  }),
);

competeRouter.get(
  '/problems/:problemId/editorial',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const { problem, editorialUnlocked } = await loadProblemForUser(String(req.params.problemId), user.id);
    if (!editorialUnlocked) {
      throw new HttpError(403, `Solve it or make ${problem.editorialUnlockAfterAttempts} attempts to unlock the editorial.`);
    }
    res.json({ editorial: problem.editorial });
  }),
);

competeRouter.post(
  '/problems/:problemId/submit',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const content = await getContent();
    const problem = content.problems.get(String(req.params.problemId));
    if (!problem) throw new HttpError(404, 'That problem does not exist.');
    const language = String(req.body?.language ?? 'python');
    const source = String(req.body?.source ?? '');
    const stats = await getStats(user.id);

    const run = await runTests({
      language,
      source,
      tests: problem.tests,
      timeLimitMs: problem.timeLimitMs,
      memoryLimitKb: problem.memoryLimitKb,
    });
    const solved = run.total > 0 && run.passed === run.total;
    const score = run.total === 0 ? 0 : Math.round((problem.points * run.passed) / run.total);

    await query(
      `INSERT INTO problem_submissions (user_id, problem_id, language, source, passed, total, score, status, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [
        user.id,
        problem.id,
        language,
        source,
        run.passed,
        run.total,
        score,
        solved ? 'accepted' : 'failed',
        JSON.stringify(run.outcomes),
      ],
    );

    const existing = await queryOne<{ attempts: number; solved: boolean }>(
      'SELECT attempts, solved FROM problem_progress WHERE user_id = $1 AND problem_id = $2',
      [user.id, problem.id],
    );
    const firstSolve = solved && !existing?.solved;
    await query(
      `INSERT INTO problem_progress (user_id, problem_id, attempts, solved, first_solved_at)
       VALUES ($1, $2, 1, $3, CASE WHEN $3 THEN now() ELSE NULL END)
       ON CONFLICT (user_id, problem_id) DO UPDATE
         SET attempts = problem_progress.attempts + 1,
             solved = problem_progress.solved OR $3,
             first_solved_at = COALESCE(problem_progress.first_solved_at, CASE WHEN $3 THEN now() ELSE NULL END)`,
      [user.id, problem.id, solved],
    );

    let xpAwarded = 0;
    if (firstSolve) {
      xpAwarded = problem.points;
      await addXp(user.id, problem.points, 'problem-solved', problem.id);
      await query(
        `INSERT INTO topic_mastery (user_id, topic_id, correct, total) VALUES ($1, $2, 1, 1)
         ON CONFLICT (user_id, topic_id) DO UPDATE SET correct = topic_mastery.correct + 1, total = topic_mastery.total + 1`,
        [user.id, problem.topics[0] ?? problem.id],
      );
      await recordActivity(user.id);
      await evaluateBadgesSafe(user.id);
    }

    res.json({
      passed: run.passed,
      total: run.total,
      solved,
      score,
      xpAwarded,
      outcomes: run.outcomes,
      editorialUnlocked: solved || (existing?.attempts ?? 0) + 1 >= problem.editorialUnlockAfterAttempts,
      contestLanguage: stats.contestLanguage,
    });
  }),
);

function inviteCode(): string {
  return randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
}

competeRouter.post(
  '/friend-challenges',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const content = await getContent();
    const problemId = String(req.body?.problemId ?? '');
    if (!content.problems.has(problemId)) throw new HttpError(404, 'Pick a real problem to race on.');
    const row = await queryOne<{ id: string; code: string }>(
      'INSERT INTO friend_challenges (code, problem_id, creator_id) VALUES ($1, $2, $3) RETURNING id, code',
      [inviteCode(), problemId, user.id],
    );
    res.status(201).json({ id: row?.id, code: row?.code, problemId, link: `axiomcode://challenge/${row?.code}` });
  }),
);

competeRouter.post(
  '/friend-challenges/join',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const code = String(req.body?.code ?? '').trim().toUpperCase();
    const row = await queryOne<{ id: string; creator_id: string; joiner_id: string | null; problem_id: string }>(
      'SELECT id, creator_id, joiner_id, problem_id FROM friend_challenges WHERE code = $1',
      [code],
    );
    if (!row) throw new HttpError(404, 'No challenge with that code.');
    if (row.creator_id === user.id) throw new HttpError(400, 'Share the code with a friend to race.');
    await query('UPDATE friend_challenges SET joiner_id = COALESCE(joiner_id, $2) WHERE id = $1', [row.id, user.id]);
    res.json({ id: row.id, problemId: row.problem_id, code });
  }),
);

competeRouter.get(
  '/friend-challenges',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const rows = await query<{
      code: string;
      problem_id: string;
      creator_id: string;
      joiner_id: string | null;
      creator_name: string;
      joiner_name: string | null;
      winner_id: string | null;
    }>(
      `SELECT f.code, f.problem_id, f.creator_id, f.joiner_id, f.winner_id,
              c.display_name AS creator_name, j.display_name AS joiner_name
         FROM friend_challenges f
         JOIN users c ON c.id = f.creator_id
         LEFT JOIN users j ON j.id = f.joiner_id
        WHERE f.creator_id = $1 OR f.joiner_id = $1
        ORDER BY f.created_at DESC LIMIT 20`,
      [user.id],
    );
    res.json({
      challenges: rows.map((row) => ({
        code: row.code,
        problemId: row.problem_id,
        creator: { id: row.creator_id, name: row.creator_name },
        joiner: row.joiner_id ? { id: row.joiner_id, name: row.joiner_name } : null,
        winnerId: row.winner_id,
      })),
    });
  }),
);
