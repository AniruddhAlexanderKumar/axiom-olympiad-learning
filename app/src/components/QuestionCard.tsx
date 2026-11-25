import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, type } from '../theme';
import type { Challenge } from '../types';
import { CodeBlock } from './ui';
import { CodeEditor } from './CodeEditor';

export function QuestionCard({
  challenge,
  onChange,
  disabled,
  language = 'python',
}: {
  challenge: Challenge;
  onChange: (payload: unknown, complete: boolean) => void;
  disabled?: boolean;
  language?: string;
}) {
  useEffect(() => {
    onChange(null, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.id]);

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.sm }}>
        <Text style={type.title}>{challenge.prompt}</Text>
        {challenge.code ? <CodeBlock code={challenge.code} /> : null}
      </View>
      {challenge.type === 'mcq' ? (
        <Mcq challenge={challenge} disabled={disabled} onChange={onChange} />
      ) : null}
      {challenge.type === 'true-false' ? (
        <TrueFalse challenge={challenge} disabled={disabled} onChange={onChange} />
      ) : null}
      {challenge.type === 'fill-blank' || challenge.type === 'word-bank' ? (
        <FillBlank challenge={challenge} disabled={disabled} onChange={onChange} />
      ) : null}
      {challenge.type === 'order' ? (
        <OrderQuestion challenge={challenge} disabled={disabled} onChange={onChange} />
      ) : null}
      {challenge.type === 'match' ? (
        <MatchQuestion challenge={challenge} disabled={disabled} onChange={onChange} />
      ) : null}
      {challenge.type === 'bug' ? (
        <BugQuestion challenge={challenge} disabled={disabled} onChange={onChange} />
      ) : null}
      {challenge.type === 'frq' ? (
        <FrqQuestion challenge={challenge} disabled={disabled} onChange={onChange} language={language} />
      ) : null}
    </View>
  );
}

function OptionButton({
  label,
  selected,
  onPress,
  disabled,
  index,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  index: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.option,
        selected && { borderColor: colors.blue, backgroundColor: colors.blueSoft },
        disabled && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.optionBadge, selected && { backgroundColor: colors.blue }]}>
        <Text style={[styles.optionBadgeLabel, selected && { color: colors.white }]}>
          {String.fromCharCode(65 + index)}
        </Text>
      </View>
      <Text style={[type.body, { flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}

function Mcq({
  challenge,
  onChange,
  disabled,
}: {
  challenge: Challenge;
  onChange: (payload: unknown, complete: boolean) => void;
  disabled?: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <View style={{ gap: spacing.sm }}>
      {(challenge.options ?? []).map((option, index) => (
        <OptionButton
          key={option.id}
          index={index}
          label={option.text}
          selected={picked === option.id}
          disabled={disabled}
          onPress={() => {
            setPicked(option.id);
            onChange({ optionId: option.id }, true);
          }}
        />
      ))}
    </View>
  );
}

function TrueFalse({
  challenge,
  onChange,
  disabled,
}: {
  challenge: Challenge;
  onChange: (payload: unknown, complete: boolean) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState<boolean | null>(null);
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={[type.body, { fontSize: 16 }]}>{challenge.statement}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {[true, false].map((option) => (
          <Pressable
            key={String(option)}
            disabled={disabled}
            onPress={() => {
              setValue(option);
              onChange({ value: option }, true);
            }}
            style={[
              styles.tfButton,
              value === option && {
                borderColor: option ? colors.green : colors.red,
                backgroundColor: option ? '#F1FFE6' : colors.redSoft,
              },
            ]}
          >
            <Text style={{ fontSize: 26 }}>{option ? '✅' : '❌'}</Text>
            <Text style={type.heading}>{option ? 'True' : 'False'}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function FillBlank({
  challenge,
  onChange,
  disabled,
}: {
  challenge: Challenge;
  onChange: (payload: unknown, complete: boolean) => void;
  disabled?: boolean;
}) {
  const blankCount = challenge.blankCount ?? 1;
  const [values, setValues] = useState<string[]>(() => Array.from({ length: blankCount }, () => ''));
  const [active, setActive] = useState(0);
  const isWordBank = challenge.mode === 'wordbank';
  const used = new Set(values.filter(Boolean));

  useEffect(() => {
    const complete = values.length === blankCount && values.every((value) => value.trim().length > 0);
    onChange({ values }, complete);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  function setValue(index: number, value: string) {
    setValues((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
    const nextIndex = values.findIndex((entry, idx) => idx !== index && !entry);
    setActive(nextIndex >= 0 ? nextIndex : index);
  }

  const lines = (challenge.template ?? '').split('\n');

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.templateBox}>
        {lines.map((line, lineIndex) => {
          const parts = line.split(/(\{\{\d+\}\})/g);
          return (
            <View key={lineIndex} style={styles.templateLine}>
              {parts.map((part, partIndex) => {
                const match = part.match(/^\{\{(\d+)\}\}$/);
                if (!match) return <Text key={partIndex} style={styles.templateText}>{part || ' '}</Text>;
                const index = Number(match[1]);
                if (isWordBank) {
                  return (
                    <Pressable
                      key={partIndex}
                      disabled={disabled}
                      onPress={() => setActive(index)}
                      style={[styles.blank, active === index && { borderColor: colors.blue }, values[index] ? { backgroundColor: '#E7F8DC' } : null]}
                    >
                      <Text style={styles.blankLabel}>{values[index] || ' '}</Text>
                    </Pressable>
                  );
                }
                return (
                  <TextInput
                    key={partIndex}
                    value={values[index]}
                    onChangeText={(text) => setValue(index, text)}
                    editable={!disabled}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => setActive(index)}
                    style={[styles.blank, styles.blankInput]}
                    placeholder="?"
                    placeholderTextColor={colors.textFaint}
                  />
                );
              })}
            </View>
          );
        })}
      </View>
      {isWordBank ? (
        <View style={styles.bank}>
          {(challenge.bank ?? []).map((token) => (
            <Pressable
              key={token}
              disabled={disabled || used.has(token)}
              onPress={() => setValue(active, token)}
              style={[styles.token, used.has(token) && { opacity: 0.3 }]}
            >
              <Text style={styles.tokenLabel}>{token}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {isWordBank ? (
        <Pressable onPress={() => setValues(Array.from({ length: blankCount }, () => ''))}>
          <Text style={[type.small, { color: colors.blue }]}>Clear blanks</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function OrderQuestion({
  challenge,
  onChange,
  disabled,
}: {
  challenge: Challenge;
  onChange: (payload: unknown, complete: boolean) => void;
  disabled?: boolean;
}) {
  const pool = useMemo(() => challenge.lines ?? [], [challenge.id]);
  const [order, setOrder] = useState<string[]>([]);
  const byId = new Map(pool.map((line) => [line.id, line.text]));

  useEffect(() => {
    onChange({ order }, order.length === pool.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={type.small}>Tap the lines in the order they should run.</Text>
      <View style={styles.templateBox}>
        {order.length === 0 ? <Text style={[type.small, { color: colors.textFaint }]}>Your program will appear here</Text> : null}
        {order.map((id, index) => (
          <Pressable key={`${id}-${index}`} disabled={disabled} onPress={() => setOrder((current) => current.filter((_, idx) => idx !== index))}>
            <Text style={styles.templateText}>
              {index + 1}. {byId.get(id)}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={{ gap: spacing.sm }}>
        {pool
          .filter((line) => !order.includes(line.id))
          .map((line) => (
            <Pressable
              key={line.id}
              disabled={disabled}
              onPress={() => setOrder((current) => [...current, line.id])}
              style={styles.lineOption}
            >
              <Text style={styles.templateText}>{line.text}</Text>
            </Pressable>
          ))}
      </View>
      {order.length > 0 ? (
        <Pressable onPress={() => setOrder([])}>
          <Text style={[type.small, { color: colors.blue }]}>Start over</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function MatchQuestion({
  challenge,
  onChange,
  disabled,
}: {
  challenge: Challenge;
  onChange: (payload: unknown, complete: boolean) => void;
  disabled?: boolean;
}) {
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const left = challenge.left ?? [];
  const rights = challenge.rightOptions ?? [];
  const usedRight = new Set(Object.values(pairs));

  useEffect(() => {
    onChange({ pairs }, Object.keys(pairs).length === left.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs]);

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={type.small}>Tap a card on the left, then its match on the right.</Text>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.sm }}>
          {left.map((item) => (
            <Pressable
              key={item}
              disabled={disabled}
              onPress={() => setSelectedLeft(item)}
              style={[
                styles.matchCard,
                selectedLeft === item && { borderColor: colors.blue },
                pairs[item] && { backgroundColor: '#F1FFE6', borderColor: colors.green },
              ]}
            >
              <Text style={styles.matchCode}>{item}</Text>
              {pairs[item] ? <Text style={type.small}>→ {pairs[item]}</Text> : null}
            </Pressable>
          ))}
        </View>
        <View style={{ flex: 1, gap: spacing.sm }}>
          {rights.map((item) => (
            <Pressable
              key={item}
              disabled={disabled || usedRight.has(item)}
              onPress={() => {
                if (!selectedLeft) return;
                setPairs((current) => ({ ...current, [selectedLeft]: item }));
                setSelectedLeft(null);
              }}
              style={[styles.matchCard, usedRight.has(item) && { opacity: 0.35 }]}
            >
              <Text style={styles.matchCode}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function BugQuestion({
  challenge,
  onChange,
  disabled,
}: {
  challenge: Challenge;
  onChange: (payload: unknown, complete: boolean) => void;
  disabled?: boolean;
}) {
  const [lineId, setLineId] = useState<string | null>(null);
  const [fixId, setFixId] = useState<string | null>(null);

  useEffect(() => {
    onChange({ lineId, fixId }, Boolean(lineId && fixId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineId, fixId]);

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={type.small}>1. Tap the buggy line.</Text>
      <View style={styles.templateBox}>
        {(challenge.lines ?? []).map((line) => (
          <Pressable
            key={line.id}
            disabled={disabled}
            onPress={() => setLineId(line.id)}
            style={[styles.bugLine, lineId === line.id && { backgroundColor: colors.redSoft, borderRadius: 6 }]}
          >
            <Text style={styles.templateText}>{line.text}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={type.small}>2. Tap the fix.</Text>
      <View style={{ gap: spacing.sm }}>
        {(challenge.fixes ?? []).map((fix) => (
          <Pressable
            key={fix.id}
            disabled={disabled}
            onPress={() => setFixId(fix.id)}
            style={[styles.lineOption, fixId === fix.id && { borderColor: colors.green, backgroundColor: '#F1FFE6' }]}
          >
            <Text style={styles.templateText}>{fix.text}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function FrqQuestion({
  challenge,
  onChange,
  disabled,
  language,
}: {
  challenge: Challenge;
  onChange: (payload: unknown, complete: boolean) => void;
  disabled?: boolean;
  language: string;
}) {
  const starter = challenge.starterCode?.[language] ?? challenge.starterCode?.python ?? '';
  const [source, setSource] = useState(starter);

  useEffect(() => {
    onChange({ source, language }, source.trim().length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  return (
    <View style={{ gap: spacing.md }}>
      {challenge.sampleTest ? (
        <View style={styles.sample}>
          <Text style={type.tiny}>SAMPLE TEST</Text>
          <Text style={styles.templateText}>input: {challenge.sampleTest.stdin.trim() || '(none)'}</Text>
          <Text style={styles.templateText}>expected: {challenge.sampleTest.expected}</Text>
          <Text style={[type.small, { marginTop: 4 }]}>
            {challenge.testCount ?? 1} test{(challenge.testCount ?? 1) === 1 ? '' : 's'} will grade this run.
          </Text>
        </View>
      ) : null}
      <CodeEditor value={source} onChange={setSource} language={language} />
      {disabled ? <Text style={type.small}>Running your code in the Judge0 sandbox…</Text> : null}
    </View>
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
  optionBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBadgeLabel: { fontWeight: '800', color: colors.textMuted },
  tfButton: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
  },
  templateBox: {
    gap: 4,
    backgroundColor: '#0F172A',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  templateLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  templateText: { fontFamily: 'monospace', fontSize: 14, color: '#E2E8F0', lineHeight: 22 },
  blank: {
    minWidth: 84,
    borderBottomWidth: 2,
    borderColor: colors.blue,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginHorizontal: 2,
    alignItems: 'center',
  },
  blankLabel: { fontFamily: 'monospace', fontSize: 14, color: '#86EFAC' },
  blankInput: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#86EFAC',
    minWidth: 84,
  },
  bank: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  token: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.white,
  },
  tokenLabel: { fontFamily: 'monospace', fontSize: 14, color: colors.text },
  lineOption: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    backgroundColor: '#0F172A',
  },
  bugLine: { paddingVertical: 2, paddingHorizontal: 2 },
  matchCard: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    backgroundColor: colors.white,
    gap: 4,
    minHeight: 54,
    justifyContent: 'center',
  },
  matchCode: { fontFamily: 'monospace', fontSize: 13, color: colors.text },
  sample: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
});
