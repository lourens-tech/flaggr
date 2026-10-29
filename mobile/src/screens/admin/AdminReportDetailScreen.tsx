import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { DesktopDataTable, TableAvatarCell, TableTag, TableText, statusTone, type DesktopTableColumn } from '../../components/admin/desktop/DesktopDataTable';
import { downloadReport, AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { CourseReportKind, MemberReportRow, RedemptionReportRow, ReceiptReportRow } from '../../data/adminTypes';
import { adminFont, tabularNums, type AdminColors } from '../../theme/admin';
import { AdminButton, EmptyState, Muted, PageTitle, Segmented, SkeletonRows, Tile } from '../../components/admin/ui';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminReportDetail'>;

type Period = 'month' | 'year' | 'all';
const PERIOD_LABELS: Record<Period, string> = { month: 'Month', year: 'Year', all: 'All' };
const PERIODS: Period[] = ['month', 'year', 'all'];

type Row = RedemptionReportRow | ReceiptReportRow | MemberReportRow;

interface Column {
  key: string;
  label: string;
  width: number;
  render: (row: Row) => string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const REDEMPTION_COLUMNS: Column[] = [
  { key: 'code', label: 'Code', width: 110, render: (r) => (r as RedemptionReportRow).code },
  { key: 'member', label: 'Member', width: 150, render: (r) => (r as RedemptionReportRow).memberName },
  { key: 'email', label: 'Email', width: 190, render: (r) => (r as RedemptionReportRow).memberEmail },
  { key: 'reward', label: 'Reward', width: 170, render: (r) => (r as RedemptionReportRow).rewardTitle },
  { key: 'variant', label: 'Variant', width: 130, render: (r) => (r as RedemptionReportRow).variantLabel },
  { key: 'cost', label: 'Flagrr Cash', width: 100, render: (r) => String((r as RedemptionReportRow).cost) },
  { key: 'status', label: 'Status', width: 100, render: (r) => (r as RedemptionReportRow).status },
  { key: 'issuedAt', label: 'Issued At', width: 160, render: (r) => formatDate((r as RedemptionReportRow).issuedAt) },
  {
    key: 'redeemedAt',
    label: 'Redeemed At',
    width: 160,
    render: (r) => {
      const v = (r as RedemptionReportRow).redeemedAt;
      return v ? formatDate(v) : '—';
    },
  },
];

const RECEIPT_COLUMNS: Column[] = [
  { key: 'receiptNumber', label: 'Receipt #', width: 130, render: (r) => (r as ReceiptReportRow).receiptNumber ?? '—' },
  { key: 'member', label: 'Member', width: 150, render: (r) => (r as ReceiptReportRow).memberName },
  { key: 'email', label: 'Email', width: 190, render: (r) => (r as ReceiptReportRow).memberEmail },
  { key: 'whereScanned', label: 'Where Scanned', width: 170, render: (r) => (r as ReceiptReportRow).whereScanned || '—' },
  { key: 'total', label: 'Total (R)', width: 100, render: (r) => (r as ReceiptReportRow).total.toFixed(2) },
  {
    key: 'pointsAwarded',
    label: 'Flagrr Cash',
    width: 110,
    render: (r) => {
      const v = (r as ReceiptReportRow).pointsAwarded;
      return v === null ? '—' : String(v);
    },
  },
  { key: 'status', label: 'Status', width: 100, render: (r) => (r as ReceiptReportRow).status },
  { key: 'submittedAt', label: 'Submitted At', width: 160, render: (r) => formatDate((r as ReceiptReportRow).submittedAt) },
];

const MEMBER_COLUMNS: Column[] = [
  { key: 'firstName', label: 'First Name', width: 120, render: (r) => (r as MemberReportRow).firstName },
  { key: 'lastName', label: 'Last Name', width: 120, render: (r) => (r as MemberReportRow).lastName },
  { key: 'email', label: 'Email', width: 190, render: (r) => (r as MemberReportRow).email },
  { key: 'tier', label: 'Tier', width: 90, render: (r) => (r as MemberReportRow).tier },
  { key: 'memberSince', label: 'Member Since', width: 160, render: (r) => formatDate((r as MemberReportRow).memberSince) },
  { key: 'balance', label: 'FC Balance', width: 100, render: (r) => (r as MemberReportRow).balance.toLocaleString() },
  { key: 'totalEarned', label: 'FC Earned', width: 100, render: (r) => (r as MemberReportRow).totalEarned.toLocaleString() },
  { key: 'totalRedeemed', label: 'FC Redeemed', width: 110, render: (r) => (r as MemberReportRow).totalRedeemed.toLocaleString() },
];

const COLUMNS_BY_REPORT: Record<CourseReportKind, Column[]> = {
  redemptions: REDEMPTION_COLUMNS,
  receipts: RECEIPT_COLUMNS,
  members: MEMBER_COLUMNS,
};

// Desktop-only column definitions — same underlying rows, but the
// member/status columns render as an avatar cell / colored tag instead of
// plain text (see DesktopDataTable). Mobile keeps the plain-text table above.
const D_REDEMPTION_COLUMNS: DesktopTableColumn<RedemptionReportRow>[] = [
  { key: 'code', label: 'Code', width: 110, sortValue: (r) => r.code, render: (r) => <TableText>{r.code}</TableText> },
  {
    key: 'member',
    label: 'Member',
    width: 220,
    sortValue: (r) => r.memberName,
    render: (r) => <TableAvatarCell name={r.memberName} subtitle={r.memberEmail} />,
  },
  { key: 'reward', label: 'Reward', width: 170, sortValue: (r) => r.rewardTitle, render: (r) => <TableText>{r.rewardTitle}</TableText> },
  { key: 'variant', label: 'Variant', width: 130, render: (r) => <TableText>{r.variantLabel}</TableText> },
  { key: 'cost', label: 'Flagrr Cash', width: 100, align: 'right', sortValue: (r) => r.cost, render: (r) => <TableText>{r.cost.toLocaleString()}</TableText> },
  { key: 'status', label: 'Status', width: 110, sortValue: (r) => r.status, render: (r) => <TableTag label={r.status} tone={statusTone(r.status)} /> },
  { key: 'issuedAt', label: 'Issued At', width: 160, sortValue: (r) => new Date(r.issuedAt).getTime(), render: (r) => <TableText muted>{formatDate(r.issuedAt)}</TableText> },
  {
    key: 'redeemedAt',
    label: 'Redeemed At',
    width: 160,
    sortValue: (r) => (r.redeemedAt ? new Date(r.redeemedAt).getTime() : 0),
    render: (r) => <TableText muted>{r.redeemedAt ? formatDate(r.redeemedAt) : '—'}</TableText>,
  },
];

const D_RECEIPT_COLUMNS: DesktopTableColumn<ReceiptReportRow>[] = [
  { key: 'receiptNumber', label: 'Receipt #', width: 130, sortValue: (r) => r.receiptNumber ?? '', render: (r) => <TableText>{r.receiptNumber ?? '—'}</TableText> },
  {
    key: 'member',
    label: 'Member',
    width: 220,
    sortValue: (r) => r.memberName,
    render: (r) => <TableAvatarCell name={r.memberName} subtitle={r.memberEmail} />,
  },
  { key: 'whereScanned', label: 'Where Scanned', width: 170, render: (r) => <TableText>{r.whereScanned || '—'}</TableText> },
  { key: 'total', label: 'Total (R)', width: 100, align: 'right', sortValue: (r) => r.total, render: (r) => <TableText>{r.total.toFixed(2)}</TableText> },
  {
    key: 'pointsAwarded',
    label: 'Flagrr Cash',
    width: 110,
    align: 'right',
    sortValue: (r) => r.pointsAwarded ?? -1,
    render: (r) => <TableText>{r.pointsAwarded === null ? '—' : r.pointsAwarded.toLocaleString()}</TableText>,
  },
  { key: 'status', label: 'Status', width: 110, sortValue: (r) => r.status, render: (r) => <TableTag label={r.status} tone={statusTone(r.status)} /> },
  { key: 'submittedAt', label: 'Submitted At', width: 160, sortValue: (r) => new Date(r.submittedAt).getTime(), render: (r) => <TableText muted>{formatDate(r.submittedAt)}</TableText> },
];

const D_MEMBER_COLUMNS: DesktopTableColumn<MemberReportRow>[] = [
  {
    key: 'member',
    label: 'Member',
    width: 220,
    sortValue: (r) => `${r.firstName} ${r.lastName}`,
    render: (r) => <TableAvatarCell name={`${r.firstName} ${r.lastName}`} subtitle={r.email} />,
  },
  { key: 'tier', label: 'Tier', width: 100, sortValue: (r) => r.tier, render: (r) => <TableTag label={r.tier} tone="gray" /> },
  { key: 'memberSince', label: 'Member Since', width: 160, sortValue: (r) => new Date(r.memberSince).getTime(), render: (r) => <TableText muted>{formatDate(r.memberSince)}</TableText> },
  { key: 'balance', label: 'FC Balance', width: 100, align: 'right', sortValue: (r) => r.balance, render: (r) => <TableText>{r.balance.toLocaleString()}</TableText> },
  { key: 'totalEarned', label: 'FC Earned', width: 100, align: 'right', sortValue: (r) => r.totalEarned, render: (r) => <TableText>{r.totalEarned.toLocaleString()}</TableText> },
  { key: 'totalRedeemed', label: 'FC Redeemed', width: 110, align: 'right', sortValue: (r) => r.totalRedeemed, render: (r) => <TableText>{r.totalRedeemed.toLocaleString()}</TableText> },
];

const D_COLUMNS_BY_REPORT: Record<CourseReportKind, DesktopTableColumn<Row>[]> = {
  redemptions: D_REDEMPTION_COLUMNS as DesktopTableColumn<Row>[],
  receipts: D_RECEIPT_COLUMNS as DesktopTableColumn<Row>[],
  members: D_MEMBER_COLUMNS as DesktopTableColumn<Row>[],
};

// A single generic detail page for every Overview stat card — 'redemptions'
// backs Flagrr Cash Redeemed, 'receipts' backs both Flagrr Cash Earned and
// Receipts Scanned (same underlying receipts either way), and 'members'
// backs both Members (period='all') and New Members (period-filtered).
// Shows the exact same rows the Excel download produces, so the on-screen
// table and the file always agree.
export function AdminReportDetailScreen({ navigation, route }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { report, label } = route.params;
  const { getReportRows } = useAdmin();
  const [period, setPeriod] = useState<Period>(route.params.period);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const columns = COLUMNS_BY_REPORT[report];

  const load = useCallback(
    async (p: Period) => {
      setLoading(true);
      try {
        setRows(await getReportRows(report, p));
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
      const downloaded = await downloadReport(report, period, { filename: `${slug}-${period}.xlsx` });
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

  const rowCount = `${rows.length.toLocaleString()} row${rows.length === 1 ? '' : 's'}`;

  const periodControl = (fullWidth: boolean) => (
    <Segmented
      accessibilityLabel="Period"
      fullWidth={fullWidth}
      value={period}
      onChange={handlePeriodChange}
      options={PERIODS.map((p) => ({ key: p, label: PERIOD_LABELS[p] }))}
    />
  );

  const exportButton = <AdminButton label="Excel" variant="accent" icon="download-outline" onPress={handleExport} loading={exporting} />;

  const emptyState = <EmptyState icon="document-text-outline" title="No data for this period." />;

  const table = loading ? (
    <View style={{ padding: 18 }}>
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
    <SkeletonRows rows={8} />
  ) : rows.length === 0 ? (
    emptyState
  ) : (
    <DesktopDataTable columns={D_COLUMNS_BY_REPORT[report]} rows={rows} keyExtractor={(_, i) => String(i)} />
  );

  if (isDesktop) {
    return (
      <AdminDesktopFrame
        activeKey="AdminDashboard"
        breadcrumb={`Home › ${label}`}
        showRail={false}
        scrollable={false}
        headerRight={
          <View style={styles.dHeaderRight}>
            {periodControl(false)}
            {exportButton}
          </View>
        }
      >
        <View>
          <PageTitle>{label}</PageTitle>
          <Muted style={styles.dLede}>{rowCount}</Muted>
        </View>
        <Tile style={styles.dTableCard}>{desktopTable}</Tile>
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title={label} />

      <View style={styles.toolbar}>
        <View style={styles.toolbarTop}>
          <Text style={styles.totalText}>{rowCount}</Text>
          {exportButton}
        </View>
        {periodControl(true)}
      </View>
      <Tile padded={false} style={styles.tableCard}>
        {table}
      </Tile>
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
    toolbar: { paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
    toolbarTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    totalText: { ...adminFont.bodySemiBold, ...tabularNums, fontSize: 15, color: c.ink },
    tableCard: { flex: 1, marginHorizontal: 16, marginBottom: 16, overflow: 'hidden' },
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
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.edge,
    },
    dataRowLast: { borderBottomWidth: 0 },
    dataCell: { ...adminFont.body, ...tabularNums, fontSize: 13.5, color: c.ink, paddingRight: 8 },
    dHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    dLede: { marginTop: 4 },
    dTableCard: { flex: 1, paddingVertical: 8, paddingHorizontal: 10, overflow: 'hidden' },
  });
}
