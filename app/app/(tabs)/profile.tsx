import React, { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { useAuth } from '../../src/auth';
import { StreakHeatmap } from '../../src/components/StreakHeatmap';
import {
  Button,
  Card,
  Chip,
  ErrorNote,
  Loading,
  Pill,
  ProgressBar,
  Screen,
  SectionTitle,
  StatTile,
} from '../../src/components/ui';
import { colors, radius, spacing, type } from '../../src/theme';
import type { Badge, Overview } from '../../src/types';

interface FriendChallenge {
  code: string;
  problemId: string;
  creator: { id: string; name: string };
  joiner: { id: string; name: string } | null;
  winnerId: string | null;
}

const GOALS = [
  { id: 20, label: 'Casual · 20 XP' },
  { id: 50, label: 'Regular · 50 XP' },
  { id: 100, label: 'Serious · 100 XP' },
];

export default function ProfileScreen() {
  const { user, signOut, refresh } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [races, setRaces] = useState<FriendChallenge[]>([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [overview, badgeData, raceData] = await Promise.all([
        api.get<Overview>('/me'),
        api.get<{ badges: Badge[] }>('/me/badges'),
        api.get<{ challenges: FriendChallenge[] }>('/friend-challenges'),
      ]);
      setData(overview);
      setBadges(badgeData.badges);
      setRaces(raceData.challenges);
      setName(overview.user.displayName);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load your profile.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await api.patch('/me', patch);
      await refresh();
      await load();
      setMessage('Saved.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save that change.');
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <Screen>{error ? <ErrorNote message={error} onRetry={load} /> : <Loading label="Loading profile…" />}</Screen>;
  }

  const { stats } = data;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.green }]}>
          <Text style={styles.avatarLabel}>{(user?.displayName ?? 'A').slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.title}>{user?.displayName}</Text>
          <Text style={type.small}>{user?.email}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: 4 }}>
            <Pill label={`LEVEL ${stats.level.level}`} color={colors.greenDark} />
            <Pill label={stats.leagueTier.toUpperCase()} color={colors.blue} />
          </View>
        </View>
        <Text style={{ fontSize: 32 }}>🔥</Text>
      </View>

      <Card style={{ gap: spacing.md }}>
        <View style={styles.statsRow}>
          <StatTile label="Total XP" value={String(stats.xp)} accent={colors.yellow} />
          <StatTile label="Streak" value={`${stats.streak}d`} accent={colors.orange} />
          <StatTile label="Best" value={`${stats.longestStreak}d`} accent={colors.purple} />
          <StatTile label="Badges" value={`${data.badgesEarned}`} accent={colors.greenDark} />
        </View>
        <View style={{ gap: 4 }}>
          <View style={styles.rowBetween}>
            <Text style={type.small}>Next level</Text>
            <Text style={type.small}>
              {stats.xp} / {stats.level.nextLevelXp} XP
            </Text>
          </View>
          <ProgressBar value={stats.level.progress} />
        </View>
      </Card>

      <View>
        <SectionTitle title="Streak history" />
        <Card>
          <StreakHeatmap days={data.heatmap} />
        </Card>
      </View>

      <View>
        <SectionTitle title={`Badges · ${data.badgesEarned}/${data.badgesTotal}`} />
        <View style={styles.badgeGrid}>
          {badges.map((badge) => (
            <View key={badge.id} style={[styles.badge, !badge.earned && { opacity: 0.4 }]}>
              <Text style={{ fontSize: 24 }}>{badge.earned ? badge.icon : '🔒'}</Text>
              <Text style={[type.tiny, { textAlign: 'center' }]}>{badge.title.toUpperCase()}</Text>
              <Text style={[type.small, { textAlign: 'center', fontSize: 11 }]}>{badge.description}</Text>
            </View>
          ))}
        </View>
      </View>

      {races.length > 0 ? (
        <View>
          <SectionTitle title="Friend races" />
          <Card style={{ gap: spacing.sm }}>
            {races.map((race) => (
              <View key={race.code} style={styles.rowBetween}>
                <Text style={type.small}>
                  {race.creator.name} vs {race.joiner?.name ?? 'waiting…'}
                </Text>
                <Pill label={race.code} color={colors.purple} />
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      <View>
        <SectionTitle title="Settings" />
        <Card style={{ gap: spacing.md }}>
          <View style={{ gap: 6 }}>
            <Text style={type.tiny}>DISPLAY NAME</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholderTextColor={colors.textFaint}
            />
          </View>
          <Button
            label="Save name"
            variant="secondary"
            small
            loading={busy}
            disabled={!name.trim() || name.trim() === user?.displayName}
            onPress={() => save({ displayName: name.trim() })}
          />

          <View style={{ gap: 6 }}>
            <Text style={type.tiny}>DAILY GOAL</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {GOALS.map((goal) => (
                <Chip
                  key={goal.id}
                  label={goal.label}
                  active={stats.dailyGoalXp === goal.id}
                  tone={colors.green}
                  onPress={() => save({ dailyGoalXp: goal.id })}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={type.tiny}>CONTEST LANGUAGE</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {['python', 'java', 'javascript', 'cpp'].map((language) => (
                <Chip
                  key={language}
                  label={language === 'cpp' ? 'C++' : language}
                  active={stats.contestLanguage === language}
                  tone={colors.blue}
                  onPress={() => save({ contestLanguage: language })}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={type.tiny}>GOAL</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {['learn', 'compete', 'both'].map((goal) => (
                <Chip
                  key={goal}
                  label={goal}
                  active={user?.goal === goal}
                  tone={colors.purple}
                  onPress={() => save({ goal })}
                />
              ))}
            </View>
          </View>

          {message ? <Text style={[type.small, { color: colors.greenDark }]}>{message}</Text> : null}
          {error ? <Text style={[type.small, { color: colors.redDark }]}>{error}</Text> : null}
        </Card>
      </View>

      <Button
        label="Sign out"
        variant="secondary"
        onPress={async () => {
          await signOut();
          router.replace('/auth');
        }}
      />
      <Text style={[type.tiny, { textAlign: 'center' }]}>
        Lesson content is original sample material written for this app, not official contest papers.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { color: colors.white, fontSize: 24, fontWeight: '800' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    width: 102,
    alignItems: 'center',
    gap: 4,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
});
