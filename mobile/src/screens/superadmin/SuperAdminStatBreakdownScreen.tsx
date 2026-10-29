import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { useHover, hoverTransition } from '../../hooks/useHover';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { AdminButton, EmptyState, PageTitle, Segmented, SkeletonRows, Tile } from '../../components/admin/ui';
import { AdminApiError, downloadSuperAdminStatBreakdown } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { StatBreakdownRow } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminStatBreakdown'>;

type Period = 'month' | 'year' | 'all';
const PERIOD_LABELS: Record<Period, string> = { month: 'Month', year: 'Year', all: 'All' };
const PERIODS: Period[] = ['month', 'year', 'all'];
const PERIOD_OPTIONS = PERIODS.map((p) => ({ key: p, label: PERIOD_LABELS[p] }));

// Drills into a single Reports-screen stat card (tapped from
// SuperAdminReportsScreen) to show every club's own number behind that
// aggregate, sorted highest first.
export function SuperAdminStatBreakdownScreen({ navigation, route }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { metric, label } = route.params;
  const { getSuperAdminStatBreakdown } = useAdmin();

  const [period, setPeriod] = useState<Period>(route.params.period);
  const [rows, setRows] = useState<StatBreakdownRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(
    async (p: Period) => {
      setLoading(true);
      try {
        setRows(await getSuperAdminStatBreakdown(metric, p));
      } catch (err) {
        const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
        showAlert('Couldn’t load breakdown', message);
      } finally {
        setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [metric],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!cancelled) await load(period);
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [metric]),
  );

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    load(p);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || metric;
      const downloaded = await downloadSuperAdminStatBreakdown(metric, period, `${slug}-${period}.xlsx`);
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

  const total = rows.reduce((sum, r) => sum + r.value, 0);
  // Longest bar = the top club; purely visual.
  const maxValue = rows.reduce((max, r) => Math.max(max, r.value), 0);
  // Only these two metrics are literally counts of members, so only these
  // drill further into an actual member list — the FC/receipts metrics stay
  // as plain per-club totals.
  const isMemberMetric = metric === 'members' || metric === 'newMembers';

  const handleRowPress = (row: StatBreakdownRow) => {
    if (!isMemberMetric) return;
    navigation.navigate('SuperAdminClubMembers', {
      courseId: row.courseId,
      courseName: row.courseName,
      // 'members' ignores the period filter server-side (it's always every
      // member on the club's books), so the drill-down list matches that by
      // defaulting to 'all'; 'newMembers' keeps whichever period is selected.
      period: metric === 'members' ? 'all' : period,
    });
  };

  const rowItem = (item: StatBreakdownRow, index: number) => (
    <RankRow
      key={item.courseId}
      item={item}
      index={index}
      isFirst={index === 0}
      pressable={isMemberMetric}
      barPct={maxValue > 0 ? (item.value / maxValue) * 100 : 0}
      showBar={isDesktop}
      onPress={() => handleRowPress(item)}
      styles={styles}
    />
  );

  const periodControl = (
    <Segmented options={PERIOD_OPTIONS} value={period} onChange={handlePeriodChange} accessibilityLabel="Period" />
  );
  const exportButton = <AdminButton label="Excel" icon="download-outline" onPress={handleExport} loading={exporting} />;
  const totalText = <Text style={styles.totalText}>{total.toLocaleString()} total</Text>;

  const emptyState = <EmptyState icon="business-outline" title="No clubs yet." />;

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame
        activeKey="SuperAdminReports"
        breadcrumb={`Reports › ${label}`}
        showRail={false}
        headerRight={
          <View style={styles.headerRight}>
            {periodControl}
            {exportButton}
          </View>
        }
      >
        <View style={styles.dTitleRow}>
          <PageTitle style={{ flexShrink: 1 }}>{label}</PageTitle>
          {totalText}
        </View>
        <Tile style={styles.dCard}>
          {loading ? (
            <SkeletonRows rows={5} />
          ) : rows.length === 0 ? (
            emptyState
          ) : (
            <View>{rows.map((r, i) => rowItem(r, i))}</View>
          )}
        </Tile>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title={label} />

      <View style={styles.toolbar}>
        {totalText}
        <View style={styles.toolbarRight}>
          {periodControl}
          {exportButton}
        </View>
      </View>

      {loading ? (
        <View style={styles.listContent}>
          <Tile>
            <SkeletonRows rows={5} />
          </Tile>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.courseId}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <View
              style={[
                styles.groupSlice,
                index === 0 && styles.groupFirst,
                index === rows.length - 1 && styles.groupLast,
              ]}
            >
              {rowItem(item, index)}
            </View>
          )}
          ListEmptyComponent={<Tile>{emptyState}</Tile>}
        />
      )}
    </View>
  );
}

function RankRow({
  item,
  index,
  isFirst,
  pressable,
  barPct,
  showBar,
  onPress,
  styles,
}: {
  item: StatBreakdownRow;
  index: number;
  isFirst: boolean;
  pressable: boolean;
  barPct: number;
  showBar: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const { c } = useAdminTheme();
  const [hovered, hoverHandlers] = useHover();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        hoverTransition,
        !isFirst && styles.rowDivider,
        pressable && (hovered || pressed) && styles.rowHover,
      ]}
      onPress={onPress}
      disabled={!pressable}
      accessibilityRole={pressable ? 'button' : undefined}
      accessibilityLabel={`${index + 1}. ${item.courseName}, ${item.value.toLocaleString()}`}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
    >
      <Text style={styles.rank}>{index + 1}</Text>
      <Text style={[styles.rowLabel, showBar && styles.rowLabelFixed]} numberOfLines={1}>{item.courseName}</Text>
      {showBar ? (
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${barPct}%` }]} />
        </View>
      ) : null}
      <Text style={styles.rowValue}>{item.value.toLocaleString()}</Text>
      {pressable ? <Ionicons name="chevron-forward" size={16} color={c.ink3} /> : null}
    </Pressable>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    flexWrap: 'wrap',
    gap: 10,
  },
  totalText: { ...adminFont.bodyBold, ...tabularNums, fontSize: 14.5, color: c.ink2 },
  toolbarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listContent: { padding: 16, paddingBottom: 32 },
  // Phone: the FlatList rows read as one grouped tile.
  groupSlice: {
    backgroundColor: c.surface,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: c.edge,
    overflow: 'hidden',
  },
  groupFirst: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: adminRadius.md,
    borderTopRightRadius: adminRadius.md,
  },
  groupLast: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: adminRadius.md,
    borderBottomRightRadius: adminRadius.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: adminRadius.sm,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge, borderRadius: 0 },
  rowHover: { backgroundColor: c.fill2 },
  rank: { ...adminFont.bodySemiBold, ...tabularNums, fontSize: 13.5, color: c.ink3, width: 22 },
  rowLabel: { flex: 1, minWidth: 0, ...adminFont.bodySemiBold, fontSize: 15, color: c.ink },
  rowLabelFixed: { flex: 0, width: 240 },
  barTrack: { flex: 1, height: 8, borderRadius: adminRadius.pill, backgroundColor: c.fill, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: adminRadius.pill, backgroundColor: c.bar },
  rowValue: { flexShrink: 0, ...adminFont.bodyBold, ...tabularNums, fontSize: 15, color: c.ink, minWidth: 60, textAlign: 'right' },
  dTitleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  dCard: { marginTop: 16, paddingVertical: 8, paddingHorizontal: 8 },
});
}
