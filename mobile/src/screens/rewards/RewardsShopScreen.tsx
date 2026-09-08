import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { HeaderAvatar } from '../../components/common/HeaderAvatar';
import { RewardCard, REWARD_CATEGORY_LABELS } from '../../components/common/RewardCard';
import { AdSpace } from '../../components/common/AdSpace';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { Reward, RewardCategory } from '../../data/types';

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

const NOT_LISTED_POPUP_TITLE = "You're Almost In the Family";
const NOT_LISTED_POPUP_BODY =
  "We couldn't find your golf club on Flagrr yet, so there's no rewards catalogue to show you just yet. Ask your club to join Flagrr, or get in touch with our support team and we'll help make it happen.";

// Filter-pill icon/tone per category — the "all" entry (darkGreen, solid)
// mirrors the active state; every category pill instead uses a light tint
// (the same tone language as the admin desktop quick links) so the active
// "All" pill reads as the one currently selected.
const CATEGORY_FILTERS: Array<{ key: RewardCategory; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'rounds', icon: 'flag-outline' },
  { key: 'dining', icon: 'restaurant-outline' },
  { key: 'practice', icon: 'locate-outline' },
  { key: 'pro-shop', icon: 'bag-outline' },
  { key: 'experiences', icon: 'sparkles-outline' },
];

function categoryPillTone(category: RewardCategory, colors: ThemeColors): { bg: string; fg: string } {
  switch (category) {
    case 'rounds':
      return { bg: colors.mintBg, fg: colors.clubGreen };
    case 'dining':
      return { bg: colors.warningBg, fg: colors.textPrimary };
    case 'practice':
      return { bg: 'rgba(205,222,92,0.25)', fg: colors.textPrimary };
    case 'pro-shop':
      return { bg: 'rgba(31,66,52,0.08)', fg: colors.darkGreen };
    case 'experiences':
    default:
      return { bg: colors.mintBg, fg: colors.clubGreen };
  }
}

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Rewards'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function RewardsShopScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, rewards, points, redeemReward, unreadNotificationCount } = useApp();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<RewardCategory | 'all'>('all');

  const availableCategories = useMemo(
    () => CATEGORY_FILTERS.filter((c) => rewards.some((r) => r.category === c.key)),
    [rewards],
  );

  const filteredRewards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rewards.filter((r) => {
      if (category !== 'all' && r.category !== category) return false;
      if (q && !r.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rewards, search, category]);

  // Unlike Home's every-second-open popup, this shows on every visit here —
  // an empty shop needs explaining every time, not just as a standing
  // reminder (see HomeScreen for the alternating version of the same copy).
  useFocusEffect(
    useCallback(() => {
      if (!user.isPlaceholderClub) return;
      showAlert(NOT_LISTED_POPUP_TITLE, NOT_LISTED_POPUP_BODY, [
        { text: 'Contact Support', onPress: () => navigation.navigate('Contact') },
        { text: 'Close', style: 'cancel' },
      ]);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user.isPlaceholderClub]),
  );

  const handleRedeem = (reward: Reward, variantId: string) => {
    const variant = reward.variants.find((v) => v.id === variantId);
    if (!variant) return;
    const label = variant.label === 'Standard' ? reward.title : `${reward.title} (${variant.label})`;
    if (points.balance < variant.cost) {
      showAlert(
        'Not enough Flagrr Cash',
        `You need ${variant.cost - points.balance} more Flagrr Cash to redeem ${label}.`,
      );
      return;
    }
    showAlert('Redeem reward?', `Use ${variant.cost} Flagrr Cash to redeem ${label}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Redeem',
        onPress: async () => {
          const voucher = await redeemReward(reward.id, variantId);
          if (voucher) navigation.navigate('Voucher', { voucherId: voucher.id });
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Rewards Shop</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name="notifications" size={20} color={colors.white} />
              {unreadNotificationCount > 0 ? <View style={styles.badge} /> : null}
            </TouchableOpacity>
            <HeaderAvatar size={30} />
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {rewards.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="golf-outline" size={32} color={colors.clubGreen} />
            <Text style={styles.emptyTitle}>
              {user.isPlaceholderClub ? 'Nothing Here Yet' : 'No Rewards Yet'}
            </Text>
            <Text style={styles.emptyBody}>
              {user.isPlaceholderClub
                ? "Your golf club hasn't joined the Flagrr family yet — that's why there's nothing to redeem here."
                : "Your club hasn't added any rewards yet — check back soon."}
            </Text>
            <AdSpace placement="rewardsShop" style={styles.adSpace} />
          </View>
        ) : (
          <>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={17} color={colors.textMuted} />
              <TextInput
                placeholder="Search rewards…"
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
              />
            </View>

            {availableCategories.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                <TouchableOpacity
                  style={[styles.filterPill, category === 'all' && styles.filterPillActive]}
                  onPress={() => setCategory('all')}
                >
                  <Text style={[styles.filterTextActive, category !== 'all' && { color: colors.textPrimary }]}>All</Text>
                </TouchableOpacity>
                {availableCategories.map((c) => {
                  const tone = categoryPillTone(c.key, colors);
                  const active = category === c.key;
                  return (
                    <TouchableOpacity
                      key={c.key}
                      style={[styles.filterPill, { backgroundColor: active ? colors.darkGreen : tone.bg }]}
                      onPress={() => setCategory(active ? 'all' : c.key)}
                    >
                      <Ionicons name={c.icon} size={13} color={active ? colors.white : tone.fg} />
                      <Text style={active ? styles.filterTextActive : [styles.filterText, { color: colors.textPrimary }]}>
                        {REWARD_CATEGORY_LABELS[c.key]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}

            {filteredRewards.length === 0 ? (
              <Text style={styles.noResultsText}>No rewards match your search.</Text>
            ) : (
              <View style={styles.grid}>
                {/* Paired rows with stretch alignment, rather than a flex-wrap grid of
                    fixed-width cards, so two cards in the same row always match height —
                    a flex-wrap grid leaves a reward with many redeem-price options
                    (more variant chips) visibly taller than its row neighbor. */}
                {chunk(filteredRewards, 2).map((pair, rowIndex) => (
                  <React.Fragment key={pair[0].id}>
                    <View style={styles.gridRow}>
                      {pair.map((reward) => (
                        <RewardCard
                          key={reward.id}
                          reward={reward}
                          style={styles.card}
                          onRedeem={(variantId) => handleRedeem(reward, variantId)}
                        />
                      ))}
                      {/* Odd one out: reserve the second column's space so a lone
                          trailing card stays half-width instead of stretching full-row. */}
                      {pair.length === 1 ? <View style={styles.card} /> : null}
                    </View>
                    {rowIndex === 0 ? <AdSpace placement="rewardsShop" style={styles.adSpace} /> : null}
                  </React.Fragment>
                ))}
              </View>
            )}
          </>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  header: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
  },
  headerTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.white },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.lime,
  },
  content: { paddingHorizontal: screenPadding, paddingTop: spacing.lg },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.inputBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  searchInput: { flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.small, color: colors.textPrimary, padding: 0 },
  filterRow: { gap: spacing.sm, paddingTop: spacing.md },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.mintBgAlt,
  },
  filterPillActive: { backgroundColor: colors.darkGreen },
  filterText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.small - 1 },
  filterTextActive: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.small - 1, color: colors.white },
  noResultsText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  grid: { gap: spacing.md, marginTop: spacing.lg },
  gridRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
  card: { flex: 1 },
  adSpace: { width: '100%' },
  emptyState: { alignItems: 'center', paddingTop: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.xs },
  emptyTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.cardTitle, color: colors.textPrimary, marginTop: spacing.sm },
  emptyBody: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
}
