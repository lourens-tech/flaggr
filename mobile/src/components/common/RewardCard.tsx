import React, { useState, useMemo } from 'react';
import { Image, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { fontFamily, fontSize, radius, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { Reward } from '../../data/types';

interface Props {
  reward: Reward;
  width?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onRedeem?: (variantId: string) => void;
}

function iconForReward(title: string): keyof typeof MaterialCommunityIcons.glyphMap {
  const t = title.toLowerCase();
  if (t.includes('cart')) return 'golf-cart';
  if (t.includes('driving range')) return 'golf-tee';
  if (t.includes('round')) return 'golf';
  if (t.includes('coaching')) return 'school';
  if (t.includes('pro shop')) return 'shopping';
  if (t.includes('kitchen')) return 'silverware-fork-knife';
  if (t.includes('bar')) return 'glass-cocktail';
  return 'gift';
}

export function RewardCard({ reward, width, style, onPress, onRedeem }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const variant = reward.variants[selectedIndex] ?? reward.variants[0];
  const showVariantPicker = onRedeem && reward.variants.length > 1;

  const body = (
    <>
      {reward.imageUrl && !imageFailed ? (
        <Image
          source={{ uri: reward.imageUrl }}
          style={styles.image}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <View style={[styles.image, styles.imageFallback]}>
          <MaterialCommunityIcons name={iconForReward(reward.title)} size={40} color={colors.lime} />
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {reward.title}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {reward.description}
        </Text>

        {showVariantPicker ? (
          <View style={styles.variantRow}>
            {reward.variants.map((v, i) => (
              <TouchableOpacity
                key={v.id}
                style={[styles.variantChip, i === selectedIndex && styles.variantChipActive]}
                onPress={() => setSelectedIndex(i)}
                hitSlop={4}
              >
                <Text style={[styles.variantChipText, i === selectedIndex && styles.variantChipTextActive]}>
                  {v.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <Text style={styles.cost}>{variant.cost} Flagrr Cash</Text>

        {onRedeem ? (
          <TouchableOpacity style={styles.redeemButton} onPress={() => onRedeem(variant.id)}>
            <Text style={styles.redeemButtonText}>Redeem Now</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.darkGreen} />
          </TouchableOpacity>
        ) : null}
      </View>
    </>
  );

  const cardStyle = [styles.card, width ? { width } : null, style];

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={cardStyle}>
        {body}
      </TouchableOpacity>
    );
  }
  return <View style={cardStyle}>{body}</View>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    overflow: 'hidden',
  },
  image: { width: '100%', height: 112, backgroundColor: colors.imagePlaceholder },
  imageFallback: { backgroundColor: colors.darkGreen, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.sm + 4, gap: 4 },
  title: { fontFamily: fontFamily.heading, fontSize: fontSize.cardTitle, color: colors.textPrimary },
  description: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  cost: { fontFamily: fontFamily.heading, fontSize: fontSize.label, color: colors.textPrimary, marginTop: 2 },
  variantRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  variantChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.clubGreen,
  },
  variantChipActive: { backgroundColor: colors.clubGreen },
  variantChipText: { fontFamily: fontFamily.bodyMedium, fontSize: 11, color: colors.clubGreen },
  variantChipTextActive: { color: colors.white },
  redeemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.lime,
    borderRadius: radius.pill,
    paddingVertical: 10,
    marginTop: 4,
  },
  redeemButtonText: { fontFamily: fontFamily.heading, fontSize: 12, color: colors.darkGreen },
});
}
