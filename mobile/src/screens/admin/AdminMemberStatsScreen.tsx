import React, { useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { StatCard } from '../../components/common/StatCard';
import { BarChart } from '../../components/common/BarChart';
import { useAdmin } from '../../context/AdminContext';
import { downloadReport, AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { MemberStats } from '../../data/adminTypes';

type Period = 'month' | 'year' | 'all';
const PERIOD_LABELS: Record<Period, string> = { month: 'Month', year: 'Year', all: 'All' };
const PERIODS: Period[] = ['month', 'year', 'all'];
// "All" has no prior window to compare against (see api/_lib/periods.ts),
// so its deltaPct is always forced to 0 server-side — show no delta at all
// there rather than a misleading "0%".
const DELTA_LABELS: Record<Period, string> = { month: 'vs Last Month', year: 'vs Last Year', all: '' };

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminMemberStats'>;

export function AdminMemberStatsScreen({ route, navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { memberId } = route.params;
  const { getMemberStats } = useAdmin();
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<MemberStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = async (p: Period) => {
    setLoading(true);
    try {
      setData(await getMemberStats(memberId, p));
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t load member', message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    load(p);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const downloaded = await downloadReport('memberActivity', period, {
        userId: memberId,
        filename: data ? `${data.member.firstName}-${data.member.lastName}-activity.xlsx` : 'member-activity.xlsx',
      });
      if (!downloaded) {
        showAlert('Web only for now', 'Excel export is available on the Flagrr web app — open your dashboard in a browser to download this report.');
      }
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t generate report', message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {data ? `${data.member.firstName} ${data.member.lastName}` : 'Member Stats'}
            </Text>
            {data ? <Text style={styles.headerSubtitle} numberOfLines={1}>{data.member.email}</Text> : null}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsHeaderRow}>
          <Text style={styles.sectionTitle}>Overview</Text>
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
        </View>

        {loading && !data ? (
          <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
        ) : data ? (
          <>
            <View style={styles.tierRow}>
              <View style={styles.tierPill}>
                <Ionicons name="trophy-outline" size={14} color={colors.textPrimary} />
                <Text style={styles.tierPillText}>{data.member.tier} Member</Text>
              </View>
              <Text style={styles.balanceText}>{data.member.balance.toLocaleString()} FC Balance</Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statsRow}>
                <StatCard
                  label="Rounds (9 Holes)"
                  value={data.stats.roundsPlayed9}
                  deltaPct={data.stats.roundsPlayed9DeltaPct}
                  deltaLabel={DELTA_LABELS[period]}
                  showDelta={period !== 'all'}
                  fill
                  backgroundColor={colors.mintBg}
                />
                <StatCard
                  label="Rounds (18 Holes)"
                  value={data.stats.roundsPlayed18}
                  deltaPct={data.stats.roundsPlayed18DeltaPct}
                  deltaLabel={DELTA_LABELS[period]}
                  showDelta={period !== 'all'}
                  fill
                  backgroundColor={colors.mintBg}
                />
              </View>
              <View style={styles.statsRow}>
                <StatCard
                  label="Flagrr Cash Earned"
                  value={data.stats.bucksEarned.toLocaleString()}
                  deltaPct={data.stats.bucksEarnedDeltaPct}
                  deltaLabel={DELTA_LABELS[period]}
                  showDelta={period !== 'all'}
                  fill
                  backgroundColor={colors.mintBg}
                />
                <StatCard
                  label="Flagrr Cash Redeemed"
                  value={data.stats.bucksRedeemed.toLocaleString()}
                  deltaPct={data.stats.bucksRedeemedDeltaPct}
                  deltaLabel={DELTA_LABELS[period]}
                  showDelta={period !== 'all'}
                  fill
                  backgroundColor={colors.mintBg}
                />
              </View>
              <StatCard
                label="Receipts Scanned"
                value={data.stats.receiptsScanned}
                deltaPct={data.stats.receiptsScannedDeltaPct}
                deltaLabel={DELTA_LABELS[period]}
                showDelta={period !== 'all'}
                width="100%"
                backgroundColor={colors.mintBg}
              />
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Flagrr Cash Earned Per Month</Text>
              <BarChart data={data.stats.monthly} />
            </View>

            <View style={styles.card}>
              <TouchableOpacity style={styles.downloadRow} onPress={handleExport} disabled={exporting}>
                <Ionicons name="download-outline" size={20} color={colors.clubGreen} />
                <Text style={styles.downloadLabel}>Download Member Excel Report</Text>
                {exporting ? <ActivityIndicator color={colors.clubGreen} size="small" /> : null}
              </TouchableOpacity>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  header: {
    paddingHorizontal: screenPadding,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fontFamily.headingDisplay, fontSize: fontSize.title, color: colors.white },
  headerSubtitle: { fontFamily: fontFamily.body, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  content: { padding: screenPadding, paddingBottom: spacing.xl * 2 },
  statsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  periodToggle: {
    flexDirection: 'row',
    backgroundColor: colors.mintBg,
    borderRadius: radius.pill,
    padding: 3,
  },
  periodPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  periodPillActive: { backgroundColor: colors.darkGreen },
  periodText: { fontFamily: fontFamily.heading, fontSize: 12, color: colors.textPrimary },
  periodTextActive: { color: colors.white },
  sectionTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.textPrimary, marginBottom: spacing.sm },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.mintBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  tierPillText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.textPrimary },
  balanceText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  statsGrid: { gap: spacing.sm, marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', gap: 10 },
  chartCard: {
    backgroundColor: colors.mintBg,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  chartTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.small, color: colors.textPrimary, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.mintBg,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  downloadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  downloadLabel: { flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
});
}
