import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fontFamily, fontSize, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

interface Props {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

// The compact green header used on sub-screens (Scan Receipt, Help Center, etc.)
export function ScreenHeader({ title, onBack, right }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation();
  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onBack ?? (() => navigation.goBack())}
        hitSlop={12}
        style={styles.iconButton}
        accessibilityLabel="Back"
        accessibilityRole="button"
      >
        <Ionicons name="chevron-back" size={24} color={colors.white} />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.iconButton}>{right}</View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    height: 62,
    backgroundColor: colors.clubGreen,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  iconButton: { width: 32, alignItems: 'center', justifyContent: 'center' },
  title: {
    // Every screen passes a short, punctuation-free static title, so this is
    // safe for the Ws Paradose demo build (see typography.ts).
    fontFamily: fontFamily.headingDisplay,
    fontSize: fontSize.title,
    color: colors.white,
  },
});
}
