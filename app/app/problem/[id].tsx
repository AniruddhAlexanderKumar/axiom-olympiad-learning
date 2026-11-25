import React, { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { CodeEditor } from '../../src/components/CodeEditor';
import { Button, Card, Chip, ErrorNote, Loading, Pill, Screen } from '../../src/components/ui';
import { colors, radius, spacing, type } from '../../src/theme';
import type { Problem, SubmitResponse } from '../../src/types';

const LANGUAGE_LABEL: Record<string, string> = {
  python: 'Python',
  java: 'Java',
  javascript: 'JavaScript',
  cpp: 'C++',
};

export default function ProblemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [language, setLanguage] = useState('python');
  const [source, setSource] = useState('');
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showEditorial, setShowEditorial] = useState(false);
  const [invite, setInvite] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const payload = await api.get<Problem>(`/problems/${id}`);
      setProblem(payload);
      setLanguage(payload.contestLanguage ?? 'python');
      setSource(payload.starterCode?.[payload.contestLanguage ?? 'python'] ?? payload.starterCode?.python ?? '');
      setShowEditorial(Boolean(payload.editorialUnlocked && payload.editorial));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load that problem.');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function pickLanguage(next: string) {
    setLanguage(next);
    if (problem?.starterCode?.[next]) setSource(problem.starterCode[next] as string);
  }

  async function submit() {
    if (!problem) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await api.post<SubmitResponse>(`/problems/${problem.id}/submit`, { language, source });
      setResult(payload);
      if (payload.solved) load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Submission failed.');
    } finally {
      setBusy(false);
    }
  }

  async function createRace() {
    if (!problem) return;
    try {
      const payload = await api.post<{ code: string }>('/friend-challenges', { problemId: problem.id });
      setInvite(payload.code);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create a race.');
    }
  }

  if (error && !problem) return <Screen><ErrorNote message={error} onRetry={load} /></Screen>;
  if (!problem) return <Loading label="Loading the problem…" />;

  return (
    <Screen>
      <Pressable onPress={() => router.back()}>
        <Text style={[type.small, { color: colors.blue }]}>‹ Back</Text>
      </Pressable>

      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <Pill label={problem.tier.toUpperCase()} color={colors.blue} />
          <Pill label={`${problem.points} PTS`} color={colors.orange} />
          {problem.solved ? <Pill label="SOLVED" color={colors.greenDark} /> : null}
        </View>
        <Text style={type.display}>{problem.title}</Text>
      </View>

      <Card style={{ gap: spacing.sm }}>
        <Text style={type.body}>{problem.statement}</Text>
        {problem.sampleTest ? (
          <View style={styles.sample}>
            <Text style={type.tiny}>SAMPLE INPUT</Text>
            <Text style={styles.mono}>{problem.sampleTest.stdin.trim() || '(none)'}</Text>
            <Text style={type.tiny}>EXPECTED OUTPUT</Text>
            <Text style={styles.mono}>{problem.sampleTest.expected}</Text>
            <Text style={type.tiny}>{problem.testCount} HIDDEN TESTS</Text>
          </View>
        ) : null}
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {problem.languages.map((entry) => (
          <Chip
            key={entry.id}
            label={LANGUAGE_LABEL[entry.id] ?? entry.label}
            active={language === entry.id}
            tone={colors.blue}
            onPress={() => pickLanguage(entry.id)}
          />
        ))}
      </View>

      <CodeEditor value={source} onChange={setSource} language={language} minHeight={260} />

      {!problem.judgeConfigured ? (
        <Card tone="muted">
          <Text style={type.small}>
            Judge0 is not configured on the server, so runs are unavailable. Start Judge0 and set JUDGE0_URL.
          </Text>
        </Card>
      ) : null}

      <Button label="Submit for grading" variant="blue" onPress={submit} loading={busy} disabled={!source.trim()} />
      {error ? <Text style={[type.small, { color: colors.redDark }]}>{error}</Text> : null}

      {result ? (
        <Card style={{ gap: spacing.sm }}>
          <View style={styles.resultHeader}>
            <Text style={type.heading}>
              {result.solved ? 'Accepted 🎉' : `${result.passed}/${result.total} tests passed`}
            </Text>
            <Text style={type.tiny}>{result.score} PTS</Text>
          </View>
          {result.xpAwarded > 0 ? <Text style={[type.small, { color: colors.greenDark }]}>+{result.xpAwarded} XP first solve</Text> : null}
          <View style={{ gap: 4 }}>
            {result.outcomes.map((outcome) => (
              <View key={outcome.index} style={styles.outcome}>
                <Text style={{ fontSize: 14 }}>{outcome.passed ? '✅' : '❌'}</Text>
                <Text style={[type.small, { flex: 1 }]}>Test {outcome.index + 1}: {outcome.message}</Text>
                {outcome.timeMs != null ? <Text style={type.tiny}>{outcome.timeMs} MS</Text> : null}
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <View style={styles.resultHeader}>
          <Text style={type.heading}>Editorial</Text>
          {problem.editorialUnlocked ? <Pill label="UNLOCKED" color={colors.greenDark} /> : <Pill label="LOCKED" color={colors.textMuted} />}
        </View>
        {showEditorial && problem.editorial ? (
          <Card tone="purple">
            <Text style={type.body}>{problem.editorial}</Text>
          </Card>
        ) : (
          <Button
            label={problem.editorialUnlocked ? 'Reveal editorial' : 'Locked'}
            variant="secondary"
            disabled={!problem.editorialUnlocked}
            onPress={() => setShowEditorial(true)}
          />
        )}
        {problem.editorialHint ? <Text style={type.small}>{problem.editorialHint}</Text> : null}
      </View>

      <Card tone="muted" style={{ gap: spacing.sm }}>
        <Text style={type.heading}>Race a friend</Text>
        <Text style={type.small}>Create a challenge code, and whoever passes the tests first wins.</Text>
        {invite ? <Text style={[type.title, { letterSpacing: 4 }]}>{invite}</Text> : null}
        <Button label="Create race" variant="secondary" small onPress={createRace} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sample: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  mono: { fontFamily: 'monospace', fontSize: 13, color: colors.text, marginBottom: 4 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  outcome: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
