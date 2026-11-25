import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing, type } from '../theme';

export function Screen({
  children,
  scroll = true,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.screenContent, style]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screenContent, styles.flex, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
  tone = 'default',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'muted' | 'green' | 'blue' | 'purple';
}) {
  const tones = {
    default: colors.white,
    muted: colors.surface,
    green: '#F1FFE6',
    blue: colors.blueSoft,
    purple: colors.purpleSoft,
  };
  return <View style={[styles.card, { backgroundColor: tones[tone] }, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  small,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'blue';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const palette = {
    primary: { background: colors.green, border: colors.greenDark, text: colors.white },
    blue: { background: colors.blue, border: colors.blueDark, text: colors.white },
    danger: { background: colors.red, border: colors.redDark, text: colors.white },
    secondary: { background: colors.white, border: colors.borderStrong, text: colors.text },
    ghost: { background: 'transparent', border: 'transparent', text: colors.textMuted },
  }[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          opacity: isDisabled ? 0.5 : 1,
          transform: [{ translateY: pressed && !isDisabled ? 2 : 0 }],
        },
        variant !== 'ghost' && shadow.button,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <Text style={[styles.buttonLabel, small && styles.buttonLabelSmall, { color: palette.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  tone = colors.blue,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.chip, { borderColor: active ? tone : colors.border, backgroundColor: active ? tone : colors.white }]}
    >
      <Text style={[styles.chipLabel, { color: active ? colors.white : colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

export function ProgressBar({
  value,
  color = colors.green,
  height = 14,
  track = colors.surfaceAlt,
}: {
  value: number;
  color?: string;
  height?: number;
  track?: string;
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${clamped * 100}%`, height: '100%', backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

export function Hearts({ hearts, max = 5 }: { hearts: number; max?: number }) {
  return (
    <View style={styles.heartsRow} accessibilityLabel={`${hearts} of ${max} hearts`}>
      {Array.from({ length: max }).map((_, index) => (
        <Text key={index} style={{ fontSize: 16, opacity: index < hearts ? 1 : 0.22 }}>
          ❤️
        </Text>
      ))}
    </View>
  );
}

export function Pill({ label, color = colors.blue, background }: { label: string; color?: string; background?: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: background ?? `${color}22` }]}>
      <Text style={[styles.pillLabel, { color }]}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={type.heading}>{title}</Text>
      {action}
    </View>
  );
}

export function EmptyState({ title, body, emoji = '🫥' }: { title: string; body: string; emoji?: string }) {
  return (
    <Card style={styles.empty}>
      <Text style={{ fontSize: 32 }}>{emoji}</Text>
      <Text style={[type.heading, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.small, { textAlign: 'center' }]}>{body}</Text>
    </Card>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.green} />
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card tone="muted" style={{ gap: spacing.sm }}>
      <Text style={[type.body, { color: colors.redDark }]}>{message}</Text>
      {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} small /> : null}
    </Card>
  );
}

export function CodeBlock({ code }: { code: string }) {
  return (
    <View style={styles.codeBlock}>
      <Text style={type.mono}>{code}</Text>
    </View>
  );
}

export function StatTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={type.tiny}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  screenContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    borderBottomWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonSmall: { minHeight: 40, borderBottomWidth: 2, paddingHorizontal: spacing.md },
  buttonLabel: { fontSize: 15, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  buttonLabelSmall: { fontSize: 12 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 2,
    marginRight: spacing.sm,
  },
  chipLabel: { fontSize: 13, fontWeight: '700' },
  heartsRow: { flexDirection: 'row', gap: 2 },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  pillLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  codeBlock: {
    backgroundColor: '#0F172A',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  statTile: { alignItems: 'center', gap: 2, minWidth: 72 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text },
});
