import React, { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import {
  Button,
  Card,
  Chip,
  ErrorNote,
  Hearts,
  Loading,
  Pill,
  ProgressBar,
  Screen,
} from '../../src/components/ui';
import { colors, radius, spacing, type } from '../../src/theme';
import type { LearnData } from '../../src/types';

export default function LearnScreen() {
  const [data, setData] = useState<LearnData | null>(null);
  const [trackId, setTrackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const payload = await api.get<LearnData>('/learn');
      setData(payload);
      setTrackId((current) => current ?? payload.activeTrackId);
      setExpanded((current) => current ?? payload.nextLesson?.skillId ?? payload.tracks[0]?.skills[0]?.id ?? null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the skill tree.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (error && !data) return <Screen><ErrorNote message={error} onRetry={load} /></Screen>;
  if (!data) return <Loading label="Loading your skill tree…" />;

  const track = data.tracks.find((entry) => entry.id === trackId) ?? data.tracks[0];
  if (!track) return <Screen><Text style={type.body}>No language tracks are available.</Text></Screen>;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.display}>Learn</Text>
          <Text style={type.small}>
            {track.completedLessons}/{track.totalLessons} lessons complete
          </Text>
        </View>
        <Hearts hearts={data.hearts} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {data.tracks.map((entry) => (
          <Chip
            key={entry.id}
            label={entry.available ? entry.title : `${entry.title} · soon`}
            active={entry.id === track.id}
            tone={colors.green}
            onPress={() => entry.available && setTrackId(entry.id)}
          />
        ))}
      </View>

      {data.reviewDue > 0 ? (
        <Pressable onPress={() => router.push('/lesson/review')}>
          <Card tone="purple" style={styles.reviewCard}>
            <Text style={{ fontSize: 24 }}>♻️</Text>
            <View style={{ flex: 1 }}>
              <Text style={type.heading}>{data.reviewDue} questions to review</Text>
              <Text style={type.small}>Spaced repetition: these come back until you get them right.</Text>
            </View>
            <Text style={[type.heading, { color: colors.purple }]}>›</Text>
          </Card>
        </Pressable>
      ) : null}

      {data.nextLesson ? (
        <Card tone="green" style={{ gap: spacing.sm }}>
          <Text style={type.tiny}>UP NEXT</Text>
          <Text style={type.heading}>{data.nextLesson.title}</Text>
          <Text style={type.small}>{data.nextLesson.skillTitle}</Text>
          <Button label="Continue" onPress={() => router.push(`/lesson/${data.nextLesson?.lessonId}`)} />
        </Card>
      ) : null}

      <View style={{ gap: spacing.md }}>
        {track.skills.map((skill, index) => {
          const isOpen = expanded === skill.id;
          return (
            <View key={skill.id} style={{ gap: spacing.sm }}>
              <Pressable
                disabled={!skill.unlocked}
                onPress={() => setExpanded(isOpen ? null : skill.id)}
              >
                <Card style={[styles.skillCard, skill.completed && styles.skillDone, !skill.unlocked && styles.skillLocked]}>
                  <View style={[styles.node, skill.completed && { backgroundColor: colors.green }, !skill.unlocked && { backgroundColor: colors.surfaceAlt }]}>
                    <Text style={[styles.nodeLabel, skill.unlocked && { color: colors.white }]}>
                      {skill.completed ? '✓' : skill.unlocked ? index + 1 : '🔒'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={type.heading}>{skill.title}</Text>
                    <Text style={type.small}>{skill.summary}</Text>
                    <View style={{ marginTop: 6 }}>
                      <ProgressBar
                        value={skill.lessonCount === 0 ? 0 : skill.lessonsDone / skill.lessonCount}
                        height={8}
                        color={skill.completed ? colors.green : colors.blue}
                      />
                    </View>
                  </View>
                  <Text style={type.tiny}>
                    {skill.lessonsDone}/{skill.lessonCount}
                  </Text>
                </Card>
              </Pressable>

              {isOpen && skill.unlocked ? (
                <View style={{ gap: spacing.sm, paddingLeft: spacing.lg }}>
                  {skill.lessons.map((lesson) => (
                    <Pressable
                      key={lesson.id}
                      onPress={() => router.push(`/lesson/${lesson.id}`)}
                      style={styles.lessonRow}
                    >
                      <Text style={{ fontSize: 20 }}>{lesson.completed ? '✅' : '📘'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={type.body}>{lesson.title}</Text>
                        <Text style={type.tiny}>{lesson.xp} XP</Text>
                      </View>
                      {lesson.completed ? <Pill label="DONE" color={colors.greenDark} /> : <Text style={[type.heading, { color: colors.blue }]}>›</Text>}
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {error ? <ErrorNote message={error} onRetry={load} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reviewCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  skillCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  skillDone: { borderColor: colors.green },
  skillLocked: { opacity: 0.6 },
  node: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeLabel: { color: colors.textMuted, fontWeight: '800' },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
});
