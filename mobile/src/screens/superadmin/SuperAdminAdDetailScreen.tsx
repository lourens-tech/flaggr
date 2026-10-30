import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { BarChart } from '../../components/common/BarChart';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { DesktopStatCard } from '../../components/admin/desktop/DesktopStatCard';
import { AdminButton, ErrorState, PageTitle, Segmented, SkeletonRows, Tile } from '../../components/admin/ui';
import { AdminApiError, downloadSuperAdminAdClickLog } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { AdClickLogRow, AdTrendPoint } from '../../data/adminTypes';
import { adminFont, tabularNums, type AdminColors } from '../../theme/admin';

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
export function SuperAdminAdDetailScreen({ route }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { adId, adTitle } = route.params;
  const { getSuperAdminAdTrend, getSuperAdminAdClickLog } = useAdmin();
  const [period, setPeriod] = useState<Period>(route.params.period);
  const [trend, setTrend] = useState<AdTrendPoint[]>([]);
  const [clickLog, setClickLog] = useState<AdClickLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(
    async (p: Period) => {
      setLoading(true);
      setLoadError(false);
      try {
        const [trendPoints, log] = await Promise.all([getSuperAdminAdTrend(p, adId), getSuperAdminAdClickLog(adId, p)]);
        setTrend(trendPoints);
        setClickLog(log);
      } catch (err) {
        setLoadError(true);
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
    <Segmented
      accessibilityLabel="Period"
      options={PERIODS.map((p) => ({ key: p, label: PERIOD_LABELS[p] }))}
      value={period}
      onChange={handlePeriodChange}
    />
  );

  const clickRows =
    clickLog.length === 0 ? (
      <Text style={styles.emptyText}>No clicks in this period.</Text>
    ) : (
      clickLog.map((row, i) => (
        <View key={row.id} style={[styles.row, i > 0 && styles.rowRule]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.rowLabel, !row.memberName && styles.rowLabelDeleted]} numberOfLines={1}>{row.memberName ?? 'Deleted member'}</Text>
            {row.memberEmail ? <Text style={styles.rowSubtext} numberOfLines={1}>{row.memberEmail}</Text> : null}
          </View>
          <Text style={[styles.rowValue, { flexShrink: 0 }]}>{formatDate(row.clickedAt)}</Text>
        </View>
      ))
    );

  const clicksChart = (
    <>
      <Text style={styles.chartTitle}>Clicks Over Time</Text>
      <BarChart data={trend.map((t) => ({ month: t.label, value: t.clicks }))} />
    </>
  );
  const impressionsChart = (
    <>
      <Text style={styles.chartTitle}>Impressions Over Time</Text>
      <BarChart data={trend.map((t) => ({ month: t.label, value: t.impressions }))} />
    </>
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminReports" breadcrumb={`Reports › ${adTitle}`} headerRight={periodToggle} showRail={false}>
        <PageTitle>{adTitle}</PageTitle>
        {loadError ? (
          <View style={styles.dBlock}>
            <ErrorState onRetry={() => load(period)} />
          </View>
        ) : loading ? (
          <Tile style={styles.dBlock}>
            <SkeletonRows rows={4} />
          </Tile>
        ) : (
          <>
            <View style={styles.dStrip}>
              <DesktopStatCard label="Clicks" value={totalClicks.toLocaleString()} icon="hand-left-outline" />
              <DesktopStatCard label="Impressions" value={totalImpressions.toLocaleString()} icon="eye-outline" />
              <DesktopStatCard label="CTR" value={`${ctr}%`} icon="analytics-outline" />
            </View>

            <View style={styles.dCharts}>
              <Tile style={styles.dChart}>{clicksChart}</Tile>
              <Tile style={styles.dChart}>{impressionsChart}</Tile>
            </View>

            <DesktopPanel title="Click Log" onViewAll={handleExport} viewAllLabel={exporting ? 'Exporting…' : 'Export Excel'} style={styles.dBlock}>
              <View>{clickRows}</View>
            </DesktopPanel>
          </>
        )}
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title={adTitle} />

      <View style={styles.toolbar}>{periodToggle}</View>

      {loadError ? (
        <View style={styles.content}>
          <ErrorState onRetry={() => load(period)} />
        </View>
      ) : loading ? (
        <View style={styles.content}>
          <Tile>
            <SkeletonRows rows={4} />
          </Tile>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Tile style={styles.summaryRow}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>{totalClicks.toLocaleString()}</Text>
              <Text style={styles.summaryLabel}>Clicks</Text>
            </View>
            <View style={[styles.summaryStat, styles.summaryRule]}>
              <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>{totalImpressions.toLocaleString()}</Text>
              <Text style={styles.summaryLabel}>Impressions</Text>
            </View>
            <View style={[styles.summaryStat, styles.summaryRule]}>
              <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>{ctr}%</Text>
              <Text style={styles.summaryLabel}>CTR</Text>
            </View>
          </Tile>

          <Tile>
            {clicksChart}
            <View style={{ height: 16 }} />
            {impressionsChart}
          </Tile>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Click Log</Text>
            <AdminButton label="Excel" icon="download-outline" variant="glass" onPress={handleExport} loading={exporting} style={{ height: 44 }} />
          </View>
          <Tile padded={false} style={styles.listTile}>
            <View style={styles.listInner}>{clickRows}</View>
          </Tile>
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 48, gap: 14 },
  toolbar: { paddingHorizontal: 16, paddingBottom: 12 },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 14 },
  summaryStat: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  summaryRule: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: c.edge },
  summaryValue: { ...adminFont.bodyBold, ...tabularNums, fontSize: 24, letterSpacing: -0.5, color: c.ink },
  summaryLabel: { ...adminFont.body, fontSize: 12.5, color: c.ink2, marginTop: 2 },
  chartTitle: { ...adminFont.bodyBold, fontSize: 15, color: c.ink, marginBottom: 14 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { ...adminFont.bodyBold, fontSize: 17, color: c.ink },
  listTile: { overflow: 'hidden' },
  listInner: { paddingHorizontal: 16, paddingVertical: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 8 },
  rowRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },
  rowLabel: { ...adminFont.bodySemiBold, fontSize: 15, color: c.ink },
  rowLabelDeleted: { ...adminFont.body, fontStyle: 'italic', color: c.ink2 },
  rowSubtext: { ...adminFont.body, fontSize: 13, color: c.ink2, marginTop: 2 },
  rowValue: { ...adminFont.body, ...tabularNums, fontSize: 13, color: c.ink2 },
  emptyText: { ...adminFont.body, fontSize: 14, color: c.ink2, textAlign: 'center', paddingVertical: 24 },
  dBlock: { marginTop: 16 },
  dStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 },
  dCharts: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  dChart: { flexGrow: 1, flexBasis: 360 },
});
}
