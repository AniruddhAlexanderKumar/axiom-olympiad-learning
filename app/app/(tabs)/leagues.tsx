import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { Card, ErrorNote, Loading, Pill, Screen } from '../../src/components/ui';
import { colors, radius, spacing, type } from '../../src/theme';
import type { LeagueData } from '../../src/types';

export default function LeaguesScreen() {
  const [data, setData] = useState<LeagueData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await api.get<LeagueData>('/me/leagues'));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the league.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (error && !data) return <Screen><ErrorNote message={error} onRetry={load} /></Screen>;
  if (!data) return <Loading label="Loading standings…" />;

  return (
    <Screen>
      <View style={{ gap: 2 }}>
        <Text style={type.display}>{capitalise(data.tier)} League</Text>
        <Text style={type.small}>Week of {data.weekStart} · ranked by XP earned this week</Text>
      </View>

      <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={type.tiny}>YOUR WEEK</Text>
          <Text style={type.title}>{data.weeklyXp} XP</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={type.tiny}>GROUP SIZE</Text>
          <Text style={type.title}>{data.standings.length}</Text>
        </View>
      </Card>

      <View style={{ gap: spacing.sm }}>
        {data.standings.map((entry) => (
          <View
            key={entry.userId}
            style={[
              styles.row,
              entry.isYou && styles.rowYou,
              entry.zone === 'promotion' && styles.rowPromote,
              entry.zone === 'demotion' && styles.rowDemote,
            ]}
          >
            <Text style={[type.heading, { width: 34 }]}>{entry.rank}</Text>
            <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
              {entry.displayName}
              {entry.isYou ? ' (you)' : ''}
            </Text>
            {entry.zone === 'promotion' ? <Pill label="PROMOTE" color={colors.greenDark} /> : null}
            {entry.zone === 'demotion' ? <Pill label="DEMOTE" color={colors.redDark} /> : null}
            <Text style={type.small}>{entry.xp} XP</Text>
          </View>
        ))}
      </View>

      <Card tone="muted">
        <Text style={type.small}>
          The top three move up a tier when the week resets. The bottom four move down. XP from lessons, reviews,
          problems and mock contests all counts.
        </Text>
      </Card>
    </Screen>
  );
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  rowYou: { borderColor: colors.blue, backgroundColor: colors.blueSoft },
  rowPromote: { borderLeftWidth: 4, borderLeftColor: colors.green },
  rowDemote: { borderLeftWidth: 4, borderLeftColor: colors.red },
});
