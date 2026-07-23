import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily, fontSize, radius, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

interface Props {
  label: string;
  value: string | number;
  deltaPct: number;
  // What the delta is being compared against — callers must pass the label
  // that actually matches the selected period (e.g. "vs Last Month" when a
  // month toggle is active), since this used to be hardcoded to "vs Last
  // Year" regardless of period and silently lied about the comparison.
  deltaLabel?: string;
  // Hide the delta row entirely — use for a period with no meaningful prior
  // window to compare against (e.g. "All") rather than showing a fake 0%.
  showDelta?: boolean;
  width?: DimensionValue;
  // When true, sizes via flex instead of a fixed width — use inside a
  // flex-row container with a gap so a pair of cards splits it exactly,
  // rather than approximating with a percentage that can fall short of
  // (or overshoot) the row's true width once the gap is accounted for.
  fill?: boolean;
  backgroundColor?: string;
}

export function StatCard({
  label,
  value,
  deltaPct,
  deltaLabel = 'vs Last Year',
  showDelta = true,
  width = '47%',
  fill = false,
  backgroundColor,
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const positive = deltaPct >= 0;
  return (
    <View style={[styles.card, fill ? styles.fill : { width }, backgroundColor ? { backgroundColor } : null]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {showDelta ? (
        <View style={styles.deltaRow}>
          <Ionicons
            name={positive ? 'arrow-up' : 'arrow-down'}
            size={10}
            color={positive ? colors.positive : colors.negative}
          />
          <Text style={[styles.delta, { color: positive ? colors.positive : colors.negative }]}>
            {Math.abs(deltaPct)}% {deltaLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    gap: 4,
  },
  fill: { flex: 1 },
  label: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textPrimary },
  value: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.textPrimary },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  delta: { fontFamily: fontFamily.body, fontSize: fontSize.tiny },
});
}
