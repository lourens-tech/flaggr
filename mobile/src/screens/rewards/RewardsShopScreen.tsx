import React from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { HeaderAvatar } from '../../components/common/HeaderAvatar';
import { RewardCard } from '../../components/common/RewardCard';
import { showAlert } from '../../utils/alert';
import { colors, fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import type { Reward } from '../../data/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Rewards'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function RewardsShopScreen({ navigation }: Props) {
  const { rewards, points, redeemReward, unreadNotificationCount } = useApp();

  const handleRedeem = (reward: Reward, variantId: string) => {
    const variant = reward.variants.find((v) => v.id === variantId);
    if (!variant) return;
    const label = variant.label === 'Standard' ? reward.title : `${reward.title} (${variant.label})`;
    if (points.balance < variant.cost) {
      showAlert(
        'Not enough Flagrr Bucks',
        `You need ${variant.cost - points.balance} more Flagrr Bucks to redeem ${label}.`,
      );
      return;
    }
    showAlert('Redeem reward?', `Use ${variant.cost} Flagrr Bucks to redeem ${label}?`, [
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
        <View style={styles.grid}>
          {rewards.map((reward, i) => (
            <React.Fragment key={reward.id}>
              <RewardCard
                reward={reward}
                style={styles.card}
                onRedeem={(variantId) => handleRedeem(reward, variantId)}
              />
              {i === 1 ? (
                <View style={styles.adSpace}>
                  <Text style={styles.adSpaceText}>Ad Space</Text>
                </View>
              ) : null}
            </React.Fragment>
          ))}
        </View>
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
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
  adSpace: {
    width: '100%',
    height: 90,
    backgroundColor: colors.darkGreen,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adSpaceText: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.lime },
});
