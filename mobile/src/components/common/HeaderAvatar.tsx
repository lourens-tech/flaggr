import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { colors } from '../../theme';

interface Props {
  size?: number;
}

// Small circular header avatar used on Home/Rewards/Activity — shows the
// member's uploaded profile picture when set, otherwise the same person-icon
// placeholder every screen used before avatars existed.
export function HeaderAvatar({ size = 32 }: Props) {
  const { user } = useApp();

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      {user.avatarUrl ? (
        <Image source={{ uri: user.avatarUrl }} style={styles.image} />
      ) : (
        <Ionicons name="person" size={Math.round(size * 0.56)} color={colors.darkGreen} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
});
