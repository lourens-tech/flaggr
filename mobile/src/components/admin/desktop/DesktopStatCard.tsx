import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily } from '../../../theme';
import { useThemeColors, type ThemeColors } from '../../../context/ThemeContext';
import { useHover, hoverTransition } from '../../../hooks/useHover';

interface Props {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  deltaPct?: number;
  showDelta?: boolean;
  onPress?: () => void;
}

// Desktop-web restyle of StatCard (see components/common/StatCard.tsx) —
// same underlying numbers/handlers, laid out to match the approved dashboard
// mockup (icon chip + chevron row, label, big Fraunces value, delta pill).
export function DesktopStatCard({ label, value, icon, deltaPct = 0, showDelta = false, onPress }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const positive = deltaPct >= 0;
  const [hovered, hoverHandlers] = useHover();
  return (
    <TouchableOpacity
      style={[styles.card, hoverTransition, onPress && hovered && styles.cardHover]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
      {...(onPress ? hoverHandlers : null)}
    >
      <View style={styles.top}>
        <View style={[styles.iconChip, hoverTransition, onPress && hovered && styles.iconChipHover]}>
          <Ionicons name={icon} size={15} color={onPress && hovered ? colors.white : colors.clubGreen} />
        </View>
        {showDelta ? (
          <View style={styles.deltaRow}>
            <Ionicons name={positive ? 'arrow-up' : 'arrow-down'} size={10} color={positive ? colors.clubGreen : colors.negative} />
            <Text style={[styles.delta, { color: positive ? colors.clubGreen : colors.negative }]}>{Math.abs(deltaPct)}%</Text>
          </View>
        ) : onPress ? (
          <Ionicons
            name="chevron-forward"
            size={14}
            color={hovered ? colors.clubGreen : colors.textMuted}
            style={[hoverTransition, hovered && styles.chevronHover] as any}
          />
        ) : null}
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1}>{value}</Text>
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 160,
    backgroundColor: colors.mintBgAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  cardHover: {
    borderColor: colors.clubGreen,
    transform: [{ translateY: -3 }],
    shadowColor: colors.clubGreen,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 4,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  iconChip: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.mintBg, alignItems: 'center', justifyContent: 'center' },
  iconChipHover: { backgroundColor: colors.clubGreen },
  chevronHover: { transform: [{ translateX: 2 }] },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  delta: { fontFamily: fontFamily.bodySemiBold, fontSize: 11.5 },
  label: { fontFamily: fontFamily.bodyMedium, fontSize: 12, color: colors.textSecondary },
  value: { fontFamily: fontFamily.heading, fontSize: 24, color: colors.textPrimary },
});
}
