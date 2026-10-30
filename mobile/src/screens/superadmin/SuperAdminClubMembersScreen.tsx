import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { DesktopDataTable, TableAvatarCell, TableTag, TableText, type DesktopTableColumn } from '../../components/admin/desktop/DesktopDataTable';
import { AdminButton, EmptyState, PageTitle, Segmented, SkeletonRows, Tile } from '../../components/admin/ui';
import { AdminApiError, downloadSuperAdminClubMembers } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { MemberReportRow } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminClubMembers'>;

type Period = 'month' | 'year' | 'all';
const PERIOD_LABELS: Record<Period, string> = { month: 'Month', year: 'Year', all: 'All' };
const PERIODS: Period[] = ['month', 'year', 'all'];
const PERIOD_OPTIONS = PERIODS.map((p) => ({ key: p, label: PERIOD_LABELS[p] }));

interface Column {
  key: string;
  label: string;
  width: number;
  render: (row: MemberReportRow) => string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const COLUMNS: Column[] = [
  { key: 'firstName', label: 'First Name', width: 120, render: (r) => r.firstName },
  { key: 'lastName', label: 'Last Name', width: 120, render: (r) => r.lastName },
  { key: 'email', label: 'Email', width: 190, render: (r) => r.email },
  { key: 'tier', label: 'Tier', width: 90, render: (r) => r.tier },
  { key: 'memberSince', label: 'Member Since', width: 160, render: (r) => formatDate(r.memberSince) },
  { key: 'balance', label: 'FC Balance', width: 100, render: (r) => r.balance.toLocaleString() },
  { key: 'totalEarned', label: 'FC Earned', width: 100, render: (r) => r.totalEarned.toLocaleString() },
  { key: 'totalRedeemed', label: 'FC Redeemed', width: 110, render: (r) => r.totalRedeemed.toLocaleString() },
];

// Desktop-only columns — same rows, avatar cell + tier tag (see DesktopDataTable).
const D_COLUMNS: DesktopTableColumn<MemberReportRow>[] = [
  {
    key: 'member',
    label: 'Member',
    width: 220,
    render: (r) => <TableAvatarCell name={`${r.firstName} ${r.lastName}`} subtitle={r.email} />,
    sortValue: (r) => `${r.firstName} ${r.lastName}`.toLowerCase(),
  },
  { key: 'tier', label: 'Tier', width: 100, render: (r) => <TableTag label={r.tier} tone="gray" />, sortValue: (r) => r.tier },
  {
    key: 'memberSince',
    label: 'Member Since',
    width: 160,
    render: (r) => <TableText muted>{formatDate(r.memberSince)}</TableText>,
    sortValue: (r) => new Date(r.memberSince).getTime(),
  },
  { key: 'balance', label: 'FC Balance', width: 100, align: 'right', render: (r) => <TableText>{r.balance.toLocaleString()}</TableText>, sortValue: (r) => r.balance },
  { key: 'totalEarned', label: 'FC Earned', width: 100, align: 'right', render: (r) => <TableText>{r.totalEarned.toLocaleString()}</TableText>, sortValue: (r) => r.totalEarned },
  { key: 'totalRedeemed', label: 'FC Redeemed', width: 110, align: 'right', render: (r) => <TableText>{r.totalRedeemed.toLocaleString()}</TableText>, sortValue: (r) => r.totalRedeemed },
];

// One club's own member table, opened by tapping a row on
// SuperAdminStatBreakdownScreen ('Members' / 'New Members' cards).
export function SuperAdminClubMembersScreen({ route }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { courseId, courseName } = route.params;
  const { getSuperAdminClubMembers } = useAdmin();
  const [period, setPeriod] = useState<Period>(route.params.period);
  const [rows, setRows] = useState<MemberReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(
    async (p: Period) => {
      setLoading(true);
      try {
        setRows(await getSuperAdminClubMembers(courseId, p));
      } catch (err) {
        const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
        showAlert('Couldn’t load members', message);
      } finally {
        setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [courseId],
  );

  useFocusEffect(
    useCallback(() => {
      load(period);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId]),
  );

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    load(p);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const slug = courseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'club';
      const downloaded = await downloadSuperAdminClubMembers(courseId, period, `${slug}-members-${period}.xlsx`);
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

  const totalText = (
    <Text style={styles.totalText}>{rows.length.toLocaleString()} member{rows.length === 1 ? '' : 's'}</Text>
  );
  const periodControl = (
    <Segmented options={PERIOD_OPTIONS} value={period} onChange={handlePeriodChange} accessibilityLabel="Period" />
  );
  const exportButton = <AdminButton label="Excel" icon="download-outline" onPress={handleExport} loading={exporting} />;
  const emptyState = <EmptyState icon="people-outline" title="No members for this period." />;

  const table = loading ? (
    <View style={styles.statePad}>
      <SkeletonRows rows={6} />
    </View>
  ) : rows.length === 0 ? (
    emptyState
  ) : (
    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
      <View>
        <View style={styles.headerRow}>
          {COLUMNS.map((col) => (
            <Text key={col.key} style={[styles.headerCell, { width: col.width }]} numberOfLines={1}>
              {col.label}
            </Text>
          ))}
        </View>
        <ScrollView showsVerticalScrollIndicator style={styles.verticalScroll}>
          {rows.map((row, i) => (
            <View key={i} style={[styles.dataRow, i === rows.length - 1 && styles.dataRowLast]}>
              {COLUMNS.map((col) => (
                <Text key={col.key} style={[styles.dataCell, { width: col.width }]} numberOfLines={1}>
                  {col.render(row)}
                </Text>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );

  const desktopTable = loading ? (
    <View style={styles.statePad}>
      <SkeletonRows rows={6} />
    </View>
  ) : rows.length === 0 ? (
    emptyState
  ) : (
    <DesktopDataTable columns={D_COLUMNS} rows={rows} keyExtractor={(_, i) => String(i)} />
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame
        activeKey="SuperAdminReports"
        breadcrumb={`Reports › ${courseName}`}
        showRail={false}
        scrollable={false}
        headerRight={
          <View style={styles.headerRight}>
            {periodControl}
            {exportButton}
          </View>
        }
      >
        <View style={styles.dTitleRow}>
          <PageTitle style={{ flexShrink: 1 }}>{courseName} — Members</PageTitle>
          {totalText}
        </View>
        <Tile style={[styles.dTableCard, !loading && rows.length > 0 && styles.mTableFill]} padded={false}>
          {desktopTable}
        </Tile>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title={courseName} />

      <View style={styles.toolbar}>
        {totalText}
        <View style={styles.toolbarRight}>
          {periodControl}
          {exportButton}
        </View>
      </View>
      <Tile style={[styles.mTableCard, !loading && rows.length > 0 && styles.mTableFill]} padded={false}>
        {table}
      </Tile>
    </View>
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
    paddingBottom: 12,
    flexWrap: 'wrap',
    gap: 10,
  },
  totalText: { ...adminFont.bodyBold, ...tabularNums, fontSize: 14.5, color: c.ink2 },
  toolbarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tableScroll: { flex: 1 },
  verticalScroll: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.edge,
  },
  headerCell: {
    ...adminFont.bodyBold,
    fontSize: 11.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: c.ink3,
    paddingRight: 8,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.edge,
  },
  dataRowLast: { borderBottomWidth: 0 },
  statePad: { padding: 16 },
  dataCell: { ...adminFont.body, ...tabularNums, fontSize: 13.5, color: c.ink, paddingRight: 8 },
  mTableCard: { marginHorizontal: 16, marginBottom: 16, overflow: 'hidden' },
  mTableFill: { flex: 1 },
  dTitleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  dTableCard: { marginTop: 16, paddingHorizontal: 8, paddingVertical: 6, overflow: 'hidden', borderRadius: adminRadius.md },
});
}
