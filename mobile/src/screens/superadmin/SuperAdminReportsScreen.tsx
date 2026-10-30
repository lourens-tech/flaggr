import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { type CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList, SuperAdminTabParamList } from '../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { AdminStatCard } from '../../components/admin/AdminStatCard';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { BarChart } from '../../components/common/BarChart';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { useHover, hoverTransition } from '../../hooks/useHover';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { DesktopStatCard } from '../../components/admin/desktop/DesktopStatCard';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { TableAvatarCell, TableTag } from '../../components/admin/desktop/DesktopDataTable';
import { AdminButton, EmptyState, ErrorState, Muted, PageTitle, Segmented, SkeletonRows, Tile } from '../../components/admin/ui';
import {
  AdminApiError,
  downloadSuperAdminAdPerformance,
  downloadSuperAdminAdPerformanceByCourse,
  downloadSuperAdminAdPerformanceBySlot,
} from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type {
  AdCoursePerformanceRow,
  AdPerformanceRow,
  AdSlotPerformanceRow,
  AdTrendPoint,
  SuperAdminDashboardReport,
  SuperAdminMemberSearchResult,
} from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

type Props = CompositeScreenProps<
  BottomTabScreenProps<SuperAdminTabParamList, 'SuperAdminReports'>,
  NativeStackScreenProps<SuperAdminStackParamList>
>;

type Period = 'month' | 'year' | 'all';
const PERIOD_LABELS: Record<Period, string> = { month: 'Month', year: 'Year', all: 'All' };
const PERIODS: Period[] = ['month', 'year', 'all'];
const PERIOD_OPTIONS = PERIODS.map((p) => ({ key: p, label: PERIOD_LABELS[p] }));
const PLACEMENT_LABELS: Record<string, string> = { home: 'Home', home_top: 'Home (Top Banner)', rewards_shop: 'Rewards Shop' };

type AdView = 'combined' | 'slot' | 'course' | 'ad';
const AD_VIEWS: AdView[] = ['combined', 'slot', 'course', 'ad'];
const AD_VIEW_LABELS: Record<AdView, string> = { combined: 'Combined', slot: 'By Slot', course: 'By Club', ad: 'By Ad' };
const AD_VIEW_OPTIONS = AD_VIEWS.map((v) => ({ key: v, label: AD_VIEW_LABELS[v] }));

// Same shape/look as AdminDashboardScreen, aggregated across every club
// instead of just one — plus an Ad Performance section, deliberately
// excluded from the course-admin dashboard and reserved for this screen.
export function SuperAdminReportsScreen({ navigation }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const {
    getSuperAdminDashboard,
    getSuperAdminAdPerformance,
    getSuperAdminAdPerformanceBySlot,
    getSuperAdminAdPerformanceByCourse,
    getSuperAdminAdTrend,
    searchSuperAdminMembers,
  } = useAdmin();

  const [period, setPeriod] = useState<Period>('month');
  const [dashboard, setDashboard] = useState<SuperAdminDashboardReport | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [adView, setAdView] = useState<AdView>('combined');
  const [adPerformance, setAdPerformance] = useState<AdPerformanceRow[]>([]);
  const [adTrend, setAdTrend] = useState<AdTrendPoint[]>([]);
  const [adBySlot, setAdBySlot] = useState<AdSlotPerformanceRow[]>([]);
  const [adByCourse, setAdByCourse] = useState<AdCoursePerformanceRow[]>([]);
  const [adsLoading, setAdsLoading] = useState(true);
  // Set when the ad-performance requests fail (they used to fail silently
  // into empty lists); cleared on the next load.
  const [adsError, setAdsError] = useState(false);
  const [adExporting, setAdExporting] = useState(false);
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

  const loadAdPerformance = useCallback(async (p: Period) => {
    setAdsLoading(true);
    setAdsError(false);
    try {
      const [rows, trend, bySlot, byCourse] = await Promise.all([
        getSuperAdminAdPerformance(p),
        getSuperAdminAdTrend(p),
        getSuperAdminAdPerformanceBySlot(p),
        getSuperAdminAdPerformanceByCourse(p),
      ]);
      setAdPerformance(rows);
      setAdTrend(trend);
      setAdBySlot(bySlot);
      setAdByCourse(byCourse);
    } catch {
      setAdPerformance([]);
      setAdTrend([]);
      setAdBySlot([]);
      setAdByCourse([]);
      setAdsError(true);
    } finally {
      setAdsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Combined totals derive from the by-slot breakdown (an unpaginated
  // aggregate) rather than summing the by-ad list, which is capped at 50
  // rows server-side and would undercount past that.
  const adTotals = useMemo(() => {
    const clicks = adBySlot.reduce((sum, s) => sum + s.clicks, 0);
    const impressions = adBySlot.reduce((sum, s) => sum + s.impressions, 0);
    const ctr = impressions === 0 ? 0 : Math.round((clicks / impressions) * 1000) / 10;
    let best: AdSlotPerformanceRow | null = null;
    for (const s of adBySlot) {
      if (s.impressions === 0) continue;
      if (!best || s.ctr > best.ctr) best = s;
    }
    return { clicks, impressions, ctr, best };
  }, [adBySlot]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!cancelled) await loadDashboard(period);
      })();
      (async () => {
        if (!cancelled) await loadAdPerformance(period);
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
    loadAdPerformance(p);
  };

  const handleExportAdPerformance = async () => {
    setAdExporting(true);
    try {
      // Combined and By Ad both export the same per-ad workbook — a
      // "combined" export is just that list without the slot/club split.
      const downloaded =
        adView === 'slot'
          ? await downloadSuperAdminAdPerformanceBySlot(period, `ad-performance-by-slot-${period}.xlsx`)
          : adView === 'course'
            ? await downloadSuperAdminAdPerformanceByCourse(period, `ad-performance-by-club-${period}.xlsx`)
            : await downloadSuperAdminAdPerformance(period, `ad-performance-${period}.xlsx`);
      if (!downloaded) {
        showAlert('Web only for now', 'Excel export is available on the Flagrr web app — open this page in a browser to download this report.');
      }
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t generate report', message);
    } finally {
      setAdExporting(false);
    }
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

  const periodToggle = (
    <Segmented options={PERIOD_OPTIONS} value={period} onChange={handlePeriodChange} accessibilityLabel="Period" />
  );

  const adViewToggle = (
    <Segmented options={AD_VIEW_OPTIONS} value={adView} onChange={setAdView} accessibilityLabel="Ad performance view" />
  );

  const bestSlotLabel = adTotals.best ? PLACEMENT_LABELS[adTotals.best.placement] ?? adTotals.best.placement : 'Not enough data yet';

  const adSummaryTiles = (
    <View style={styles.adSummaryRow}>
      <View style={styles.adSummaryTile}>
        <Text style={styles.adSummaryLabel}>Total Clicks</Text>
        <Text style={styles.adSummaryValue}>{adTotals.clicks.toLocaleString()}</Text>
      </View>
      <View style={styles.adSummaryTile}>
        <Text style={styles.adSummaryLabel}>Total Impressions</Text>
        <Text style={styles.adSummaryValue}>{adTotals.impressions.toLocaleString()}</Text>
      </View>
      <View style={styles.adSummaryTile}>
        <Text style={styles.adSummaryLabel}>Overall CTR</Text>
        <Text style={styles.adSummaryValue}>{adTotals.ctr}%</Text>
      </View>
      <View style={styles.adSummaryTile}>
        <Text style={styles.adSummaryLabel}>Best Slot (CTR)</Text>
        <Text style={styles.adSummaryValueSmall} numberOfLines={1}>{bestSlotLabel}</Text>
      </View>
    </View>
  );

  const adCombinedContent = (
    <View style={{ gap: 16 }}>
      {adSummaryTiles}
      {adTrend.some((t) => t.clicks > 0 || t.impressions > 0) ? (
        <View style={[styles.adCharts, isDesktop && styles.adChartsDesktop]}>
          <View style={isDesktop ? styles.flex1 : undefined}>
            <Text style={styles.chartSubTitle}>Clicks Over Time</Text>
            <BarChart data={adTrend.map((t) => ({ month: t.label, value: t.clicks }))} />
          </View>
          <View style={isDesktop ? styles.flex1 : undefined}>
            <Text style={styles.chartSubTitle}>Impressions Over Time</Text>
            <BarChart data={adTrend.map((t) => ({ month: t.label, value: t.impressions }))} />
          </View>
        </View>
      ) : null}
    </View>
  );

  const adSlotRows = (
    <View style={{ gap: 8 }}>
      {adBySlot.map((s) => {
        const isBest = adTotals.best?.placement === s.placement;
        return (
          <View key={s.placement} style={[styles.slotRow, isBest && styles.slotRowBest]}>
            <View style={styles.rowLabelWithIcon}>
              {isBest ? <Ionicons name="trophy" size={14} color={c.accentText} /> : null}
              <Text style={styles.rowLabelStrong}>{PLACEMENT_LABELS[s.placement] ?? s.placement}</Text>
            </View>
            <Text style={styles.rowValueMuted}>{s.clicks} clicks · {s.impressions} impressions · {s.ctr}% CTR</Text>
          </View>
        );
      })}
    </View>
  );

  const adCourseRows =
    adByCourse.length === 0 ? (
      <EmptyState icon="business-outline" title="No club engagement yet." />
    ) : (
      <View>
        {adByCourse.map((course, i) => (
          <View key={course.courseId} style={[styles.row, i > 0 && styles.rowDivider]}>
            <Text style={styles.rowLabelStrong} numberOfLines={1}>{course.courseName}</Text>
            <Text style={styles.rowValueMuted}>{course.clicks} clicks · {course.impressions} impressions · {course.ctr}% CTR</Text>
          </View>
        ))}
      </View>
    );

  const adAdRows =
    adPerformance.length === 0 ? (
      <EmptyState icon="megaphone-outline" title="No ads running yet." />
    ) : (
      <View>
        {adPerformance.map((a, i) => (
          <HoverRow
            key={a.adId}
            style={[styles.adRow, i > 0 && styles.rowDivider]}
            hoverStyle={styles.rowHover}
            accessibilityLabel={a.title || '(untitled ad)'}
            onPress={() => navigation.navigate('SuperAdminAdDetail', { adId: a.adId, adTitle: a.title || '(untitled ad)', period })}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowLabelStrong} numberOfLines={1}>{a.title || '(untitled ad)'}</Text>
              <Text style={styles.adSubtext}>
                {a.courseName} · {PLACEMENT_LABELS[a.placement] ?? a.placement}{a.active ? '' : ' · inactive'}
              </Text>
              <Text style={styles.adSubtext}>
                {a.clicks} clicks · {a.impressions} impressions · {a.ctr}% CTR
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.ink3} />
          </HoverRow>
        ))}
      </View>
    );

  const adSectionBody = (
    <>
      {adView === 'combined' ? adCombinedContent : null}
      {adView === 'slot' ? adSlotRows : null}
      {adView === 'course' ? adCourseRows : null}
      {adView === 'ad' ? adAdRows : null}
    </>
  );

  const adSection = adsLoading ? (
    <SkeletonRows rows={3} />
  ) : adsError ? (
    <ErrorState title="Couldn’t load ad performance" onRetry={() => loadAdPerformance(period)} />
  ) : (
    adSectionBody
  );

  const tierRows =
    dashboard && dashboard.tierDistribution.length === 0 ? (
      <EmptyState icon="people-outline" title="No members yet." />
    ) : (
      <View>
        {dashboard?.tierDistribution.map((t, i) => (
          <View key={t.tier} style={[styles.row, i > 0 && styles.rowDivider]}>
            <Text style={styles.rowLabel}>{t.tier}</Text>
            <Text style={styles.rowValue}>{t.count}</Text>
          </View>
        ))}
      </View>
    );

  const rewardRows =
    dashboard && dashboard.topRewards.length === 0 ? (
      <EmptyState icon="gift-outline" title="No redemptions in this period." />
    ) : (
      <View>
        {dashboard?.topRewards.map((r, i) => (
          <View key={r.rewardId} style={[styles.row, i > 0 && styles.rowDivider]}>
            <Text style={styles.rowLabelStrong} numberOfLines={1}>{r.title}</Text>
            <Text style={styles.rowValue}>{r.redemptions}× · {r.fcSpent.toLocaleString()} FC</Text>
          </View>
        ))}
      </View>
    );

  const memberSearchForm = (
    <View style={styles.searchForm}>
      <TextField
        placeholder="Search by name or email, any club"
        variant="onLight"
        value={memberSearch}
        onChangeText={setMemberSearch}
        onSubmitEditing={handleSearchMembers}
        returnKeyType="search"
      />
      <PillButton label="Search" icon="search" variant="outline" onPress={handleSearchMembers} loading={searchingMembers} />
    </View>
  );

  const memberNoMatch = <EmptyState icon="search-outline" title="No members match that search." />;

  const dashboardError = !dashboardLoading && !dashboard;

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminReports" breadcrumb="Reports" headerRight={periodToggle}>
        <View style={styles.dTitleRow}>
          <PageTitle>Reports</PageTitle>
          <Muted style={styles.dPageSubtitle}>All Clubs</Muted>
        </View>

        {dashboardLoading && !dashboard ? (
          <Tile style={styles.dBlock}>
            <SkeletonRows rows={4} />
          </Tile>
        ) : dashboard ? (
          <>
            <View style={styles.dStatRow}>
              <DesktopStatCard label="Clubs" value={dashboard.totals.clubs} icon="business-outline" />
              <DesktopStatCard
                label="Members"
                value={dashboard.totals.members}
                icon="people-outline"
                onPress={() => navigation.navigate('SuperAdminStatBreakdown', { metric: 'members', label: 'Members', period })}
              />
              <DesktopStatCard
                label="New Members"
                value={dashboard.totals.newMembers}
                icon="person-add-outline"
                onPress={() => navigation.navigate('SuperAdminStatBreakdown', { metric: 'newMembers', label: 'New Members', period })}
              />
              <DesktopStatCard
                label="Flagrr Cash Earned"
                value={dashboard.totals.fcEarned.toLocaleString()}
                icon="trending-up-outline"
                deltaPct={dashboard.totals.fcEarnedDeltaPct}
                showDelta={period !== 'all'}
                onPress={() => navigation.navigate('SuperAdminStatBreakdown', { metric: 'fcEarned', label: 'Flagrr Cash Earned', period })}
              />
              <DesktopStatCard
                label="Flagrr Cash Redeemed"
                value={dashboard.totals.fcRedeemed.toLocaleString()}
                icon="swap-horizontal-outline"
                deltaPct={dashboard.totals.fcRedeemedDeltaPct}
                showDelta={period !== 'all'}
                onPress={() => navigation.navigate('SuperAdminStatBreakdown', { metric: 'fcRedeemed', label: 'Flagrr Cash Redeemed', period })}
              />
              <DesktopStatCard
                label="Receipts Scanned"
                value={dashboard.totals.receiptsScanned}
                icon="receipt-outline"
                deltaPct={dashboard.totals.receiptsScannedDeltaPct}
                showDelta={period !== 'all'}
                onPress={() => navigation.navigate('SuperAdminStatBreakdown', { metric: 'receiptsScanned', label: 'Receipts Scanned', period })}
              />
            </View>

            <View style={styles.dGrid2}>
              <DesktopPanel title="Members Joined This Year" style={{ flex: 2, minWidth: 360 }}>
                <BarChart data={dashboard.signupsByMonth} height={130} />
              </DesktopPanel>
              <DesktopPanel
                title="Tier Distribution"
                style={{ flex: 1, minWidth: 260 }}
                onViewAll={() => navigation.navigate('SuperAdminReportDetail', { report: 'crossClubMembers', label: 'Tier Distribution', period: 'all' })}
              >
                {tierRows}
              </DesktopPanel>
            </View>
          </>
        ) : (
          <View style={styles.dBlock}>
            <ErrorState title="Couldn’t load reports" onRetry={() => loadDashboard(period)} />
          </View>
        )}

        <View style={styles.dGrid2}>
          {dashboard ? (
            <DesktopPanel
              title="Top Redeemed Rewards"
              style={{ flex: 1, minWidth: 320 }}
              onViewAll={() => navigation.navigate('SuperAdminReportDetail', { report: 'crossClubRedemptions', label: 'Top Redeemed Rewards', period })}
            >
              {rewardRows}
            </DesktopPanel>
          ) : null}

          <DesktopPanel title="Look Up a Member" style={{ flex: 1, minWidth: 320 }}>
            {memberSearchForm}
            {searchedOnce && memberResults.length === 0 ? (
              memberNoMatch
            ) : (
              <View>
                {memberResults.map((m, i) => (
                  <HoverRow
                    key={m.id}
                    style={[styles.dMemberRow, i > 0 && styles.rowDivider]}
                    hoverStyle={styles.rowHover}
                    accessibilityLabel={`${m.firstName} ${m.lastName}, ${m.courseName}`}
                    onPress={() => navigation.navigate('SuperAdminMemberStats', { memberId: m.id })}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <TableAvatarCell name={`${m.firstName} ${m.lastName}`} subtitle={`${m.email} · ${m.courseName}`} />
                    </View>
                    <TableTag label={m.tier} tone="gray" />
                    <Text style={styles.dMemberBalance}>{m.balance.toLocaleString()} FC</Text>
                    <Ionicons name="chevron-forward" size={16} color={c.ink3} />
                  </HoverRow>
                ))}
              </View>
            )}
          </DesktopPanel>
        </View>

        <DesktopPanel
          title="Ad Performance"
          style={styles.dBlock}
          onViewAll={handleExportAdPerformance}
          viewAllLabel={adExporting ? 'Exporting…' : 'Export Excel'}
        >
          {adViewToggle}
          {adSection}
        </DesktopPanel>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="Reports" subtitle="All Clubs" showBack={false} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsHeaderRow}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Overview</Text>
          {periodToggle}
        </View>

        {dashboardLoading && !dashboard ? (
          <Tile style={styles.mBlock}>
            <SkeletonRows rows={4} />
          </Tile>
        ) : dashboard ? (
          <>
            <View style={styles.statsGrid}>
              <AdminStatCard label="Clubs" value={dashboard.totals.clubs} icon="business-outline" width="100%" />
              <View style={styles.statsRow}>
                <AdminStatCard
                  label="Members"
                  icon="people-outline"
                  value={dashboard.totals.members}
                  showDelta={false}
                  fill
                  onPress={() => navigation.navigate('SuperAdminStatBreakdown', { metric: 'members', label: 'Members', period })}
                />
                <AdminStatCard
                  label="New Members"
                  icon="person-add-outline"
                  value={dashboard.totals.newMembers}
                  showDelta={false}
                  fill
                  onPress={() => navigation.navigate('SuperAdminStatBreakdown', { metric: 'newMembers', label: 'New Members', period })}
                />
              </View>
              <View style={styles.statsRow}>
                <AdminStatCard
                  label="Flagrr Cash Earned"
                  icon="trending-up-outline"
                  value={dashboard.totals.fcEarned.toLocaleString()}
                  deltaPct={dashboard.totals.fcEarnedDeltaPct}
                  showDelta={period !== 'all'}
                  fill
                  onPress={() => navigation.navigate('SuperAdminStatBreakdown', { metric: 'fcEarned', label: 'Flagrr Cash Earned', period })}
                />
                <AdminStatCard
                  label="Flagrr Cash Redeemed"
                  icon="swap-horizontal-outline"
                  value={dashboard.totals.fcRedeemed.toLocaleString()}
                  deltaPct={dashboard.totals.fcRedeemedDeltaPct}
                  showDelta={period !== 'all'}
                  fill
                  onPress={() => navigation.navigate('SuperAdminStatBreakdown', { metric: 'fcRedeemed', label: 'Flagrr Cash Redeemed', period })}
                />
              </View>
              <AdminStatCard
                label="Receipts Scanned"
                icon="receipt-outline"
                value={dashboard.totals.receiptsScanned}
                deltaPct={dashboard.totals.receiptsScannedDeltaPct}
                showDelta={period !== 'all'}
                width="100%"
                onPress={() => navigation.navigate('SuperAdminStatBreakdown', { metric: 'receiptsScanned', label: 'Receipts Scanned', period })}
              />
            </View>

            <Tile style={styles.mBlock}>
              <Text style={styles.chartTitle}>Members Joined This Year</Text>
              <BarChart data={dashboard.signupsByMonth} />
            </Tile>

            <Pressable
              style={({ pressed }) => [styles.sectionHeaderRow, pressed && styles.pressedDim]}
              accessibilityRole="button"
              accessibilityLabel="Tier Distribution, view all"
              onPress={() => navigation.navigate('SuperAdminReportDetail', { report: 'crossClubMembers', label: 'Tier Distribution', period: 'all' })}
            >
              <Text style={styles.sectionTitle}>Tier Distribution</Text>
              <Ionicons name="chevron-forward" size={18} color={c.ink3} />
            </Pressable>
            <Tile style={styles.mBlock}>{tierRows}</Tile>

            <Pressable
              style={({ pressed }) => [styles.sectionHeaderRow, pressed && styles.pressedDim]}
              accessibilityRole="button"
              accessibilityLabel="Top Redeemed Rewards, view all"
              onPress={() => navigation.navigate('SuperAdminReportDetail', { report: 'crossClubRedemptions', label: 'Top Redeemed Rewards', period })}
            >
              <Text style={styles.sectionTitle}>Top Redeemed Rewards</Text>
              <Ionicons name="chevron-forward" size={18} color={c.ink3} />
            </Pressable>
            <Tile style={styles.mBlock}>{rewardRows}</Tile>
          </>
        ) : dashboardError ? (
          <View style={styles.mBlock}>
            <ErrorState title="Couldn’t load reports" onRetry={() => loadDashboard(period)} />
          </View>
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Ad Performance</Text>
          <AdminButton
            label="Excel"
            icon="download-outline"
            onPress={handleExportAdPerformance}
            loading={adExporting}
            accessibilityLabel="Export ad performance to Excel"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.adViewToggleScrollWrap}>
          {adViewToggle}
        </ScrollView>

        <Tile style={styles.mBlock}>{adSection}</Tile>

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]} accessibilityRole="header">Look Up a Member</Text>
        <Tile style={styles.mBlock}>
          {memberSearchForm}
          {searchedOnce && memberResults.length === 0 ? (
            memberNoMatch
          ) : (
            <View style={memberResults.length > 0 ? styles.memberList : undefined}>
              {memberResults.map((m, i) => (
                <Pressable
                  key={m.id}
                  style={({ pressed }) => [styles.memberRow, i > 0 && styles.rowDivider, pressed && styles.rowHover]}
                  accessibilityRole="button"
                  accessibilityLabel={`${m.firstName} ${m.lastName}, ${m.courseName}`}
                  onPress={() => navigation.navigate('SuperAdminMemberStats', { memberId: m.id })}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.memberName} numberOfLines={1}>{m.firstName} {m.lastName}</Text>
                    <Text style={styles.memberEmail} numberOfLines={1}>{m.email} · {m.courseName}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.memberTier}>{m.tier}</Text>
                    <Text style={styles.memberBalance}>{m.balance.toLocaleString()} FC</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={c.ink3} />
                </Pressable>
              ))}
            </View>
          )}
        </Tile>
      </ScrollView>
    </View>
  );
}

// A pressable list row with the desktop hover wash.
function HoverRow({
  style,
  hoverStyle,
  onPress,
  accessibilityLabel,
  children,
}: {
  style: StyleProp<ViewStyle>;
  hoverStyle: StyleProp<ViewStyle>;
  onPress: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
}) {
  const [hovered, hoverHandlers] = useHover();
  return (
    <Pressable
      style={({ pressed }) => [style, hoverTransition, (hovered || pressed) && hoverStyle]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
    >
      {children}
    </Pressable>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 16, paddingBottom: 64 },
  flex1: { flex: 1, minWidth: 0 },
  statsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10 },
  statsGrid: { gap: 10, marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 10 },
  sectionTitle: { ...adminFont.bodyBold, fontSize: 17, color: c.ink },
  sectionTitleSpaced: { marginTop: 12, marginBottom: 10 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, marginTop: 12, marginBottom: 6, gap: 10 },
  pressedDim: { opacity: 0.7 },
  mBlock: { marginBottom: 12 },
  chartTitle: { ...adminFont.bodyBold, fontSize: 15, color: c.ink, marginBottom: 14 },
  chartSubTitle: { ...adminFont.bodySemiBold, fontSize: 13.5, color: c.ink2, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 8 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },
  rowHover: { backgroundColor: c.fill2 },
  rowLabelWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  rowLabel: { flex: 1, ...adminFont.body, fontSize: 15, color: c.ink },
  rowLabelStrong: { flexShrink: 1, ...adminFont.bodySemiBold, fontSize: 15, color: c.ink },
  rowValue: { ...adminFont.bodyBold, ...tabularNums, fontSize: 15, color: c.ink },
  rowValueMuted: { ...adminFont.body, ...tabularNums, fontSize: 13.5, color: c.ink2, flexShrink: 1, textAlign: 'right' },
  slotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.fill2,
    borderRadius: adminRadius.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  slotRowBest: { borderColor: c.accent },
  adRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 10, paddingHorizontal: 8 },
  adSubtext: { ...adminFont.body, ...tabularNums, fontSize: 13, color: c.ink2, marginTop: 2 },
  adViewToggleScrollWrap: { marginBottom: 12, flexGrow: 0 },
  adCharts: { gap: 16 },
  adChartsDesktop: { flexDirection: 'row', gap: 20 },
  adSummaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  adSummaryTile: {
    flexGrow: 1,
    flexBasis: 130,
    backgroundColor: c.fill2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.edge,
    borderRadius: adminRadius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  adSummaryValue: { ...adminFont.bodyBold, ...tabularNums, fontSize: 24, letterSpacing: -0.4, color: c.ink },
  adSummaryValueSmall: { ...adminFont.bodyBold, fontSize: 16, color: c.ink, marginTop: 4 },
  adSummaryLabel: { ...adminFont.body, fontSize: 13, color: c.ink2 },
  searchForm: { gap: 10 },
  memberList: { marginTop: 8 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingVertical: 10,
  },
  memberName: { ...adminFont.bodySemiBold, fontSize: 15, color: c.ink },
  memberEmail: { ...adminFont.body, fontSize: 13, color: c.ink2, marginTop: 1 },
  memberTier: { ...adminFont.bodySemiBold, fontSize: 13, color: c.ink2 },
  memberBalance: { ...adminFont.bodyBold, ...tabularNums, fontSize: 13.5, color: c.ink },
  dMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 56,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  dMemberBalance: { ...adminFont.bodyBold, ...tabularNums, fontSize: 14, color: c.ink, minWidth: 80, textAlign: 'right' },
  dTitleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  dPageSubtitle: { marginBottom: 4 },
  dBlock: { marginTop: 12 },
  dStatRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 18 },
  dGrid2: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 12 },
});
}
