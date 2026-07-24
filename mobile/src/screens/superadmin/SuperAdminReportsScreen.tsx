import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList, SuperAdminTabParamList } from '../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { StatCard } from '../../components/common/StatCard';
import { BarChart } from '../../components/common/BarChart';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { AdPerformanceRow, SuperAdminDashboardReport, SuperAdminMemberSearchResult } from '../../data/adminTypes';

type Props = CompositeScreenProps<
  BottomTabScreenProps<SuperAdminTabParamList, 'SuperAdminReports'>,
  NativeStackScreenProps<SuperAdminStackParamList>
>;

type Period = 'month' | 'year' | 'all';
const PERIOD_LABELS: Record<Period, string> = { month: 'Month', year: 'Year', all: 'All' };
const PERIODS: Period[] = ['month', 'year', 'all'];
const DELTA_LABELS: Record<Period, string> = { month: 'vs Last Month', year: 'vs Last Year', all: '' };
const PLACEMENT_LABELS: Record<string, string> = { home: 'Home', rewards_shop: 'Rewards Shop' };

// Same shape/look as AdminDashboardScreen, aggregated across every club
// instead of just one — plus an Ad Performance section, deliberately
// excluded from the course-admin dashboard and reserved for this screen.
export function SuperAdminReportsScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { getSuperAdminDashboard, getSuperAdminAdPerformance, searchSuperAdminMembers } = useAdmin();

  const [period, setPeriod] = useState<Period>('month');
  const [dashboard, setDashboard] = useState<SuperAdminDashboardReport | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [adPerformance, setAdPerformance] = useState<AdPerformanceRow[]>([]);
  const [adsLoading, setAdsLoading] = useState(true);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<SuperAdminMemberSearchResult[]>([]);
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [searchedOnce, setSearchedOnce] = useState(false);

  const loadDashboard = useCallback(async (p: Period) => {
    setDashboardLoading(true);
    try {
      setDashboard(await getSuperAdminDashboard(p));
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t load reports', message);
    } finally {
      setDashboardLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!cancelled) await loadDashboard(period);
      })();
      (async () => {
        setAdsLoading(true);
        try {
          const rows = await getSuperAdminAdPerformance();
          if (!cancelled) setAdPerformance(rows);
        } catch {
          if (!cancelled) setAdPerformance([]);
        } finally {
          if (!cancelled) setAdsLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    loadDashboard(p);
  };

  const handleSearchMembers = async () => {
    if (!memberSearch.trim()) return;
    setSearchingMembers(true);
    try {
      setMemberResults(await searchSuperAdminMembers(memberSearch.trim()));
      setSearchedOnce(true);
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t search members', message);
      setMemberResults([]);
    } finally {
      setSearchingMembers(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Reports</Text>
          <Text style={styles.headerSubtitle}>All Clubs</Text>
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

        {dashboardLoading && !dashboard ? (
          <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
        ) : dashboard ? (
          <>
            <View style={styles.statsGrid}>
              <StatCard label="Clubs" value={dashboard.totals.clubs} deltaPct={0} showDelta={false} width="100%" backgroundColor={colors.mintBg} />
              <View style={styles.statsRow}>
                <StatCard
                  label="Members"
                  value={dashboard.totals.members}
                  deltaPct={0}
                  showDelta={false}
                  fill
                  backgroundColor={colors.mintBg}
                  onPress={() => navigation.navigate('SuperAdminStatBreakdown', { metric: 'members', label: 'Members', period })}
                />
                <StatCard
                  label="New Members"
                  value={dashboard.totals.newMembers}
                  deltaPct={0}
                  showDelta={false}
                  fill
                  backgroundColor={colors.mintBg}
                  onPress={() => navigation.navigate('SuperAdminStatBreakdown', { metric: 'newMembers', label: 'New Members', period })}
                />
              </View>
              <View style={styles.statsRow}>
                <StatCard
                  label="Flagrr Cash Earned"
                  value={dashboard.totals.fcEarned.toLocaleString()}
                  deltaPct={dashboard.totals.fcEarnedDeltaPct}
                  deltaLabel={DELTA_LABELS[period]}
                  showDelta={period !== 'all'}
                  fill
                  backgroundColor={colors.mintBg}
                  onPress={() => navigation.navigate('SuperAdminStatBreakdown', { metric: 'fcEarned', label: 'Flagrr Cash Earned', period })}
                />
                <StatCard
                  label="Flagrr Cash Redeemed"
                  value={dashboard.totals.fcRedeemed.toLocaleString()}
                  deltaPct={dashboard.totals.fcRedeemedDeltaPct}
                  deltaLabel={DELTA_LABELS[period]}
                  showDelta={period !== 'all'}
                  fill
                  backgroundColor={colors.mintBg}
                  onPress={() => navigation.navigate('SuperAdminStatBreakdown', { metric: 'fcRedeemed', label: 'Flagrr Cash Redeemed', period })}
                />
              </View>
              <StatCard
                label="Receipts Scanned"
                value={dashboard.totals.receiptsScanned}
                deltaPct={dashboard.totals.receiptsScannedDeltaPct}
                deltaLabel={DELTA_LABELS[period]}
                showDelta={period !== 'all'}
                width="100%"
                backgroundColor={colors.mintBg}
                onPress={() => navigation.navigate('SuperAdminStatBreakdown', { metric: 'receiptsScanned', label: 'Receipts Scanned', period })}
              />
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Members Joined This Year</Text>
              <BarChart data={dashboard.signupsByMonth} />
            </View>

            <Text style={styles.sectionTitle}>Tier Distribution</Text>
            <View style={styles.card}>
              {dashboard.tierDistribution.length === 0 ? (
                <Text style={styles.emptyText}>No members yet.</Text>
              ) : (
                dashboard.tierDistribution.map((t) => (
                  <View key={t.tier} style={styles.row}>
                    <Text style={styles.rowLabel}>{t.tier}</Text>
                    <Text style={styles.rowValue}>{t.count}</Text>
                  </View>
                ))
              )}
            </View>

            <Text style={styles.sectionTitle}>Top Redeemed Rewards</Text>
            <View style={styles.card}>
              {dashboard.topRewards.length === 0 ? (
                <Text style={styles.emptyText}>No redemptions in this period.</Text>
              ) : (
                dashboard.topRewards.map((r) => (
                  <View key={r.rewardId} style={styles.row}>
                    <Text style={styles.rowLabel} numberOfLines={1}>{r.title}</Text>
                    <Text style={styles.rowValue}>{r.redemptions}× · {r.fcSpent.toLocaleString()} FC</Text>
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Ad Performance</Text>
        <View style={styles.card}>
          {adsLoading ? (
            <ActivityIndicator color={colors.clubGreen} />
          ) : adPerformance.length === 0 ? (
            <Text style={styles.emptyText}>No ads running yet.</Text>
          ) : (
            adPerformance.map((a) => (
              <View key={a.adId} style={styles.adRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel} numberOfLines={1}>{a.title || '(untitled ad)'}</Text>
                  <Text style={styles.adSubtext}>
                    {a.courseName} · {PLACEMENT_LABELS[a.placement] ?? a.placement}{a.active ? '' : ' · inactive'}
                  </Text>
                </View>
                <Text style={styles.rowValue}>{a.clicks} clicks</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>Look Up a Member</Text>
        <View style={styles.card}>
          <TextField
            placeholder="Search by name or email, any club"
            variant="onLight"
            value={memberSearch}
            onChangeText={setMemberSearch}
            onSubmitEditing={handleSearchMembers}
            returnKeyType="search"
          />
          <PillButton label="Search" icon="search" variant="outline" onPress={handleSearchMembers} loading={searchingMembers} />
          {searchedOnce && memberResults.length === 0 ? (
            <Text style={styles.emptyText}>No members match that search.</Text>
          ) : (
            memberResults.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={styles.memberRow}
                onPress={() => navigation.navigate('SuperAdminMemberStats', { memberId: m.id })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{m.firstName} {m.lastName}</Text>
                  <Text style={styles.memberEmail}>{m.email} · {m.courseName}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.memberTier}>{m.tier}</Text>
                  <Text style={styles.memberBalance}>{m.balance.toLocaleString()} FC</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.clubGreen} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  header: { paddingHorizontal: screenPadding, paddingVertical: spacing.md },
  headerTitle: { fontFamily: fontFamily.headingDisplay, fontSize: fontSize.title, color: colors.white },
  headerSubtitle: { fontFamily: fontFamily.body, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  content: { padding: screenPadding, paddingBottom: spacing.xl * 2 },
  statsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  periodToggle: { flexDirection: 'row', backgroundColor: colors.mintBg, borderRadius: radius.pill, padding: 3 },
  periodPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  periodPillActive: { backgroundColor: colors.darkGreen },
  periodText: { fontFamily: fontFamily.heading, fontSize: 12, color: colors.textPrimary },
  periodTextActive: { color: colors.white },
  statsGrid: { gap: spacing.sm, marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', gap: 10 },
  sectionTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.textPrimary, marginBottom: spacing.sm },
  chartCard: {
    backgroundColor: colors.mintBg,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  chartTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.small, color: colors.textPrimary, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.mintBg,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  emptyText: { fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.textSecondary },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  rowLabel: { flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.textPrimary },
  rowValue: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  adRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  adSubtext: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 2 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  memberName: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  memberEmail: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  memberTier: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.textPrimary },
  memberBalance: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
});
}
