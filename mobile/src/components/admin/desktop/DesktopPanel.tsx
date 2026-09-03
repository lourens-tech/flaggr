import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily } from '../../../theme';
import { useThemeColors, type ThemeColors } from '../../../context/ThemeContext';

interface Props {
  title: string;
  onViewAll?: () => void;
  viewAllLabel?: string;
  children: React.ReactNode;
  style?: object;
}

// Generic white card used to group dashboard content on desktop (chart,
// tier distribution, top rewards, member lookup, etc.) — matches the
// approved mockup's `.panel` styling.
export function DesktopPanel({ title, onViewAll, viewAllLabel = 'View all', children, style }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.panel, style]}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        {onViewAll ? (
          <TouchableOpacity style={styles.link} onPress={onViewAll} activeOpacity={0.7}>
            <Text style={styles.linkText}>{viewAllLabel}</Text>
            <Ionicons name="chevron-forward" size={12} color={colors.clubGreen} />
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fontFamily.heading, fontSize: 16.5, color: colors.textPrimary },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkText: { fontFamily: fontFamily.bodySemiBold, fontSize: 12, color: colors.clubGreen },
});
}
