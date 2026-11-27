import assert from 'node:assert/strict';
import { it } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JUDGE0_URL = 'http://localhost:2358';

const { runTests } = await import('../src/judge0.js');

const submission = {
  language: 'python',
  source: 'print(input())',
  tests: [{ stdin: 'one', expected: 'one' }, { stdin: 'two', expected: 'two' }],
  timeLimitMs: 1000,
  memoryLimitKb: 128_000,
};

it('matches Judge0 results to test order by token', async (t) => {
  t.mock.method(globalThis, 'fetch', (_url: string, init: RequestInit) => {
    if (init.method === 'POST') {
      return Response.json([{ token: 'first' }, { token: 'second' }]);
    }
    return Response.json({
      submissions: [
        { token: 'second', status: { id: 4 } },
        { token: 'first', status: { id: 3 } },
      ],
    });
  });

  const result = await runTests(submission);
  assert.equal(result.passed, 1);
  assert.deepEqual(result.outcomes.map(({ index, passed }) => [index, passed]), [[0, true], [1, false]]);
});

it('rejects a partial Judge0 batch as an upstream error', async (t) => {
  t.mock.method(globalThis, 'fetch', () => Response.json([{ token: 'first' }]));
  await assert.rejects(runTests(submission), { status: 502, message: /did not start every test/ });
});

it('rejects Judge0 internal errors instead of grading the answer', async (t) => {
  t.mock.method(globalThis, 'fetch', (_url: string, init: RequestInit) => {
    if (init.method === 'POST') {
      return Response.json([{ token: 'first' }, { token: 'second' }]);
    }
    return Response.json({
      submissions: [
        { token: 'first', status: { id: 3 } },
        { token: 'second', status: { id: 13 } },
      ],
    });
  });
  await assert.rejects(runTests(submission), { status: 502, message: /could not run a test/ });
});
