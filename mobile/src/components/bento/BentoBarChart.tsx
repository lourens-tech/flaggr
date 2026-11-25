import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { useBento } from '../../context/ThemeContext';
import { bentoEasing, prefersReducedMotion, useNativeDriver } from '../../theme/motion';
import type { MonthlyPoint } from '../../data/types';

// Monthly bars from the Home board: soft accent bars, the latest month in
// solid accent, a compact value over each bar ("3.1k") and the month letter
// under it. Bars grow in with a stagger and a slight overshoot.

const STAGGER = 60;

export function compactNumber(n: number): string {
  if (n < 1000) return String(Math.round(n));
  const k = n / 1000;
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
}

export function BentoBarChart({ data, height = 120 }: { data: MonthlyPoint[]; height?: number }) {
  const { t } = useBento();
  const max = Math.max(0, ...data.map((d) => d.value));
  const last = data.length - 1;
  const grow = useRef<Animated.Value[]>([]).current;
  while (grow.length < data.length) grow.push(new Animated.Value(prefersReducedMotion() ? 1 : 0));
  const key = data.map((d) => d.value).join(',');

  useEffect(() => {
    if (prefersReducedMotion()) {
      grow.forEach((v) => v.setValue(1));
      return;
    }
    grow.forEach((v) => v.setValue(0));
    const a = Animated.stagger(
      STAGGER,
      grow.slice(0, data.length).map((v) => Animated.timing(v, { toValue: 1, duration: 700, easing: bentoEasing.overshoot, useNativeDriver })),
    );
    a.start();
    return () => a.stop();
  }, [key, grow, data.length]);

  // Room for the value above and the month letter below each bar.
  const barArea = height - 40;
  const label = data.map((d) => `${d.month} ${d.value}`).join(', ');

  return (
    <View accessibilityRole="image" accessibilityLabel={`Flagrr Cash earned per month: ${label}`} style={{ flexDirection: 'row', gap: 10, height }}>
      {data.map((d, i) => {
        const h = max > 0 ? Math.max(8, (d.value / max) * barArea) : 8;
        const latest = i === last;
        return (
          <View key={`${d.month}-${i}`} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: latest ? t.ink : t.muted }} maxFontSizeMultiplier={1.4}>
              {compactNumber(d.value)}
            </Text>
            <Animated.View
              style={{
                width: '100%',
                height: h,
                borderRadius: 8,
                backgroundColor: latest ? t.accent : t.accentSoft,
                transformOrigin: 'bottom',
                transform: [{ scaleY: grow[i] }],
              }}
            />
            <Text style={{ fontSize: 12, color: t.muted }} maxFontSizeMultiplier={1.4}>
              {d.month}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
