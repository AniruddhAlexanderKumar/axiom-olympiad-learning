import { Router } from 'express';
import { currentUser, requireAuth } from '../auth.js';
import { getContent, type Challenge, type Lesson } from '../content.js';
import { query, queryOne } from '../db.js';
import { HttpError, wrap } from '../http.js';
import { evaluateBadgesSafe } from '../badges.js';
import { challengeXp, gradeChallenge } from '../grade.js';
import { runTests } from '../judge0.js';
import { publicChallenge } from '../serialize.js';
import {
  HEART_MAX,
  addXp,
  clearReview,
  completedLessonIds,
  completedSkills,
  getStats,
  grantHeart,
  recordActivity,
  recordAttempt,
  reviewQueue,
  spendHeart,
} from '../progress.js';

export const learnRouter = Router();

const TYPE_RAMP: Record<string, number> = {
  mcq: 0,
  'true-false': 0,
  'word-bank': 1,
  match: 1,
  order: 2,
  'fill-blank': 2,
  bug: 3,
  frq: 4,
};

interface SessionState {
  mode: 'lesson' | 'review';
  lessonId: string;
  queue: string[];
  index: number;
  total: number;
  mistakes: number;
  xp: number;
  requeued: string[];
}

interface SessionRow {
  id: string;
  user_id: string;
  lesson_id: string;
  state: SessionState | string;
  hearts_lost: number;
  completed_at: string | null;
}

function parseState(row: SessionRow): SessionState {
  return typeof row.state === 'string' ? (JSON.parse(row.state) as SessionState) : row.state;
}

function nextLessonFor(
  lessons: Set<string>,
  trackId: string,
  skills: Map<string, string[]>,
  track: { skills: { id: string; lessons: string[] }[] },
): { lessonId: string; skillId: string } | null {
  for (const skill of track.skills) {
    for (const lessonId of skill.lessons) {
      if (!lessons.has(lessonId)) return { lessonId, skillId: skill.id };
    }
  }
  return null;
}

learnRouter.get(
  '/learn',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const content = await getContent();
    const completed = await completedLessonIds(user.id);
    const stats = await getStats(user.id);
    const skillsDone = await completedSkills(user.id);

    const tracks = content.learnTracks.map((track) => {
      let previousComplete = true;
      const skills = track.skills.map((skill) => {
        const done = skill.lessons.filter((lessonId) => completed.has(lessonId)).length;
        const unlocked = track.available && (previousComplete || skillsDone.has(skill.id));
        previousComplete = skill.lessons.length > 0 && done === skill.lessons.length;
        return {
          id: skill.id,
          title: skill.title,
          summary: skill.summary,
          unlocked,
          completed: previousComplete,
          lessonCount: skill.lessons.length,
          lessonsDone: done,
          lessons: skill.lessons.map((lessonId) => ({
            id: lessonId,
            title: content.lessons.get(lessonId)?.title ?? lessonId,
            completed: completed.has(lessonId),
            xp: content.lessons.get(lessonId)?.xp ?? 0,
          })),
        };
      });
      return {
        id: track.id,
        title: track.title,
        language: track.language,
        description: track.description,
        available: track.available,
        skills,
        completedLessons: skills.reduce((sum, skill) => sum + skill.lessonsDone, 0),
        totalLessons: skills.reduce((sum, skill) => sum + skill.lessonCount, 0),
      };
    });

    const track = tracks.find((entry) => entry.language === user.language) ?? tracks[0] ?? null;
    const activeTrack = content.learnTracks.find((entry) => entry.id === track?.id);
    const nextLesson =
      activeTrack && track
        ? nextLessonFor(completed, track.id, new Map(), activeTrack)
        : null;

    res.json({
      tracks,
      activeTrackId: track?.id ?? null,
      nextLesson: nextLesson
        ? {
            lessonId: nextLesson.lessonId,
            skillId: nextLesson.skillId,
            title: content.lessons.get(nextLesson.lessonId)?.title ?? nextLesson.lessonId,
            skillTitle: track?.skills.find((skill) => skill.id === nextLesson.skillId)?.title ?? '',
          }
        : null,
      hearts: stats.hearts,
      reviewDue: (await reviewQueue(user.id, 50)).length,
    });
  }),
);

learnRouter.get(
  '/learn/lessons/:lessonId',
  requireAuth,
  wrap(async (req, res) => {
    const content = await getContent();
    const lesson = content.lessons.get(String(req.params.lessonId));
    if (!lesson) throw new HttpError(404, 'That lesson does not exist.');
    res.json({
      id: lesson.id,
      title: lesson.title,
      language: lesson.language,
      xp: lesson.xp,
      intro: lesson.intro,
      challengeCount: lesson.challenges.length,
    });
  }),
);

learnRouter.post(
  '/learn/lessons/:lessonId/start',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const content = await getContent();
    const lesson = content.lessons.get(String(req.params.lessonId));
    if (!lesson) throw new HttpError(404, 'That lesson does not exist.');
    const stats = await getStats(user.id);
    if (stats.hearts <= 0) {
      throw new HttpError(409, 'Out of hearts. They refill over time, or finish a review session to earn one.', {
        hearts: 0,
      });
    }

    const ordered = [...lesson.challenges].sort((a, b) => (TYPE_RAMP[a.type] ?? 0) - (TYPE_RAMP[b.type] ?? 0));
    const state: SessionState = {
      mode: 'lesson',
      lessonId: lesson.id,
      queue: ordered.map((challenge) => challenge.id),
      index: 0,
      total: ordered.length,
      mistakes: 0,
      xp: 0,
      requeued: [],
    };
    const row = await queryOne<SessionRow>(
      `INSERT INTO lesson_sessions (user_id, lesson_id, state) VALUES ($1, $2, $3::jsonb) RETURNING *`,
      [user.id, lesson.id, JSON.stringify(state)],
    );
    if (!row) throw new HttpError(500, 'Could not start the lesson.');

    res.status(201).json({
      sessionId: row.id,
      lesson: { id: lesson.id, title: lesson.title, xp: lesson.xp, intro: lesson.intro },
      challenge: publicChallenge(ordered[0] as Challenge),
      progress: { solved: 0, total: ordered.length, hearts: stats.hearts },
    });
  }),
);

learnRouter.get(
  '/lesson-sessions/:sessionId',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const row = await queryOne<SessionRow>(
      'SELECT * FROM lesson_sessions WHERE id = $1 AND user_id = $2',
      [String(req.params.sessionId), user.id],
    );
    if (!row) throw new HttpError(404, 'That lesson session does not exist.');
    const state = parseState(row);
    const content = await getContent();
    const challengeId = state.queue[state.index];
    const entry = challengeId ? content.challenges.get(challengeId) : null;
    const stats = await getStats(user.id);
    res.json({
      sessionId: row.id,
      mode: state.mode,
      lesson: content.lessons.get(state.lessonId)
        ? {
            id: state.lessonId,
            title: content.lessons.get(state.lessonId)?.title,
            intro: content.lessons.get(state.lessonId)?.intro,
          }
        : null,
      challenge: entry ? publicChallenge(entry.challenge) : null,
      progress: { solved: state.index, total: state.total, hearts: stats.hearts, mistakes: state.mistakes },
      remaining: Math.max(0, state.queue.length - state.index),
      requeued: state.requeued,
      completed: Boolean(row.completed_at),
    });
  }),
);

learnRouter.post(
  '/lesson-sessions/:sessionId/answer',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const row = await queryOne<SessionRow>(
      'SELECT * FROM lesson_sessions WHERE id = $1 AND user_id = $2',
      [String(req.params.sessionId), user.id],
    );
    if (!row) throw new HttpError(404, 'That lesson session does not exist.');
    if (row.completed_at) throw new HttpError(409, 'This session is already finished.');

    const state = parseState(row);
    const content = await getContent();
    const challengeId = state.queue[state.index];
    if (!challengeId) throw new HttpError(409, 'This session has no question left.');
    const entry = content.challenges.get(challengeId);
    if (!entry) throw new HttpError(500, 'That question is missing from the content files.');
    const challenge = entry.challenge;

    const stats = await getStats(user.id);
    if (state.mode === 'lesson' && stats.hearts <= 0) {
      throw new HttpError(409, 'Out of hearts. Try again when one refills.', { hearts: 0 });
    }

    let graded = gradeChallenge(challenge, req.body?.answer);
    if (challenge.type === 'frq') {
      const source = String((req.body?.answer as { source?: string })?.source ?? '');
      const language = String((req.body?.answer as { language?: string })?.language ?? 'python');
      const run = await runTests({
        language,
        source,
        tests: challenge.tests,
        timeLimitMs: 2000,
        memoryLimitKb: 128_000,
      });
      graded = {
        correct: run.passed === run.total && run.total > 0,
        expected: `${run.total} hidden tests`,
        given: `${run.passed}/${run.total} tests passed`,
      };
    }
    if (!graded) throw new HttpError(400, 'This question needs code to grade.');

    await recordAttempt(user.id, challenge.id, entry.lessonId, graded.correct);
    let hearts = stats.hearts;

    if (graded.correct) {
      state.xp += challengeXp(challenge);
      await addXp(user.id, challengeXp(challenge), state.mode === 'review' ? 'review' : 'lesson', state.lessonId);
      await clearReview(user.id, challenge.id);
    } else {
      state.mistakes += 1;
      if (state.mode === 'lesson') {
        hearts = (await spendHeart(user.id)).hearts;
      }
      if (!state.requeued.includes(challenge.id)) {
        state.requeued.push(challenge.id);
        state.queue.push(challenge.id);
      }
    }

    state.index += 1;
    let summary: Record<string, unknown> | null = null;
    const done = state.index >= state.queue.length;

    if (done) {
      const accuracy = state.total === 0 ? 1 : Math.max(0, (state.total - state.mistakes) / state.total);
      if (state.mode === 'lesson') {
        const lesson = content.lessons.get(state.lessonId);
        const perfectBonus = state.mistakes === 0 ? 20 : 0;
        const earned = state.xp + perfectBonus + (lesson?.xp ?? 0);
        if (perfectBonus + (lesson?.xp ?? 0) > 0) {
          await addXp(user.id, perfectBonus + (lesson?.xp ?? 0), 'lesson-complete', state.lessonId);
        }
        await query(
          `INSERT INTO lesson_completions (user_id, lesson_id, accuracy, xp_awarded)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, lesson_id) DO UPDATE
             SET attempts = lesson_completions.attempts + 1,
                 accuracy = GREATEST(lesson_completions.accuracy, $3),
                 xp_awarded = lesson_completions.xp_awarded + $4,
                 completed_at = now()`,
          [user.id, state.lessonId, accuracy, earned],
        );
      } else {
        await grantHeart(user.id, 1);
      }
      const afterStreak = await recordActivity(user.id);
      const badges = await evaluateBadgesSafe(user.id);
      await query('UPDATE lesson_sessions SET state = $2::jsonb, completed_at = now() WHERE id = $1', [
        row.id,
        JSON.stringify(state),
      ]);
      summary = {
        xpEarned: state.xp + (state.mode === 'lesson' ? (content.lessons.get(state.lessonId)?.xp ?? 0) + (state.mistakes === 0 ? 20 : 0) : 0),
        accuracy,
        mistakes: state.mistakes,
        streak: afterStreak.streak,
        newBadges: badges,
        hearts: (await getStats(user.id)).hearts,
      };
    } else {
      await query('UPDATE lesson_sessions SET state = $2::jsonb WHERE id = $1', [row.id, JSON.stringify(state)]);
    }

    const nextId = state.queue[state.index];
    const nextEntry = nextId ? content.challenges.get(nextId) : null;
    res.json({
      result: {
        correct: graded.correct,
        expected: graded.expected,
        given: graded.given,
        explanation: challenge.explanation,
      },
      hearts: (await getStats(user.id)).hearts,
      progress: { solved: Math.min(state.index, state.total), total: state.total, mistakes: state.mistakes },
      next: nextEntry ? publicChallenge(nextEntry.challenge) : null,
      complete: done,
      summary,
    });
  }),
);

learnRouter.get(
  '/review',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const content = await getContent();
    const due = await reviewQueue(user.id, 50);
    res.json({
      dueCount: due.length,
      items: due.slice(0, 10).map((item) => {
        const entry = content.challenges.get(item.challengeId);
        return {
          challengeId: item.challengeId,
          lessonId: item.lessonId,
          type: entry?.challenge.type ?? 'mcq',
          prompt: entry?.challenge.prompt ?? '',
        };
      }),
    });
  }),
);

learnRouter.post(
  '/review/start',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const content = await getContent();
    const due = await reviewQueue(user.id, 12);
    if (due.length === 0) throw new HttpError(409, 'Nothing is due for review. Nice work!');
    const state: SessionState = {
      mode: 'review',
      lessonId: 'review',
      queue: due.map((item) => item.challengeId),
      index: 0,
      total: due.length,
      mistakes: 0,
      xp: 0,
      requeued: [],
    };
    const row = await queryOne<SessionRow>(
      'INSERT INTO lesson_sessions (user_id, lesson_id, state) VALUES ($1, $2, $3::jsonb) RETURNING *',
      [user.id, 'review', JSON.stringify(state)],
    );
    const first = content.challenges.get(state.queue[0] as string);
    const stats = await getStats(user.id);
    res.status(201).json({
      sessionId: row?.id,
      mode: 'review',
      challenge: first ? publicChallenge(first.challenge) : null,
      progress: { solved: 0, total: state.total, hearts: stats.hearts },
    });
  }),
);

export function lessonXp(lesson: Lesson): number {
  return lesson.challenges.reduce((sum, challenge) => sum + challengeXp(challenge), lesson.xp);
}
