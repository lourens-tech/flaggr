import React, { useState, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { StatCard } from '../../components/common/StatCard';
import { BarChart } from '../../components/common/BarChart';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { SuperAdminMemberStats } from '../../data/adminTypes';

type Period = 'month' | 'year' | 'all';
const PERIOD_LABELS: Record<Period, string> = { month: 'Month', year: 'Year', all: 'All' };
const PERIODS: Period[] = ['month', 'year', 'all'];
const DELTA_LABELS: Record<Period, string> = { month: 'vs Last Month', year: 'vs Last Year', all: '' };

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminMemberStats'>;

// Same shape/look as AdminMemberStatsScreen (a course_admin looking up one of
// their own members), just reachable for any member platform-wide — see
// SuperAdminReportsScreen's "Look Up a Member" section.
export function SuperAdminMemberStatsScreen({ route, navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { memberId } = route.params;
  const { getSuperAdminMemberStats } = useAdmin();
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<SuperAdminMemberStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (p: Period) => {
    setLoading(true);
    try {
      setData(await getSuperAdminMemberStats(memberId, p));
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t load member', message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    load(p);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {data ? `${data.member.firstName} ${data.member.lastName}` : 'Member Stats'}
            </Text>
            {data ? (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {data.member.email} · {data.member.courseName}
              </Text>
            ) : null}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsHeaderRow}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.periodToggle}>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => handlePeriodChange(p)}
                style={[styles.periodPill, period === p && styles.periodPillActive]}
              >
                <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{PERIOD_LABELS[p]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {loading && !data ? (
          <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
        ) : data ? (
          <>
            <View style={styles.tierRow}>
              <View style={styles.tierPill}>
                <Ionicons name="trophy-outline" size={14} color={colors.textPrimary} />
                <Text style={styles.tierPillText}>{data.member.tier} Member</Text>
              </View>
              <Text style={styles.balanceText}>{data.member.balance.toLocaleString()} FC Balance</Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statsRow}>
                <StatCard
                  label="Rounds (9 Holes)"
                  value={data.stats.roundsPlayed9}
                  deltaPct={data.stats.roundsPlayed9DeltaPct}
                  deltaLabel={DELTA_LABELS[period]}
                  showDelta={period !== 'all'}
                  fill
                  backgroundColor={colors.mintBg}
                />
                <StatCard
                  label="Rounds (18 Holes)"
                  value={data.stats.roundsPlayed18}
                  deltaPct={data.stats.roundsPlayed18DeltaPct}
                  deltaLabel={DELTA_LABELS[period]}
                  showDelta={period !== 'all'}
                  fill
                  backgroundColor={colors.mintBg}
                />
              </View>
              <View style={styles.statsRow}>
                <StatCard
                  label="Flagrr Cash Earned"
                  value={data.stats.bucksEarned.toLocaleString()}
                  deltaPct={data.stats.bucksEarnedDeltaPct}
                  deltaLabel={DELTA_LABELS[period]}
                  showDelta={period !== 'all'}
                  fill
                  backgroundColor={colors.mintBg}
                />
                <StatCard
                  label="Flagrr Cash Redeemed"
                  value={data.stats.bucksRedeemed.toLocaleString()}
                  deltaPct={data.stats.bucksRedeemedDeltaPct}
                  deltaLabel={DELTA_LABELS[period]}
                  showDelta={period !== 'all'}
                  fill
                  backgroundColor={colors.mintBg}
                />
              </View>
              <StatCard
                label="Receipts Scanned"
                value={data.stats.receiptsScanned}
                deltaPct={data.stats.receiptsScannedDeltaPct}
                deltaLabel={DELTA_LABELS[period]}
                showDelta={period !== 'all'}
                width="100%"
                backgroundColor={colors.mintBg}
              />
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Flagrr Cash Earned Per Month</Text>
              <BarChart data={data.stats.monthly} />
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  header: {
    paddingHorizontal: screenPadding,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fontFamily.headingDisplay, fontSize: fontSize.title, color: colors.white },
  headerSubtitle: { fontFamily: fontFamily.body, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  content: { padding: screenPadding, paddingBottom: spacing.xl * 2 },
  statsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  periodToggle: {
    flexDirection: 'row',
    backgroundColor: colors.mintBg,
    borderRadius: radius.pill,
    padding: 3,
  },
  periodPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  periodPillActive: { backgroundColor: colors.darkGreen },
  periodText: { fontFamily: fontFamily.heading, fontSize: 12, color: colors.textPrimary },
  periodTextActive: { color: colors.white },
  sectionTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.textPrimary, marginBottom: spacing.sm },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.mintBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  tierPillText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.textPrimary },
  balanceText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  statsGrid: { gap: spacing.sm, marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', gap: 10 },
  chartCard: {
    backgroundColor: colors.mintBg,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  chartTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.small, color: colors.textPrimary, marginBottom: spacing.md },
});
}
