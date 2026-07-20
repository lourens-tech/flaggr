import React from 'react';
import { Alert, Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { colors, fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Rewards'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function RewardsShopScreen({ navigation }: Props) {
  const { rewards, points, redeemReward, unreadNotificationCount } = useApp();

  const handleRedeem = (rewardId: string, title: string, cost: number) => {
    if (points.balance < cost) {
      Alert.alert('Not enough Flagrr Bucks', `You need ${cost - points.balance} more Flagrr Bucks to redeem ${title}.`);
      return;
    }
    Alert.alert('Redeem reward?', `Use ${cost} Flagrr Bucks to redeem ${title}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Redeem',
        onPress: () => {
          const voucher = redeemReward(rewardId);
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
            <View style={styles.avatar}>
              <Ionicons name="person" size={18} color={colors.darkGreen} />
            </View>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {rewards.map((reward, i) => (
            <React.Fragment key={reward.id}>
              <View style={styles.card}>
                <Image source={{ uri: reward.imageUrl }} style={styles.image} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{reward.title}</Text>
                  <Text style={styles.cardDescription} numberOfLines={2}>{reward.description}</Text>
                  <Text style={styles.cardCost}>{reward.cost} Flagrr Bucks</Text>
                  <TouchableOpacity
                    style={styles.redeemButton}
                    onPress={() => handleRedeem(reward.id, reward.title, reward.cost)}
                  >
                    <Text style={styles.redeemButtonText}>Redeem Now</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.darkGreen} />
                  </TouchableOpacity>
                </View>
              </View>
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
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: screenPadding, paddingTop: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.md },
  card: {
    width: '47%',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    overflow: 'hidden',
  },
  image: { width: '100%', height: 100, backgroundColor: colors.imagePlaceholder },
  cardBody: { padding: spacing.sm + 4, gap: 4 },
  cardTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.cardTitle, color: colors.darkGreen },
  cardDescription: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, minHeight: 28 },
  cardCost: { fontFamily: fontFamily.heading, fontSize: fontSize.label, color: colors.darkGreen, marginBottom: 4 },
  redeemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.lime,
    borderRadius: radius.pill,
    paddingVertical: 10,
  },
  redeemButtonText: { fontFamily: fontFamily.heading, fontSize: 12, color: colors.darkGreen },
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
