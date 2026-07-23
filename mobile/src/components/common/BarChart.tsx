import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, fontSize } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { MonthlyPoint } from '../../data/types';

interface Props {
  data: MonthlyPoint[];
  height?: number;
  highlightIndex?: number;
}

export function BarChart({ data, height = 90, highlightIndex }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const max = Math.max(...data.map((d) => d.value));
  const peakIdx = highlightIndex ?? data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);

  return (
    <View>
      <View style={[styles.row, { height }]}>
        {data.map((d, i) => {
          const barHeight = Math.max(8, (d.value / max) * height);
          const isPeak = i === peakIdx;
          return (
            <View key={`${d.month}-${i}`} style={styles.barColumn}>
              <Text style={styles.value}>{d.value}</Text>
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: isPeak ? colors.darkGreen : colors.mintBg,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.row}>
        {data.map((d, i) => (
          <View key={`label-${i}`} style={styles.barColumn}>
            <Text style={styles.label}>{d.month}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  barColumn: { alignItems: 'center', flex: 1, gap: 4 },
  bar: { width: 28, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  value: { fontFamily: fontFamily.heading, fontSize: 9, color: colors.textPrimary },
  label: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.tiny,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    marginTop: 8,
  },
});
}
