import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily, fontSize, radius } from '../../../theme';
import { useThemeColors, type ThemeColors } from '../../../context/ThemeContext';
import { useHover, hoverTransition } from '../../../hooks/useHover';

// A little brand-safe colour per quick link (reusing existing theme tokens,
// not new hues) so a list of otherwise-identical action rows reads as more
// than a stack of black-outline buttons — green for people-management
// links, dark green for record/oversight links, lime for "go do a thing"
// CTAs, amber for the one that needs attention, red for something serious.
const QUICK_LINK_TONES = {
  green: { bg: (c: ThemeColors) => c.mintBg, fg: (c: ThemeColors) => c.clubGreen },
  darkGreen: { bg: () => 'rgba(31,66,52,0.08)', fg: (c: ThemeColors) => c.darkGreen },
  lime: { bg: () => 'rgba(205,222,92,0.25)', fg: (c: ThemeColors) => c.darkGreen },
  amber: { bg: (c: ThemeColors) => c.warningBg, fg: (c: ThemeColors) => c.warning },
  red: { bg: (c: ThemeColors) => c.dangerBg, fg: (c: ThemeColors) => c.negative },
} as const;
export type QuickLinkTone = keyof typeof QUICK_LINK_TONES;

interface Props {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: QuickLinkTone;
  onPress: () => void;
}

// Desktop-only "quick link" row — colored icon chip + label + chevron, with
// the same hover lift as the rest of the desktop chrome. Used anywhere a
// screen lists a handful of jump-to-this-other-screen actions (course-admin
// and super-admin Profile screens' "Quick Links"/action panels).
export function QuickLinkButton({ label, icon, tone, onPress }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [hovered, hoverHandlers] = useHover();
  const t = QUICK_LINK_TONES[tone];
  return (
    <TouchableOpacity
      style={[styles.quickLink, hoverTransition, hovered && styles.quickLinkHover]}
      onPress={onPress}
      activeOpacity={0.85}
      {...hoverHandlers}
    >
      <View style={[styles.quickLinkIcon, { backgroundColor: t.bg(colors) }]}>
        <Ionicons name={icon} size={16} color={t.fg(colors)} />
      </View>
      <Text style={styles.quickLinkLabel}>{label}</Text>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={colors.textMuted}
        style={[hoverTransition, hovered && styles.chevronHover] as any}
      />
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  quickLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  quickLinkHover: { borderColor: colors.clubGreen, backgroundColor: colors.mintBgAlt },
  quickLinkIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  quickLinkLabel: { flex: 1, fontFamily: fontFamily.headingDisplay, fontSize: fontSize.button, color: colors.textPrimary },
  chevronHover: { transform: [{ translateX: 2 }] },
});
}
