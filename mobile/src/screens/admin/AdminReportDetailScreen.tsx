import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { downloadReport, AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { CourseReportKind, MemberReportRow, RedemptionReportRow, ReceiptReportRow } from '../../data/adminTypes';

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

// A single generic detail page for every Overview stat card — 'redemptions'
// backs Flagrr Cash Redeemed, 'receipts' backs both Flagrr Cash Earned and
// Receipts Scanned (same underlying receipts either way), and 'members'
// backs both Members (period='all') and New Members (period-filtered).
// Shows the exact same rows the Excel download produces, so the on-screen
// table and the file always agree.
export function AdminReportDetailScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  const toolbar = (
    <View style={styles.toolbar}>
      <Text style={styles.totalText}>{rows.length.toLocaleString()} row{rows.length === 1 ? '' : 's'}</Text>
      <View style={styles.toolbarRight}>
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
    </View>
  );

  const table = loading ? (
    <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
  ) : rows.length === 0 ? (
    <Text style={styles.emptyText}>No data for this period.</Text>
  ) : (
    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
      <View>
        <View style={styles.headerRow}>
          {columns.map((c) => (
            <Text key={c.key} style={[styles.headerCell, { width: c.width }]} numberOfLines={1}>
              {c.label}
            </Text>
          ))}
        </View>
        <ScrollView showsVerticalScrollIndicator style={styles.verticalScroll}>
          {rows.map((row, i) => (
            <View key={i} style={[styles.dataRow, i % 2 === 1 && styles.dataRowAlt]}>
              {columns.map((c) => (
                <Text key={c.key} style={[styles.dataCell, { width: c.width }]} numberOfLines={1}>
                  {c.render(row)}
                </Text>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="" breadcrumb={label} showRail={false} scrollable={false}>
        <Text style={styles.dPageTitle}>{label}</Text>
        <View style={styles.dTableCard}>
          {toolbar}
          {table}
        </View>
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title={label} onBack={() => navigation.goBack()} />
      </SafeAreaView>

      {toolbar}
      {table}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  totalText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  toolbarRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  periodToggle: { flexDirection: 'row', backgroundColor: colors.mintBg, borderRadius: radius.pill, padding: 3 },
  periodPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  periodPillActive: { backgroundColor: colors.darkGreen },
  periodText: { fontFamily: fontFamily.heading, fontSize: 12, color: colors.textPrimary },
  periodTextActive: { color: colors.white },
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
  tableScroll: { flex: 1 },
  verticalScroll: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: colors.darkGreen,
    paddingHorizontal: screenPadding,
    paddingVertical: spacing.sm,
  },
  headerCell: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.white, paddingRight: spacing.sm },
  dataRow: {
    flexDirection: 'row',
    paddingHorizontal: screenPadding,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(31,66,52,0.08)',
  },
  dataRowAlt: { backgroundColor: colors.mintBg },
  dataCell: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textPrimary, paddingRight: spacing.sm },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  dPageTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.textPrimary },
  dTableCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
});
}
