import React, { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList, AdminTabParamList } from '../../navigation/types';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { AdminButton, CircleButton, EmptyState, ErrorState, PageTitle, SkeletonRows, Tile } from '../../components/admin/ui';
import { PressableScale } from '../../components/motion';
import { useAdminTheme } from '../../context/ThemeContext';
import type { AdminReward } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums } from '../../theme/admin';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabParamList, 'AdminRewards'>,
  NativeStackScreenProps<AdminStackParamList>
>;

const CATEGORY_ICON: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  rounds: 'golf',
  experiences: 'star-four-points-outline',
  'pro-shop': 'shopping',
  practice: 'golf-tee',
  dining: 'silverware-fork-knife',
};

function priceLabelFor(item: AdminReward): string {
  const prices = item.variants
    .filter((v) => v.active !== false)
    .map((v) => v.cost ?? 0)
    .sort((a, b) => a - b);
  if (prices.length === 0) return 'No active variants';
  if (prices.length === 1) return `${prices[0].toLocaleString()} Flagrr Cash`;
  return `${prices[0].toLocaleString()}–${prices[prices.length - 1].toLocaleString()} Flagrr Cash`;
}

export function AdminRewardsListScreen({ navigation }: Props) {
  const { c } = useAdminTheme();
  const isDesktop = useIsDesktopNav();
  const { rewards, loadRewards } = useAdmin();
  const [loading, setLoading] = useState(true);
  // Load failures used to be swallowed silently; surface them with a retry.
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        setError(false);
        try {
          await loadRewards();
        } catch {
          if (!cancelled) setError(true);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reloadKey]),
  );

  const retry = () => setReloadKey((k) => k + 1);

  const rewardCard = (reward: AdminReward) => (
    <PressableScale
      key={reward.id}
      style={[styles.card, isDesktop ? styles.dCard : styles.mCard, { backgroundColor: c.surface, borderColor: c.edge }]}
      pressedScale={0.98}
      onPress={() => navigation.navigate('AdminRewardEdit', { rewardId: reward.id })}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${reward.title}`}
    >
      {reward.imageUrl ? (
        <Image source={{ uri: reward.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.imageFallback]}>
          <MaterialCommunityIcons
            name={CATEGORY_ICON[reward.category] ?? 'gift'}
            size={40}
            color={LIME}
            style={styles.fallbackIcon}
          />
        </View>
      )}
      {!reward.active ? (
        <View style={styles.inactiveBadge}>
          <Text style={styles.inactiveBadgeText}>Inactive</Text>
        </View>
      ) : null}

      <LinearGradient colors={CAPTION_GRADIENT} style={styles.caption}>
        <Text style={styles.title} numberOfLines={1}>{reward.title}</Text>
        <Text style={styles.description} numberOfLines={2}>{reward.description}</Text>
        <View style={styles.captionFoot}>
          <Text style={styles.cost} numberOfLines={1}>{priceLabelFor(reward)}</Text>
          <View style={styles.editLink}>
            <Text style={styles.editLinkText}>Edit</Text>
            <Ionicons name="arrow-forward" size={14} color={WHITE} />
          </View>
        </View>
      </LinearGradient>
    </PressableScale>
  );

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminRewards" breadcrumb="Rewards">
        <View style={styles.dHeadRow}>
          <PageTitle>Rewards</PageTitle>
          <AdminButton variant="accent" icon="add" label="New Reward" onPress={() => navigation.navigate('AdminRewardEdit', {})} />
        </View>
        {error ? <ErrorState onRetry={retry} /> : null}
        {loading ? (
          <Tile>
            <SkeletonRows rows={4} />
          </Tile>
        ) : rewards.length === 0 ? (
          error ? null : (
            <Tile>
              <EmptyState icon="gift-outline" title="No rewards yet — add your first one." />
            </Tile>
          )
        ) : (
          <View style={styles.dGrid}>{rewards.map(rewardCard)}</View>
        )}
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader
        title="Rewards"
        showBack={false}
        right={<CircleButton icon="add" onPress={() => navigation.navigate('AdminRewardEdit', {})} accessibilityLabel="Add Reward" size={44} />}
      />

      {error ? (
        <View style={styles.mState}>
          <ErrorState onRetry={retry} />
        </View>
      ) : null}
      {loading ? (
        <View style={styles.mState}>
          <Tile>
            <SkeletonRows rows={4} />
          </Tile>
        </View>
      ) : rewards.length === 0 ? (
        error ? null : (
          <View style={styles.mState}>
            <Tile>
              <EmptyState icon="gift-outline" title="No rewards yet — tap + to create your first one." />
            </Tile>
          </View>
        )
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.grid}>{rewards.map(rewardCard)}</View>
          <View style={{ height: 120 }} />
        </ScrollView>
      )}
    </View>
  );
}

// Brand constants for text and icons that sit on a reward photo (or on the
// Fairway fallback when there's no photo): they stay the same in both schemes.
const WHITE = '#FFFFFF';
const LIME = '#CDDE5C';
const CAPTION_GRADIENT = ['rgba(6,14,10,0)', 'rgba(6,14,10,0.82)'] as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  mState: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  card: {
    borderRadius: adminRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  mCard: { width: '48.5%', height: 220 },
  dCard: { width: 250, height: 260 },
  imageFallback: { backgroundColor: '#1F4234', alignItems: 'center' },
  fallbackIcon: { marginTop: 48 },
  inactiveBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: adminRadius.pill,
  },
  inactiveBadgeText: { ...adminFont.bodyBold, fontSize: 12, color: WHITE },
  caption: { paddingTop: 40, paddingHorizontal: 14, paddingBottom: 12, gap: 3 },
  title: { ...adminFont.bodyBold, fontSize: 15.5, color: WHITE },
  description: { ...adminFont.body, fontSize: 12.5, lineHeight: 17, color: 'rgba(255,255,255,0.88)' },
  captionFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  cost: { ...adminFont.bodyBold, ...tabularNums, fontSize: 13, color: WHITE, flexShrink: 1 },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editLinkText: { ...adminFont.bodySemiBold, fontSize: 13, color: WHITE },
  dHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  dGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
});
