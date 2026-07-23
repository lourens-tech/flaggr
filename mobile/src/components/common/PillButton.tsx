import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily, fontSize, radius } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

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

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        isPrimary && { backgroundColor: colors.lime },
        isDark && { backgroundColor: colors.darkGreen },
        (isOutline || isOutlineLight) && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: outlineColor },
        fullWidth && { alignSelf: 'stretch' },
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
    </TouchableOpacity>
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
  disabled: { opacity: 0.5 },
});
}
