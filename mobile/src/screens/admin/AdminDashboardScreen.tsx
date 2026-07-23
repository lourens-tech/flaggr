import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList, AdminTabParamList } from '../../navigation/types';
import { StatCard } from '../../components/common/StatCard';
import { BarChart } from '../../components/common/BarChart';
import { AdminHeaderAvatar } from '../../components/common/AdminHeaderAvatar';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { downloadCsvReport, AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { colors, fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import type { AdminMember } from '../../data/adminTypes';

type Period = 'month' | 'year' | 'all';
const PERIOD_LABELS: Record<Period, string> = { month: 'Month', year: 'Year', all: 'All' };
const PERIODS: Period[] = ['month', 'year', 'all'];

type ReportKind = 'redemptions' | 'receipts' | 'members';
const REPORT_KINDS: ReportKind[] = ['redemptions', 'receipts', 'members'];
const REPORT_LABELS: Record<ReportKind, string> = {
  redemptions: 'Redemptions',
  receipts: 'Receipts',
  members: 'Members',
};
const REPORT_ICONS: Record<ReportKind, keyof typeof Ionicons.glyphMap> = {
  redemptions: 'pricetag-outline',
  receipts: 'receipt-outline',
  members: 'people-outline',
};

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabParamList, 'AdminDashboard'>,
  NativeStackScreenProps<AdminStackParamList>
>;

export function AdminDashboardScreen({ navigation }: Props) {
  const {
    course,
    dashboard,
    dashboardPeriod,
    dashboardLoading,
    setDashboardPeriod,
    refreshDashboard,
    unreadNotificationCount,
    searchMembers,
  } = useAdmin();
  const [exporting, setExporting] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<AdminMember[]>([]);
  const [searchingMembers, setSearchingMembers] = useState(false);

  useEffect(() => {
    refreshDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchMembers = async () => {
    setSearchingMembers(true);
    try {
      setMemberResults(await searchMembers(memberSearch.trim()));
    } catch {
      setMemberResults([]);
    } finally {
      setSearchingMembers(false);
    }
  };

  const handleExport = async (report: ReportKind) => {
    setExporting(report);
    try {
      const downloaded = await downloadCsvReport(report, dashboardPeriod);
      if (!downloaded) {
        showAlert('Web only for now', 'CSV export is available on the Flagrr web app — open your dashboard in a browser to download this report.');
      }
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t generate report', message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{course.name || 'Reports'}</Text>
            <Text style={styles.headerSubtitle}>Course Admin</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => navigation.navigate('AdminNotifications')}
              style={styles.bellButton}
              accessibilityLabel="Notifications"
              accessibilityRole="button"
            >
              <Ionicons name="notifications" size={20} color={colors.white} />
              {unreadNotificationCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadNotificationCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('AdminCourseProfile')}>
              <AdminHeaderAvatar logoUrl={course.logoUrl} size={32} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {course.coverImageUrl ? (
          <Image source={{ uri: course.coverImageUrl }} style={styles.coverImage} />
        ) : null}

        <View style={styles.statsHeaderRow}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.periodToggle}>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setDashboardPeriod(p)}
                style={[styles.periodPill, dashboardPeriod === p && styles.periodPillActive]}
              >
                <Text style={[styles.periodText, dashboardPeriod === p && styles.periodTextActive]}>{PERIOD_LABELS[p]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {dashboardLoading && !dashboard ? (
          <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
        ) : dashboard ? (
          <>
            <View style={styles.statsGrid}>
              <View style={styles.statsRow}>
                <StatCard label="Members" value={dashboard.totals.members} deltaPct={0} fill backgroundColor={colors.mintBg} />
                <StatCard label="New Members" value={dashboard.totals.newMembers} deltaPct={0} fill backgroundColor={colors.mintBg} />
              </View>
              <View style={styles.statsRow}>
                <StatCard
                  label="Flagrr Cash Earned"
                  value={dashboard.totals.fcEarned.toLocaleString()}
                  deltaPct={dashboard.totals.fcEarnedDeltaPct}
                  fill
                  backgroundColor={colors.mintBg}
                />
                <StatCard
                  label="Flagrr Cash Redeemed"
                  value={dashboard.totals.fcRedeemed.toLocaleString()}
                  deltaPct={dashboard.totals.fcRedeemedDeltaPct}
                  fill
                  backgroundColor={colors.mintBg}
                />
              </View>
              <StatCard
                label="Receipts Scanned"
                value={dashboard.totals.receiptsScanned}
                deltaPct={dashboard.totals.receiptsScannedDeltaPct}
                width="100%"
                backgroundColor={colors.mintBg}
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

            <Text style={styles.sectionTitle}>Pull a Report</Text>
            <View style={styles.card}>
              <View style={styles.reportGrid}>
                {REPORT_KINDS.map((report) => (
                  <TouchableOpacity
                    key={report}
                    style={styles.reportTile}
                    onPress={() => handleExport(report)}
                    disabled={exporting === report}
                  >
                    <Ionicons name={REPORT_ICONS[report]} size={26} color={colors.clubGreen} />
                    <Text style={styles.reportTileLabel}>{REPORT_LABELS[report]}</Text>
                    {exporting === report ? (
                      <View style={styles.reportTileOverlay}>
                        <ActivityIndicator color={colors.clubGreen} size="small" />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={styles.sectionTitle}>Look Up a Member</Text>
            <View style={styles.card}>
              <TextField
                placeholder="Search by name or email"
                variant="onLight"
                value={memberSearch}
                onChangeText={setMemberSearch}
                onSubmitEditing={handleSearchMembers}
                returnKeyType="search"
              />
              <PillButton label="Search" icon="search" variant="outline" onPress={handleSearchMembers} loading={searchingMembers} />
              {memberResults.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={styles.memberRow}
                  onPress={() => navigation.navigate('AdminMemberStats', { memberId: m.id })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{m.firstName} {m.lastName}</Text>
                    <Text style={styles.memberEmail}>{m.email}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.memberTier}>{m.tier}</Text>
                    <Text style={styles.memberBalance}>{m.balance.toLocaleString()} FC</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.clubGreen} />
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  header: {
    paddingHorizontal: screenPadding,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontFamily: fontFamily.headingDisplay, fontSize: fontSize.title, color: colors.white },
  headerSubtitle: { fontFamily: fontFamily.body, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
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
  content: { padding: screenPadding, paddingBottom: spacing.xl * 2 },
  coverImage: {
    width: '100%',
    height: 280,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
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
  periodText: { fontFamily: fontFamily.heading, fontSize: 12, color: colors.darkGreen },
  periodTextActive: { color: colors.white },
  statsGrid: { gap: spacing.sm, marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', gap: 10 },
  sectionTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.darkGreen, marginBottom: spacing.sm },
  chartCard: {
    backgroundColor: colors.mintBg,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  chartTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.small, color: colors.darkGreen, marginBottom: spacing.md },
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
  rowValue: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.darkGreen },
  reportGrid: { flexDirection: 'row', gap: spacing.sm },
  reportTile: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: colors.white,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  reportTileLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.darkGreen, textAlign: 'center' },
  reportTileOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  memberName: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  memberEmail: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  memberTier: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.darkGreen },
  memberBalance: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
});
