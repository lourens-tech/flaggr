import React, { useState, useMemo } from 'react';
import { ActivityIndicator, Modal, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { StatCard } from '../../components/common/StatCard';
import { BarChart } from '../../components/common/BarChart';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { DesktopStatCard } from '../../components/admin/desktop/DesktopStatCard';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { SuperAdminMemberStats } from '../../data/adminTypes';

type Period = 'month' | 'year' | 'all';
const PERIOD_LABELS: Record<Period, string> = { month: 'Month', year: 'Year', all: 'All' };
const PERIODS: Period[] = ['month', 'year', 'all'];
const DELTA_LABELS: Record<Period, string> = { month: 'vs Last Month', year: 'vs Last Year', all: '' };

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminMemberStats'>;

// Same shape/look as AdminMemberStatsScreen (a course_admin looking up one of
// their own members), just reachable for any member platform-wide — see
// SuperAdminReportsScreen's "Look Up a Member" section.
export function SuperAdminMemberStatsScreen({ route, navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDesktop = useIsDesktopNav();
  const { memberId } = route.params;
  const { getSuperAdminMemberStats, giftFlagrrCash } = useAdmin();
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<SuperAdminMemberStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [giftAmount, setGiftAmount] = useState('');
  const [giftReason, setGiftReason] = useState('');
  const [giftSubmitting, setGiftSubmitting] = useState(false);

  const load = async (p: Period) => {
    setLoading(true);
    try {
      setData(await getSuperAdminMemberStats(memberId, p));
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t load member', message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    load(p);
  };

  const openGiftModal = () => {
    setGiftAmount('');
    setGiftReason('');
    setGiftModalOpen(true);
  };

  const parsedGiftAmount = Number(giftAmount);
  const giftAmountValid = giftAmount.trim() !== '' && Number.isInteger(parsedGiftAmount) && parsedGiftAmount !== 0;

  const handleSubmitGift = async () => {
    if (!giftAmountValid || !giftReason.trim()) return;
    setGiftSubmitting(true);
    try {
      const { newBalance } = await giftFlagrrCash(memberId, parsedGiftAmount, giftReason.trim());
      setData((prev) => (prev ? { ...prev, member: { ...prev.member, balance: newBalance } } : prev));
      setGiftModalOpen(false);
      showAlert(
        parsedGiftAmount > 0 ? 'Flagrr Cash gifted' : 'Flagrr Cash adjusted',
        `${data?.member.firstName ?? 'The member'}'s new balance is ${newBalance.toLocaleString()} FC.`,
      );
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t update balance', message);
    } finally {
      setGiftSubmitting(false);
    }
  };

  const periodToggle = (
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
  );

  const giftModal = (
    <Modal visible={giftModalOpen} transparent animationType="fade" onRequestClose={() => setGiftModalOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.giftSheet}>
            <View style={styles.giftSheetHeader}>
              <Text style={styles.giftSheetTitle}>Gift Flagrr Cash</Text>
              <TouchableOpacity onPress={() => setGiftModalOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.giftSheetHint}>
              Enter a negative number to deduct instead. {data?.member.firstName ?? 'The member'} will be sent a
              notification with the reason below either way.
            </Text>
            <TextInput
              placeholder="Amount (e.g. 100 or -50)"
              placeholderTextColor={colors.textSecondary}
              value={giftAmount}
              onChangeText={setGiftAmount}
              keyboardType="numbers-and-punctuation"
              style={styles.giftAmountInput}
            />
            <View style={{ height: spacing.sm }} />
            <TextInput
              placeholder="Reason (e.g. Birthday gift, goodwill correction…)"
              placeholderTextColor={colors.textSecondary}
              value={giftReason}
              onChangeText={setGiftReason}
              multiline
              style={styles.giftReasonInput}
            />
            <View style={styles.giftModalActions}>
              <TouchableOpacity style={styles.giftCancelButton} onPress={() => setGiftModalOpen(false)}>
                <Text style={styles.giftCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.giftSubmitButton, (!giftAmountValid || !giftReason.trim() || giftSubmitting) && styles.giftSubmitButtonDisabled]}
                onPress={handleSubmitGift}
                disabled={!giftAmountValid || !giftReason.trim() || giftSubmitting}
              >
                {giftSubmitting ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.giftSubmitText}>{parsedGiftAmount < 0 ? 'Deduct' : 'Gift'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
  );

  const nameTitle = data ? `${data.member.firstName} ${data.member.lastName}` : 'Member Stats';

  if (isDesktop) {
    return (
      <>
        <SuperAdminDesktopFrame activeKey="SuperAdminReports" breadcrumb={nameTitle} headerRight={periodToggle} showRail={false}>
          <Text style={styles.dPageTitle}>{nameTitle}</Text>
          {data ? <Text style={styles.dPageSubtitle}>{data.member.email} · {data.member.courseName}</Text> : null}

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

              <TouchableOpacity style={styles.giftButton} onPress={openGiftModal}>
                <Ionicons name="gift-outline" size={16} color={colors.white} />
                <Text style={styles.giftButtonText}>Gift Flagrr Cash</Text>
              </TouchableOpacity>

              <View style={styles.dStatRow}>
                <DesktopStatCard label="Rounds (9 Holes)" value={data.stats.roundsPlayed9} icon="golf-outline" deltaPct={data.stats.roundsPlayed9DeltaPct} showDelta={period !== 'all'} />
                <DesktopStatCard label="Rounds (18 Holes)" value={data.stats.roundsPlayed18} icon="golf-outline" deltaPct={data.stats.roundsPlayed18DeltaPct} showDelta={period !== 'all'} />
                <DesktopStatCard label="Flagrr Cash Earned" value={data.stats.bucksEarned.toLocaleString()} icon="trending-up-outline" deltaPct={data.stats.bucksEarnedDeltaPct} showDelta={period !== 'all'} />
                <DesktopStatCard label="Flagrr Cash Redeemed" value={data.stats.bucksRedeemed.toLocaleString()} icon="swap-horizontal-outline" deltaPct={data.stats.bucksRedeemedDeltaPct} showDelta={period !== 'all'} />
                <DesktopStatCard label="Receipts Scanned" value={data.stats.receiptsScanned} icon="receipt-outline" deltaPct={data.stats.receiptsScannedDeltaPct} showDelta={period !== 'all'} />
              </View>

              <DesktopPanel title="Flagrr Cash Earned Per Month">
                <BarChart data={data.stats.monthly} height={130} />
              </DesktopPanel>
            </>
          ) : null}
        </SuperAdminDesktopFrame>
        {giftModal}
      </>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{nameTitle}</Text>
            {data ? (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {data.member.email} · {data.member.courseName}
              </Text>
            ) : null}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsHeaderRow}>
          <Text style={styles.sectionTitle}>Overview</Text>
          {periodToggle}
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

            <TouchableOpacity style={styles.giftButton} onPress={openGiftModal}>
              <Ionicons name="gift-outline" size={16} color={colors.white} />
              <Text style={styles.giftButtonText}>Gift Flagrr Cash</Text>
            </TouchableOpacity>

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
          </>
        ) : null}
      </ScrollView>

      {giftModal}
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
  giftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.clubGreen,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  giftButtonText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.small, color: colors.white },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: screenPadding },
  giftSheet: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    width: '100%',
    maxWidth: 420,
  },
  giftSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  giftSheetTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.cardTitle, color: colors.textPrimary },
  giftSheetHint: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginBottom: spacing.sm, lineHeight: 17 },
  giftAmountInput: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textPrimary,
  },
  giftReasonInput: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 80,
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  giftModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  giftCancelButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  giftCancelText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.small, color: colors.textSecondary },
  giftSubmitButton: {
    backgroundColor: colors.clubGreen,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minWidth: 72,
    alignItems: 'center',
  },
  giftSubmitButtonDisabled: { opacity: 0.5 },
  giftSubmitText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.small, color: colors.white },
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
  dPageTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.textPrimary },
  dPageSubtitle: { fontFamily: fontFamily.body, fontSize: 13, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md },
  dStatRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', marginTop: spacing.md },
});
}
