import React, { useCallback, useMemo } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { HeaderAvatar } from '../../components/common/HeaderAvatar';
import { RewardCard } from '../../components/common/RewardCard';
import { AdSpace } from '../../components/common/AdSpace';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { Reward } from '../../data/types';

const NOT_LISTED_POPUP_TITLE = "You're Almost In the Family";
const NOT_LISTED_POPUP_BODY =
  "We couldn't find your golf club on Flagrr yet, so there's no rewards catalogue to show you just yet. Ask your club to join Flagrr, or get in touch with our support team and we'll help make it happen.";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Rewards'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function RewardsShopScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, rewards, points, redeemReward, unreadNotificationCount } = useApp();

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
          <View style={styles.grid}>
            {rewards.map((reward, i) => (
              <React.Fragment key={reward.id}>
                <RewardCard
                  reward={reward}
                  style={styles.card}
                  onRedeem={(variantId) => handleRedeem(reward, variantId)}
                />
                {i === 1 ? <AdSpace placement="rewardsShop" style={styles.adSpace} /> : null}
              </React.Fragment>
            ))}
          </View>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.md },
  card: { width: '47%' },
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
