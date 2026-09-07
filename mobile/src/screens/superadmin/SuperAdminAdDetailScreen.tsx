import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { BarChart } from '../../components/common/BarChart';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { AdminApiError, downloadSuperAdminAdClickLog } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { AdClickLogRow, AdTrendPoint } from '../../data/adminTypes';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminAdDetail'>;

type Period = 'month' | 'year' | 'all';
const PERIOD_LABELS: Record<Period, string> = { month: 'Month', year: 'Year', all: 'All' };
const PERIODS: Period[] = ['month', 'year', 'all'];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function computeCtr(clicks: number, impressions: number): number {
  if (impressions === 0) return 0;
  return Math.round((clicks / impressions) * 1000) / 10;
}

// One ad's own detail — the trend and click log behind its row on the
// Ad Performance report. Impressions aren't itemized (see getAdClickLog
// server-side) — only clicks get a per-event log; impressions stay a
// count/trend line.
export function SuperAdminAdDetailScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDesktop = useIsDesktopNav();
  const { adId, adTitle } = route.params;
  const { getSuperAdminAdTrend, getSuperAdminAdClickLog } = useAdmin();
  const [period, setPeriod] = useState<Period>(route.params.period);
  const [trend, setTrend] = useState<AdTrendPoint[]>([]);
  const [clickLog, setClickLog] = useState<AdClickLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(
    async (p: Period) => {
      setLoading(true);
      try {
        const [trendPoints, log] = await Promise.all([getSuperAdminAdTrend(p, adId), getSuperAdminAdClickLog(adId, p)]);
        setTrend(trendPoints);
        setClickLog(log);
      } catch (err) {
        const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
        showAlert('Couldn’t load ad detail', message);
      } finally {
        setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [adId],
  );

  useFocusEffect(
    useCallback(() => {
      load(period);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [adId]),
  );

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    load(p);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const slug = adTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'ad';
      const downloaded = await downloadSuperAdminAdClickLog(adId, period, `${slug}-clicks-${period}.xlsx`);
      if (!downloaded) {
        showAlert('Web only for now', 'Excel export is available on the Flagrr web app — open this page in a browser to download this report.');
      }
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t generate report', message);
    } finally {
      setExporting(false);
    }
  };

  const totalClicks = trend.reduce((sum, t) => sum + t.clicks, 0);
  const totalImpressions = trend.reduce((sum, t) => sum + t.impressions, 0);
  const ctr = computeCtr(totalClicks, totalImpressions);

  const periodToggle = (
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
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminReports" breadcrumb={adTitle} headerRight={periodToggle} showRail={false}>
        <Text style={styles.dPageTitle}>{adTitle}</Text>
        {loading ? (
          <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            <View style={styles.summaryRow}>
              <View style={styles.summaryTile}>
                <Text style={styles.summaryValue}>{totalClicks.toLocaleString()}</Text>
                <Text style={styles.summaryLabel}>Clicks</Text>
              </View>
              <View style={styles.summaryTile}>
                <Text style={styles.summaryValue}>{totalImpressions.toLocaleString()}</Text>
                <Text style={styles.summaryLabel}>Impressions</Text>
              </View>
              <View style={styles.summaryTile}>
                <Text style={styles.summaryValue}>{ctr}%</Text>
                <Text style={styles.summaryLabel}>CTR</Text>
              </View>
            </View>

            <DesktopPanel title="Trend">
              <Text style={styles.chartTitle}>Clicks Over Time</Text>
              <BarChart data={trend.map((t) => ({ month: t.label, value: t.clicks }))} />
              <View style={{ height: spacing.md }} />
              <Text style={styles.chartTitle}>Impressions Over Time</Text>
              <BarChart data={trend.map((t) => ({ month: t.label, value: t.impressions }))} />
            </DesktopPanel>

            <DesktopPanel title="Click Log" onViewAll={handleExport} viewAllLabel={exporting ? 'Exporting…' : 'Export Excel'}>
              {clickLog.length === 0 ? (
                <Text style={styles.emptyText}>No clicks in this period.</Text>
              ) : (
                clickLog.map((c) => (
                  <View key={c.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowLabel} numberOfLines={1}>{c.memberName ?? 'Deleted member'}</Text>
                      {c.memberEmail ? <Text style={styles.rowSubtext}>{c.memberEmail}</Text> : null}
                    </View>
                    <Text style={styles.rowValue}>{formatDate(c.clickedAt)}</Text>
                  </View>
                ))
              )}
            </DesktopPanel>
          </>
        )}
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title={adTitle} onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <View style={styles.toolbar}>{periodToggle}</View>

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryValue}>{totalClicks.toLocaleString()}</Text>
              <Text style={styles.summaryLabel}>Clicks</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryValue}>{totalImpressions.toLocaleString()}</Text>
              <Text style={styles.summaryLabel}>Impressions</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryValue}>{ctr}%</Text>
              <Text style={styles.summaryLabel}>CTR</Text>
            </View>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Clicks Over Time</Text>
            <BarChart data={trend.map((t) => ({ month: t.label, value: t.clicks }))} />
            <View style={{ height: spacing.md }} />
            <Text style={styles.chartTitle}>Impressions Over Time</Text>
            <BarChart data={trend.map((t) => ({ month: t.label, value: t.impressions }))} />
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Click Log</Text>
            <TouchableOpacity style={styles.exportButton} onPress={handleExport} disabled={exporting}>
              {exporting ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={16} color={colors.white} />
                  <Text style={styles.exportButtonText}>Excel</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            {clickLog.length === 0 ? (
              <Text style={styles.emptyText}>No clicks in this period.</Text>
            ) : (
              clickLog.map((c) => (
                <View key={c.id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel} numberOfLines={1}>{c.memberName ?? 'Deleted member'}</Text>
                    {c.memberEmail ? <Text style={styles.rowSubtext}>{c.memberEmail}</Text> : null}
                  </View>
                  <Text style={styles.rowValue}>{formatDate(c.clickedAt)}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  content: { padding: screenPadding, paddingBottom: spacing.xl * 2 },
  toolbar: { paddingHorizontal: screenPadding, paddingTop: spacing.md, paddingBottom: spacing.sm },
  periodToggle: { flexDirection: 'row', backgroundColor: colors.mintBg, borderRadius: radius.pill, padding: 3, alignSelf: 'flex-start' },
  periodPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  periodPillActive: { backgroundColor: colors.darkGreen },
  periodText: { fontFamily: fontFamily.heading, fontSize: 12, color: colors.textPrimary },
  periodTextActive: { color: colors.white },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  summaryTile: {
    flex: 1,
    backgroundColor: colors.mintBg,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  summaryValue: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.textPrimary },
  summaryLabel: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 2 },
  chartCard: {
    backgroundColor: colors.mintBg,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  chartTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.small, color: colors.textPrimary, marginBottom: spacing.md },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.textPrimary },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.clubGreen,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  exportButtonText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.white },
  card: {
    backgroundColor: colors.mintBg,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  rowLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  rowSubtext: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 2 },
  rowValue: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  emptyText: { fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.textSecondary },
  dPageTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.textPrimary },
});
}
