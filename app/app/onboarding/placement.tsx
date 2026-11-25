import React, { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { useAuth } from '../../src/auth';
import { Button, Card, CodeBlock, ErrorNote, Loading, ProgressBar, Screen } from '../../src/components/ui';
import { colors, radius, spacing, type } from '../../src/theme';

interface PlacementQuestion {
  id: string;
  skillId: string;
  prompt: string;
  code?: string;
  options: { id: string; text: string }[];
}

export default function PlacementScreen() {
  const { refresh } = useAuth();
  const [questions, setQuestions] = useState<PlacementQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const payload = await api.get<{ questions: PlacementQuestion[] }>('/auth/onboarding/placement');
      setQuestions(payload.questions);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the placement quiz.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function finish() {
    setBusy(true);
    try {
      const payload = await api.post<{ recommendation: string }>('/auth/onboarding/placement', { answers });
      setRecommendation(payload.recommendation);
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save the quiz.');
    } finally {
      setBusy(false);
    }
  }

  if (error) return <Screen><ErrorNote message={error} onRetry={load} /></Screen>;
  if (!questions.length) return <Loading label="Building your placement quiz…" />;

  if (recommendation) {
    return (
      <Screen>
        <View style={{ gap: spacing.md, paddingTop: spacing.xxl }}>
          <Text style={{ fontSize: 48, textAlign: 'center' }}>🎯</Text>
          <Text style={[type.display, { textAlign: 'center' }]}>You're placed</Text>
          <Card>
            <Text style={[type.body, { textAlign: 'center' }]}>{recommendation}</Text>
          </Card>
          <Button label="Start learning" onPress={() => router.replace('/(tabs)')} />
        </View>
      </Screen>
    );
  }

  const question = questions[index] as PlacementQuestion;
  const picked = answers[question.id];
  const isLast = index === questions.length - 1;

  return (
    <Screen>
      <View style={{ gap: spacing.sm }}>
        <Text style={type.tiny}>
          QUESTION {index + 1} OF {questions.length}
        </Text>
        <ProgressBar value={(index + (picked ? 1 : 0)) / questions.length} />
      </View>

      <View style={{ gap: spacing.md }}>
        <Text style={type.title}>{question.prompt}</Text>
        {question.code ? <CodeBlock code={question.code} /> : null}
        <View style={{ gap: spacing.sm }}>
          {question.options.map((option, optionIndex) => (
            <Pressable
              key={option.id}
              onPress={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
              style={[styles.option, picked === option.id && styles.optionActive]}
            >
              <Text style={styles.letter}>{String.fromCharCode(65 + optionIndex)}</Text>
              <Text style={[type.body, { flex: 1 }]}>{option.text}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {index > 0 ? (
          <Button label="Back" variant="secondary" onPress={() => setIndex((value) => value - 1)} style={{ flex: 1 }} />
        ) : null}
        <Button
          label={isLast ? 'Finish quiz' : 'Next'}
          onPress={() => (isLast ? finish() : setIndex((value) => value + 1))}
          disabled={!picked}
          loading={busy}
          style={{ flex: 1 }}
        />
      </View>
      <Button
        label="Skip the quiz"
        variant="ghost"
        onPress={async () => {
          await api.post('/auth/onboarding/placement', { answers: {} });
          await refresh();
          router.replace('/(tabs)');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.white,
  },
  optionActive: { borderColor: colors.blue, backgroundColor: colors.blueSoft },
  letter: { fontWeight: '800', color: colors.textMuted, width: 20 },
});
