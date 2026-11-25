import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '../theme';

function lastNDays(count: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    days.push(date.toISOString().slice(0, 10));
  }
  return days;
}

export function StreakHeatmap({ days }: { days: { day: string; xp: number }[] }) {
  const byDay = new Map(days.map((entry) => [entry.day, entry.xp]));
  const calendar = lastNDays(28);
  return (
    <View>
      <View style={styles.grid}>
        {calendar.map((day) => {
          const xp = byDay.get(day) ?? 0;
          const level = xp <= 0 ? 0 : xp < 30 ? 1 : xp < 70 ? 2 : xp < 120 ? 3 : 4;
          return (
            <View
              key={day}
              accessibilityLabel={`${day}: ${xp} XP`}
              style={[
                styles.cell,
                {
                  backgroundColor:
                    level === 0
                      ? colors.surfaceAlt
                      : level === 1
                        ? '#C6F6A6'
                        : level === 2
                          ? '#8FE05A'
                          : level === 3
                            ? colors.green
                            : colors.greenDark,
                },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.legend}>
        <Text style={type.tiny}>LESS</Text>
        {[colors.surfaceAlt, '#C6F6A6', '#8FE05A', colors.green, colors.greenDark].map((color) => (
          <View key={color} style={[styles.legendCell, { backgroundColor: color }]} />
        ))}
        <Text style={type.tiny}>MORE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: 30, height: 30, borderRadius: radius.sm },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.md },
  legendCell: { width: 12, height: 12, borderRadius: 3 },
});
