import React, { useCallback, useState, useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { AdminButton, CircleButton, EmptyState, ErrorState, Muted, PageTitle, SkeletonRows, Tile } from '../../components/admin/ui';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import { useHover, hoverTransition } from '../../hooks/useHover';
import type { AdminReward } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminCourseRewards'>;

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

function clubInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Photo-topped reward card: inactive badge on the photo, title, description,
// price and an Edit cue.
function RewardCard({ reward, onPress, style }: { reward: AdminReward; onPress: () => void; style?: object }) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const [hovered, hoverHandlers] = useHover();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${reward.title}`}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
      style={({ pressed }) => [styles.card, hoverTransition, (hovered || pressed) && { backgroundColor: c.surface2 }, style]}
    >
      {reward.imageUrl ? (
        <Image source={{ uri: reward.imageUrl }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imageFallback]}>
          <MaterialCommunityIcons name={CATEGORY_ICON[reward.category] ?? 'gift'} size={40} color="#CDDE5C" />
        </View>
      )}
      {!reward.active ? (
        <View style={styles.inactiveBadge}>
          <Text style={styles.inactiveBadgeText}>Inactive</Text>
        </View>
      ) : null}

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{reward.title}</Text>
        <Text style={styles.description} numberOfLines={2}>{reward.description}</Text>
        <View style={styles.footRow}>
          <Text style={styles.cost} numberOfLines={1}>{priceLabelFor(reward)}</Text>
          <View style={styles.editCue}>
            <Text style={styles.editText}>Edit</Text>
            <Ionicons name="chevron-forward" size={13} color={c.accentText} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// Same grid/card layout as AdminRewardsListScreen (the course_admin's own
// Rewards tab), rewired for an explicit courseId param so a super_admin can
// view and override any club's rewards from the Courses tab's "Manage
// Rewards" button, instead of relying on session-implicit scoping.
export function SuperAdminCourseRewardsScreen({ navigation, route }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { courseId, courseName, fbPerRand } = route.params;
  const { getSuperAdminRewards } = useAdmin();
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setRewards(await getSuperAdminRewards(courseId));
    } catch (err) {
      setLoadError(true);
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t load rewards', message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!cancelled) await load();
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId]),
  );

  const openReward = (reward: AdminReward) => navigation.navigate('SuperAdminRewardEdit', { courseId, fbPerRand, rewardId: reward.id });

  const content = (emptyText: string, cardStyle: object) =>
    loadError ? (
      <ErrorState onRetry={load} />
    ) : loading ? (
      <Tile>
        <SkeletonRows rows={3} />
      </Tile>
    ) : rewards.length === 0 ? (
      <Tile padded={false}>
        <EmptyState icon="gift-outline" title={emptyText} />
      </Tile>
    ) : (
      <View style={[styles.grid, !isDesktop && styles.mGrid]}>
        {rewards.map((reward) => (
          <RewardCard key={reward.id} reward={reward} onPress={() => openReward(reward)} style={cardStyle} />
        ))}
      </View>
    );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminCourses" breadcrumb={`Courses › ${courseName} › Rewards`} showRail={false}>
        <View style={styles.dHeadRow}>
          <View style={styles.crest}>
            <Text style={styles.crestText}>{clubInitials(courseName)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <PageTitle>{courseName}</PageTitle>
            <Muted style={styles.dSection}>Rewards</Muted>
          </View>
          <AdminButton label="New Reward" icon="add" variant="accent" onPress={() => navigation.navigate('SuperAdminRewardEdit', { courseId, fbPerRand })} />
        </View>
        <View style={{ height: 18 }} />
        {content('No rewards yet — create the first one.', styles.dCard)}
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader
        title="Rewards"
        subtitle={courseName}
        right={
          <CircleButton
            icon="add"
            size={44}
            onPress={() => navigation.navigate('SuperAdminRewardEdit', { courseId, fbPerRand })}
            accessibilityLabel="Add Reward"
          />
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {content('No rewards yet — tap + to create the first one.', styles.mCard)}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 16, paddingTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    backgroundColor: c.surface,
    borderRadius: adminRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.edge,
    overflow: 'hidden',
  },
  mCard: { width: '47%' },
  mGrid: { justifyContent: 'space-between' },
  dCard: { width: 230 },
  image: { width: '100%', height: 124, backgroundColor: c.fill },
  imageFallback: { backgroundColor: '#1F4234', alignItems: 'center', justifyContent: 'center' },
  // Sits on the reward photo, so it keeps a dark chip with white text.
  inactiveBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(10,20,15,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: adminRadius.pill,
  },
  inactiveBadgeText: { ...adminFont.bodyBold, fontSize: 12, color: '#FFFFFF' },
  body: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 3 },
  title: { ...adminFont.bodyBold, fontSize: 15, color: c.ink },
  description: { ...adminFont.body, fontSize: 13, lineHeight: 18, color: c.ink2 },
  footRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  cost: { ...adminFont.bodyBold, ...tabularNums, fontSize: 13, color: c.ink, flexShrink: 1 },
  editCue: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0 },
  editText: { ...adminFont.bodySemiBold, fontSize: 13, color: c.accentText },
  dHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  crest: { width: 48, height: 48, borderRadius: adminRadius.sm, backgroundColor: '#1F4234', alignItems: 'center', justifyContent: 'center' },
  crestText: { ...adminFont.bodyBold, fontSize: 16, color: '#CDDE5C' },
  dSection: { marginTop: 2, fontSize: 15 },
});
}
