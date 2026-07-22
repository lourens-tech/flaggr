import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../navigation/types';
import type { RootStackParamList } from '../../navigation/types';
import { ProgressBar } from '../../components/common/ProgressBar';
import { PillButton } from '../../components/common/PillButton';
import { StatCard } from '../../components/common/StatCard';
import { BarChart } from '../../components/common/BarChart';
import { RewardCard } from '../../components/common/RewardCard';
import { HeaderAvatar } from '../../components/common/HeaderAvatar';
import { AdSpace } from '../../components/common/AdSpace';
import { useApp } from '../../context/AppContext';
import { colors, fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import type { StatsPeriod } from '../../data/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

const PERIOD_LABELS: Record<StatsPeriod, string> = { month: 'Month', year: 'Year', all: 'All' };
const PERIODS: StatsPeriod[] = ['month', 'year', 'all'];

export function HomeScreen({ navigation }: Props) {
  const { user, points, streak, stats, rewards, unreadNotificationCount, statsPeriod, setStatsPeriod } = useApp();

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>Home</Text>
          <View style={styles.topBarRight}>
            <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.bellButton}>
              <Ionicons name="notifications" size={20} color={colors.white} />
              {unreadNotificationCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadNotificationCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
              <HeaderAvatar size={32} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.welcome}>Hello, {user.firstName} 👋</Text>

        <View style={styles.pointsCard}>
          <View style={styles.pointsHeaderRow}>
            <View style={styles.pointsSummary}>
              <MaterialCommunityIcons name="cards" size={20} color={colors.clubGreen} />
              <View>
                <Text style={styles.pointsValue}>{points.balance.toLocaleString()}</Text>
                <Text style={styles.pointsLabel}>Flagrr Cash</Text>
              </View>
            </View>
            <LinearGradient
              colors={[colors.goldGradientStart, colors.goldGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tierBadge}
            >
              <Text style={styles.tierBadgeText}>{user.tier} Member</Text>
              <MaterialCommunityIcons name="crown" size={13} color={colors.white} />
            </LinearGradient>
          </View>

          <ProgressBar progress={points.tierProgress} />
          <View style={styles.progressFooterRow}>
            <Text style={styles.progressFooterText}>
              {points.pointsToNextTier.toLocaleString()} pts to {points.nextTier}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('MemberTiers')}>
              <Ionicons name="information-circle-outline" size={16} color={colors.clubGreen} />
            </TouchableOpacity>
          </View>

          <PillButton
            label="Redeem Flagrr Cash"
            onPress={() => navigation.navigate('Rewards')}
            variant="primary"
          />

          <View style={styles.streakCard}>
            <View style={styles.streakIcon}>
              <Ionicons name="flame" size={26} color={colors.lime} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.streakTitle}>{streak.weeks}-Week Streak</Text>
              <Text style={styles.streakSubtitle}>
                {streak.weeks > 0
                  ? `You've played every week since ${new Date(streak.activeSince).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`
                  : 'Play a round this week to start your streak'}
              </Text>
              <View style={styles.streakDots}>
                {streak.weeksPlayed.map((played, i) => (
                  <View
                    key={i}
                    style={[styles.streakDot, { backgroundColor: played ? colors.lime : 'rgba(255,255,255,0.3)' }]}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.statsHeaderRow}>
          <Text style={styles.sectionTitle}>My Stats</Text>
          <View style={styles.periodToggle}>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setStatsPeriod(p)}
                style={[styles.periodPill, statsPeriod === p && styles.periodPillActive]}
              >
                <Text style={[styles.periodText, statsPeriod === p && styles.periodTextActive]}>
                  {PERIOD_LABELS[p]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Rounds Played (9 Holes)" value={stats.roundsPlayed9} deltaPct={stats.roundsPlayed9DeltaPct} />
          <StatCard label="Rounds Played (18 Holes)" value={stats.roundsPlayed18} deltaPct={stats.roundsPlayed18DeltaPct} />
          <StatCard label="Flagrr Cash Earned" value={stats.bucksEarned.toLocaleString()} deltaPct={stats.bucksEarnedDeltaPct} />
          <StatCard label="Flagrr Cash Redeemed" value={stats.bucksRedeemed.toLocaleString()} deltaPct={stats.bucksRedeemedDeltaPct} />
        </View>

        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Points Earned Per Month</Text>
          <BarChart data={stats.monthly} />
        </View>

        <AdSpace placement="home" style={styles.adSpace} />

        <View style={styles.rewardsHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Rewards</Text>
          <TouchableOpacity style={styles.viewAllRow} onPress={() => navigation.navigate('Rewards')}>
            <Text style={styles.viewAllText}>View All</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.clubGreen} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rewardsRow}>
          {rewards.slice(0, 3).map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              onPress={() => navigation.navigate('Rewards')}
            />
          ))}
        </ScrollView>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  safeArea: { backgroundColor: colors.clubGreen },
  topBar: {
    height: 62,
    backgroundColor: colors.clubGreen,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
  },
  topBarTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.white },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bellButton: { width: 23, height: 23, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: colors.lime,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontFamily: fontFamily.bodySemiBold, fontSize: 9, color: colors.darkGreen },
  scrollContent: { backgroundColor: colors.white },
  welcome: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.title,
    color: colors.white,
    backgroundColor: colors.clubGreen,
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.xl + spacing.md,
    paddingTop: spacing.sm,
  },
  pointsCard: {
    backgroundColor: colors.darkGreen,
    marginHorizontal: screenPadding,
    marginTop: -spacing.xl,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  pointsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pointsSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pointsValue: { fontFamily: fontFamily.heading, fontSize: 32, color: colors.white },
  pointsLabel: { fontFamily: fontFamily.body, fontSize: fontSize.small, color: colors.white },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  tierBadgeText: {
    fontFamily: fontFamily.heading,
    fontSize: 11,
    color: colors.white,
    textTransform: 'uppercase',
  },
  progressFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressFooterText: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: 'rgba(255,255,255,0.7)' },
  streakCard: {
    backgroundColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  streakIcon: {
    width: 54,
    height: 54,
    borderRadius: 11,
    backgroundColor: colors.darkGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.white },
  streakSubtitle: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.white, marginTop: 2 },
  streakDots: { flexDirection: 'row', gap: 4, marginTop: spacing.sm },
  streakDot: { width: 9, height: 9, borderRadius: 4.5 },
  statsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: screenPadding,
    marginTop: spacing.lg,
  },
  sectionTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.darkGreen },
  periodToggle: {
    flexDirection: 'row',
    backgroundColor: colors.mintBg,
    borderRadius: radius.pill,
    padding: 3,
  },
  periodPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  periodPillActive: { backgroundColor: colors.darkGreen },
  periodText: { fontFamily: fontFamily.heading, fontSize: 12, color: colors.darkGreen },
  periodTextActive: { color: colors.white },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  chartCard: {
    marginHorizontal: screenPadding,
    marginTop: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  chartTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.small, color: colors.darkGreen, marginBottom: spacing.md },
  adSpace: { marginHorizontal: screenPadding, marginTop: spacing.md },
  rewardsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: screenPadding,
    marginTop: spacing.lg,
  },
  viewAllRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewAllText: { fontFamily: fontFamily.heading, fontSize: fontSize.label, color: colors.clubGreen },
  rewardsRow: { paddingHorizontal: screenPadding, gap: spacing.sm, marginTop: spacing.sm },
});
