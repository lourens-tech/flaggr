import React, { useState, useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminStatCard } from '../../components/admin/AdminStatCard';
import { BarChart } from '../../components/common/BarChart';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { DesktopStatCard } from '../../components/admin/desktop/DesktopStatCard';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { AdminButton, CircleButton, ErrorState, Muted, PageTitle, Segmented, SkeletonRows, StatusPill, Tile } from '../../components/admin/ui';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { SuperAdminMemberStats } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

type Period = 'month' | 'year' | 'all';
const PERIOD_LABELS: Record<Period, string> = { month: 'Month', year: 'Year', all: 'All' };
const PERIODS: Period[] = ['month', 'year', 'all'];
const PERIOD_OPTIONS = PERIODS.map((p) => ({ key: p, label: PERIOD_LABELS[p] }));

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminMemberStats'>;

// Same shape/look as AdminMemberStatsScreen (a course_admin looking up one of
// their own members), just reachable for any member platform-wide — see
// SuperAdminReportsScreen's "Look Up a Member" section.
export function SuperAdminMemberStatsScreen({ route }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
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
    <Segmented options={PERIOD_OPTIONS} value={period} onChange={handlePeriodChange} accessibilityLabel="Period" />
  );

  const giftDisabled = !giftAmountValid || !giftReason.trim() || giftSubmitting;

  const giftModal = (
    <Modal visible={giftModalOpen} transparent animationType="fade" onRequestClose={() => setGiftModalOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.giftSheet} accessibilityViewIsModal>
            <View style={styles.giftSheetHeader}>
              <Text style={styles.giftSheetTitle} accessibilityRole="header">Gift Flagrr Cash</Text>
              <CircleButton icon="close" size={36} onPress={() => setGiftModalOpen(false)} accessibilityLabel="Close" />
            </View>
            <Text style={styles.giftSheetHint}>
              Enter a negative number to deduct instead. {data?.member.firstName ?? 'The member'} will be sent a
              notification with the reason below either way.
            </Text>
            <TextInput
              placeholder="Amount (e.g. 100 or -50)"
              placeholderTextColor={c.ink3}
              value={giftAmount}
              onChangeText={setGiftAmount}
              keyboardType="numbers-and-punctuation"
              style={styles.giftAmountInput}
              accessibilityLabel="Amount"
            />
            <View style={{ height: 10 }} />
            <TextInput
              placeholder="Reason (e.g. Birthday gift, goodwill correction…)"
              placeholderTextColor={c.ink3}
              value={giftReason}
              onChangeText={setGiftReason}
              multiline
              style={styles.giftReasonInput}
              accessibilityLabel="Reason"
            />
            <View style={styles.giftModalActions}>
              <AdminButton label="Cancel" variant="glass" onPress={() => setGiftModalOpen(false)} />
              <AdminButton
                label={parsedGiftAmount < 0 ? 'Deduct' : 'Gift'}
                variant="accent"
                onPress={handleSubmitGift}
                disabled={giftDisabled}
                loading={giftSubmitting}
                style={styles.giftSubmitButton}
              />
            </View>
          </View>
        </View>
      </Modal>
  );

  const nameTitle = data ? `${data.member.firstName} ${data.member.lastName}` : 'Member Stats';

  const giftButton = <AdminButton label="Gift Flagrr Cash" icon="gift-outline" variant="accent" onPress={openGiftModal} />;
  const errorState = <ErrorState title="Couldn’t load member" onRetry={() => load(period)} />;

  if (isDesktop) {
    const initials = data ? `${data.member.firstName.charAt(0)}${data.member.lastName.charAt(0)}`.toUpperCase() : '';
    return (
      <>
        <SuperAdminDesktopFrame activeKey="SuperAdminReports" breadcrumb={`Reports › ${nameTitle}`} headerRight={periodToggle} showRail={false}>
          <View style={styles.dHead}>
            {data ? (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            ) : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <PageTitle>{nameTitle}</PageTitle>
              {data ? <Muted style={styles.dPageSubtitle}>{data.member.email} · {data.member.courseName}</Muted> : null}
            </View>
            {data ? (
              <>
                <StatusPill label={`${data.member.tier} Member`} tone="neutral" style={styles.tierPill} />
                <Text style={styles.dBalanceText}>{data.member.balance.toLocaleString()} FC Balance</Text>
                {giftButton}
              </>
            ) : null}
          </View>

          {loading && !data ? (
            <View style={styles.dStatRow}>
              <Tile style={{ flex: 1 }}>
                <SkeletonRows rows={2} />
              </Tile>
            </View>
          ) : data ? (
            <>
              <View style={styles.dStatRow}>
                <DesktopStatCard label="Rounds (9 Holes)" value={data.stats.roundsPlayed9} icon="golf-outline" deltaPct={data.stats.roundsPlayed9DeltaPct} showDelta={period !== 'all'} />
                <DesktopStatCard label="Rounds (18 Holes)" value={data.stats.roundsPlayed18} icon="golf-outline" deltaPct={data.stats.roundsPlayed18DeltaPct} showDelta={period !== 'all'} />
                <DesktopStatCard label="Flagrr Cash Earned" value={data.stats.bucksEarned.toLocaleString()} icon="trending-up-outline" deltaPct={data.stats.bucksEarnedDeltaPct} showDelta={period !== 'all'} />
                <DesktopStatCard label="Flagrr Cash Redeemed" value={data.stats.bucksRedeemed.toLocaleString()} icon="swap-horizontal-outline" deltaPct={data.stats.bucksRedeemedDeltaPct} showDelta={period !== 'all'} />
                <DesktopStatCard label="Receipts Scanned" value={data.stats.receiptsScanned} icon="receipt-outline" deltaPct={data.stats.receiptsScannedDeltaPct} showDelta={period !== 'all'} />
              </View>

              <DesktopPanel title="Flagrr Cash Earned Per Month" style={{ marginTop: 12 }}>
                <BarChart data={data.stats.monthly} height={130} />
              </DesktopPanel>
            </>
          ) : (
            <View style={{ marginTop: 16 }}>{errorState}</View>
          )}
        </SuperAdminDesktopFrame>
        {giftModal}
      </>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader
        title={nameTitle}
        subtitle={data ? `${data.member.email} · ${data.member.courseName}` : undefined}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsHeaderRow}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Overview</Text>
          {periodToggle}
        </View>

        {loading && !data ? (
          <Tile>
            <SkeletonRows rows={3} />
          </Tile>
        ) : data ? (
          <>
            <Tile style={styles.mSummary}>
              <View style={styles.tierRow}>
                <StatusPill label={`${data.member.tier} Member`} tone="neutral" />
                <Text style={styles.balanceText}>{data.member.balance.toLocaleString()} FC Balance</Text>
              </View>
              <AdminButton label="Gift Flagrr Cash" icon="gift-outline" variant="accent" onPress={openGiftModal} fullWidth size="lg" />
            </Tile>

            <View style={styles.statsGrid}>
              <View style={styles.statsRow}>
                <AdminStatCard
                  label="Rounds (9 Holes)"
                  value={data.stats.roundsPlayed9}
                  icon="golf-outline"
                  deltaPct={data.stats.roundsPlayed9DeltaPct}
                  showDelta={period !== 'all'}
                  fill
                />
                <AdminStatCard
                  label="Rounds (18 Holes)"
                  value={data.stats.roundsPlayed18}
                  icon="golf-outline"
                  deltaPct={data.stats.roundsPlayed18DeltaPct}
                  showDelta={period !== 'all'}
                  fill
                />
              </View>
              <View style={styles.statsRow}>
                <AdminStatCard
                  label="Flagrr Cash Earned"
                  value={data.stats.bucksEarned.toLocaleString()}
                  icon="trending-up-outline"
                  deltaPct={data.stats.bucksEarnedDeltaPct}
                  showDelta={period !== 'all'}
                  fill
                />
                <AdminStatCard
                  label="Flagrr Cash Redeemed"
                  value={data.stats.bucksRedeemed.toLocaleString()}
                  icon="swap-horizontal-outline"
                  deltaPct={data.stats.bucksRedeemedDeltaPct}
                  showDelta={period !== 'all'}
                  fill
                />
              </View>
              <AdminStatCard
                label="Receipts Scanned"
                value={data.stats.receiptsScanned}
                icon="receipt-outline"
                deltaPct={data.stats.receiptsScannedDeltaPct}
                showDelta={period !== 'all'}
                width="100%"
              />
            </View>

            <Tile>
              <Text style={styles.chartTitle}>Flagrr Cash Earned Per Month</Text>
              <BarChart data={data.stats.monthly} />
            </Tile>
          </>
        ) : (
          errorState
        )}
      </ScrollView>

      {giftModal}
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 16, paddingBottom: 64 },
  statsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  sectionTitle: { ...adminFont.bodyBold, fontSize: 17, color: c.ink },
  mSummary: { gap: 14, marginBottom: 12 },
  tierRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  balanceText: { ...adminFont.bodyBold, ...tabularNums, fontSize: 16, color: c.ink },
  backdrop: { flex: 1, backgroundColor: c.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
  giftSheet: {
    backgroundColor: c.surface,
    borderRadius: adminRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.edge,
    padding: 22,
    width: '100%',
    maxWidth: 440,
  },
  giftSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 12 },
  giftSheetTitle: { ...adminFont.bodyBold, fontSize: 19, color: c.ink, flex: 1 },
  giftSheetHint: { ...adminFont.body, fontSize: 13.5, color: c.ink2, marginBottom: 14, lineHeight: 19 },
  giftAmountInput: {
    backgroundColor: c.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.edge,
    borderRadius: adminRadius.sm,
    paddingHorizontal: 14,
    minHeight: 46,
    ...adminFont.body,
    ...tabularNums,
    fontSize: 15,
    color: c.ink,
  },
  giftReasonInput: {
    backgroundColor: c.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.edge,
    borderRadius: adminRadius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 88,
    ...adminFont.body,
    fontSize: 15,
    color: c.ink,
    textAlignVertical: 'top',
  },
  giftModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  giftSubmitButton: { minWidth: 96 },
  statsGrid: { gap: 10, marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 10 },
  chartTitle: { ...adminFont.bodyBold, fontSize: 15, color: c.ink, marginBottom: 14 },
  dHead: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  // Fairway crest with lime initials: the avatar treatment the brand keeps.
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1F4234', alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...adminFont.bodyBold, fontSize: 18, color: '#CDDE5C' },
  dPageSubtitle: { marginTop: 4 },
  tierPill: { alignSelf: 'center' },
  dBalanceText: { ...adminFont.bodyBold, ...tabularNums, fontSize: 22, color: c.ink },
  dStatRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 18 },
});
}
