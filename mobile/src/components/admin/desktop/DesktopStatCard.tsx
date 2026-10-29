import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAdminTheme } from '../../../context/ThemeContext';
import { useHover, hoverTransition } from '../../../hooks/useHover';
import { adminFont, adminRadius, tabularNums } from '../../../theme/admin';
import { CountUpText, FadeIn } from '../../motion';

interface Props {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  deltaPct?: number;
  showDelta?: boolean;
  onPress?: () => void;
}

// A KPI tile on desktop: label, a large number that counts up, and either its
// change since the last period or a chevron when it opens a detail page.
export function DesktopStatCard({ label, value, icon, deltaPct = 0, showDelta = false, onPress }: Props) {
  const { c, scheme } = useAdminTheme();
  const positive = deltaPct >= 0;
  const [hovered, hoverHandlers] = useHover();
  const lift = !!onPress && hovered;
  return (
    <FadeIn style={styles.slot}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : 'summary'}
        accessibilityLabel={`${label}: ${value}${showDelta ? `, ${positive ? 'up' : 'down'} ${Math.abs(deltaPct)}%` : ''}`}
        onHoverIn={hoverHandlers.onMouseEnter}
        onHoverOut={hoverHandlers.onMouseLeave}
        style={[
          styles.card,
          hoverTransition,
          { backgroundColor: c.surface, borderColor: c.edge, shadowOpacity: scheme === 'dark' ? 0.3 : 0.08 },
          lift && { backgroundColor: c.surface2, transform: [{ translateY: -2 }] },
        ]}
      >
        <View style={styles.top}>
          <Ionicons name={icon} size={17} color={c.ink3} />
          <Text style={[styles.label, { color: c.ink2 }]} numberOfLines={1}>{label}</Text>
          {onPress ? <Ionicons name="chevron-forward" size={14} color={c.ink3} /> : null}
        </View>
        <CountUpText style={[styles.value, { color: c.ink }]} numberOfLines={1} value={value} />
        {showDelta ? (
          <View style={styles.deltaRow}>
            <Ionicons name={positive ? 'arrow-up' : 'arrow-down'} size={11} color={positive ? c.pos : c.neg} />
            <Text style={[styles.delta, { color: positive ? c.pos : c.neg }]}>{Math.abs(deltaPct)}%</Text>
            <Text style={[styles.deltaNote, { color: c.ink3 }]}>vs last period</Text>
          </View>
        ) : null}
      </Pressable>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, minWidth: 170 },
  card: {
    flexGrow: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: adminRadius.md,
    padding: 18,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 30,
    elevation: 2,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { ...adminFont.bodySemiBold, fontSize: 13.5, flex: 1 },
  value: { ...adminFont.bodyBold, ...tabularNums, fontSize: 30, letterSpacing: -0.8 },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  delta: { ...adminFont.bodySemiBold, ...tabularNums, fontSize: 12.5 },
  deltaNote: { ...adminFont.body, fontSize: 12, marginLeft: 4 },
});
