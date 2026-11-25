import React, { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
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
} from '../../src/components/ui';
import { colors, radius, spacing, type } from '../../src/theme';
import type { CompeteData, ContestSummary } from '../../src/types';

export default function CompeteScreen() {
  const [data, setData] = useState<CompeteData | null>(null);
  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [trackId, setTrackId] = useState<string>('usaco');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [compete, contestData] = await Promise.all([
        api.get<CompeteData>('/compete'),
        api.get<{ contests: ContestSummary[] }>('/contests'),
      ]);
      setData(compete);
      setContests(contestData.contests);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the contest tracks.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (error && !data) return <Screen><ErrorNote message={error} onRetry={load} /></Screen>;
  if (!data) return <Loading label="Loading contest tracks…" />;

  const track = data.tracks.find((entry) => entry.id === trackId) ?? data.tracks[0];

  return (
    <Screen>
      <View style={{ gap: 2 }}>
        <Text style={type.display}>Compete</Text>
        <Text style={type.small}>Contest problems graded test by test, like the real thing.</Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {data.tracks.map((entry) => (
          <Chip
            key={entry.id}
            label={entry.title}
            active={entry.id === track?.id}
            tone={colors.blue}
            onPress={() => setTrackId(entry.id)}
          />
        ))}
      </View>

      {!data.judgeConfigured ? (
        <Card tone="muted" style={{ gap: 4 }}>
          <Text style={type.heading}>Code execution is offline</Text>
          <Text style={type.small}>
            Start Judge0 and set JUDGE0_URL on the server to run submissions in the sandbox. Lessons and checks still work.
          </Text>
        </Card>
      ) : null}

      {track ? (
        <View style={{ gap: spacing.lg }}>
          <Text style={type.small}>{track.description}</Text>
          {track.tiers.map((tier) => (
            <View key={tier.id} style={{ gap: spacing.sm }}>
              <View style={styles.tierHeader}>
                <Text style={type.heading}>{track.title} {tier.title}</Text>
                {tier.unlocked ? (
                  <Pill label="UNLOCKED" color={colors.greenDark} />
                ) : (
                  <Pill label="LOCKED" color={colors.textMuted} />
                )}
              </View>
              {!tier.unlocked ? (
                <Card tone="muted" style={{ gap: 4 }}>
                  <Text style={type.small}>
                    Finish these Learn skills to unlock: {tier.unlockSkills.join(', ') || 'the previous tier'}.
                  </Text>
                  <Button label="Open Learn" variant="secondary" small onPress={() => router.push('/(tabs)/learn')} />
                </Card>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {tier.topics.map((topic) => (
                    <Pressable key={topic.id} onPress={() => router.push(`/topic/${topic.id}`)}>
                      <Card style={{ gap: spacing.sm }}>
                        <View style={styles.topicHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={type.body}>{topic.title}</Text>
                            <Text style={type.tiny}>
                              {topic.solved}/{topic.problems} problems solved
                            </Text>
                          </View>
                          <Text style={[type.heading, { color: colors.blue }]}>›</Text>
                        </View>
                        <ProgressBar value={topic.mastery} height={8} color={colors.blue} />
                      </Card>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      ) : null}

      <View>
        <SectionTitle title="Mock contests" />
        <View style={{ gap: spacing.md }}>
          {contests.map((contest) => (
            <Card key={contest.id} style={{ gap: spacing.sm }}>
              <View style={styles.topicHeader}>
                <Text style={type.heading}>{contest.title}</Text>
                <Pill label={`${contest.durationMinutes} MIN`} color={colors.orange} />
              </View>
              <Text style={type.small}>{contest.description}</Text>
              <Text style={type.tiny}>
                {contest.problemCount} PROBLEMS · {contest.entry ? `BEST ${contest.entry.score} PTS` : 'NOT STARTED'}
              </Text>
              <Button
                label={contest.entry?.finishedAt ? 'View results' : contest.entry ? 'Resume contest' : 'Start contest'}
                variant={contest.entry?.finishedAt ? 'secondary' : 'blue'}
                small
                onPress={() => router.push(`/contest/${contest.id}`)}
              />
            </Card>
          ))}
        </View>
      </View>

      <Card tone="muted" style={{ gap: 4 }}>
        <Text style={type.tiny}>CONTEST LANGUAGE</Text>
        <Text style={type.body}>
          {data.contestLanguages.find((entry) => entry.id === data.contestLanguage)?.label ?? data.contestLanguage}
        </Text>
        <Text style={type.small}>Change it in Profile → settings.</Text>
      </Card>

      {error ? <ErrorNote message={error} onRetry={load} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tierHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topicHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
});
