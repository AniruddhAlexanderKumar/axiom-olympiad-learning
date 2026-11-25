import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = '';
process.env.CONTENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../content');
process.env.JUDGE0_URL = '';

let server: Server;
let base = '';
let token = '';

async function call<T = any>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.auth !== false && token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${base}/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
}

before(async () => {
  const { createApp } = await import('../src/app.js');
  const { migrate } = await import('../src/db.js');
  const { loadContent } = await import('../src/content.js');
  await migrate();
  await loadContent();
  const app = createApp();
  await new Promise<void>((ready) => {
    server = app.listen(0, '127.0.0.1', () => ready());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((done) => server.close(() => done()));
});

describe('server', () => {
  it('reports health without a session', async () => {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok: boolean; database: string };
    assert.equal(body.ok, true);
    assert.equal(body.database, 'pglite');
  });
});

describe('auth', () => {
  it('registers, rejects duplicates and authenticates', async () => {
    const created = await call<{ token: string; user: { email: string } }>('/auth/register', {
      method: 'POST',
      auth: false,
      body: { email: 'learner@example.com', password: 'supersecret', displayName: 'Learner' },
    });
    assert.equal(created.status, 201);
    token = created.body.token;
    assert.ok(token);

    const duplicate = await call('/auth/register', {
      method: 'POST',
      auth: false,
      body: { email: 'learner@example.com', password: 'supersecret', displayName: 'Learner' },
    });
    assert.equal(duplicate.status, 409);

    const me = await call<{ user: { email: string; onboardingComplete: boolean } }>('/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, 'learner@example.com');
    assert.equal(me.body.user.onboardingComplete, false);

    const unauthenticated = await call('/me', { auth: false });
    assert.equal(unauthenticated.status, 401);
  });

  it('runs onboarding and placement', async () => {
    const onboarding = await call<{ user: { goal: string; language: string } }>('/auth/onboarding', {
      method: 'POST',
      body: { goal: 'both', language: 'python' },
    });
    assert.equal(onboarding.status, 200);
    assert.equal(onboarding.body.user.language, 'python');

    const quiz = await call<{ questions: { id: string; answer?: string }[] }>('/auth/onboarding/placement');
    assert.ok(quiz.body.questions.length > 0);
    assert.equal(quiz.body.questions[0].answer, undefined);

    const placement = await call<{ recommendation: string; user: { onboardingComplete: boolean } }>(
      '/auth/onboarding/placement',
      { method: 'POST', body: { answers: { 'place-1': 'b', 'place-2': 'c' } } },
    );
    assert.equal(placement.status, 200);
    assert.equal(placement.body.user.onboardingComplete, true);
  });
});

describe('learn', () => {
  it('serves the skill tree without answers', async () => {
    const learn = await call<{ tracks: { skills: { lessons: { id: string }[] }[] }[]; hearts: number }>('/learn');
    assert.equal(learn.status, 200);
    assert.equal(learn.body.hearts, 5);
    assert.ok(learn.body.tracks[0]?.skills[0]?.lessons[0]?.id);
  });

  it('grades a wrong answer, costs a heart and requeues the question', async () => {
    const started = await call<{ sessionId: string; challenge: { id: string; type: string; options?: { id: string }[] } }>(
      '/learn/lessons/printing-1/start',
      { method: 'POST' },
    );
    assert.equal(started.status, 201);
    assert.equal(started.body.challenge.options?.[0]?.id, 'a');
    assert.equal((started.body.challenge as Record<string, unknown>).answer, undefined);

    const wrong = await call<{
      result: { correct: boolean; explanation: string };
      hearts: number;
      next: { id: string };
      complete: boolean;
    }>(`/lesson-sessions/${started.body.sessionId}/answer`, {
      method: 'POST',
      body: { challengeId: started.body.challenge.id, answer: { optionId: 'd' } },
    });
    assert.equal(wrong.status, 200);
    assert.equal(wrong.body.result.correct, false);
    assert.equal(wrong.body.hearts, 4);
    assert.equal(wrong.body.complete, false);
    assert.ok(wrong.body.next.id, 'the lesson continues with the next question');
    assert.ok(wrong.body.result.explanation.length > 0);

    const resumed = await call<{ requeued: string[]; remaining: number }>(
      `/lesson-sessions/${started.body.sessionId}`,
    );
    assert.ok(
      resumed.body.requeued.includes(started.body.challenge.id),
      'the missed question is queued to come back at the end of the lesson',
    );
  });

  it('schedules missed questions for spaced repetition', async () => {
    const review = await call<{ dueCount: number }>('/review');
    assert.equal(review.status, 200);
    assert.ok(review.body.dueCount >= 0);
  });
});

describe('compete', () => {
  it('locks tiers until the required Learn skills are done', async () => {
    const compete = await call<{
      tracks: { tiers: { id: string; unlocked: boolean; unlockSkills: string[] }[] }[];
      judgeConfigured: boolean;
    }>('/compete');
    assert.equal(compete.status, 200);
    assert.equal(compete.body.judgeConfigured, false);
    const usaco = compete.body.tracks.find((track) => (track as { id?: string }).id === 'usaco');
    const bronze = usaco?.tiers.find((tier) => tier.id === 'bronze');
    assert.equal(bronze?.unlocked, false);
    assert.ok((bronze?.unlockSkills ?? []).includes('loops'));
  });

  it('keeps problem editorials locked and refuses execution without Judge0', async () => {
    const problem = await call<{
      editorial: string | null;
      editorialUnlocked: boolean;
      sampleTest: { stdin: string } | null;
      testCount: number;
    }>('/problems/usaco-robot-path');
    assert.equal(problem.status, 200);
    assert.equal(problem.body.editorial, null);
    assert.equal(problem.body.editorialUnlocked, false);
    assert.ok(problem.body.sampleTest);
    assert.ok(problem.body.testCount >= 3);

    const submit = await call<{ error: string }>('/problems/usaco-robot-path/submit', {
      method: 'POST',
      body: { language: 'python', source: 'print(1)' },
    });
    assert.equal(submit.status, 503);
    assert.match(submit.body.error, /Judge0/i);
  });

  it('exposes contests with problem counts', async () => {
    const contests = await call<{ contests: { id: string; problemCount: number }[] }>('/contests');
    assert.equal(contests.status, 200);
    assert.ok(contests.body.contests[0]?.problemCount >= 2);
  });
});

describe('me', () => {
  it('returns the dashboard with stats, level and heatmap', async () => {
    const overview = await call<{
      stats: { xp: number; hearts: number; level: { level: number } };
      nextLesson: { id: string } | null;
      badgesTotal: number;
      heatmap: unknown[];
    }>('/me');
    assert.equal(overview.status, 200);
    assert.equal(overview.body.stats.hearts, 4);
    assert.ok(overview.body.stats.level.level >= 1);
    assert.ok(overview.body.nextLesson?.id);
    assert.ok(overview.body.badgesTotal >= 8);
  });

  it('updates the daily goal and contest language', async () => {
    const patch = await call<{ user: { dailyGoalXp: number } }>('/me', {
      method: 'PATCH',
      body: { dailyGoalXp: 100, contestLanguage: 'cpp' },
    });
    assert.equal(patch.status, 200);
    assert.equal(patch.body.user.dailyGoalXp, 100);

    const invalid = await call('/me', { method: 'PATCH', body: { dailyGoalXp: 5 } });
    assert.equal(invalid.status, 400);
  });

  it('starts new learners in the bronze league', async () => {
    const league = await call<{ tier: string; standings: { isYou: boolean }[] }>('/me/leagues');
    assert.equal(league.status, 200);
    assert.equal(league.body.tier, 'bronze');
    assert.ok(league.body.standings.some((entry) => entry.isYou));
  });
});
