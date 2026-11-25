import type { Challenge } from './content.js';

export function shuffle<T>(input: T[]): T[] {
  const copy = [...input];
  for (let i = copy.length - 1 > 0 ? copy.length - 1 : 0; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

/** The client never receives answers, hidden tests or explanations. */
export function publicChallenge(challenge: Challenge): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: challenge.id,
    type: challenge.type,
    prompt: challenge.prompt,
    xp: challenge.xp ?? (challenge.type === 'frq' ? 40 : 10),
  };
  if (challenge.code) base.code = challenge.code;

  switch (challenge.type) {
    case 'mcq':
      base.options = challenge.options;
      break;
    case 'fill-blank':
    case 'word-bank':
      base.template = challenge.template;
      base.mode = challenge.mode;
      base.bank = challenge.bank ?? [];
      base.blankCount = challenge.blanks.length;
      break;
    case 'order':
      base.lines = shuffle(challenge.lines);
      break;
    case 'match':
      base.left = challenge.pairs.map((pair) => pair.left);
      base.rightOptions = shuffle(challenge.pairs.map((pair) => pair.right));
      break;
    case 'bug':
      base.lines = challenge.lines;
      base.fixes = challenge.fixes;
      break;
    case 'true-false':
      base.statement = challenge.statement;
      break;
    case 'frq':
      base.starterCode = challenge.starterCode;
      base.sampleTest = challenge.tests[0] ?? null;
      base.testCount = challenge.tests.length;
      break;
  }
  return base;
}
