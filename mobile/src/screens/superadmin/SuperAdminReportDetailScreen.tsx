import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { DesktopDataTable, TableAvatarCell, TableTag, TableText, statusTone, type DesktopTableColumn } from '../../components/admin/desktop/DesktopDataTable';
import { AdminApiError, downloadSuperAdminReport } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { SuperAdminMemberReportRow, SuperAdminRedemptionReportRow, SuperAdminReportKind } from '../../data/adminTypes';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminReportDetail'>;

type Period = 'month' | 'year' | 'all';
const PERIOD_LABELS: Record<Period, string> = { month: 'Month', year: 'Year', all: 'All' };
const PERIODS: Period[] = ['month', 'year', 'all'];

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
  },
  { key: 'courseName', label: 'Club', width: 150, render: (r) => <TableText>{r.courseName}</TableText> },
  { key: 'tier', label: 'Tier', width: 100, render: (r) => <TableTag label={r.tier} /> },
  { key: 'memberSince', label: 'Member Since', width: 160, render: (r) => <TableText muted>{formatDate(r.memberSince)}</TableText> },
  { key: 'balance', label: 'FC Balance', width: 100, align: 'right', render: (r) => <TableText>{r.balance.toLocaleString()}</TableText> },
  { key: 'totalEarned', label: 'FC Earned', width: 100, align: 'right', render: (r) => <TableText>{r.totalEarned.toLocaleString()}</TableText> },
  { key: 'totalRedeemed', label: 'FC Redeemed', width: 110, align: 'right', render: (r) => <TableText>{r.totalRedeemed.toLocaleString()}</TableText> },
];

const D_REDEMPTION_COLUMNS: DesktopTableColumn<SuperAdminRedemptionReportRow>[] = [
  { key: 'code', label: 'Code', width: 110, render: (r) => <TableText>{r.code}</TableText> },
  {
    key: 'member',
    label: 'Member',
    width: 220,
    render: (r) => <TableAvatarCell name={r.memberName} subtitle={r.memberEmail} />,
  },
  { key: 'courseName', label: 'Club', width: 150, render: (r) => <TableText>{r.courseName}</TableText> },
  { key: 'reward', label: 'Reward', width: 170, render: (r) => <TableText>{r.rewardTitle}</TableText> },
  { key: 'variant', label: 'Variant', width: 130, render: (r) => <TableText>{r.variantLabel}</TableText> },
  { key: 'cost', label: 'Flagrr Cash', width: 100, align: 'right', render: (r) => <TableText>{r.cost.toLocaleString()}</TableText> },
  { key: 'status', label: 'Status', width: 110, render: (r) => <TableTag label={r.status} tone={statusTone(r.status)} /> },
  { key: 'issuedAt', label: 'Issued At', width: 160, render: (r) => <TableText muted>{formatDate(r.issuedAt)}</TableText> },
  {
    key: 'redeemedAt',
    label: 'Redeemed At',
    width: 160,
    render: (r) => <TableText muted>{r.redeemedAt ? formatDate(r.redeemedAt) : '—'}</TableText>,
  },
];

const D_COLUMNS_BY_REPORT: Record<SuperAdminReportKind, DesktopTableColumn<Row>[]> = {
  crossClubMembers: D_MEMBER_COLUMNS as DesktopTableColumn<Row>[],
  crossClubRedemptions: D_REDEMPTION_COLUMNS as DesktopTableColumn<Row>[],
};

// Cross-club counterpart of AdminReportDetailScreen — backs super_admin's
// Tier Distribution ('crossClubMembers') and Top Redeemed Rewards
// ('crossClubRedemptions') cards on SuperAdminReportsScreen.
export function SuperAdminReportDetailScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  const desktopTable = loading ? (
    <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
  ) : rows.length === 0 ? (
    <Text style={styles.emptyText}>No data for this period.</Text>
  ) : (
    <DesktopDataTable columns={D_COLUMNS_BY_REPORT[report]} rows={rows} keyExtractor={(_, i) => String(i)} />
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminReports" breadcrumb={label} showRail={false} scrollable={false}>
        <Text style={styles.dPageTitle}>{label}</Text>
        <View style={styles.dTableCard}>
          {toolbar}
          {desktopTable}
        </View>
      </SuperAdminDesktopFrame>
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
