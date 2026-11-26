import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { useAuth } from '../../src/auth';
import { Button, Card, ErrorNote, Loading, Screen } from '../../src/components/ui';
import { colors, radius, spacing, type } from '../../src/theme';

interface OnboardingTrack {
  id: string;
  title: string;
  language: string;
  description: string;
  available: boolean;
}

export default function LanguageScreen() {
  const params = useLocalSearchParams<{ goal?: string }>();
  const goal = params.goal ?? 'both';
  const { refresh } = useAuth();
  const [tracks, setTracks] = useState<OnboardingTrack[]>([]);
  const [language, setLanguage] = useState('python');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<{ tracks: OnboardingTrack[] }>('/auth/onboarding')
      .then((payload) => setTracks(payload.tracks))
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : 'Could not load languages.'));
  }, []);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/onboarding', { goal, language });
      await refresh();
      router.push('/onboarding/placement');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save that choice.');
    } finally {
      setBusy(false);
    }
  }

  if (!tracks.length && !error) return <Loading label="Loading languages…" />;

  return (
    <Screen>
      <View style={{ gap: spacing.xs, paddingTop: spacing.lg }}>
        <Text style={type.display}>Pick your language</Text>
        <Text style={[type.body, { color: colors.textMuted }]}>
          Python comes first. Java, JavaScript and C++ join the same skill tree later.
        </Text>
      </View>

      <View style={{ gap: spacing.md }}>
        {tracks.map((track) => (
          <Pressable
            key={track.id}
            disabled={!track.available}
            onPress={() => setLanguage(track.language)}
          >
            <Card
              style={[
                styles.trackCard,
                language === track.language && track.available && styles.trackActive,
                !track.available && { opacity: 0.5 },
              ]}
            >
              <Text style={{ fontSize: 28 }}>{track.language === 'python' ? '🐍' : '💻'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={type.heading}>{track.title}</Text>
                <Text style={type.small}>{track.description}</Text>
              </View>
              <Text style={type.tiny}>{track.available ? 'READY' : 'SOON'}</Text>
            </Card>
          </Pressable>
        ))}
      </View>

      {error ? <ErrorNote message={error} /> : null}
      <Button label="Continue" onPress={save} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  trackCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  trackActive: { borderColor: colors.green, borderWidth: 2, backgroundColor: '#DDF4FF' },
});
