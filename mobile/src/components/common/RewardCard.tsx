import React, { useState, useMemo } from 'react';
import { Image, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { fontFamily, fontSize, radius, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { Reward, RewardCategory } from '../../data/types';

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

export const REWARD_CATEGORY_LABELS: Record<RewardCategory, string> = {
  rounds: 'Rounds',
  experiences: 'Experiences',
  'pro-shop': 'Pro Shop',
  practice: 'Practice',
  dining: 'Dining',
};

// Tag-pill background/text pairing per category — the same tone language as
// the admin desktop dashboard's status tags, applied to a reward photo's
// overlay chip instead of a table cell.
function categoryTagStyle(category: RewardCategory, colors: ThemeColors): { bg: string; text: string } {
  switch (category) {
    case 'rounds':
      return { bg: 'rgba(31,66,52,0.85)', text: colors.lime };
    case 'dining':
      return { bg: 'rgba(138,90,0,0.85)', text: colors.warningBg };
    case 'practice':
      return { bg: 'rgba(0,128,90,0.9)', text: colors.white };
    case 'pro-shop':
      return { bg: 'rgba(0,128,90,0.85)', text: colors.white };
    case 'experiences':
    default:
      return { bg: 'rgba(31,66,52,0.85)', text: colors.lime };
  }
}

export function RewardCard({ reward, width, style, onPress, onRedeem }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const variant = reward.variants[selectedIndex] ?? reward.variants[0];
  const showVariantPicker = onRedeem && reward.variants.length > 1;

  const tag = categoryTagStyle(reward.category, colors);

  const body = (
    <>
      <View style={styles.imageWrap}>
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
        <View style={[styles.categoryTag, { backgroundColor: tag.bg }]}>
          <Text style={[styles.categoryTagText, { color: tag.text }]}>{REWARD_CATEGORY_LABELS[reward.category]}</Text>
        </View>
      </View>
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
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  imageWrap: { position: 'relative' },
  image: { width: '100%', height: 112, backgroundColor: colors.imagePlaceholder },
  imageFallback: { backgroundColor: colors.darkGreen, alignItems: 'center', justifyContent: 'center' },
  categoryTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  categoryTagText: { fontFamily: fontFamily.bodySemiBold, fontSize: 9 },
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
