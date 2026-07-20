import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';
import type { Reward } from '../../data/types';

interface Props {
  reward: Reward;
  onPress?: () => void;
  width?: number;
}

export function RewardCard({ reward, onPress, width = 180 }: Props) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.card, { width }]}>
      <Image source={{ uri: reward.imageUrl }} style={styles.image} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {reward.title}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {reward.description}
        </Text>
        <Text style={styles.cost}>{reward.cost} Flagrr Bucks</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    overflow: 'hidden',
  },
  image: { width: '100%', height: 112, backgroundColor: colors.imagePlaceholder },
  body: { padding: spacing.sm + 4, gap: 4 },
  title: { fontFamily: fontFamily.heading, fontSize: fontSize.cardTitle, color: colors.darkGreen },
  description: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  cost: { fontFamily: fontFamily.heading, fontSize: fontSize.label, color: colors.darkGreen, marginTop: 2 },
});
