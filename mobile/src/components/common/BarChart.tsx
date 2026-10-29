import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { fontFamily, fontSize } from '../../theme';
import { duration, easing, prefersReducedMotion, useNativeDriver } from '../../theme/motion';
import { useOptionalAdminTheme, useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { MonthlyPoint } from '../../data/types';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

interface Props {
  data: MonthlyPoint[];
  height?: number;
  highlightIndex?: number;
}

const BAR_STAGGER = 30;

export function BarChart({ data, height = 90, highlightIndex }: Props) {
  const admin = useOptionalAdminTheme();
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

  // Inside the admin consoles: neutral bars with the highlighted one in the
  // accent, light gridlines and an axis. Member screens keep the look below.
  if (admin) return <AdminBars data={data} height={height} peakIdx={peakIdx} grow={grow} c={admin.c} />;

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

// ── Admin look ───────────────────────────────────────────────────────────────
const AXIS_WIDTH = 34;
const VALUE_SPACE = 18;

// Short labels so a busy year of Flagrr Cash still fits above narrow bars.
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k`;
  return String(n);
}

// A round step that puts three gridlines above zero and keeps the top line
// at or above the tallest bar (counts and Flagrr Cash are whole numbers).
function niceStep(max: number): number {
  if (max <= 0) return 1;
  const raw = max / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
  return Math.max(1, step);
}

function AdminBars({
  data,
  height,
  peakIdx,
  grow,
  c,
}: {
  data: MonthlyPoint[];
  height: number;
  peakIdx: number;
  grow: Animated.Value[];
  c: AdminColors;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  const step = niceStep(max);
  const top = step * 3;
  const ticks = [0, step, step * 2, top];
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={data.map((d) => `${d.month} ${d.value}`).join(', ')}
    >
      <View style={{ flexDirection: 'row', height: height + VALUE_SPACE }}>
        <View style={{ width: AXIS_WIDTH }}>
          {ticks.map((t) => (
            <Text
              key={`axis-${t}`}
              style={[adminStyles.axis, { color: c.ink3, bottom: (t / top) * height - 8 }]}
              numberOfLines={1}
            >
              {compact(t)}
            </Text>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          {ticks.map((t) => (
            <View
              key={`grid-${t}`}
              style={[adminStyles.grid, { borderTopColor: c.edge, bottom: (t / top) * height }]}
            />
          ))}
          <View style={adminStyles.barsRow}>
            {data.map((d, i) => {
              const barHeight = Math.max(4, (d.value / top) * height);
              const isPeak = i === peakIdx;
              return (
                <View key={`${d.month}-${i}`} style={adminStyles.barColumn}>
                  <Animated.Text style={[adminStyles.value, { color: isPeak ? c.ink : c.ink2, opacity: grow[i] }]} numberOfLines={1}>
                    {compact(d.value)}
                  </Animated.Text>
                  <Animated.View
                    style={[
                      adminStyles.bar,
                      {
                        height: barHeight,
                        backgroundColor: isPeak ? c.accent : c.bar,
                        transform: [{ scaleY: grow[i] }],
                      },
                    ]}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </View>
      <View style={[adminStyles.labelsRow, { paddingLeft: AXIS_WIDTH }]}>
        {data.map((d, i) => (
          <View key={`label-${i}`} style={adminStyles.barColumn}>
            <Text style={[adminStyles.label, { color: c.ink3 }]} numberOfLines={1}>
              {d.month}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const adminStyles = StyleSheet.create({
  axis: { position: 'absolute', left: 0, width: AXIS_WIDTH - 6, textAlign: 'right', ...adminFont.body, ...tabularNums, fontSize: 11.5, lineHeight: 16 },
  grid: { position: 'absolute', left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth },
  barsRow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: '100%', maxWidth: 28, borderTopLeftRadius: adminRadius.sm, borderTopRightRadius: adminRadius.sm, transformOrigin: 'bottom' },
  value: { ...adminFont.bodyBold, ...tabularNums, fontSize: 11.5 },
  labelsRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  label: { ...adminFont.bodySemiBold, fontSize: 11.5 },
});
