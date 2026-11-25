import { Router } from 'express';
import { currentUser, requireAuth } from '../auth.js';
import { getContent } from '../content.js';
import { query, queryOne } from '../db.js';
import { HttpError, wrap } from '../http.js';
import { LANGUAGE_LABELS, runTests } from '../judge0.js';
import { evaluateBadgesSafe } from '../badges.js';
import { addXp, getStats, recordActivity } from '../progress.js';

export const contestsRouter = Router();

interface EntryRow {
  id: string;
  contest_id: string;
  started_at: string;
  finished_at: string | null;
  score: number;
  problem_scores: Record<string, number> | string;
}

function scoresOf(entry: EntryRow): Record<string, number> {
  return typeof entry.problem_scores === 'string'
    ? (JSON.parse(entry.problem_scores) as Record<string, number>)
    : entry.problem_scores;
}

function endsAt(entry: EntryRow, durationMinutes: number): string {
  return new Date(Date.parse(entry.started_at) + durationMinutes * 60_000).toISOString();
}

async function loadContest(contestId: string) {
  const content = await getContent();
  const contest = content.contests.find((entry) => entry.id === contestId);
  if (!contest) throw new HttpError(404, 'That contest does not exist.');
  return { contest, content };
}

contestsRouter.get(
  '/contests',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const content = await getContent();
    const entries = await query<EntryRow>('SELECT * FROM contest_entries WHERE user_id = $1', [user.id]);
    const byContest = new Map(entries.map((entry) => [entry.contest_id, entry]));
    res.json({
      contests: content.contests.map((contest) => {
        const entry = byContest.get(contest.id);
        return {
          ...contest,
          problemCount: contest.problemIds.length,
          entry: entry
            ? {
                score: entry.score,
                startedAt: entry.started_at,
                finishedAt: entry.finished_at,
                endsAt: endsAt(entry, contest.durationMinutes),
              }
            : null,
        };
      }),
    });
  }),
);

contestsRouter.post(
  '/contests/:contestId/start',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const { contest, content } = await loadContest(String(req.params.contestId));
    let entry = await queryOne<EntryRow>(
      'SELECT * FROM contest_entries WHERE user_id = $1 AND contest_id = $2',
      [user.id, contest.id],
    );
    if (entry?.finished_at) throw new HttpError(409, 'You already finished this mock contest.');
    if (!entry) {
      entry = await queryOne<EntryRow>(
        'INSERT INTO contest_entries (user_id, contest_id) VALUES ($1, $2) RETURNING *',
        [user.id, contest.id],
      );
    }
    if (!entry) throw new HttpError(500, 'Could not start the contest.');

    const remainingSeconds = Math.max(
      0,
      Math.round((Date.parse(endsAt(entry, contest.durationMinutes)) - Date.now()) / 1000),
    );
    res.json({
      entry: { id: entry.id, startedAt: entry.started_at, endsAt: endsAt(entry, contest.durationMinutes), score: entry.score },
      remainingSeconds,
      contest: { id: contest.id, title: contest.title, durationMinutes: contest.durationMinutes },
      problems: contest.problemIds.map((id) => {
        const problem = content.problems.get(id);
        return problem
          ? { id: problem.id, title: problem.title, points: problem.points, statement: problem.statement, sampleTest: problem.tests[0] ?? null, starterCode: problem.starterCode }
          : null;
      }).filter(Boolean),
      scores: scoresOf(entry),
    });
  }),
);

contestsRouter.post(
  '/contests/:contestId/submit',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const { contest, content } = await loadContest(String(req.params.contestId));
    const problem = content.problems.get(String(req.body?.problemId ?? ''));
    if (!problem || !contest.problemIds.includes(problem.id)) {
      throw new HttpError(404, 'That problem is not part of this contest.');
    }
    const entry = await queryOne<EntryRow>(
      'SELECT * FROM contest_entries WHERE user_id = $1 AND contest_id = $2',
      [user.id, contest.id],
    );
    if (!entry) throw new HttpError(409, 'Start the contest first.');
    if (entry.finished_at) throw new HttpError(409, 'This contest is already submitted.');
    if (Date.now() > Date.parse(endsAt(entry, contest.durationMinutes))) {
      throw new HttpError(409, 'Time is up for this contest.');
    }

    const language = String(req.body?.language ?? 'python');
    const source = String(req.body?.source ?? '');
    const run = await runTests({
      language,
      source,
      tests: problem.tests,
      timeLimitMs: problem.timeLimitMs,
      memoryLimitKb: problem.memoryLimitKb,
    });
    const score = run.total === 0 ? 0 : Math.round((problem.points * run.passed) / run.total);
    const scores = scoresOf(entry);
    scores[problem.id] = Math.max(scores[problem.id] ?? 0, score);
    const totalScore = Object.values(scores).reduce((sum, value) => sum + Number(value), 0);

    await query('UPDATE contest_entries SET score = $2, problem_scores = $3::jsonb WHERE id = $1', [
      entry.id,
      totalScore,
      JSON.stringify(scores),
    ]);
    await query(
      `INSERT INTO problem_submissions (user_id, problem_id, contest_id, language, source, passed, total, score, status, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
      [
        user.id,
        problem.id,
        contest.id,
        language,
        source,
        run.passed,
        run.total,
        score,
        run.passed === run.total ? 'accepted' : 'partial',
        JSON.stringify(run.outcomes),
      ],
    );
    if (run.passed === run.total) {
      await query(
        `INSERT INTO problem_progress (user_id, problem_id, attempts, solved, first_solved_at)
         VALUES ($1, $2, 1, true, now())
         ON CONFLICT (user_id, problem_id) DO UPDATE
           SET attempts = problem_progress.attempts + 1, solved = true,
               first_solved_at = COALESCE(problem_progress.first_solved_at, now())`,
        [user.id, problem.id],
      );
    }

    res.json({ score, totalScore, passed: run.passed, total: run.total, outcomes: run.outcomes, scores });
  }),
);

contestsRouter.post(
  '/contests/:contestId/finish',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const { contest, content } = await loadContest(String(req.params.contestId));
    const entry = await queryOne<EntryRow>(
      'SELECT * FROM contest_entries WHERE user_id = $1 AND contest_id = $2',
      [user.id, contest.id],
    );
    if (!entry) throw new HttpError(409, 'Start the contest first.');

    if (!entry.finished_at) {
      await query('UPDATE contest_entries SET finished_at = now() WHERE id = $1', [entry.id]);
      if (entry.score > 0) await addXp(user.id, entry.score, 'contest', contest.id);
      await recordActivity(user.id);
    }
    await evaluateBadgesSafe(user.id);
    const scores = scoresOf(entry);

    const submissions = await query<{ problem_id: string; created_at: string }>(
      'SELECT problem_id, created_at FROM problem_submissions WHERE user_id = $1 AND contest_id = $2 ORDER BY created_at ASC',
      [user.id, contest.id],
    );
    const firstAttempt = new Map<string, string>();
    for (const submission of submissions) {
      if (!firstAttempt.has(submission.problem_id)) firstAttempt.set(submission.problem_id, submission.created_at);
    }

    const problems = contest.problemIds.map((id) => {
      const problem = content.problems.get(id);
      const started = firstAttempt.get(id);
      return {
        id,
        title: problem?.title ?? id,
        points: problem?.points ?? 0,
        score: scores[id] ?? 0,
        solved: Boolean(problem && scores[id] === problem.points),
        topics: problem?.topics ?? [],
        minutesSpent: started
          ? Math.max(1, Math.round((Date.parse(started) - Date.parse(entry.started_at)) / 60_000))
          : 0,
      };
    });

    const weakTopics = [...new Set(problems.filter((problem) => !problem.solved).flatMap((problem) => problem.topics))];

    res.json({
      score: entry.score,
      maxScore: problems.reduce((sum, problem) => sum + problem.points, 0),
      problems,
      topicsToReview: weakTopics,
      xpEarned: entry.score,
      streak: (await getStats(user.id)).streak,
      languages: Object.entries(LANGUAGE_LABELS).map(([id, label]) => ({ id, label })),
    });
  }),
);
