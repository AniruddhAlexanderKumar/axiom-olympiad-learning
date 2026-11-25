import { query, queryOne } from './db.js';
import { getContent } from './content.js';

export const HEART_MAX = 5;
const HEART_REFRESH_MINUTES = 25;
export const LEAGUE_TIERS = ['bronze', 'silver', 'gold', 'diamond'] as const;

export interface Stats {
  xp: number;
  streak: number;
  longestStreak: number;
  lastActiveOn: string | null;
  freezes: number;
  hearts: number;
  heartsUpdatedAt: string;
  leagueTier: string;
  leagueWeek: string | null;
  contestLanguage: string;
}

interface StatsRow {
  xp: number;
  streak: number;
  longest_streak: number;
  last_active_on: string | Date | null;
  freezes: number;
  hearts: number;
  hearts_updated_at: string | Date;
  league_tier: string;
  league_week: string | Date | null;
  contest_language: string;
}

function isoDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function toStats(row: StatsRow): Stats {
  return {
    xp: Number(row.xp),
    streak: Number(row.streak),
    longestStreak: Number(row.longest_streak),
    lastActiveOn: isoDate(row.last_active_on),
    freezes: Number(row.freezes),
    hearts: Number(row.hearts),
    heartsUpdatedAt: new Date(row.hearts_updated_at).toISOString(),
    leagueTier: row.league_tier,
    leagueWeek: isoDate(row.league_week),
    contestLanguage: row.contest_language,
  };
}

export function today(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

export async function getStats(userId: string): Promise<Stats> {
  let row = await queryOne<StatsRow>('SELECT * FROM user_stats WHERE user_id = $1', [userId]);
  if (!row) {
    await query('INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
    row = await queryOne<StatsRow>('SELECT * FROM user_stats WHERE user_id = $1', [userId]);
  }
  if (!row) throw new Error('Could not create progress record.');

  const stats = toStats(row);
  const elapsedMinutes = (Date.now() - Date.parse(stats.heartsUpdatedAt)) / 60_000;
  if (stats.hearts < HEART_MAX && elapsedMinutes >= HEART_REFRESH_MINUTES) {
    const gained = Math.min(HEART_MAX - stats.hearts, Math.floor(elapsedMinutes / HEART_REFRESH_MINUTES));
    if (gained > 0) {
      const updated = await queryOne<StatsRow>(
        `UPDATE user_stats
            SET hearts = LEAST($2, hearts + $3),
                hearts_updated_at = hearts_updated_at + ($3 * interval '25 minutes')
          WHERE user_id = $1
          RETURNING *`,
        [userId, HEART_MAX, gained],
      );
      if (updated) return toStats(updated);
    }
  }
  return stats;
}

export async function spendHeart(userId: string): Promise<Stats> {
  await getStats(userId);
  const row = await queryOne<StatsRow>(
    `UPDATE user_stats SET hearts = GREATEST(0, hearts - 1), hearts_updated_at = now()
      WHERE user_id = $1 RETURNING *`,
    [userId],
  );
  return toStats(row as StatsRow);
}

export async function grantHeart(userId: string, amount = 1): Promise<void> {
  await query(
    `UPDATE user_stats SET hearts = LEAST($2, hearts + $3), hearts_updated_at = now() WHERE user_id = $1`,
    [userId, HEART_MAX, amount],
  );
}

export async function addXp(
  userId: string,
  amount: number,
  source: string,
  lessonId?: string,
): Promise<void> {
  if (amount <= 0) return;
  await query('UPDATE user_stats SET xp = xp + $2 WHERE user_id = $1', [userId, amount]);
  await query('INSERT INTO xp_events (user_id, amount, source, lesson_id) VALUES ($1, $2, $3, $4)', [
    userId,
    amount,
    source,
    lessonId ?? null,
  ]);
}

export async function recordActivity(userId: string): Promise<Stats> {
  const stats = await getStats(userId);
  const now = today();
  if (stats.lastActiveOn === now) return stats;

  const gap = stats.lastActiveOn ? dayDiff(now, stats.lastActiveOn) : Number.POSITIVE_INFINITY;
  let streak = 1;
  let freezes = stats.freezes;

  if (gap === 1) {
    streak = stats.streak + 1;
  } else if (gap > 1 && freezes > 0) {
    freezes -= 1;
    streak = stats.streak + 1;
  }

  const longest = Math.max(stats.longestStreak, streak);
  const earnedFreeze = streak > 0 && streak % 7 === 0 ? 1 : 0;
  const row = await queryOne<StatsRow>(
    `UPDATE user_stats
        SET streak = $2, longest_streak = $3, last_active_on = $4,
            freezes = freezes - $5 + $6
      WHERE user_id = $1 RETURNING *`,
    [userId, streak, longest, now, gap > 1 && stats.freezes > 0 ? 1 : 0, earnedFreeze],
  );
  return toStats(row as StatsRow);
}

export async function completedLessonIds(userId: string): Promise<Set<string>> {
  const rows = await query<{ lesson_id: string }>('SELECT lesson_id FROM lesson_completions WHERE user_id = $1', [
    userId,
  ]);
  return new Set(rows.map((row) => row.lesson_id));
}

export async function completedSkills(userId: string): Promise<Set<string>> {
  const content = await getContent();
  const lessons = await completedLessonIds(userId);
  const skills = new Set<string>();
  for (const track of content.learnTracks) {
    for (const skill of track.skills) {
      if (skill.lessons.length > 0 && skill.lessons.every((lessonId) => lessons.has(lessonId))) {
        skills.add(skill.id);
      }
    }
  }
  return skills;
}

export async function tierUnlocked(userId: string, unlockSkills: string[]): Promise<boolean> {
  if (unlockSkills.length === 0) return true;
  const skills = await completedSkills(userId);
  return unlockSkills.every((skill) => skills.has(skill));
}

export async function recordAttempt(
  userId: string,
  challengeId: string,
  lessonId: string,
  correct: boolean,
): Promise<void> {
  await query('INSERT INTO challenge_attempts (user_id, challenge_id, lesson_id, correct) VALUES ($1, $2, $3, $4)', [
    userId,
    challengeId,
    lessonId,
    correct,
  ]);
  if (!correct) {
    const due = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    await query(
      `INSERT INTO challenge_reviews (user_id, challenge_id, lesson_id, wrong_count, due_on, cleared)
       VALUES ($1, $2, $3, 1, $4, false)
       ON CONFLICT (user_id, challenge_id) DO UPDATE
         SET wrong_count = challenge_reviews.wrong_count + 1,
             due_on = $4,
             cleared = false,
             updated_at = now()`,
      [userId, challengeId, lessonId, due],
    );
  }
}

export async function reviewQueue(userId: string, limit = 12): Promise<{ challengeId: string; lessonId: string; dueOn: string }[]> {
  const rows = await query<{ challenge_id: string; lesson_id: string; due_on: string }>(
    `SELECT challenge_id, lesson_id, due_on FROM challenge_reviews
      WHERE user_id = $1 AND cleared = false AND due_on <= CURRENT_DATE
      ORDER BY due_on ASC LIMIT $2`,
    [userId, limit],
  );
  return rows.map((row) => ({ challengeId: row.challenge_id, lessonId: row.lesson_id, dueOn: isoDate(row.due_on) as string }));
}

export async function clearReview(userId: string, challengeId: string): Promise<void> {
  await query('UPDATE challenge_reviews SET cleared = true, updated_at = now() WHERE user_id = $1 AND challenge_id = $2', [
    userId,
    challengeId,
  ]);
}

export function weekStart(now = new Date()): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - (day - 1));
  return date.toISOString().slice(0, 10);
}

export async function weeklyXp(userId: string): Promise<number> {
  const row = await queryOne<{ total: number }>(
    'SELECT COALESCE(SUM(amount), 0)::int AS total FROM xp_events WHERE user_id = $1 AND created_at >= $2',
    [userId, `${weekStart()}T00:00:00Z`],
  );
  return Number(row?.total ?? 0);
}

export function levelFor(xp: number): { level: number; title: string; nextLevelXp: number; progress: number } {
  const titles = ['Newcomer', 'Coder', 'Problem Solver', 'Contender', 'Competitor', 'Champion', 'Legend'];
  const level = Math.min(titles.length, Math.floor(xp / 250) + 1);
  const nextLevelXp = level * 250;
  const base = (level - 1) * 250;
  return {
    level,
    title: titles[level - 1] ?? 'Legend',
    nextLevelXp,
    progress: Math.min(1, (xp - base) / 250),
  };
}

function bucketFor(userId: string): number {
  let hash = 5381;
  for (let i = 0; i < userId.length; i += 1) hash = ((hash << 5) + hash + userId.charCodeAt(i)) | 0;
  return Math.abs(hash) % 20;
}

export interface LeagueStanding {
  userId: string;
  displayName: string;
  xp: number;
  rank: number;
  isYou: boolean;
  zone: 'promotion' | 'demotion' | 'safe';
}

export async function leagueFor(userId: string): Promise<{
  tier: string;
  weekStart: string;
  standings: LeagueStanding[];
  weeklyXp: number;
}> {
  const stats = await getStats(userId);
  const start = weekStart();
  await settleLeague(userId, stats.leagueTier, stats.leagueWeek);
  const fresh = await getStats(userId);
  const rows = await query<{ user_id: string; display_name: string; xp: number }>(
    `SELECT s.user_id, u.display_name, COALESCE(SUM(e.amount), 0)::int AS xp
       FROM user_stats s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN xp_events e ON e.user_id = s.user_id AND e.created_at >= $1
      WHERE s.league_tier = $2
      GROUP BY s.user_id, u.display_name`,
    [`${start}T00:00:00Z`, fresh.leagueTier],
  );
  const bucket = bucketFor(userId);
  const members = rows.filter((row) => bucketFor(row.user_id) === bucket).sort((a, b) => Number(b.xp) - Number(a.xp));
  const standings: LeagueStanding[] = members.map((row, index) => ({
    userId: row.user_id,
    displayName: row.display_name,
    xp: Number(row.xp),
    rank: index + 1,
    isYou: row.user_id === userId,
    zone: index < 3 ? 'promotion' : index >= members.length - 4 && members.length > 6 ? 'demotion' : 'safe',
  }));
  const mine = standings.find((entry) => entry.isYou);
  return {
    tier: fresh.leagueTier,
    weekStart: start,
    standings,
    weeklyXp: mine?.xp ?? (await weeklyXp(userId)),
  };
}

async function settleLeague(userId: string, tier: string, settledWeek: string | null): Promise<void> {
  const current = weekStart();
  if (settledWeek === current) return;
  const previousStart = new Date(Date.parse(`${current}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
  const rows = await query<{ user_id: string; xp: number }>(
    `SELECT s.user_id, COALESCE(SUM(e.amount), 0)::int AS xp
       FROM user_stats s
       LEFT JOIN xp_events e ON e.user_id = s.user_id AND e.created_at >= $1 AND e.created_at < $2
      WHERE s.league_tier = $3
      GROUP BY s.user_id`,
    [`${previousStart}T00:00:00Z`, `${current}T00:00:00Z`, tier],
  );
  const bucket = bucketFor(userId);
  const members = rows.filter((row) => bucketFor(row.user_id) === bucket).sort((a, b) => Number(b.xp) - Number(a.xp));
  const rank = members.findIndex((row) => row.user_id === userId);
  let nextTier = tier;
  const tierIndex = LEAGUE_TIERS.indexOf(tier as (typeof LEAGUE_TIERS)[number]);
  const promotionEligible = members.length > 6 && rank >= 0 && rank < 3;
  if (promotionEligible && tierIndex < LEAGUE_TIERS.length - 1) nextTier = LEAGUE_TIERS[tierIndex + 1];
  else if (members.length > 6 && rank >= members.length - 4 && tierIndex > 0) nextTier = LEAGUE_TIERS[tierIndex - 1];

  await query('UPDATE user_stats SET league_tier = $2, league_week = $3 WHERE user_id = $1', [
    userId,
    nextTier,
    current,
  ]);
}
