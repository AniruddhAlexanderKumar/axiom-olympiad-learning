import { query, queryOne } from './db.js';
import { getContent } from './content.js';
import { getStats } from './progress.js';

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const BADGES: BadgeDefinition[] = [
  { id: 'first-lesson', title: 'First Steps', description: 'Finish your first lesson.', icon: '🚀' },
  { id: 'perfect-lesson', title: 'Flawless', description: 'Finish a lesson with no mistakes.', icon: '💎' },
  { id: 'streak-7', title: '7-Day Streak', description: 'Practice seven days in a row.', icon: '🔥' },
  { id: 'streak-30', title: '30-Day Streak', description: 'Practice thirty days in a row.', icon: '🌋' },
  { id: 'bug-hunter', title: 'Bug Hunter', description: 'Fix five bugs correctly.', icon: '🐞' },
  { id: 'bronze-cleared', title: 'Bronze Cleared', description: 'Solve every USACO Bronze problem.', icon: '🥉' },
  { id: 'first-mock', title: 'First Mock Contest', description: 'Finish a timed mock contest.', icon: '⏱️' },
  { id: 'xp-1000', title: 'Thousand Club', description: 'Earn 1,000 XP.', icon: '🏅' },
];

interface EarnedRow {
  badge_id: string;
  earned_at: string;
}

export async function evaluateBadges(userId: string): Promise<string[]> {
  const content = await getContent();
  const stats = await getStats(userId);
  const conditions = new Map<string, boolean>();

  const lessons = await queryOne<{ count: number }>('SELECT COUNT(*)::int AS count FROM lesson_completions WHERE user_id = $1', [userId]);
  conditions.set('first-lesson', Number(lessons?.count ?? 0) > 0);

  const perfect = await queryOne<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM lesson_completions WHERE user_id = $1 AND accuracy >= 0.999',
    [userId],
  );
  conditions.set('perfect-lesson', Number(perfect?.count ?? 0) > 0);
  conditions.set('streak-7', stats.streak >= 7 || stats.longestStreak >= 7);
  conditions.set('streak-30', stats.streak >= 30 || stats.longestStreak >= 30);
  conditions.set('xp-1000', stats.xp >= 1000);

  const correctAttempts = await query<{ challenge_id: string }>(
    'SELECT DISTINCT challenge_id FROM challenge_attempts WHERE user_id = $1 AND correct = true',
    [userId],
  );
  const bugFixes = correctAttempts.filter(
    (row) => content.challenges.get(row.challenge_id)?.challenge.type === 'bug',
  ).length;
  conditions.set('bug-hunter', bugFixes >= 5);

  const bronze = content.competeTracks
    .find((track) => track.id === 'usaco')
    ?.problems.filter((problem) => problem.tier === 'bronze') ?? [];
  if (bronze.length > 0) {
    const solved = await query<{ problem_id: string }>(
      'SELECT problem_id FROM problem_progress WHERE user_id = $1 AND solved = true',
      [userId],
    );
    const solvedIds = new Set(solved.map((row) => row.problem_id));
    conditions.set('bronze-cleared', bronze.every((problem) => solvedIds.has(problem.id)));
  }

  const mocks = await queryOne<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM contest_entries WHERE user_id = $1 AND finished_at IS NOT NULL',
    [userId],
  );
  conditions.set('first-mock', Number(mocks?.count ?? 0) > 0);

  const awarded: string[] = [];
  for (const [badgeId, met] of conditions) {
    if (!met) continue;
    const inserted = await queryOne<{ badge_id: string }>(
      'INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING badge_id',
      [userId, badgeId],
    );
    if (inserted) awarded.push(badgeId);
  }
  return awarded;
}

export async function evaluateBadgesSafe(userId: string): Promise<string[]> {
  try {
    return await evaluateBadges(userId);
  } catch (error) {
    console.error('[badges] evaluation failed', error);
    return [];
  }
}

export async function badgeCatalog(userId: string) {
  await evaluateBadges(userId);
  const rows = await query<EarnedRow>('SELECT badge_id, earned_at FROM user_badges WHERE user_id = $1', [userId]);
  const earned = new Map(rows.map((row) => [row.badge_id, row.earned_at]));
  return BADGES.map((badge) => ({
    ...badge,
    earned: earned.has(badge.id),
    earnedAt: earned.get(badge.id) ?? null,
  }));
}
