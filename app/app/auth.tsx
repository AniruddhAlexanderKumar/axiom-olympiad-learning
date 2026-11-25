import React, { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import { useAuth } from '../src/auth';
import { Mascot } from '../src/components/Mascot';
import { Button, Card, Screen } from '../src/components/ui';
import { colors, radius, spacing, type } from '../src/theme';
import { ApiError } from '../src/api';

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';

export default function AuthScreen() {
  const { signIn, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const user = await (mode === 'login' ? signIn(email.trim(), password) : register(email.trim(), password, displayName.trim()));
      router.replace(user.onboardingComplete ? '/(tabs)' : '/onboarding/goal');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not sign you in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Mascot mood="happy" size={92} />
        <Text style={type.display}>Axiom Code</Text>
        <Text style={[type.body, { textAlign: 'center', color: colors.textMuted }]}>
          Short daily lessons in Python, then real contest problems.
        </Text>
      </View>

      <Card style={{ gap: spacing.md }}>
        <View style={styles.tabs}>
          {(['login', 'register'] as const).map((entry) => (
            <Pressable
              key={entry}
              onPress={() => {
                setMode(entry);
                setError(null);
              }}
              style={[styles.tab, mode === entry && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, mode === entry && { color: colors.text }]}>
                {entry === 'login' ? 'Sign in' : 'Create account'}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'register' ? (
          <Field label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="Ada" />
        ) : null}
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry />

        {error ? <Text style={[type.small, { color: colors.redDark }]}>{error}</Text> : null}
        <Button
          label={mode === 'login' ? 'Sign in' : 'Create account'}
          onPress={submit}
          loading={busy}
          disabled={!email.trim() || password.length < 8}
        />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={type.tiny}>OR</Text>
          <View style={styles.divider} />
        </View>
        {GOOGLE_CLIENT_ID ? (
          <GoogleButton />
        ) : (
          <View style={{ gap: spacing.xs }}>
            <Button
              label="Continue with Google"
              variant="secondary"
              disabled
              onPress={() => undefined}
            />
            <Text style={type.tiny}>
              Set EXPO_PUBLIC_GOOGLE_CLIENT_ID AND GOOGLE_CLIENT_ID TO ENABLE GOOGLE SIGN-IN.
            </Text>
          </View>
        )}
      </Card>
    </Screen>
  );
}

function GoogleButton() {
  const { signInWithGoogle } = useAuth();
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    webClientId: GOOGLE_CLIENT_ID,
  });
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken = response.params.id_token;
    if (!idToken) {
      setError('Google did not return an ID token.');
      return;
    }
    signInWithGoogle(idToken)
      .then((user) => router.replace(user.onboardingComplete ? '/(tabs)' : '/onboarding/goal'))
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : 'Google sign-in failed.'));
  }, [response, signInWithGoogle]);

  return (
    <View style={{ gap: spacing.xs }}>
      <Button label="Continue with Google" variant="secondary" disabled={!request} onPress={() => promptAsync()} />
      {error ? <Text style={[type.small, { color: colors.redDark }]}>{error}</Text> : null}
    </View>
  );
}

function Field({
  label,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={type.tiny}>{label.toUpperCase()}</Text>
      <TextInput
        {...props}
        style={styles.input}
        placeholderTextColor={colors.textFaint}
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xl },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4 },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.pill, alignItems: 'center' },
  tabActive: { backgroundColor: colors.white },
  tabLabel: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.white,
  },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
});
