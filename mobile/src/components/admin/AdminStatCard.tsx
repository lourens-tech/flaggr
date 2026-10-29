import React from 'react';
import { StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAdminTheme } from '../../context/ThemeContext';
import { adminFont, adminRadius, tabularNums } from '../../theme/admin';
import { CountUpText, FadeIn, PressableScale } from '../motion';

interface Props {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  deltaPct?: number;
  showDelta?: boolean;
  width?: DimensionValue;
  // When true, sizes via flex instead of a fixed width — use inside a
  // flex-row container with a gap so a pair of cards splits it exactly.
  fill?: boolean;
  onPress?: () => void;
}

// Phone counterpart to DesktopStatCard: the same KPI tile, sized for a two-up
// grid and pressable instead of hoverable.
export function AdminStatCard({ label, value, icon, deltaPct = 0, showDelta = false, width = '47%', fill = false, onPress }: Props) {
  const { c, scheme } = useAdminTheme();
  const positive = deltaPct >= 0;
  const cardStyle = [styles.card, { backgroundColor: c.surface, borderColor: c.edge, shadowOpacity: scheme === 'dark' ? 0.3 : 0.08 }];
  const body = (
    <>
      <View style={styles.top}>
        <Ionicons name={icon} size={16} color={c.ink3} />
        <Text style={[styles.label, { color: c.ink2 }]} numberOfLines={1}>{label}</Text>
        {onPress ? <Ionicons name="chevron-forward" size={14} color={c.ink3} /> : null}
      </View>
      <CountUpText style={[styles.value, { color: c.ink }]} numberOfLines={1} value={value} />
      {showDelta ? (
        <View style={styles.deltaRow}>
          <Ionicons name={positive ? 'arrow-up' : 'arrow-down'} size={10} color={positive ? c.pos : c.neg} />
          <Text style={[styles.delta, { color: positive ? c.pos : c.neg }]}>{Math.abs(deltaPct)}%</Text>
        </View>
      ) : null}
    </>
  );
  const a11y = `${label}: ${value}${showDelta ? `, ${positive ? 'up' : 'down'} ${Math.abs(deltaPct)}%` : ''}`;
  return (
    <FadeIn style={fill ? styles.fill : { width }}>
      {onPress ? (
        <PressableScale style={cardStyle} onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y}>
          {body}
        </PressableScale>
      ) : (
        <View style={cardStyle} accessible accessibilityLabel={a11y}>
          {body}
        </View>
      )}
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: adminRadius.md,
    padding: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 2,
  },
  fill: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { ...adminFont.bodySemiBold, fontSize: 13, flex: 1 },
  value: { ...adminFont.bodyBold, ...tabularNums, fontSize: 26, letterSpacing: -0.6 },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  delta: { ...adminFont.bodySemiBold, ...tabularNums, fontSize: 12 },
});
