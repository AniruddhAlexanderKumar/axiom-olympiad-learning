import React, { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { QuestionCard } from '../../src/components/QuestionCard';
import { Button, Card, ErrorNote, Loading, Pill, Screen } from '../../src/components/ui';
import { colors, spacing, type } from '../../src/theme';
import type { Challenge, TopicDetail } from '../../src/types';

export default function TopicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<TopicDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkIndex, setCheckIndex] = useState(0);
  const [answer, setAnswer] = useState<unknown>(null);
  const [ready, setReady] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; expected: string; explanation: string } | null>(null);
  const [showEditorial, setShowEditorial] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await api.get<TopicDetail>(`/compete/topics/${id}`));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load that topic.');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <Screen><ErrorNote message={error} onRetry={load} /></Screen>;
  if (!data) return <Loading label="Loading the topic…" />;

  const checks = data.topic.checks;
  const check: Challenge | undefined = checks[checkIndex];

  async function submitCheck() {
    if (!check) return;
    setBusy(true);
    try {
      const payload = await api.post<{ result: { correct: boolean; expected: string; explanation: string } }>(
        `/compete/topics/${data?.topic.id}/check`,
        { challengeId: check.id, answer },
      );
      setFeedback(payload.result);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not check that answer.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()}>
        <Text style={[type.small, { color: colors.blue }]}>‹ Back</Text>
      </Pressable>

      <View style={{ gap: 4 }}>
        <Text style={type.tiny}>{data.tier.title.toUpperCase()} · {data.track.title.toUpperCase()}</Text>
        <Text style={type.display}>{data.topic.title}</Text>
        <Text style={type.small}>{data.topic.summary}</Text>
      </View>

      <Card style={{ gap: spacing.sm }}>
        <Text style={type.tiny}>THE IDEA</Text>
        <Text style={type.body}>{data.topic.explanation}</Text>
      </Card>

      <Card tone="blue" style={{ gap: spacing.sm }}>
        <Text style={type.tiny}>WORKED EXAMPLE</Text>
        <Text style={[type.body, { fontFamily: 'monospace', fontSize: 13 }]}>{data.topic.workedExample}</Text>
      </Card>

      {check ? (
        <View style={{ gap: spacing.md }}>
          <View style={styles.checkHeader}>
            <Text style={type.heading}>Check your thinking</Text>
            <Text style={type.tiny}>
              {checkIndex + 1}/{checks.length}
            </Text>
          </View>
          <QuestionCard
            key={check.id}
            challenge={check}
            onChange={(payload, complete) => {
              setAnswer(payload);
              setReady(Boolean(complete));
            }}
            disabled={Boolean(feedback) || busy}
          />
          {feedback ? (
            <Card tone={feedback.correct ? 'green' : 'muted'} style={{ gap: 4 }}>
              <Text style={[type.heading, { color: feedback.correct ? colors.greenDark : colors.redDark }]}>
                {feedback.correct ? 'Correct' : `Answer: ${feedback.expected}`}
              </Text>
              <Text style={type.small}>{feedback.explanation}</Text>
              <Button
                label={checkIndex + 1 < checks.length ? 'Next check' : 'Done with checks'}
                variant="secondary"
                small
                onPress={() => {
                  setFeedback(null);
                  setAnswer(null);
                  setReady(false);
                  setCheckIndex((value) => Math.min(value + 1, checks.length - 1));
                }}
              />
            </Card>
          ) : (
            <Button label="Check answer" onPress={submitCheck} disabled={!ready} loading={busy} />
          )}
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Text style={type.heading}>Problems</Text>
        {data.topic.problems.map((problem) => (
          <Pressable key={problem.id} onPress={() => router.push(`/problem/${problem.id}`)}>
            <Card style={styles.problemRow}>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>{problem.title}</Text>
                <Text style={type.tiny}>
                  {problem.difficulty.toUpperCase()} · {problem.points} PTS · {problem.attempts} ATTEMPTS
                </Text>
              </View>
              {problem.solved ? <Pill label="SOLVED" color={colors.greenDark} /> : <Text style={[type.heading, { color: colors.blue }]}>›</Text>}
            </Card>
          </Pressable>
        ))}
      </View>

      <View style={{ gap: spacing.sm }}>
        <View style={styles.checkHeader}>
          <Text style={type.heading}>Editorial</Text>
          <Pill label="SPOILERS" color={colors.purple} />
        </View>
        {showEditorial ? (
          <Card tone="purple">
            <Text style={type.body}>{data.topic.editorial}</Text>
          </Card>
        ) : (
          <Button label="Reveal editorial" variant="secondary" onPress={() => setShowEditorial(true)} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  checkHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  problemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
