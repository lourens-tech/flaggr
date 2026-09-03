import React, { useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList, AdminTabParamList } from '../../navigation/types';
import { StatCard } from '../../components/common/StatCard';
import { BarChart } from '../../components/common/BarChart';
import { AdminHeaderAvatar } from '../../components/common/AdminHeaderAvatar';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { DesktopStatCard } from '../../components/admin/desktop/DesktopStatCard';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { AdminMember } from '../../data/adminTypes';

const MEMBERS_PAGE_SIZE = 10;

type Period = 'month' | 'year' | 'all';
const PERIOD_LABELS: Record<Period, string> = { month: 'Month', year: 'Year', all: 'All' };
const PERIODS: Period[] = ['month', 'year', 'all'];
// "All" has no prior window to compare against (see api/_lib/periods.ts),
// so its deltaPct is always forced to 0 server-side — show no delta at all
// there rather than a misleading "0%".
const DELTA_LABELS: Record<Period, string> = { month: 'vs Last Month', year: 'vs Last Year', all: '' };

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabParamList, 'AdminDashboard'>,
  NativeStackScreenProps<AdminStackParamList>
>;

export function AdminDashboardScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDesktop = useIsDesktopNav();
  const {
    admin,
    course,
    dashboard,
    dashboardPeriod,
    dashboardLoading,
    setDashboardPeriod,
    refreshDashboard,
    unreadNotificationCount,
    searchMembers,
    listAllMembers,
  } = useAdmin();
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<AdminMember[]>([]);
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [allMembers, setAllMembers] = useState<AdminMember[]>([]);
  const [allMembersTotal, setAllMembersTotal] = useState(0);
  const [allMembersPage, setAllMembersPage] = useState(1);
  const [loadingAllMembers, setLoadingAllMembers] = useState(false);

  useEffect(() => {
    refreshDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchMembers = async () => {
    setSearchingMembers(true);
    try {
      setMemberResults(await searchMembers(memberSearch.trim()));
    } catch {
      setMemberResults([]);
    } finally {
      setSearchingMembers(false);
    }
  };

  const loadAllMembersPage = async (page: number) => {
    setLoadingAllMembers(true);
    try {
      const result = await listAllMembers(page, MEMBERS_PAGE_SIZE);
      setAllMembers(result.members);
      setAllMembersTotal(result.total);
      setAllMembersPage(result.page);
    } catch {
      setAllMembers([]);
    } finally {
      setLoadingAllMembers(false);
    }
  };

  const handleToggleAllMembers = () => {
    const next = !showAllMembers;
    setShowAllMembers(next);
    if (next && allMembers.length === 0) {
      loadAllMembersPage(1);
    }
  };

  const memberRow = (m: AdminMember, desktop: boolean) => (
    <TouchableOpacity
      key={m.id}
      style={desktop ? styles.dMemberRow : styles.memberRow}
      onPress={() => navigation.navigate('AdminMemberStats', { memberId: m.id })}
    >
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {desktop ? (
          <View style={styles.dMemberAvatar}>
            <Text style={styles.dMemberAvatarText}>{`${m.firstName.charAt(0)}${m.lastName.charAt(0)}`.toUpperCase()}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={desktop ? styles.dMemberName : styles.memberName}>{m.firstName} {m.lastName}</Text>
          <Text style={desktop ? styles.dMemberEmail : styles.memberEmail}>{m.email}</Text>
        </View>
      </View>
      <Text style={desktop ? styles.dMemberTier : styles.memberTier}>{m.tier}</Text>
      <Text style={desktop ? styles.dMemberBalance : styles.memberBalance}>{m.balance.toLocaleString()} FC</Text>
      {!desktop ? <Ionicons name="chevron-forward" size={18} color={colors.clubGreen} /> : null}
    </TouchableOpacity>
  );

  if (isDesktop) {
    const periodToggle = (
      <View style={styles.dPeriodToggle}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setDashboardPeriod(p)}
            style={[styles.dPeriodPill, dashboardPeriod === p && styles.dPeriodPillActive]}
          >
            <Text style={[styles.dPeriodText, dashboardPeriod === p && styles.dPeriodTextActive]}>{PERIOD_LABELS[p]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );

    return (
      <AdminDesktopFrame activeKey="AdminDashboard" breadcrumb="Dashboard" headerRight={periodToggle}>
        <View>
          <Text style={styles.dPageTitle}>{greeting()}, {admin.firstName}</Text>
          <Text style={styles.dPageSubtitle}>Here's how {course.name || 'your club'} is tracking this {dashboardPeriod === 'all' ? 'period' : dashboardPeriod}.</Text>
        </View>

        {dashboardLoading && !dashboard ? (
          <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
        ) : dashboard ? (
          <>
            <View style={styles.dStatRow}>
              <DesktopStatCard
                label="Members"
                value={dashboard.totals.members.toLocaleString()}
                icon="people-outline"
                onPress={() => navigation.navigate('AdminReportDetail', { report: 'members', label: 'Members', period: 'all' })}
              />
              <DesktopStatCard
                label="New Members"
                value={dashboard.totals.newMembers.toLocaleString()}
                icon="person-add-outline"
                onPress={() => navigation.navigate('AdminReportDetail', { report: 'members', label: 'New Members', period: dashboardPeriod })}
              />
              <DesktopStatCard
                label="Flagrr Cash Earned"
                value={dashboard.totals.fcEarned.toLocaleString()}
                icon="trending-up-outline"
                deltaPct={dashboard.totals.fcEarnedDeltaPct}
                showDelta={dashboardPeriod !== 'all'}
                onPress={() => navigation.navigate('AdminReportDetail', { report: 'receipts', label: 'Flagrr Cash Earned', period: dashboardPeriod })}
              />
              <DesktopStatCard
                label="Flagrr Cash Redeemed"
                value={dashboard.totals.fcRedeemed.toLocaleString()}
                icon="swap-horizontal-outline"
                deltaPct={dashboard.totals.fcRedeemedDeltaPct}
                showDelta={dashboardPeriod !== 'all'}
                onPress={() => navigation.navigate('AdminReportDetail', { report: 'redemptions', label: 'Flagrr Cash Redeemed', period: dashboardPeriod })}
              />
              <DesktopStatCard
                label="Receipts Scanned"
                value={dashboard.totals.receiptsScanned.toLocaleString()}
                icon="receipt-outline"
                deltaPct={dashboard.totals.receiptsScannedDeltaPct}
                showDelta={dashboardPeriod !== 'all'}
                onPress={() => navigation.navigate('AdminReportDetail', { report: 'receipts', label: 'Receipts Scanned', period: dashboardPeriod })}
              />
            </View>

            <View style={styles.dGrid2}>
              <DesktopPanel title="Members Joined This Year" style={{ flex: 1.35 }}>
                <BarChart data={dashboard.signupsByMonth} height={130} />
              </DesktopPanel>

              <DesktopPanel
                title="Tier Distribution"
                style={{ flex: 1 }}
                onViewAll={() => navigation.navigate('AdminReportDetail', { report: 'members', label: 'Tier Distribution', period: 'all' })}
              >
                {dashboard.tierDistribution.length === 0 ? (
                  <Text style={styles.dEmptyText}>No members yet.</Text>
                ) : (
                  (() => {
                    const max = Math.max(...dashboard.tierDistribution.map((t) => t.count), 1);
                    return dashboard.tierDistribution.map((t) => (
                      <View key={t.tier} style={styles.dTierRow}>
                        <Text style={styles.dTierTag}>{t.tier}</Text>
                        <View style={styles.dBarTrack}>
                          <View style={[styles.dBarFill, { width: `${Math.max(4, (t.count / max) * 100)}%` }]} />
                        </View>
                        <Text style={styles.dTierValue}>{t.count}</Text>
                      </View>
                    ));
                  })()
                )}
              </DesktopPanel>
            </View>

            <View style={styles.dGrid2}>
              <DesktopPanel
                title="Top Redeemed Rewards"
                style={{ flex: 1 }}
                onViewAll={() => navigation.navigate('AdminReportDetail', { report: 'redemptions', label: 'Top Redeemed Rewards', period: dashboardPeriod })}
              >
                {dashboard.topRewards.length === 0 ? (
                  <Text style={styles.dEmptyText}>No redemptions in this period.</Text>
                ) : (
                  dashboard.topRewards.map((r) => (
                    <View key={r.rewardId} style={styles.dRowLine}>
                      <Text style={styles.dRowName} numberOfLines={1}>{r.title}</Text>
                      <Text style={styles.dRowMeta}>{r.redemptions}× · {r.fcSpent.toLocaleString()} FC</Text>
                    </View>
                  ))
                )}
              </DesktopPanel>

              <DesktopPanel title="Look Up a Member" style={{ flex: 1 }}>
                <View style={styles.dLookupBar}>
                  <View style={{ flex: 1 }}>
                    <TextField
                      placeholder="Search by name or email"
                      variant="onLight"
                      value={memberSearch}
                      onChangeText={setMemberSearch}
                      onSubmitEditing={handleSearchMembers}
                      returnKeyType="search"
                    />
                  </View>
                  <PillButton label="Search" icon="search" variant="outline" onPress={handleSearchMembers} loading={searchingMembers} fullWidth={false} />
                </View>
                {memberResults.map((m) => memberRow(m, true))}

                <TouchableOpacity onPress={handleToggleAllMembers} style={styles.dViewAllRow} activeOpacity={0.7}>
                  <Text style={styles.dViewAllText}>View All Members</Text>
                  <Ionicons name={showAllMembers ? 'chevron-up' : 'chevron-down'} size={14} color={colors.clubGreen} />
                </TouchableOpacity>

                {showAllMembers ? (
                  loadingAllMembers && allMembers.length === 0 ? (
                    <ActivityIndicator color={colors.clubGreen} />
                  ) : (
                    <>
                      {allMembers.length === 0 ? (
                        <Text style={styles.dEmptyText}>No members yet.</Text>
                      ) : (
                        allMembers.map((m) => memberRow(m, true))
                      )}
                      <View style={styles.paginationRow}>
                        <TouchableOpacity
                          onPress={() => loadAllMembersPage(allMembersPage - 1)}
                          disabled={allMembersPage <= 1 || loadingAllMembers}
                          style={[styles.pageButton, (allMembersPage <= 1 || loadingAllMembers) && styles.pageButtonDisabled]}
                          accessibilityLabel="Previous page"
                        >
                          <Ionicons name="chevron-back" size={16} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.pageIndicator}>
                          Page {allMembersPage} of {Math.max(1, Math.ceil(allMembersTotal / MEMBERS_PAGE_SIZE))}
                        </Text>
                        <TouchableOpacity
                          onPress={() => loadAllMembersPage(allMembersPage + 1)}
                          disabled={allMembersPage >= Math.ceil(allMembersTotal / MEMBERS_PAGE_SIZE) || loadingAllMembers}
                          style={[
                            styles.pageButton,
                            (allMembersPage >= Math.ceil(allMembersTotal / MEMBERS_PAGE_SIZE) || loadingAllMembers) && styles.pageButtonDisabled,
                          ]}
                          accessibilityLabel="Next page"
                        >
                          <Ionicons name="chevron-forward" size={16} color={colors.textPrimary} />
                        </TouchableOpacity>
                      </View>
                    </>
                  )
                ) : null}
              </DesktopPanel>
            </View>
          </>
        ) : null}
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{course.name || 'Reports'}</Text>
            <Text style={styles.headerSubtitle}>Course Admin</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => navigation.navigate('AdminNotifications')}
              style={styles.bellButton}
              accessibilityLabel="Notifications"
              accessibilityRole="button"
            >
              <Ionicons name="notifications" size={20} color={colors.white} />
              {unreadNotificationCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadNotificationCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('AdminCourseProfile')}>
              <AdminHeaderAvatar logoUrl={course.logoUrl} size={32} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {course.coverImageUrl ? (
          <Image source={{ uri: course.coverImageUrl }} style={styles.coverImage} />
        ) : null}

        <View style={styles.statsHeaderRow}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.periodToggle}>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setDashboardPeriod(p)}
                style={[styles.periodPill, dashboardPeriod === p && styles.periodPillActive]}
              >
                <Text style={[styles.periodText, dashboardPeriod === p && styles.periodTextActive]}>{PERIOD_LABELS[p]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {dashboardLoading && !dashboard ? (
          <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
        ) : dashboard ? (
          <>
            <View style={styles.statsGrid}>
              <View style={styles.statsRow}>
                <StatCard
                  label="Members"
                  value={dashboard.totals.members}
                  deltaPct={0}
                  showDelta={false}
                  fill
                  backgroundColor={colors.mintBg}
                  onPress={() => navigation.navigate('AdminReportDetail', { report: 'members', label: 'Members', period: 'all' })}
                />
                <StatCard
                  label="New Members"
                  value={dashboard.totals.newMembers}
                  deltaPct={0}
                  showDelta={false}
                  fill
                  backgroundColor={colors.mintBg}
                  onPress={() => navigation.navigate('AdminReportDetail', { report: 'members', label: 'New Members', period: dashboardPeriod })}
                />
              </View>
              <View style={styles.statsRow}>
                <StatCard
                  label="Flagrr Cash Earned"
                  value={dashboard.totals.fcEarned.toLocaleString()}
                  deltaPct={dashboard.totals.fcEarnedDeltaPct}
                  deltaLabel={DELTA_LABELS[dashboardPeriod]}
                  showDelta={dashboardPeriod !== 'all'}
                  fill
                  backgroundColor={colors.mintBg}
                  onPress={() => navigation.navigate('AdminReportDetail', { report: 'receipts', label: 'Flagrr Cash Earned', period: dashboardPeriod })}
                />
                <StatCard
                  label="Flagrr Cash Redeemed"
                  value={dashboard.totals.fcRedeemed.toLocaleString()}
                  deltaPct={dashboard.totals.fcRedeemedDeltaPct}
                  deltaLabel={DELTA_LABELS[dashboardPeriod]}
                  showDelta={dashboardPeriod !== 'all'}
                  fill
                  backgroundColor={colors.mintBg}
                  onPress={() => navigation.navigate('AdminReportDetail', { report: 'redemptions', label: 'Flagrr Cash Redeemed', period: dashboardPeriod })}
                />
              </View>
              <StatCard
                label="Receipts Scanned"
                value={dashboard.totals.receiptsScanned}
                deltaPct={dashboard.totals.receiptsScannedDeltaPct}
                deltaLabel={DELTA_LABELS[dashboardPeriod]}
                showDelta={dashboardPeriod !== 'all'}
                width="100%"
                backgroundColor={colors.mintBg}
                onPress={() => navigation.navigate('AdminReportDetail', { report: 'receipts', label: 'Receipts Scanned', period: dashboardPeriod })}
              />
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Members Joined This Year</Text>
              <BarChart data={dashboard.signupsByMonth} />
            </View>

            <TouchableOpacity
              style={styles.sectionHeaderRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('AdminReportDetail', { report: 'members', label: 'Tier Distribution', period: 'all' })}
            >
              <Text style={styles.sectionTitle}>Tier Distribution</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.clubGreen} />
            </TouchableOpacity>
            <View style={styles.card}>
              {dashboard.tierDistribution.length === 0 ? (
                <Text style={styles.emptyText}>No members yet.</Text>
              ) : (
                dashboard.tierDistribution.map((t) => (
                  <View key={t.tier} style={styles.row}>
                    <Text style={styles.rowLabel}>{t.tier}</Text>
                    <Text style={styles.rowValue}>{t.count}</Text>
                  </View>
                ))
              )}
            </View>

            <TouchableOpacity
              style={styles.sectionHeaderRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('AdminReportDetail', { report: 'redemptions', label: 'Top Redeemed Rewards', period: dashboardPeriod })}
            >
              <Text style={styles.sectionTitle}>Top Redeemed Rewards</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.clubGreen} />
            </TouchableOpacity>
            <View style={styles.card}>
              {dashboard.topRewards.length === 0 ? (
                <Text style={styles.emptyText}>No redemptions in this period.</Text>
              ) : (
                dashboard.topRewards.map((r) => (
                  <View key={r.rewardId} style={styles.row}>
                    <Text style={styles.rowLabel} numberOfLines={1}>{r.title}</Text>
                    <Text style={styles.rowValue}>{r.redemptions}× · {r.fcSpent.toLocaleString()} FC</Text>
                  </View>
                ))
              )}
            </View>

            <Text style={styles.sectionTitle}>Look Up a Member</Text>
            <View style={styles.card}>
              <TextField
                placeholder="Search by name or email"
                variant="onLight"
                value={memberSearch}
                onChangeText={setMemberSearch}
                onSubmitEditing={handleSearchMembers}
                returnKeyType="search"
              />
              <PillButton label="Search" icon="search" variant="outline" onPress={handleSearchMembers} loading={searchingMembers} />
              {memberResults.map((m) => memberRow(m, false))}
            </View>

            <PillButton
              label="View All Members"
              variant="primary"
              icon={showAllMembers ? 'chevron-up' : 'chevron-down'}
              onPress={handleToggleAllMembers}
            />

            {showAllMembers ? (
              <View style={[styles.card, { marginTop: spacing.sm }]}>
                {loadingAllMembers && allMembers.length === 0 ? (
                  <ActivityIndicator color={colors.clubGreen} />
                ) : (
                  <>
                    {allMembers.length === 0 ? (
                      <Text style={styles.emptyText}>No members yet.</Text>
                    ) : (
                      allMembers.map((m) => memberRow(m, false))
                    )}

                    <View style={styles.paginationRow}>
                      <TouchableOpacity
                        onPress={() => loadAllMembersPage(allMembersPage - 1)}
                        disabled={allMembersPage <= 1 || loadingAllMembers}
                        style={[styles.pageButton, (allMembersPage <= 1 || loadingAllMembers) && styles.pageButtonDisabled]}
                        accessibilityLabel="Previous page"
                      >
                        <Ionicons name="chevron-back" size={16} color={colors.textPrimary} />
                      </TouchableOpacity>
                      <Text style={styles.pageIndicator}>
                        Page {allMembersPage} of {Math.max(1, Math.ceil(allMembersTotal / MEMBERS_PAGE_SIZE))}
                      </Text>
                      <TouchableOpacity
                        onPress={() => loadAllMembersPage(allMembersPage + 1)}
                        disabled={allMembersPage >= Math.ceil(allMembersTotal / MEMBERS_PAGE_SIZE) || loadingAllMembers}
                        style={[
                          styles.pageButton,
                          (allMembersPage >= Math.ceil(allMembersTotal / MEMBERS_PAGE_SIZE) || loadingAllMembers) && styles.pageButtonDisabled,
                        ]}
                        accessibilityLabel="Next page"
                      >
                        <Ionicons name="chevron-forward" size={16} color={colors.textPrimary} />
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            ) : null}
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
    justifyContent: 'space-between',
  },
  headerTitle: { fontFamily: fontFamily.headingDisplay, fontSize: fontSize.title, color: colors.white },
  headerSubtitle: { fontFamily: fontFamily.body, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bellButton: { width: 23, height: 23, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: colors.lime,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontFamily: fontFamily.bodySemiBold, fontSize: 9, color: colors.textPrimary },
  content: { padding: screenPadding, paddingBottom: spacing.xl * 2 },
  coverImage: {
    width: '100%',
    height: 280,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
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
  statsGrid: { gap: spacing.sm, marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', gap: 10 },
  sectionTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.textPrimary, marginBottom: spacing.sm },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  emptyText: { fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.textSecondary },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  rowLabel: { flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.textPrimary },
  rowValue: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  memberName: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  memberEmail: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  memberTier: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.textPrimary },
  memberBalance: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  pageButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageButtonDisabled: { opacity: 0.4 },
  pageIndicator: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.textPrimary },

  // ---- desktop-web only (see useIsDesktopNav) ----
  dPageTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.textPrimary },
  dPageSubtitle: { fontFamily: fontFamily.body, fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  dPeriodToggle: { flexDirection: 'row', backgroundColor: colors.mintBg, borderRadius: radius.pill, padding: 3 },
  dPeriodPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill },
  dPeriodPillActive: { backgroundColor: colors.darkGreen },
  dPeriodText: { fontFamily: fontFamily.bodySemiBold, fontSize: 12.5, color: colors.darkGreen },
  dPeriodTextActive: { color: colors.white },
  dStatRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  dGrid2: { flexDirection: 'row', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' },
  dEmptyText: { fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.textSecondary },
  dTierRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dTierTag: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: colors.clubGreen,
    backgroundColor: colors.mintBg,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
    overflow: 'hidden',
    minWidth: 64,
    textAlign: 'center',
  },
  dBarTrack: { flex: 1, height: 6, borderRadius: 99, backgroundColor: colors.mintBg, overflow: 'hidden' },
  dBarFill: { height: '100%', borderRadius: 99, backgroundColor: colors.clubGreen },
  dTierValue: { fontFamily: fontFamily.bodySemiBold, fontSize: 13.5, color: colors.textPrimary, minWidth: 34, textAlign: 'right' },
  dRowLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dRowName: { flex: 1, fontFamily: fontFamily.bodyMedium, fontSize: 13.5, color: colors.textPrimary },
  dRowMeta: { fontFamily: fontFamily.body, fontSize: 12, color: colors.textSecondary },
  dLookupBar: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  dMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dMemberAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.mintBg, alignItems: 'center', justifyContent: 'center' },
  dMemberAvatarText: { fontFamily: fontFamily.bodySemiBold, fontSize: 12, color: colors.clubGreen },
  dMemberName: { fontFamily: fontFamily.bodyMedium, fontSize: 13.5, color: colors.textPrimary },
  dMemberEmail: { fontFamily: fontFamily.body, fontSize: 11.5, color: colors.textSecondary },
  dMemberTier: { fontFamily: fontFamily.bodySemiBold, fontSize: 12.5, color: colors.textPrimary, width: 70 },
  dMemberBalance: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.textPrimary, width: 90, textAlign: 'right' },
  dViewAllRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  dViewAllText: { fontFamily: fontFamily.bodySemiBold, fontSize: 12.5, color: colors.clubGreen },
});
}
