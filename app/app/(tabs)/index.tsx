import React, { useCallback, useState } from 'react';
import { useFocusEffect, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { useAuth } from '../../src/auth';
import { Mascot } from '../../src/components/Mascot';
import { StreakHeatmap } from '../../src/components/StreakHeatmap';
import {
  Button,
  Card,
  ErrorNote,
  Hearts,
  Loading,
  Pill,
  ProgressBar,
  Screen,
  SectionTitle,
  StatTile,
} from '../../src/components/ui';
import { colors, radius, spacing, type } from '../../src/theme';
import type { Overview } from '../../src/types';

export default function HomeScreen() {
  const { user, refresh } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await api.get<Overview>('/me'));
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load your dashboard.');
    }
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (error && !data) {
    return (
      <Screen>
        <ErrorNote message={error} onRetry={load} />
      </Screen>
    );
  }
  if (!data) return <Loading label="Loading your day…" />;

  const { stats, league } = data;
  const goalProgress = stats.dailyGoalXp > 0 ? stats.todayXp / stats.dailyGoalXp : 0;
  const goalDone = stats.todayXp >= stats.dailyGoalXp;
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={type.tiny}>{greeting.toUpperCase()}</Text>
          <Text style={type.display}>{user?.displayName ?? 'Learner'}</Text>
          <Text style={type.small}>
            {stats.level.title} · Level {stats.level.level}
          </Text>
        </View>
        <Mascot mood={goalDone ? 'cheer' : 'idle'} size={64} />
      </View>

      <Card>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={type.tiny}>STREAK</Text>
            <Text style={[type.title, { color: colors.orange }]}>🔥 {stats.streak} day{stats.streak === 1 ? '' : 's'}</Text>
            <Text style={type.small}>Freezes available: {stats.freezes}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={type.tiny}>HEARTS</Text>
            <Hearts hearts={stats.hearts} max={stats.heartsMax} />
            {stats.hearts < stats.heartsMax && stats.nextHeartAt ? (
              <Text style={type.tiny}>NEXT IN {minutesUntil(stats.nextHeartAt)} MIN</Text>
            ) : null}
          </View>
        </View>
        <View style={{ height: spacing.md }} />
        <View style={styles.rowBetween}>
          <Text style={type.small}>Daily goal</Text>
          <Text style={type.small}>
            {stats.todayXp} / {stats.dailyGoalXp} XP
          </Text>
        </View>
        <View style={{ height: spacing.sm }} />
        <ProgressBar value={goalProgress} color={goalDone ? colors.green : colors.blue} />
        <View style={{ height: spacing.md }} />
        <View style={styles.statsRow}>
          <StatTile label="Total XP" value={String(stats.xp)} accent={colors.yellow} />
          <StatTile label="This week" value={String(stats.weeklyXp)} accent={colors.blue} />
          <StatTile label="Badges" value={`${data.badgesEarned}/${data.badgesTotal}`} accent={colors.purple} />
        </View>
      </Card>

      <Card tone="green">
        <View style={styles.rowBetween}>
          <Text style={type.tiny}>CONTINUE LEARNING</Text>
          <Pill label="5-15 MIN" color={colors.greenDark} />
        </View>
        <Text style={[type.title, { marginTop: spacing.xs }]}>
          {data.nextLesson?.title ?? 'Skill tree complete'}
        </Text>
        <Text style={type.small}>
          {data.nextLesson ? `${data.nextLesson.skillTitle} · +XP every question` : 'Try a Compete problem to keep growing.'}
        </Text>
        <View style={{ height: spacing.md }} />
        <Button
          label={data.nextLesson ? 'Start lesson' : 'Open Compete'}
          onPress={() =>
            data.nextLesson
              ? router.push(`/lesson/${data.nextLesson.id}`)
              : router.push('/(tabs)/compete')
          }
        />
      </Card>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Card style={{ flex: 1 }}>
          <Text style={type.tiny}>REVIEW DUE</Text>
          <Text style={type.title}>{data.reviewDue}</Text>
          <Text style={type.small}>Questions you missed, spaced out over time.</Text>
          <View style={{ height: spacing.sm }} />
          <Button
            label={data.reviewDue > 0 ? 'Review' : 'No reviews'}
            variant="secondary"
            small
            disabled={data.reviewDue === 0}
            onPress={() => router.push('/lesson/review')}
          />
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={type.tiny}>LEAGUE</Text>
          <Text style={type.title}>{capitalise(league.tier)}</Text>
          <Text style={type.small}>
            {league.rank ? `Rank ${league.rank} of ${league.members}` : 'Earn XP to enter the board'}
          </Text>
          <View style={{ height: spacing.sm }} />
          <Button label="Standings" variant="secondary" small onPress={() => router.push('/(tabs)/leagues')} />
        </Card>
      </View>

      <View>
        <SectionTitle title="Daily quests" />
        <Card style={{ gap: spacing.md }}>
          <Quest
            label="Earn 50 XP today"
            value={Math.min(1, stats.todayXp / 50)}
            done={stats.todayXp >= 50}
          />
          <Quest label="Finish one lesson" value={data.nextLesson ? 0 : 1} done={!data.nextLesson} />
          <Quest
            label="Clear your review queue"
            value={data.reviewDue === 0 ? 1 : 0}
            done={data.reviewDue === 0}
          />
        </Card>
      </View>

      <View>
        <SectionTitle title="Your streak" />
        <Card>
          <StreakHeatmap days={data.heatmap} />
        </Card>
      </View>

      {data.mastery.length > 0 ? (
        <View>
          <SectionTitle title="Topic mastery" />
          <Card style={{ gap: spacing.md }}>
            {data.mastery.map((topic) => (
              <View key={topic.topicId} style={{ gap: 4 }}>
                <View style={styles.rowBetween}>
                  <Text style={type.small}>{topic.label}</Text>
                  <Text style={type.small}>{Math.round(topic.ratio * 100)}%</Text>
                </View>
                <ProgressBar value={topic.ratio} height={10} color={colors.blue} />
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {data.badges.length > 0 ? (
        <View>
          <SectionTitle title="Recent badges" />
          <View style={styles.badgeRow}>
            {data.badges.map((badge) => (
              <View key={badge.id} style={styles.badge}>
                <Text style={{ fontSize: 24 }}>{badge.icon}</Text>
                <Text style={[type.tiny, { textAlign: 'center' }]}>{badge.title.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {error ? <ErrorNote message={error} onRetry={load} /> : null}
    </Screen>
  );
}

function Quest({ label, value, done }: { label: string; value: number; done: boolean }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.rowBetween}>
        <Text style={type.body}>{done ? '✅ ' : ''}{label}</Text>
        <Text style={type.small}>{done ? 'Done' : `${Math.round(value * 100)}%`}</Text>
      </View>
      <ProgressBar value={done ? 1 : value} height={8} color={done ? colors.green : colors.orange} />
    </View>
  );
}

function minutesUntil(iso: string): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 60_000));
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  badge: {
    width: 92,
    alignItems: 'center',
    gap: 4,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
});
