import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAdminTheme } from '../../context/ThemeContext';
import { adminFont, adminRadius, tabularNums } from '../../theme/admin';
import { Muted } from './ui';

// Approved tier palette (docs/Brand-Kit.md). Used only to mark a tier.
export const TIER_COLORS: Record<string, string> = { Bronze: '#B9773E', Silver: '#AEB8BF', Gold: '#E2B93B', Platinum: '#E8ECEF' };
const TIER_ORDER = ['Bronze', 'Silver', 'Gold', 'Platinum'];

interface Props {
  tiers: Array<{ tier: string; count: number }>;
  emptyText?: string;
}

// A stacked bar of members per tier with a legend (swatch, count, share).
// Shared by the course-admin Home and super-admin Reports.
export function TierBreakdown({ tiers, emptyText = 'No members yet.' }: Props) {
  const { c } = useAdminTheme();
  const counts = new Map(tiers.map((t) => [t.tier, t.count]));
  const extras = tiers.filter((t) => !TIER_ORDER.includes(t.tier)).map((t) => t.tier);
  const rows = [...TIER_ORDER, ...extras].map((tier) => ({ tier, count: counts.get(tier) ?? 0, color: TIER_COLORS[tier] ?? c.ink3 }));
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  if (total === 0) return <Muted>{emptyText}</Muted>;
  const pct = (n: number) => Math.round((n / total) * 100);
  return (
    <View style={{ gap: 16 }}>
      <View
        style={[styles.stack, { borderColor: c.edge }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={rows.map((r) => `${r.tier} ${r.count}`).join(', ')}
      >
        {rows
          .filter((r) => r.count > 0)
          .map((r) => (
            <View key={r.tier} style={{ flex: r.count, backgroundColor: r.color }} />
          ))}
      </View>
      {/* One column: four tiers always fit, however narrow the tile gets. */}
      <View style={styles.legend}>
        {rows.map((r) => (
          <View key={r.tier} style={styles.item}>
            {/* Hairline edge: Platinum (#E8ECEF) would vanish on a white tile. */}
            <View style={[styles.swatch, { backgroundColor: r.color, borderColor: c.edge }]} />
            <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>{r.tier}</Text>
            <Text style={[styles.count, { color: c.ink }]}>{r.count.toLocaleString()}</Text>
            <Text style={[styles.pct, { color: c.ink3 }]}>{pct(r.count)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { flexDirection: 'row', height: 14, borderRadius: adminRadius.pill, overflow: 'hidden', gap: 2, borderWidth: StyleSheet.hairlineWidth },
  legend: { gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 10, height: 10, borderRadius: adminRadius.pill, borderWidth: StyleSheet.hairlineWidth },
  name: { flex: 1, ...adminFont.body, fontSize: 13.5 },
  count: { ...adminFont.bodyBold, ...tabularNums, fontSize: 13.5 },
  pct: { ...adminFont.body, ...tabularNums, fontSize: 12.5, width: 38, textAlign: 'right' },
});
