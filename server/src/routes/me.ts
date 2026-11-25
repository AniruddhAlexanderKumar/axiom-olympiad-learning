import { Router } from 'express';
import { currentUser, loadUser, requireAuth } from '../auth.js';
import { badgeCatalog } from '../badges.js';
import { getContent } from '../content.js';
import { query, queryOne } from '../db.js';
import { HttpError, wrap } from '../http.js';
import {
  HEART_MAX,
  completedLessonIds,
  getStats,
  leagueFor,
  levelFor,
  reviewQueue,
  weeklyXp,
} from '../progress.js';

export const meRouter = Router();

meRouter.get(
  '/me',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const content = await getContent();
    const stats = await getStats(user.id);
    const level = levelFor(stats.xp);
    const completed = await completedLessonIds(user.id);

    const todayXpRow = await queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0)::int AS total FROM xp_events WHERE user_id = $1 AND created_at::date = CURRENT_DATE`,
      [user.id],
    );
    const todayXp = Number(todayXpRow?.total ?? 0);

    const heatmapRows = await query<{ day: string; xp: number }>(
      `SELECT to_char(created_at, 'YYYY-MM-DD') AS day, COALESCE(SUM(amount), 0)::int AS xp
         FROM xp_events
        WHERE user_id = $1 AND created_at >= CURRENT_DATE - interval '27 days'
        GROUP BY 1 ORDER BY 1`,
      [user.id],
    );
    const heatmap = heatmapRows.map((row) => ({ day: String(row.day), xp: Number(row.xp) }));

    const track = content.learnTracks.find((entry) => entry.language === user.language) ?? content.learnTracks[0];
    let nextLesson: { id: string; title: string; skillTitle: string } | null = null;
    if (track) {
      for (const skill of track.skills) {
        const lessonId = skill.lessons.find((id) => !completed.has(id));
        if (lessonId) {
          nextLesson = {
            id: lessonId,
            title: content.lessons.get(lessonId)?.title ?? lessonId,
            skillTitle: skill.title,
          };
          break;
        }
      }
    }

    const due = await reviewQueue(user.id, 50);
    const league = await leagueFor(user.id);
    const mine = league.standings.find((entry) => entry.isYou);
    const badges = await badgeCatalog(user.id);

    const masteryRows = await query<{ topic_id: string; correct: number; total: number }>(
      'SELECT topic_id, correct, total FROM topic_mastery WHERE user_id = $1 ORDER BY total DESC LIMIT 6',
      [user.id],
    );
    const contests = await query<{ contest_id: string; score: number; finished_at: string | null }>(
      'SELECT contest_id, score, finished_at FROM contest_entries WHERE user_id = $1 ORDER BY started_at DESC LIMIT 5',
      [user.id],
    );

    const heartsUpdated = Date.parse(stats.heartsUpdatedAt);
    const nextHeartAt =
      stats.hearts < HEART_MAX ? new Date(heartsUpdated + 25 * 60_000).toISOString() : null;

    res.json({
      user,
      stats: {
        ...stats,
        level,
        todayXp,
        dailyGoalXp: user.dailyGoalXp,
        heartsMax: HEART_MAX,
        nextHeartAt,
        weeklyXp: await weeklyXp(user.id),
      },
      nextLesson,
      reviewDue: due.length,
      league: {
        tier: league.tier,
        rank: mine?.rank ?? null,
        members: league.standings.length,
        weeklyXp: league.weeklyXp,
      },
      badges: badges.filter((badge) => badge.earned).slice(0, 6),
      badgesEarned: badges.filter((badge) => badge.earned).length,
      badgesTotal: badges.length,
      heatmap,
      mastery: masteryRows.map((row) => ({
        topicId: row.topic_id,
        label:
          [...content.competeTracks.flatMap((trackEntry) => trackEntry.tiers.flatMap((tier) => tier.topics))].find(
            (topic) => topic.id === row.topic_id,
          )?.title ?? row.topic_id,
        ratio: row.total > 0 ? row.correct / row.total : 0,
      })),
      contests: contests.map((entry) => ({
        id: entry.contest_id,
        title: content.contests.find((contest) => contest.id === entry.contest_id)?.title ?? entry.contest_id,
        score: Number(entry.score),
        finished: Boolean(entry.finished_at),
      })),
    });
  }),
);

meRouter.patch(
  '/me',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    const displayName = req.body?.displayName;
    const dailyGoalXp = req.body?.dailyGoalXp;
    const language = req.body?.language;
    const contestLanguage = req.body?.contestLanguage;
    const goal = req.body?.goal;

    if (displayName !== undefined) {
      const name = String(displayName).trim();
      if (name.length < 2) throw new HttpError(400, 'Names need at least two characters.');
      await query('UPDATE users SET display_name = $2 WHERE id = $1', [user.id, name.slice(0, 40)]);
    }
    if (dailyGoalXp !== undefined) {
      const value = Number(dailyGoalXp);
      if (!Number.isFinite(value) || value < 20 || value > 200) throw new HttpError(400, 'Daily goal must be 20-200 XP.');
      await query('UPDATE users SET daily_goal_xp = $2 WHERE id = $1', [user.id, Math.round(value)]);
    }
    if (language !== undefined) {
      const content = await getContent();
      if (!content.learnTracks.some((track) => track.language === String(language) && track.available)) {
        throw new HttpError(400, 'That language track is not available yet.');
      }
      await query('UPDATE users SET language = $2 WHERE id = $1', [user.id, String(language)]);
    }
    if (goal !== undefined) {
      if (!['learn', 'compete', 'both'].includes(String(goal))) throw new HttpError(400, 'Pick a goal.');
      await query('UPDATE users SET goal = $2 WHERE id = $1', [user.id, String(goal)]);
    }
    if (contestLanguage !== undefined) {
      if (!['python', 'java', 'javascript', 'cpp'].includes(String(contestLanguage))) {
        throw new HttpError(400, 'Unsupported contest language.');
      }
      await query('UPDATE user_stats SET contest_language = $2 WHERE user_id = $1', [
        user.id,
        String(contestLanguage),
      ]);
    }
    res.json({ user: await loadUser(user.id) });
  }),
);

meRouter.get(
  '/me/leagues',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    res.json(await leagueFor(user.id));
  }),
);

meRouter.get(
  '/me/badges',
  requireAuth,
  wrap(async (req, res) => {
    const user = currentUser(req);
    res.json({ badges: await badgeCatalog(user.id) });
  }),
);
