import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '../src/auth';
import { Mascot } from '../src/components/Mascot';
import { Loading } from '../src/components/ui';
import { colors } from '../src/theme';

export default function Entry() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/auth');
    } else if (!user.onboardingComplete) {
      router.replace('/onboarding/goal');
    } else {
      router.replace('/(tabs)');
    }
  }, [user, loading]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <Mascot mood="idle" size={96} />
      <Loading label="Getting your journey ready…" />
    </View>
  );
}
