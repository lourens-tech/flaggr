import React from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily, fontSize, radius } from '../../theme';

interface Props {
  label: string;
  onPress?: (e: GestureResponderEvent) => void;
  variant?: 'primary' | 'dark' | 'outline';
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
  const isPrimary = variant === 'primary';
  const isDark = variant === 'dark';
  const isOutline = variant === 'outline';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        isPrimary && { backgroundColor: colors.lime },
        isDark && { backgroundColor: colors.darkGreen },
        isOutline && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.darkGreen },
        fullWidth && { alignSelf: 'stretch' },
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.darkGreen : colors.white} />
      ) : (
        <View style={styles.content}>
          <Text
            style={[
              styles.label,
              (isPrimary || isOutline) && { color: colors.darkGreen },
              isDark && { color: colors.white },
            ]}
          >
            {label}
          </Text>
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={isPrimary || isOutline ? colors.darkGreen : colors.white}
            />
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
