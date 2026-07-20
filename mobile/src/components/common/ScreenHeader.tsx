import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, fontFamily, fontSize, spacing } from '../../theme';

interface Props {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

// The compact green header used on sub-screens (Scan Receipt, Help Center, etc.)
export function ScreenHeader({ title, onBack, right }: Props) {
  const navigation = useNavigation();
  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onBack ?? (() => navigation.goBack())}
        hitSlop={12}
        style={styles.iconButton}
      >
        <Ionicons name="chevron-back" size={24} color={colors.white} />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.iconButton}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontFamily: fontFamily.heading,
    fontSize: fontSize.title,
    color: colors.white,
  },
});
