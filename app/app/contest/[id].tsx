import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { CodeEditor } from '../../src/components/CodeEditor';
import { Button, Card, Chip, ErrorNote, Loading, Pill, Screen } from '../../src/components/ui';
import { colors, radius, spacing, type } from '../../src/theme';
import type { RunOutcome } from '../../src/types';

interface ContestProblem {
  id: string;
  title: string;
  points: number;
  statement: string;
  sampleTest: { stdin: string; expected: string } | null;
  starterCode: Record<string, string>;
}

interface StartResponse {
  entry: { id: string; startedAt: string; endsAt: string; score: number };
  remainingSeconds: number;
  contest: { id: string; title: string; durationMinutes: number };
  problems: ContestProblem[];
  scores: Record<string, number>;
}

interface ResultResponse {
  score: number;
  maxScore: number;
  problems: { id: string; title: string; points: number; score: number; solved: boolean; topics: string[]; minutesSpent: number }[];
  topicsToReview: string[];
  xpEarned: number;
  streak: number;
}

export default function ContestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<StartResponse | null>(null);
  const [result, setResult] = useState<ResultResponse | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sources, setSources] = useState<Record<string, string>>({});
  const [outcomes, setOutcomes] = useState<Record<string, RunOutcome[]>>({});
  const [language, setLanguage] = useState('python');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const finishedRef = useRef(false);

  const start = useCallback(async () => {
    try {
      setError(null);
      const payload = await api.post<StartResponse>(`/contests/${id}/start`);
      setData(payload);
      setActiveId(payload.problems[0]?.id ?? null);
      setSecondsLeft(payload.remainingSeconds);
      const initial: Record<string, string> = {};
      for (const problem of payload.problems) initial[problem.id] = problem.starterCode?.python ?? '';
      setSources(initial);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not start the contest.');
    }
  }, [id]);

  useEffect(() => {
    start();
  }, [start]);

  useEffect(() => {
    if (!data) return;
    const timer = setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [data]);

  const finish = useCallback(async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    try {
      const payload = await api.post<ResultResponse>(`/contests/${id}/finish`);
      setResult(payload);
    } catch (caught) {
      finishedRef.current = false;
      setError(caught instanceof ApiError ? caught.message : 'Could not finish the contest.');
    }
  }, [id]);

  useEffect(() => {
    if (data && secondsLeft === 0 && !result) finish();
  }, [secondsLeft, data, result, finish]);

  const active = useMemo(() => data?.problems.find((problem) => problem.id === activeId), [data, activeId]);

  async function submitActive() {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await api.post<{ score: number; totalScore: number; outcomes: RunOutcome[]; scores: Record<string, number> }>(
        `/contests/${id}/submit`,
        { problemId: active.id, language, source: sources[active.id] ?? '' },
      );
      setOutcomes((current) => ({ ...current, [active.id]: payload.outcomes }));
      setData((current) =>
        current
          ? {
              ...current,
              scores: payload.scores,
              entry: { ...current.entry, score: payload.totalScore },
            }
          : current,
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Submission failed.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <Screen><ErrorNote message={error} onRetry={start} /></Screen>;
  if (!data) return <Loading label="Preparing your contest…" />;

  if (result) {
    return (
      <Screen>
        <View style={{ gap: 4, paddingTop: spacing.lg }}>
          <Text style={type.tiny}>RESULTS</Text>
          <Text style={type.display}>{data.contest.title}</Text>
        </View>
        <Card style={{ alignItems: 'center', gap: 4 }}>
          <Text style={[type.display, { fontSize: 44, color: colors.blue }]}>{result.score}</Text>
          <Text style={type.small}>of {result.maxScore} points</Text>
          <Text style={[type.small, { color: colors.greenDark }]}>+{result.xpEarned} XP · 🔥 {result.streak} day streak</Text>
        </Card>
        <View style={{ gap: spacing.sm }}>
          {result.problems.map((problem) => (
            <Card key={problem.id} style={{ gap: 4 }}>
              <View style={styles.rowBetween}>
                <Text style={type.body}>{problem.title}</Text>
                <Pill label={problem.solved ? 'SOLVED' : `${problem.score}/${problem.points}`} color={problem.solved ? colors.greenDark : colors.orange} />
              </View>
              <Text style={type.tiny}>TIME SPENT ~ {problem.minutesSpent} MIN</Text>
            </Card>
          ))}
        </View>
        {result.topicsToReview.length > 0 ? (
          <Card tone="muted">
            <Text style={type.tiny}>REVIEW NEXT</Text>
            <Text style={type.body}>{result.topicsToReview.join(' · ')}</Text>
          </Card>
        ) : null}
        <Button label="Back to Compete" onPress={() => router.replace('/(tabs)/compete')} />
      </Screen>
    );
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <Screen>
      <View style={styles.rowBetween}>
        <Pressable onPress={() => router.back()}>
          <Text style={[type.small, { color: colors.blue }]}>‹ Leave</Text>
        </Pressable>
        <View style={[styles.timer, secondsLeft < 300 && { backgroundColor: colors.redSoft }]}>
          <Text style={[type.heading, { color: secondsLeft < 300 ? colors.redDark : colors.text }]}>
            {minutes}:{String(seconds).padStart(2, '0')}
          </Text>
        </View>
      </View>

      <View style={{ gap: 2 }}>
        <Text style={type.title}>{data.contest.title}</Text>
        <Text style={type.small}>Score: {data.entry.score} points · graded per test case</Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {data.problems.map((problem) => {
          const score = data.scores[problem.id] ?? 0;
          return (
            <Chip
              key={problem.id}
              label={`${problem.title}${score ? ` · ${score}` : ''}`}
              active={activeId === problem.id}
              tone={colors.orange}
              onPress={() => setActiveId(problem.id)}
            />
          );
        })}
      </View>

      {active ? (
        <View style={{ gap: spacing.md }}>
          <Card style={{ gap: spacing.sm }}>
            <View style={styles.rowBetween}>
              <Text style={type.heading}>{active.title}</Text>
              <Pill label={`${active.points} PTS`} color={colors.orange} />
            </View>
            <Text style={type.body}>{active.statement}</Text>
            {active.sampleTest ? (
              <View style={styles.sample}>
                <Text style={type.tiny}>SAMPLE</Text>
                <Text style={styles.mono}>{active.sampleTest.stdin.trim() || '(none)'} → {active.sampleTest.expected}</Text>
              </View>
            ) : null}
          </Card>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {['python', 'java', 'cpp'].map((entry) => (
              <Chip
                key={entry}
                label={entry === 'cpp' ? 'C++' : entry}
                active={language === entry}
                tone={colors.blue}
                onPress={() => {
                  setLanguage(entry);
                  setSources((current) => ({ ...current, [active.id]: active.starterCode?.[entry] ?? current[active.id] ?? '' }));
                }}
              />
            ))}
          </View>

          <CodeEditor
            value={sources[active.id] ?? ''}
            onChange={(next) => setSources((current) => ({ ...current, [active.id]: next }))}
            language={language}
            minHeight={220}
          />
          <Button label="Submit problem" variant="blue" onPress={submitActive} loading={busy} />
          {error ? <Text style={[type.small, { color: colors.redDark }]}>{error}</Text> : null}
          {(outcomes[active.id] ?? []).length > 0 ? (
            <Card style={{ gap: 4 }}>
              {(outcomes[active.id] ?? []).map((outcome) => (
                <View key={outcome.index} style={styles.rowBetween}>
                  <Text style={type.small}>Test {outcome.index + 1}</Text>
                  <Text style={[type.small, { color: outcome.passed ? colors.greenDark : colors.redDark }]}>{outcome.message}</Text>
                </View>
              ))}
            </Card>
          ) : null}
        </View>
      ) : null}

      <Button label="Finish and see results" variant="secondary" onPress={finish} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  timer: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  sample: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  mono: { fontFamily: 'monospace', fontSize: 13, color: colors.text },
});
