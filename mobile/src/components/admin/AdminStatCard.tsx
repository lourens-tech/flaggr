import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
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

// Course-admin mobile counterpart to DesktopStatCard (see
// components/admin/desktop/DesktopStatCard.tsx) — same icon-chip + delta
// layout and mintBgAlt/border card look, adapted for touch (no hover) and
// the mobile dashboard's flex/width grid instead of desktop's row-of-5.
// Not the shared components/common/StatCard, which HomeScreen (member) and
// super_admin screens also use — this is course-admin only.
export function AdminStatCard({ label, value, icon, deltaPct = 0, showDelta = false, width = '47%', fill = false, onPress }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const positive = deltaPct >= 0;
  const body = (
    <>
      <View style={styles.top}>
        <View style={styles.iconChip}>
          <Ionicons name={icon} size={15} color={colors.clubGreen} />
        </View>
        {showDelta ? (
          <View style={styles.deltaRow}>
            <Ionicons name={positive ? 'arrow-up' : 'arrow-down'} size={10} color={positive ? colors.clubGreen : colors.negative} />
            <Text style={[styles.delta, { color: positive ? colors.clubGreen : colors.negative }]}>{Math.abs(deltaPct)}%</Text>
          </View>
        ) : onPress ? (
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        ) : null}
      </View>
      <Text style={styles.label}>{label}</Text>
      <CountUpText style={styles.value} numberOfLines={1} value={value} />
    </>
  );
  return (
    <FadeIn style={fill ? styles.fill : { width }}>
      {onPress ? (
        <PressableScale style={styles.card} onPress={onPress}>
          {body}
        </PressableScale>
      ) : (
        <View style={styles.card}>{body}</View>
      )}
    </FadeIn>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: {
    flexGrow: 1,
    backgroundColor: colors.mintBgAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  fill: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  iconChip: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.mintBg, alignItems: 'center', justifyContent: 'center' },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  delta: { fontFamily: fontFamily.bodySemiBold, fontSize: 11 },
  label: { fontFamily: fontFamily.bodyMedium, fontSize: 12, color: colors.textSecondary },
  value: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.textPrimary },
});
}
