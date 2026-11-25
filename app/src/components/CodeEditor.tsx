import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, type } from '../theme';

const SYMBOLS = ['    ', ':', '(', ')', '[', ']', '{', '}', '"', "'", '=', '<', '>', '+', '-', '_'];

export function CodeEditor({
  value,
  onChange,
  language,
  minHeight = 220,
}: {
  value: string;
  onChange: (next: string) => void;
  language: string;
  minHeight?: number;
}) {
  const [selection, setSelection] = useState({ start: value.length, end: value.length });
  const lineCount = value.split('\n').length;

  function insert(symbol: string) {
    const start = selection.start ?? value.length;
    const end = selection.end ?? start;
    const next = `${value.slice(0, start)}${symbol}${value.slice(end)}`;
    onChange(next);
    const caret = start + symbol.length;
    setSelection({ start: caret, end: caret });
  }

  function handleChange(next: string) {
    onChange(next);
  }

  const lines = value.split('\n');
  const indent = (lines[lines.length - 1]?.match(/^\s*/)?.[0] ?? '').length;

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>{language.toUpperCase()}</Text>
        <Text style={styles.headerMeta}>{lineCount} lines</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.gutter}>
          {Array.from({ length: Math.max(lineCount, 6) }).map((_, index) => (
            <Text key={index} style={styles.lineNumber}>
              {index + 1}
            </Text>
          ))}
        </View>
        <TextInput
          multiline
          value={value}
          onChangeText={handleChange}
          onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          textAlignVertical="top"
          style={[styles.input, { minHeight }]}
          placeholder="Write your solution here"
          placeholderTextColor="#64748B"
          accessibilityLabel="Code editor"
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.symbolBar}>
        <Pressable
          onPress={() => insert(`${' '.repeat(indent + 4)}`)}
          style={styles.symbol}
          accessibilityLabel="Indent"
        >
          <Text style={styles.symbolLabel}>⇥ Tab</Text>
        </Pressable>
        {SYMBOLS.slice(1).map((symbol) => (
          <Pressable key={symbol} onPress={() => insert(symbol)} style={styles.symbol}>
            <Text style={styles.symbolLabel}>{symbol === '    ' ? 'space' : symbol}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#111C2E',
  },
  headerLabel: { color: '#93C5FD', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  headerMeta: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  body: { flexDirection: 'row' },
  gutter: { paddingVertical: spacing.md, paddingHorizontal: spacing.sm, backgroundColor: '#0B1322', alignItems: 'flex-end' },
  lineNumber: { color: '#475569', fontFamily: 'monospace', fontSize: 13, lineHeight: 21 },
  input: {
    flex: 1,
    color: '#E2E8F0',
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 21,
    padding: spacing.md,
    textAlignVertical: 'top',
  },
  symbolBar: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: '#111C2E' },
  symbol: {
    minWidth: 36,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    alignItems: 'center',
  },
  symbolLabel: { color: '#CBD5F5', fontFamily: 'monospace', fontSize: 13 },
});
