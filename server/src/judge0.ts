import { config } from './env.js';
import { HttpError } from './http.js';
import type { ProblemTest } from './content.js';

/** Judge0 CE language ids. */
export const LANGUAGE_IDS: Record<string, number> = {
  python: 71,
  java: 62,
  javascript: 63,
  cpp: 54,
};

export const LANGUAGE_LABELS: Record<string, string> = {
  python: 'Python',
  java: 'Java',
  javascript: 'JavaScript',
  cpp: 'C++',
};

export interface TestOutcome {
  index: number;
  passed: boolean;
  status: string;
  message: string;
  timeMs: number | null;
  memoryKb: number | null;
}

export interface RunResult {
  passed: number;
  total: number;
  outcomes: TestOutcome[];
}

const STATUS_LABELS: Record<number, string> = {
  3: 'Accepted',
  4: 'Wrong answer',
  5: 'Time limit exceeded',
  6: 'Compilation error',
  7: 'Runtime error',
  8: 'Runtime error',
  9: 'Runtime error',
  10: 'Runtime error',
  11: 'Runtime error',
  12: 'Runtime error',
  13: 'Internal error',
  14: 'Exec format error',
};

export function judgeConfigured(): boolean {
  return Boolean(config.judge0.url);
}

function headers(): Record<string, string> {
  const entries: Record<string, string> = { 'content-type': 'application/json' };
  if (config.judge0.key) entries['X-RapidAPI-Key'] = config.judge0.key;
  if (config.judge0.host) entries['X-RapidAPI-Host'] = config.judge0.host;
  return entries;
}

function judgeUrl(path: string): string {
  return `${config.judge0.url}${path}`;
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

function decode(value: string | null | undefined): string {
  if (!value) return '';
  return Buffer.from(value, 'base64').toString('utf8');
}

function friendly(statusId: number, stderr: string): string {
  if (statusId === 5) return 'Took too long — check for an infinite loop.';
  if (statusId === 6) return stderr.split('\n').slice(0, 3).join(' ').slice(0, 300) || 'Compilation error.';
  if (statusId >= 7 && statusId <= 12) {
    return stderr.split('\n')[0]?.slice(0, 200) || 'Your program crashed on this test.';
  }
  return STATUS_LABELS[statusId] ?? 'Execution failed';
}

interface BatchItem {
  token: string;
}

interface BatchStatus {
  token: string;
  status: { id: number; description: string };
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  time: string | null;
  memory: number | null;
}

const TERMINAL = new Set([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);

async function judgeFetch(path: string, signal: AbortSignal, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(judgeUrl(path), { ...init, signal });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    throw new HttpError(
      502,
      timedOut
        ? 'Judge0 timed out. Try submitting again.'
        : 'Judge0 is unreachable. Check JUDGE0_URL (or JUDGE0_KEY/JUDGE0_HOST for RapidAPI).',
    );
  }
}

export async function runTests(options: {
  language: string;
  source: string;
  tests: ProblemTest[];
  timeLimitMs: number;
  memoryLimitKb: number;
}): Promise<RunResult> {
  if (!judgeConfigured()) {
    throw new HttpError(
      503,
      'Code execution is not configured. Start Judge0 and set JUDGE0_URL so submissions run in a sandbox.',
    );
  }
  const languageId = LANGUAGE_IDS[options.language];
  if (!languageId) throw new HttpError(400, `Unsupported language: ${options.language}`);
  if (!options.source.trim()) throw new HttpError(400, 'Write some code first.');

  const submissions = options.tests.map((test) => ({
    language_id: languageId,
    source_code: encode(options.source),
    stdin: encode(test.stdin ?? ''),
    expected_output: encode(test.expected),
    cpu_time_limit: Math.max(1, Math.round(options.timeLimitMs / 1000)),
    memory_limit: options.memoryLimitKb,
  }));

  // Leave room for database work inside the Vercel function's 60-second limit.
  const signal = AbortSignal.timeout(40_000);
  const submitResponse = await judgeFetch('/submissions/batch?base64_encoded=true', signal, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ submissions }),
  });
  if (!submitResponse.ok) {
    throw new HttpError(502, `Judge0 rejected the submission (${submitResponse.status}).`);
  }
  const created = (await submitResponse.json()) as BatchItem[];
  if (!Array.isArray(created) || created.length !== options.tests.length ||
      created.some((entry) => typeof entry?.token !== 'string' || !entry.token)) {
    throw new HttpError(502, 'Judge0 did not start every test. Try submitting again.');
  }
  const tokens = created.map((entry) => entry.token);

  let statuses = new Map<string, BatchStatus>();
  while (!signal.aborted) {
    const poll = await judgeFetch(
      `/submissions/batch?tokens=${encodeURIComponent(tokens.join(','))}&base64_encoded=true&fields=token,status,stdout,stderr,compile_output,time,memory`,
      signal,
      { headers: headers() },
    );
    if (!poll.ok) throw new HttpError(502, `Judge0 status check failed (${poll.status}).`);
    const body = (await poll.json()) as { submissions: BatchStatus[] };
    statuses = new Map((body.submissions ?? []).map((entry) => [entry.token, entry]));
    if (tokens.every((token) => TERMINAL.has(statuses.get(token)?.status?.id ?? 0))) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  const outcomes: TestOutcome[] = tokens.map((token, index) => {
    const entry = statuses.get(token);
    if (!entry || !TERMINAL.has(entry.status?.id)) {
      throw new HttpError(502, 'Judge0 did not finish in time. Try submitting again.');
    }
    if (entry.status.id === 13) {
      throw new HttpError(502, 'Judge0 could not run a test. Try submitting again.');
    }
    const stderr = decode(entry.stderr) || decode(entry.compile_output);
    const passed = entry.status.id === 3;
    return {
      index,
      passed,
      status: STATUS_LABELS[entry.status.id] ?? entry.status.description,
      message: passed ? 'Passed' : friendly(entry.status.id, stderr),
      timeMs: entry.time ? Math.round(Number(entry.time) * 1000) : null,
      memoryKb: entry.memory ?? null,
    };
  });

  return {
    passed: outcomes.filter((outcome) => outcome.passed).length,
    total: outcomes.length,
    outcomes,
  };
}
