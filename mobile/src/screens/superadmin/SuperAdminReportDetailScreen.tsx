import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { DesktopDataTable, TableAvatarCell, TableTag, TableText, statusTone, type DesktopTableColumn } from '../../components/admin/desktop/DesktopDataTable';
import { AdminButton, EmptyState, PageTitle, Segmented, SkeletonRows, Tile } from '../../components/admin/ui';
import { AdminApiError, downloadSuperAdminReport } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { SuperAdminMemberReportRow, SuperAdminRedemptionReportRow, SuperAdminReportKind } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminReportDetail'>;

type Period = 'month' | 'year' | 'all';
const PERIOD_LABELS: Record<Period, string> = { month: 'Month', year: 'Year', all: 'All' };
const PERIODS: Period[] = ['month', 'year', 'all'];
const PERIOD_OPTIONS = PERIODS.map((p) => ({ key: p, label: PERIOD_LABELS[p] }));

type Row = SuperAdminMemberReportRow | SuperAdminRedemptionReportRow;

interface Column {
  key: string;
  label: string;
  width: number;
  render: (row: Row) => string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const MEMBER_COLUMNS: Column[] = [
  { key: 'firstName', label: 'First Name', width: 120, render: (r) => (r as SuperAdminMemberReportRow).firstName },
  { key: 'lastName', label: 'Last Name', width: 120, render: (r) => (r as SuperAdminMemberReportRow).lastName },
  { key: 'email', label: 'Email', width: 190, render: (r) => (r as SuperAdminMemberReportRow).email },
  { key: 'courseName', label: 'Club', width: 150, render: (r) => (r as SuperAdminMemberReportRow).courseName },
  { key: 'tier', label: 'Tier', width: 90, render: (r) => (r as SuperAdminMemberReportRow).tier },
  { key: 'memberSince', label: 'Member Since', width: 160, render: (r) => formatDate((r as SuperAdminMemberReportRow).memberSince) },
  { key: 'balance', label: 'FC Balance', width: 100, render: (r) => (r as SuperAdminMemberReportRow).balance.toLocaleString() },
  { key: 'totalEarned', label: 'FC Earned', width: 100, render: (r) => (r as SuperAdminMemberReportRow).totalEarned.toLocaleString() },
  { key: 'totalRedeemed', label: 'FC Redeemed', width: 110, render: (r) => (r as SuperAdminMemberReportRow).totalRedeemed.toLocaleString() },
];

const REDEMPTION_COLUMNS: Column[] = [
  { key: 'code', label: 'Code', width: 110, render: (r) => (r as SuperAdminRedemptionReportRow).code },
  { key: 'member', label: 'Member', width: 150, render: (r) => (r as SuperAdminRedemptionReportRow).memberName },
  { key: 'email', label: 'Email', width: 190, render: (r) => (r as SuperAdminRedemptionReportRow).memberEmail },
  { key: 'courseName', label: 'Club', width: 150, render: (r) => (r as SuperAdminRedemptionReportRow).courseName },
  { key: 'reward', label: 'Reward', width: 170, render: (r) => (r as SuperAdminRedemptionReportRow).rewardTitle },
  { key: 'variant', label: 'Variant', width: 130, render: (r) => (r as SuperAdminRedemptionReportRow).variantLabel },
  { key: 'cost', label: 'Flagrr Cash', width: 100, render: (r) => String((r as SuperAdminRedemptionReportRow).cost) },
  { key: 'status', label: 'Status', width: 100, render: (r) => (r as SuperAdminRedemptionReportRow).status },
  { key: 'issuedAt', label: 'Issued At', width: 160, render: (r) => formatDate((r as SuperAdminRedemptionReportRow).issuedAt) },
  {
    key: 'redeemedAt',
    label: 'Redeemed At',
    width: 160,
    render: (r) => {
      const v = (r as SuperAdminRedemptionReportRow).redeemedAt;
      return v ? formatDate(v) : '—';
    },
  },
];

const COLUMNS_BY_REPORT: Record<SuperAdminReportKind, Column[]> = {
  crossClubMembers: MEMBER_COLUMNS,
  crossClubRedemptions: REDEMPTION_COLUMNS,
};

// Desktop-only column definitions — same underlying rows, but the
// member/status columns render as an avatar cell / colored tag instead of
// plain text (see DesktopDataTable). Mobile keeps the plain-text table above.
const D_MEMBER_COLUMNS: DesktopTableColumn<SuperAdminMemberReportRow>[] = [
  {
    key: 'member',
    label: 'Member',
    width: 220,
    render: (r) => <TableAvatarCell name={`${r.firstName} ${r.lastName}`} subtitle={r.email} />,
    sortValue: (r) => `${r.firstName} ${r.lastName}`.toLowerCase(),
  },
  { key: 'courseName', label: 'Club', width: 150, render: (r) => <TableText>{r.courseName}</TableText>, sortValue: (r) => r.courseName.toLowerCase() },
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

const D_REDEMPTION_COLUMNS: DesktopTableColumn<SuperAdminRedemptionReportRow>[] = [
  { key: 'code', label: 'Code', width: 110, render: (r) => <TableText>{r.code}</TableText> },
  {
    key: 'member',
    label: 'Member',
    width: 220,
    render: (r) => <TableAvatarCell name={r.memberName} subtitle={r.memberEmail} />,
    sortValue: (r) => r.memberName.toLowerCase(),
  },
  { key: 'courseName', label: 'Club', width: 150, render: (r) => <TableText>{r.courseName}</TableText>, sortValue: (r) => r.courseName.toLowerCase() },
  { key: 'reward', label: 'Reward', width: 170, render: (r) => <TableText>{r.rewardTitle}</TableText>, sortValue: (r) => r.rewardTitle.toLowerCase() },
  { key: 'variant', label: 'Variant', width: 130, render: (r) => <TableText>{r.variantLabel}</TableText> },
  { key: 'cost', label: 'Flagrr Cash', width: 100, align: 'right', render: (r) => <TableText>{r.cost.toLocaleString()}</TableText>, sortValue: (r) => r.cost },
  { key: 'status', label: 'Status', width: 110, render: (r) => <TableTag label={r.status} tone={statusTone(r.status)} />, sortValue: (r) => r.status },
  {
    key: 'issuedAt',
    label: 'Issued At',
    width: 160,
    render: (r) => <TableText muted>{formatDate(r.issuedAt)}</TableText>,
    sortValue: (r) => new Date(r.issuedAt).getTime(),
  },
  {
    key: 'redeemedAt',
    label: 'Redeemed At',
    width: 160,
    render: (r) => <TableText muted>{r.redeemedAt ? formatDate(r.redeemedAt) : '—'}</TableText>,
    sortValue: (r) => (r.redeemedAt ? new Date(r.redeemedAt).getTime() : 0),
  },
];

const D_COLUMNS_BY_REPORT: Record<SuperAdminReportKind, DesktopTableColumn<Row>[]> = {
  crossClubMembers: D_MEMBER_COLUMNS as DesktopTableColumn<Row>[],
  crossClubRedemptions: D_REDEMPTION_COLUMNS as DesktopTableColumn<Row>[],
};

// Cross-club counterpart of AdminReportDetailScreen — backs super_admin's
// Tier Distribution ('crossClubMembers') and Top Redeemed Rewards
// ('crossClubRedemptions') cards on SuperAdminReportsScreen.
export function SuperAdminReportDetailScreen({ route }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { report, label } = route.params;
  const { getSuperAdminReportRows } = useAdmin();
  const [period, setPeriod] = useState<Period>(route.params.period);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const columns = COLUMNS_BY_REPORT[report];

  const load = useCallback(
    async (p: Period) => {
      setLoading(true);
      try {
        setRows(await getSuperAdminReportRows(report, p));
      } catch (err) {
        const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
        showAlert('Couldn’t load report', message);
      } finally {
        setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [report],
  );

  useFocusEffect(
    useCallback(() => {
      load(period);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [report]),
  );

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    load(p);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || report;
      const downloaded = await downloadSuperAdminReport(report, period, `${slug}-${period}.xlsx`);
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
    <Text style={styles.totalText}>{rows.length.toLocaleString()} row{rows.length === 1 ? '' : 's'}</Text>
  );
  const periodControl = (
    <Segmented options={PERIOD_OPTIONS} value={period} onChange={handlePeriodChange} accessibilityLabel="Period" />
  );
  const exportButton = <AdminButton label="Excel" icon="download-outline" onPress={handleExport} loading={exporting} />;
  const emptyState = <EmptyState icon="document-text-outline" title="No data for this period." />;
  const hasRows = !loading && rows.length > 0;

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
          {columns.map((col) => (
            <Text key={col.key} style={[styles.headerCell, { width: col.width }]} numberOfLines={1}>
              {col.label}
            </Text>
          ))}
        </View>
        <ScrollView showsVerticalScrollIndicator style={styles.verticalScroll}>
          {rows.map((row, i) => (
            <View key={i} style={[styles.dataRow, i === rows.length - 1 && styles.dataRowLast]}>
              {columns.map((col) => (
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
    <DesktopDataTable columns={D_COLUMNS_BY_REPORT[report]} rows={rows} keyExtractor={(_, i) => String(i)} />
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame
        activeKey="SuperAdminReports"
        breadcrumb={`Reports › ${label}`}
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
          <PageTitle style={{ flexShrink: 1 }}>{label}</PageTitle>
          {totalText}
        </View>
        <Tile style={[styles.dTableCard, hasRows && styles.fill]} padded={false}>
          {desktopTable}
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
      <Tile style={[styles.mTableCard, hasRows && styles.fill]} padded={false}>
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
  fill: { flex: 1 },
  mTableCard: { marginHorizontal: 16, marginBottom: 16, overflow: 'hidden' },
  dTitleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  dTableCard: { marginTop: 16, paddingHorizontal: 8, paddingVertical: 6, overflow: 'hidden', borderRadius: adminRadius.md },
});
}
