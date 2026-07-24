import React, { useState, useMemo } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { ProgressBar } from '../../components/common/ProgressBar';
import { useApp } from '../../context/AppContext';
import { memberTiers } from '../../data/mockData';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { TierName } from '../../data/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MemberTiers'>;

const STEPS = [
  { number: '01', title: 'Play', body: 'Play rounds at your club and stay active on Flagrr.' },
  { number: '02', title: 'Earn', body: 'Earn Flagrr Cash through qualifying activities.' },
  { number: '03', title: 'Upgrade', body: 'As your activity grows, unlock the next tier and enjoy enhanced benefits.' },
];

export function MemberTiersScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, points } = useApp();
  const [selectedTier, setSelectedTier] = useState<TierName>(user.tier);
  const tier = memberTiers.find((t) => t.name === selectedTier) ?? memberTiers[0];

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Member Tiers" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.pointsCard}>
          <View style={styles.pointsHeaderRow}>
            <View style={styles.pointsSummary}>
              <MaterialCommunityIcons name="cards" size={20} color={colors.clubGreen} />
              <Text style={styles.pointsValue}>{points.balance.toLocaleString()}</Text>
              <Text style={styles.pointsLabel}>Flagrr Cash</Text>
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
          <Text style={styles.progressFooterText}>
            {points.pointsToNextTier.toLocaleString()} pts to {points.nextTier}
          </Text>
        </View>

        {!user.verifiedMember ? (
          <View style={styles.unverifiedBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.darkGreen} />
            <Text style={styles.unverifiedBannerText}>
              Your club hasn't verified your membership yet, so tier progress is on hold — you can still earn and
              redeem Flagrr Cash as normal. Ask your golf club to add you to their member list.
            </Text>
          </View>
        ) : null}

        <View style={styles.howToSection}>
          <Text style={styles.howToTitle}>How to Reach the Next Tier</Text>
          <View style={styles.stepsRow}>
            {STEPS.map((step) => (
              <View key={step.number} style={styles.stepItem}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepNumber}>{step.number}</Text>
                </View>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.benefitsSection}>
          <Text style={styles.benefitsTitle}>Tier Benefits</Text>

          <View style={styles.tabRow}>
            {memberTiers.map((t) => (
              <TouchableOpacity key={t.name} onPress={() => setSelectedTier(t.name)} style={styles.tab}>
                <Text style={[styles.tabText, selectedTier === t.name && styles.tabTextActive]}>{t.name}</Text>
                {selectedTier === t.name ? <View style={styles.tabIndicator} /> : null}
              </TouchableOpacity>
            ))}
          </View>

          <LinearGradient
            colors={[colors.goldGradientStart, colors.goldGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.tierPill}
          >
            <Text style={styles.tierPillText}>{tier.name.toUpperCase()} MEMBER</Text>
            <MaterialCommunityIcons name="crown" size={13} color={colors.white} />
          </LinearGradient>

          <Text style={styles.tierDescription}>
            {tier.name} status recognises loyal players and gives them more value every time they play.
          </Text>

          {tier.perks.map((perk, i) => (
            <View key={i} style={styles.perkRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.clubGreen} />
              <Text style={styles.perkText}>{perk}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 140 }} />
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.darkGreen },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  pointsCard: {
    backgroundColor: colors.background,
    marginHorizontal: screenPadding,
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  pointsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pointsSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pointsValue: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.textPrimary },
  pointsLabel: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textPrimary },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  tierBadgeText: { fontFamily: fontFamily.heading, fontSize: 11, color: colors.white, textTransform: 'uppercase' },
  progressFooterText: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  unverifiedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.mintBg,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    marginHorizontal: screenPadding,
    marginTop: spacing.md,
  },
  unverifiedBannerText: { flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.darkGreen },
  howToSection: { paddingHorizontal: screenPadding, paddingTop: spacing.xl },
  howToTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.cardTitle, color: colors.lime, marginBottom: spacing.lg },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stepItem: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  stepNumber: { fontFamily: fontFamily.heading, fontSize: fontSize.small, color: colors.lime },
  stepTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.small, color: colors.white, marginBottom: 4 },
  stepBody: { fontFamily: fontFamily.body, fontSize: 10, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  benefitsSection: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    marginTop: spacing.xl,
    padding: screenPadding,
    minHeight: 500,
  },
  benefitsTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.textPrimary, marginBottom: spacing.md },
  tabRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  tab: { paddingBottom: spacing.sm },
  tabText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.small, color: colors.textSecondary },
  tabTextActive: { color: colors.textPrimary, fontFamily: fontFamily.bodySemiBold },
  tabIndicator: { height: 2, backgroundColor: colors.clubGreen, marginTop: 6, borderRadius: 1 },
  tierPill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  tierPillText: { fontFamily: fontFamily.heading, fontSize: 12, color: colors.white },
  tierDescription: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  perkRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, alignItems: 'flex-start' },
  perkText: { flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.small, color: colors.textPrimary, lineHeight: 20 },
});
}
