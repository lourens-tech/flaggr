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
import { AdminApiError, downloadSuperAdminClubMembers } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { MemberReportRow } from '../../data/adminTypes';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminClubMembers'>;

type Period = 'month' | 'year' | 'all';
const PERIOD_LABELS: Record<Period, string> = { month: 'Month', year: 'Year', all: 'All' };
const PERIODS: Period[] = ['month', 'year', 'all'];

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

// One club's own member table, opened by tapping a row on
// SuperAdminStatBreakdownScreen ('Members' / 'New Members' cards).
export function SuperAdminClubMembersScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  const toolbar = (
    <View style={styles.toolbar}>
      <Text style={styles.totalText}>{rows.length.toLocaleString()} member{rows.length === 1 ? '' : 's'}</Text>
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
    <Text style={styles.emptyText}>No members for this period.</Text>
  ) : (
    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
      <View>
        <View style={styles.headerRow}>
          {COLUMNS.map((c) => (
            <Text key={c.key} style={[styles.headerCell, { width: c.width }]} numberOfLines={1}>
              {c.label}
            </Text>
          ))}
        </View>
        <ScrollView showsVerticalScrollIndicator style={styles.verticalScroll}>
          {rows.map((row, i) => (
            <View key={i} style={[styles.dataRow, i % 2 === 1 && styles.dataRowAlt]}>
              {COLUMNS.map((c) => (
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
      <SuperAdminDesktopFrame activeKey="SuperAdminReports" breadcrumb={courseName} showRail={false} scrollable={false}>
        <Text style={styles.dPageTitle}>{courseName} — Members</Text>
        <View style={styles.dTableCard}>
          {toolbar}
          {table}
        </View>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title={courseName} onBack={() => navigation.goBack()} />
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
