import type { Challenge } from './content.js';

export interface GradeResult {
  correct: boolean;
  expected: string;
  given: string;
}

function normalize(value: string, caseSensitive = false): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return caseSensitive ? trimmed : trimmed.toLowerCase();
}

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

export function gradeChallenge(challenge: Challenge, answer: unknown): GradeResult | null {
  const payload = (answer ?? {}) as Record<string, unknown>;

  switch (challenge.type) {
    case 'mcq': {
      const picked = String(payload.optionId ?? '');
      const expected = challenge.options.find((option) => option.id === challenge.answer);
      const given = challenge.options.find((option) => option.id === picked);
      return {
        correct: picked === challenge.answer,
        expected: expected?.text ?? challenge.answer,
        given: given?.text ?? 'No answer',
      };
    }
    case 'fill-blank':
    case 'word-bank': {
      const values = asArray(payload.values);
      const results = challenge.blanks.map((blank, index) => {
        const given = values[index] ?? '';
        const correct = blank.answers.some(
          (candidate) => normalize(candidate, blank.caseSensitive) === normalize(given, blank.caseSensitive),
        );
        return { correct, given, expected: blank.answers[0] ?? '' };
      });
      const missed = results.find((entry) => !entry.correct);
      return {
        correct: results.every((entry) => entry.correct),
        expected: results.map((entry) => entry.expected).join(' / '),
        given: missed ? missed.given : results.map((entry) => entry.given).join(' / '),
      };
    }
    case 'order': {
      const order = asArray(payload.order);
      const correct = order.length === challenge.answer.length && order.every((id, index) => id === challenge.answer[index]);
      const label = (id: string) => challenge.lines.find((line) => line.id === id)?.text ?? id;
      return {
        correct,
        expected: challenge.answer.map(label).join('\n'),
        given: order.map(label).join('\n'),
      };
    }
    case 'match': {
      const pairs = (payload.pairs ?? {}) as Record<string, string>;
      const results = challenge.pairs.map((pair) => ({
        correct: normalize(pairs[pair.left] ?? '') === normalize(pair.right),
        expected: `${pair.left} → ${pair.right}`,
        given: `${pair.left} → ${pairs[pair.left] ?? '—'}`,
      }));
      return {
        correct: results.every((entry) => entry.correct),
        expected: results.map((entry) => entry.expected).join('\n'),
        given: results.map((entry) => entry.given).join('\n'),
      };
    }
    case 'bug': {
      const lineId = String(payload.lineId ?? '');
      const fixId = String(payload.fixId ?? '');
      const fix = challenge.fixes.find((entry) => entry.id === challenge.answer.fixId);
      const line = challenge.lines.find((entry) => entry.id === challenge.answer.lineId);
      return {
        correct: lineId === challenge.answer.lineId && fixId === challenge.answer.fixId,
        expected: `${line?.text ?? challenge.answer.lineId}\n${fix?.text ?? challenge.answer.fixId}`,
        given: `${lineId || 'no line'}\n${challenge.fixes.find((entry) => entry.id === fixId)?.text ?? 'no fix'}`,
      };
    }
    case 'true-false': {
      const value = Boolean(payload.value);
      return {
        correct: value === challenge.answer,
        expected: challenge.answer ? 'True' : 'False',
        given: value ? 'True' : 'False',
      };
    }
    case 'frq':
      return null;
  }
}

export function challengeXp(challenge: Challenge): number {
  return challenge.xp ?? (challenge.type === 'frq' ? 40 : 10);
}
