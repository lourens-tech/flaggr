import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { fontFamily, fontSize } from '../../theme';
import { duration, easing, prefersReducedMotion, useNativeDriver } from '../../theme/motion';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { MonthlyPoint } from '../../data/types';

interface Props {
  data: MonthlyPoint[];
  height?: number;
  highlightIndex?: number;
}

const BAR_STAGGER = 30;

export function BarChart({ data, height = 90, highlightIndex }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const max = Math.max(...data.map((d) => d.value));
  const peakIdx = highlightIndex ?? data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);

  // Bars grow up from the baseline left to right, and replay when the data
  // changes (e.g. switching the Month/Year/All period).
  const grow = useRef<Animated.Value[]>([]).current;
  while (grow.length < data.length) grow.push(new Animated.Value(prefersReducedMotion() ? 1 : 0));
  const dataKey = data.map((d) => d.value).join(',');

  useEffect(() => {
    if (prefersReducedMotion()) {
      grow.forEach((v) => v.setValue(1));
      return;
    }
    grow.forEach((v) => v.setValue(0));
    const anim = Animated.stagger(
      BAR_STAGGER,
      grow.slice(0, data.length).map((v) =>
        Animated.timing(v, { toValue: 1, duration: duration.long, easing: easing.out, useNativeDriver }),
      ),
    );
    anim.start();
    return () => anim.stop();
  }, [dataKey, grow, data.length]);

  return (
    <View>
      <View style={[styles.row, { height }]}>
        {data.map((d, i) => {
          const barHeight = Math.max(8, (d.value / max) * height);
          const isPeak = i === peakIdx;
          return (
            <View key={`${d.month}-${i}`} style={styles.barColumn}>
              <Animated.Text style={[styles.value, { opacity: grow[i] }]}>{d.value}</Animated.Text>
              <Animated.View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: isPeak ? colors.darkGreen : colors.mintBg,
                    transform: [{ scaleY: grow[i] }],
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
  bar: { width: 28, borderTopLeftRadius: 5, borderTopRightRadius: 5, transformOrigin: 'bottom' },
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
