import React, { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

interface Props {
  logoUrl: string | null;
  size?: number;
}

// Small circular header avatar for the course-admin side — shows the
// course's own logo in the "profile picture" slot instead of a person, since
// the identity that matters in this header is the club, not the individual
// admin. Same shape/placement as the member app's HeaderAvatar.
export function AdminHeaderAvatar({ logoUrl, size = 32 }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={styles.image} />
      ) : (
        <Ionicons name="business" size={Math.round(size * 0.56)} color={colors.darkGreen} />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
});
}
