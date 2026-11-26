import React, { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Mascot } from '../../src/components/Mascot';
import { Button, Card, Screen } from '../../src/components/ui';
import { colors, radius, spacing, type } from '../../src/theme';

const GOALS = [
  { id: 'learn', title: 'Learn to code', description: 'Start from your first print() and build real fluency.', emoji: '🌱' },
  { id: 'compete', title: 'Prepare for contests', description: 'Train for USACO, ACSL and the problems that come next.', emoji: '🏆' },
  { id: 'both', title: 'Both', description: 'Learn the language, then compete with it.', emoji: '🚀' },
];

export default function GoalScreen() {
  const [goal, setGoal] = useState('both');
  return (
    <Screen>
      <View style={styles.header}>
        <Mascot mood="happy" size={72} />
        <Text style={type.display}>What brings you here?</Text>
        <Text style={[type.body, { color: colors.textMuted }]}>
          This sets your starting point. You can change it later in your profile.
        </Text>
      </View>

      <View style={{ gap: spacing.md }}>
        {GOALS.map((entry) => (
          <Pressable key={entry.id} onPress={() => setGoal(entry.id)}>
            <Card style={[styles.goalCard, goal === entry.id && styles.goalCardActive]}>
              <Text style={{ fontSize: 28 }}>{entry.emoji}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={type.heading}>{entry.title}</Text>
                <Text style={type.small}>{entry.description}</Text>
              </View>
              <View style={[styles.radio, goal === entry.id && styles.radioActive]} />
            </Card>
          </Pressable>
        ))}
      </View>

      <Button label="Continue" onPress={() => router.push(`/onboarding/language?goal=${goal}`)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, paddingTop: spacing.xl },
  goalCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  goalCardActive: { borderColor: colors.green, borderWidth: 2, backgroundColor: '#DDF4FF' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borderStrong },
  radioActive: { borderColor: colors.green, backgroundColor: colors.green },
});
