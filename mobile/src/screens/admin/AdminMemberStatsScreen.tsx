import React, { useEffect, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { AdminStatCard } from '../../components/admin/AdminStatCard';
import { BarChart } from '../../components/common/BarChart';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { DesktopStatCard } from '../../components/admin/desktop/DesktopStatCard';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { downloadReport, AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { MemberStats } from '../../data/adminTypes';
import { adminFont, adminRadius, type AdminColors } from '../../theme/admin';
import { AdminButton, Muted, PageTitle, Segmented, SkeletonRows, StatusPill, Tile } from '../../components/admin/ui';

// Brand constants for member avatars: Fairway ground, lime initials.
const FAIRWAY = '#1F4234';
const LIME = '#CDDE5C';

type Period = 'month' | 'year' | 'all';
const PERIOD_LABELS: Record<Period, string> = { month: 'Month', year: 'Year', all: 'All' };
const PERIODS: Period[] = ['month', 'year', 'all'];

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminMemberStats'>;

export function AdminMemberStatsScreen({ route, navigation }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
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

  const periodToggle = (fullWidth: boolean) => (
    <Segmented
      accessibilityLabel="Period"
      fullWidth={fullWidth}
      value={period}
      onChange={handlePeriodChange}
      options={PERIODS.map((p) => ({ key: p, label: PERIOD_LABELS[p] }))}
    />
  );

  const memberName = data ? `${data.member.firstName} ${data.member.lastName}` : 'Member Stats';

  const tierRow = data ? (
    <View style={styles.tierRow}>
      <StatusPill label={`${data.member.tier} Member`} />
      <StatusPill label={`${data.member.balance.toLocaleString()} FC Balance`} />
    </View>
  ) : null;

  const downloadButton = (fullWidth: boolean) => (
    <AdminButton
      label="Download Member Excel Report"
      icon="download-outline"
      onPress={handleExport}
      loading={exporting}
      size={fullWidth ? 'lg' : 'md'}
      fullWidth={fullWidth}
      style={fullWidth ? undefined : { alignSelf: 'flex-start' }}
    />
  );

  if (isDesktop) {
    return (
      <AdminDesktopFrame
        activeKey="AdminDashboard"
        breadcrumb={`Home › ${memberName}`}
        headerRight={periodToggle(false)}
        showRail={false}
      >
        <View style={styles.dHead}>
          {data ? (
            <View style={styles.dAvatar} accessible={false}>
              <Text style={styles.dAvatarText}>{`${data.member.firstName.charAt(0)}${data.member.lastName.charAt(0)}`.toUpperCase()}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <PageTitle>{memberName}</PageTitle>
            {data ? <Muted style={styles.dPageSubtitle}>{data.member.email}</Muted> : null}
          </View>
        </View>

        {loading && !data ? (
          <Tile>
            <SkeletonRows rows={3} />
          </Tile>
        ) : data ? (
          <>
            {tierRow}

            <View style={styles.dStatRow}>
              <DesktopStatCard label="Rounds (9 Holes)" value={data.stats.roundsPlayed9} icon="golf-outline" deltaPct={data.stats.roundsPlayed9DeltaPct} showDelta={period !== 'all'} />
              <DesktopStatCard label="Rounds (18 Holes)" value={data.stats.roundsPlayed18} icon="golf-outline" deltaPct={data.stats.roundsPlayed18DeltaPct} showDelta={period !== 'all'} />
              <DesktopStatCard label="Flagrr Cash Earned" value={data.stats.bucksEarned.toLocaleString()} icon="trending-up-outline" deltaPct={data.stats.bucksEarnedDeltaPct} showDelta={period !== 'all'} />
              <DesktopStatCard label="Flagrr Cash Redeemed" value={data.stats.bucksRedeemed.toLocaleString()} icon="swap-horizontal-outline" deltaPct={data.stats.bucksRedeemedDeltaPct} showDelta={period !== 'all'} />
              <DesktopStatCard label="Receipts Scanned" value={data.stats.receiptsScanned} icon="receipt-outline" deltaPct={data.stats.receiptsScannedDeltaPct} showDelta={period !== 'all'} />
            </View>

            <DesktopPanel title="Flagrr Cash Earned Per Month">
              <BarChart data={data.stats.monthly} height={150} />
            </DesktopPanel>

            {downloadButton(false)}
          </>
        ) : null}
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title={memberName} subtitle={data ? data.member.email : undefined} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Overview</Text>
        {periodToggle(true)}

        {loading && !data ? (
          <Tile style={{ marginTop: 14 }}>
            <SkeletonRows rows={3} />
          </Tile>
        ) : data ? (
          <>
            <View style={{ marginTop: 14 }}>{tierRow}</View>

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

            <Tile style={styles.chartCard}>
              <Text accessibilityRole="header" style={styles.chartTitle}>Flagrr Cash Earned Per Month</Text>
              <BarChart data={data.stats.monthly} height={120} />
            </Tile>

            {downloadButton(true)}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
    content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 48 },
    sectionTitle: { ...adminFont.bodyBold, fontSize: 17, color: c.ink, marginBottom: 10 },
    tierRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    statsGrid: { gap: 10, marginTop: 14, marginBottom: 14 },
    statsRow: { flexDirection: 'row', gap: 10 },
    chartCard: { marginBottom: 16, gap: 14 },
    chartTitle: { ...adminFont.bodyBold, fontSize: 17, color: c.ink },
    dHead: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    dAvatar: {
      width: 56,
      height: 56,
      borderRadius: adminRadius.pill,
      backgroundColor: FAIRWAY,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dAvatarText: { ...adminFont.bodyBold, fontSize: 19, color: LIME },
    dPageSubtitle: { marginTop: 4 },
    dStatRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  });
}
