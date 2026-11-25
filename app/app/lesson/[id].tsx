import React, { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { useAuth } from '../../src/auth';
import { Mascot, type MascotMood } from '../../src/components/Mascot';
import { QuestionCard } from '../../src/components/QuestionCard';
import { Button, Card, CodeBlock, ErrorNote, Hearts, Loading, ProgressBar, Screen } from '../../src/components/ui';
import { colors, radius, spacing, type } from '../../src/theme';
import type { AnswerResponse, Challenge, LessonSession, LessonSummary } from '../../src/types';

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh } = useAuth();
  const [session, setSession] = useState<LessonSession | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [intro, setIntro] = useState(true);
  const [answer, setAnswer] = useState<unknown>(null);
  const [ready, setReady] = useState(false);
  const [feedback, setFeedback] = useState<AnswerResponse | null>(null);
  const [summary, setSummary] = useState<LessonSummary | null>(null);
  const [hearts, setHearts] = useState(5);
  const [progress, setProgress] = useState({ solved: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [outOfHearts, setOutOfHearts] = useState(false);

  const start = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const payload =
        id === 'review'
          ? await api.post<LessonSession>('/review/start')
          : await api.post<LessonSession>(`/learn/lessons/${id}/start`);
      setSession(payload);
      setChallenge(payload.challenge);
      setHearts(payload.progress.hearts);
      setProgress({ solved: payload.progress.solved, total: payload.progress.total });
      setIntro(id !== 'review');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not start this lesson.');
    }
  }, [id]);

  useEffect(() => {
    start();
  }, [start]);

  async function submit() {
    if (!session || !challenge) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await api.post<AnswerResponse>(`/lesson-sessions/${session.sessionId}/answer`, {
        challengeId: challenge.id,
        answer,
      });
      setFeedback(payload);
      setHearts(payload.hearts);
      setProgress({ solved: payload.progress.solved, total: payload.progress.total });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) setOutOfHearts(true);
      setError(caught instanceof ApiError ? caught.message : 'Could not check that answer.');
    } finally {
      setBusy(false);
    }
  }

  function advance() {
    if (!feedback) return;
    if (feedback.complete) {
      setSummary(feedback.summary);
      refresh();
      return;
    }
    setChallenge(feedback.next);
    setFeedback(null);
    setAnswer(null);
    setReady(false);
  }

  if (error && !session) return <Screen><ErrorNote message={error} onRetry={start} /></Screen>;
  if (!session) return <Loading label="Loading the lesson…" />;

  if (summary) {
    return <SummaryView summary={summary} mode={session.mode ?? 'lesson'} />;
  }

  if (outOfHearts) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxl }}>
          <Mascot mood="sad" size={96} />
          <Text style={type.display}>Out of hearts</Text>
          <Text style={[type.body, { textAlign: 'center', color: colors.textMuted }]}>
            Hearts refill every 25 minutes. Finish a review session to earn one back right away.
          </Text>
          <Card style={{ width: '100%' }}>
            <Text style={type.body}>Wrong answers cost one heart. Practice never costs anything.</Text>
          </Card>
          <Button label="Review instead" onPress={() => router.replace('/lesson/review')} />
          <Button label="Back to Home" variant="ghost" onPress={() => router.replace('/(tabs)')} />
        </View>
      </Screen>
    );
  }

  const total = progress.total || 1;
  const percent = Math.min(1, progress.solved / total);

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.replace('/(tabs)')} accessibilityLabel="Close lesson">
          <Text style={{ fontSize: 22, color: colors.textFaint }}>✕</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <ProgressBar value={percent} />
        </View>
        <Hearts hearts={hearts} />
      </View>

      {intro && session.lesson ? (
        <View style={{ gap: spacing.lg }}>
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Mascot mood="happy" size={80} />
            <Text style={[type.display, { textAlign: 'center' }]}>{session.lesson.intro.title}</Text>
            <Text style={[type.body, { textAlign: 'center', color: colors.textMuted }]}>{session.lesson.intro.body}</Text>
          </View>
          {session.lesson.intro.sample ? <CodeBlock code={session.lesson.intro.sample} /> : null}
          <Card tone="muted">
            <Text style={type.small}>
              {session.lesson.title} · {progress.total} challenges · answer with taps first, then code.
            </Text>
          </Card>
          <Button label="Let's go" onPress={() => setIntro(false)} />
        </View>
      ) : challenge ? (
        <View style={{ gap: spacing.lg }}>
          <View style={styles.questionMeta}>
            <Text style={type.tiny}>
              {Math.min(progress.solved + 1, total)} / {total}
            </Text>
            <Text style={type.tiny}>{challenge.type.replace('-', ' ').toUpperCase()}</Text>
          </View>

          <QuestionCard
            challenge={challenge}
            onChange={(payload, complete) => {
              setAnswer(payload);
              setReady(Boolean(complete));
            }}
            disabled={Boolean(feedback) || busy}
            language={session.lesson?.id === 'review' ? 'python' : 'python'}
          />

          {feedback ? (
            <FeedbackBanner
              correct={feedback.result.correct}
              expected={feedback.result.expected}
              explanation={feedback.result.explanation}
              onContinue={advance}
              last={feedback.complete}
            />
          ) : (
            <Button
              label={challenge.type === 'frq' ? 'Run & check' : 'Check'}
              onPress={submit}
              disabled={!ready}
              loading={busy}
            />
          )}
          {error ? <Text style={[type.small, { color: colors.redDark }]}>{error}</Text> : null}
        </View>
      ) : (
        <Text style={type.body}>This lesson has no questions yet.</Text>
      )}
    </Screen>
  );
}

function FeedbackBanner({
  correct,
  expected,
  explanation,
  onContinue,
  last,
}: {
  correct: boolean;
  expected: string;
  explanation: string;
  onContinue: () => void;
  last: boolean;
}) {
  const mood: MascotMood = correct ? 'happy' : 'sad';
  return (
    <View style={[styles.feedback, { backgroundColor: correct ? '#EAFBE0' : '#FFECEC', borderColor: correct ? colors.green : colors.red }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Mascot mood={mood} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={[type.heading, { color: correct ? colors.greenDark : colors.redDark }]}>
            {correct ? ['Nice!', 'Exactly right!', 'You got it!'][Math.floor(Math.random() * 3)] : 'Not quite'}
          </Text>
          <Text style={type.small}>{explanation}</Text>
        </View>
      </View>
      {!correct ? (
        <Card tone="muted" style={styles.expected}>
          <Text style={type.tiny}>THE ANSWER</Text>
          <Text style={styles.expectedText}>{expected}</Text>
        </Card>
      ) : null}
      <Button label={last ? 'Finish lesson' : 'Continue'} onPress={onContinue} variant={correct ? 'primary' : 'secondary'} />
    </View>
  );
}

function SummaryView({ summary, mode }: { summary: LessonSummary; mode: 'lesson' | 'review' }) {
  const accuracy = Math.round(summary.accuracy * 100);
  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl }}>
        <Mascot mood="cheer" size={110} />
        <Text style={type.display}>{mode === 'review' ? 'Review cleared' : 'Lesson complete!'}</Text>
        <Text style={[type.body, { color: colors.textMuted, textAlign: 'center' }]}>
          {summary.mistakes === 0 ? 'A perfect run. That is how streaks are built.' : 'Mistakes are the ones you remember. They will come back in review.'}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Card style={styles.summaryTile}>
          <Text style={[type.display, { color: colors.yellow }]}>+{summary.xpEarned}</Text>
          <Text style={type.tiny}>XP EARNED</Text>
        </Card>
        <Card style={styles.summaryTile}>
          <Text style={[type.display, { color: accuracy >= 80 ? colors.green : colors.orange }]}>{accuracy}%</Text>
          <Text style={type.tiny}>ACCURACY</Text>
        </Card>
        <Card style={styles.summaryTile}>
          <Text style={[type.display, { color: colors.orange }]}>🔥{summary.streak}</Text>
          <Text style={type.tiny}>DAY STREAK</Text>
        </Card>
      </View>

      {summary.newBadges.length > 0 ? (
        <Card tone="muted">
          <Text style={type.heading}>New badge{summary.newBadges.length > 1 ? 's' : ''} unlocked</Text>
          <Text style={type.body}>{summary.newBadges.join(', ')}</Text>
        </Card>
      ) : null}

      <Button label="Continue" onPress={() => router.replace('/(tabs)')} />
      <Button label="Back to skill tree" variant="ghost" onPress={() => router.replace('/(tabs)/learn')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  questionMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  feedback: { borderWidth: 2, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  expected: { padding: spacing.md },
  expectedText: { fontFamily: 'monospace', fontSize: 13, color: colors.text },
  summaryTile: { flex: 1, alignItems: 'center', paddingVertical: spacing.lg },
});
