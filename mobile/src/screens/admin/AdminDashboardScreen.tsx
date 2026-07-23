import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatCard } from '../../components/common/StatCard';
import { BarChart } from '../../components/common/BarChart';
import { useAdmin } from '../../context/AdminContext';
import { downloadCsvReport, AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { colors, fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';

type Period = 'month' | 'year' | 'all';
const PERIOD_LABELS: Record<Period, string> = { month: 'Month', year: 'Year', all: 'All' };
const PERIODS: Period[] = ['month', 'year', 'all'];

export function AdminDashboardScreen() {
  const { course, dashboard, dashboardPeriod, dashboardLoading, setDashboardPeriod, refreshDashboard } = useAdmin();
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    refreshDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = async (report: 'redemptions' | 'receipts' | 'members') => {
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
          <Text style={styles.headerTitle}>{course.name || 'Reports'}</Text>
          <Text style={styles.headerSubtitle}>Course Admin</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

        {dashboardLoading && !dashboard ? (
          <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
        ) : dashboard ? (
          <>
            <View style={styles.statsGrid}>
              <StatCard label="Members" value={dashboard.totals.members} deltaPct={0} width="47%" />
              <StatCard label="New Members" value={dashboard.totals.newMembers} deltaPct={0} width="47%" />
              <StatCard label="Flagrr Cash Earned" value={dashboard.totals.fcEarned.toLocaleString()} deltaPct={dashboard.totals.fcEarnedDeltaPct} />
              <StatCard label="Flagrr Cash Redeemed" value={dashboard.totals.fcRedeemed.toLocaleString()} deltaPct={dashboard.totals.fcRedeemedDeltaPct} />
              <StatCard label="Receipts Scanned" value={dashboard.totals.receiptsScanned} deltaPct={dashboard.totals.receiptsScannedDeltaPct} width="100%" />
            </View>

            <Text style={styles.sectionTitle}>Members Joined This Year</Text>
            <View style={styles.card}>
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

            <Text style={styles.sectionTitle}>Ad Performance</Text>
            <View style={styles.card}>
              {dashboard.adPerformance.length === 0 ? (
                <Text style={styles.emptyText}>No ads configured yet.</Text>
              ) : (
                dashboard.adPerformance.map((a) => (
                  <View key={a.adId} style={styles.row}>
                    <Text style={styles.rowLabel} numberOfLines={1}>{a.title || '(untitled ad)'}</Text>
                    <Text style={styles.rowValue}>{a.clicks} clicks</Text>
                  </View>
                ))
              )}
            </View>

            <Text style={styles.sectionTitle}>Pull a Report</Text>
            <View style={styles.card}>
              {(['redemptions', 'receipts', 'members'] as const).map((report) => (
                <TouchableOpacity
                  key={report}
                  style={styles.exportRow}
                  onPress={() => handleExport(report)}
                  disabled={exporting === report}
                >
                  <Ionicons name="download-outline" size={18} color={colors.clubGreen} />
                  <Text style={styles.exportLabel}>
                    {report === 'redemptions' ? 'Redemptions CSV' : report === 'receipts' ? 'Receipts CSV' : 'Members CSV'}
                  </Text>
                  {exporting === report ? <ActivityIndicator color={colors.clubGreen} size="small" /> : null}
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
  header: { paddingHorizontal: screenPadding, paddingVertical: spacing.md },
  headerTitle: { fontFamily: fontFamily.headingDisplay, fontSize: fontSize.title, color: colors.white },
  headerSubtitle: { fontFamily: fontFamily.body, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  content: { padding: screenPadding, paddingBottom: spacing.xl * 2 },
  periodToggle: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: colors.mintBgAlt,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.md,
  },
  periodPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  periodPillActive: { backgroundColor: colors.darkGreen },
  periodText: { fontFamily: fontFamily.heading, fontSize: 12, color: colors.darkGreen },
  periodTextActive: { color: colors.white },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.lg },
  sectionTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.cardTitle, color: colors.darkGreen, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.white,
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
  exportRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  exportLabel: { flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.textPrimary },
});
