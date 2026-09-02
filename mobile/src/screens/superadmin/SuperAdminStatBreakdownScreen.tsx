import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError, downloadSuperAdminStatBreakdown } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { StatBreakdownRow } from '../../data/adminTypes';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminStatBreakdown'>;

type Period = 'month' | 'year' | 'all';
const PERIOD_LABELS: Record<Period, string> = { month: 'Month', year: 'Year', all: 'All' };
const PERIODS: Period[] = ['month', 'year', 'all'];

// Drills into a single Reports-screen stat card (tapped from
// SuperAdminReportsScreen) to show every club's own number behind that
// aggregate, sorted highest first.
export function SuperAdminStatBreakdownScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title={label} onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <View style={styles.toolbar}>
        <Text style={styles.totalText}>{total.toLocaleString()} total</Text>
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

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.courseId}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <View style={styles.row}>
              <Text style={styles.rank}>{index + 1}</Text>
              <Text style={styles.rowLabel} numberOfLines={1}>{item.courseName}</Text>
              <Text style={styles.rowValue}>{item.value.toLocaleString()}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No clubs yet.</Text>}
        />
      )}
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
  listContent: { padding: screenPadding, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.mintBg,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  rank: { fontFamily: fontFamily.heading, fontSize: fontSize.body, color: colors.textSecondary, width: 20 },
  rowLabel: { flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  rowValue: { fontFamily: fontFamily.heading, fontSize: fontSize.body, color: colors.textPrimary },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
}
