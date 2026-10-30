import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily, fontSize, radius } from '../../theme';
import { useOptionalAdminTheme, useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import { adminFont, adminRadius } from '../../theme/admin';
import { useHover, hoverTransitionNoTransform } from '../../hooks/useHover';
import { PressableScale } from '../motion';

interface Props {
  label: string;
  onPress?: (e: GestureResponderEvent) => void;
  // 'outline' adapts to the theme (dark text/border in light mode, light in
  // dark mode) — use it on a themed page surface. 'outlineLight' is always a
  // white border/text regardless of theme — use it on a permanently-dark
  // surface (onboarding screens keep their dark-green background in both
  // themes), where 'outline' would go near-invisible in light mode.
  variant?: 'primary' | 'dark' | 'outline' | 'outlineLight';
  icon?: keyof typeof Ionicons.glyphMap | null;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

export function PillButton({
  label,
  onPress,
  variant = 'primary',
  icon = 'arrow-forward',
  disabled,
  loading,
  fullWidth = true,
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isPrimary = variant === 'primary';
  const isDark = variant === 'dark';
  const isOutline = variant === 'outline';
  const isOutlineLight = variant === 'outlineLight';
  const outlineColor = isOutlineLight ? colors.white : colors.textPrimary;
  const [hovered, hoverHandlers] = useHover();
  const canHover = hovered && !disabled && !loading;
  const admin = useOptionalAdminTheme();

  // In the admin consoles: lime (Flag Green in light mode) for the primary
  // action, a neutral fill for everything else, system font, no border.
  if (admin) {
    const { c } = admin;
    const bg = isPrimary ? c.accent : c.fill;
    const fg = isPrimary ? c.onAccent : c.ink;
    return (
      <PressableScale
        onPress={onPress}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
        onHoverIn={hoverHandlers.onMouseEnter}
        onHoverOut={hoverHandlers.onMouseLeave}
        style={[
          styles.adminBase,
          hoverTransitionNoTransform,
          { backgroundColor: bg },
          fullWidth && { alignSelf: 'stretch' },
          canHover && { opacity: 0.9 },
          (disabled || loading) && { opacity: 0.45 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <View style={styles.content}>
            <Text style={[styles.adminLabel, { color: fg }]} numberOfLines={1}>
              {label}
            </Text>
            {icon ? <Ionicons name={icon} size={17} color={fg} /> : null}
          </View>
        )}
      </PressableScale>
    );
  }

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      hoverScale={1.015}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
      style={[
        styles.base,
        hoverTransitionNoTransform,
        isPrimary && { backgroundColor: colors.lime },
        isDark && { backgroundColor: colors.darkGreen },
        (isOutline || isOutlineLight) && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: outlineColor },
        fullWidth && { alignSelf: 'stretch' },
        canHover && styles.hovered,
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.darkGreen : isOutline || isOutlineLight ? outlineColor : colors.white} />
      ) : (
        <View style={styles.content}>
          <Text
            style={[
              styles.label,
              isPrimary && { color: colors.darkGreen },
              (isOutline || isOutlineLight) && { color: outlineColor },
              isDark && { color: colors.white },
            ]}
          >
            {label}
          </Text>
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={isPrimary ? colors.darkGreen : isOutline || isOutlineLight ? outlineColor : colors.white}
            />
          ) : null}
        </View>
      )}
    </PressableScale>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  base: {
    height: 53,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: {
    // Every screen passes a short, punctuation-free static label, so this is
    // safe for the Ws Paradose demo build (see typography.ts).
    fontFamily: fontFamily.headingDisplay,
    fontSize: fontSize.button,
    textTransform: 'capitalize',
  },
  // The hover lift itself is PressableScale's hoverScale; this adds the shadow.
  hovered: {
    shadowColor: colors.darkGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 3,
  },
  disabled: { opacity: 0.5 },
  adminBase: { height: 50, borderRadius: adminRadius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  adminLabel: { ...adminFont.bodySemiBold, fontSize: 16 },
});
}
