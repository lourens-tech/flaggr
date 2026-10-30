import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, type CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import type { AdminStackParamList, AdminTabParamList } from '../../navigation/types';
import { BarChart } from '../../components/common/BarChart';
import { AdminHeaderAvatar } from '../../components/common/AdminHeaderAvatar';
import { TextField } from '../../components/common/TextField';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { AdminStatCard } from '../../components/admin/AdminStatCard';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { useHover, hoverTransitionNoTransform } from '../../hooks/useHover';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { DesktopStatCard } from '../../components/admin/desktop/DesktopStatCard';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { ScorecardUploadPanel } from '../../components/admin/ScorecardUploadPanel';
import { AdminButton, CircleButton, EmptyState, ErrorState, Eyebrow, Muted, Segmented, SkeletonRows, StatusPill, Tile } from '../../components/admin/ui';
import { PressableScale } from '../../components/motion';
import { useAdminTheme } from '../../context/ThemeContext';
import type { AdminMember, TierCount } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

const MEMBERS_PAGE_SIZE = 10;
const TIER_ORDER = ['Bronze', 'Silver', 'Gold', 'Platinum'];

type Period = 'month' | 'year' | 'all';
const PERIOD_LABELS: Record<Period, string> = { month: 'Month', year: 'Year', all: 'All' };
const PERIODS: Period[] = ['month', 'year', 'all'];
// "All" has no prior window to compare against (see api/_lib/periods.ts),
// so its deltaPct is always forced to 0 server-side — show no delta at all
// there rather than a misleading "0%".
const DELTA_LABELS: Record<Period, string> = { month: 'vs Last Month', year: 'vs Last Year', all: '' };

// Brand constants (see docs/Brand-Kit.md): the Flagrr ground and crests are
// Fairway with lime; tier colours are the approved tier palette.
const FAIRWAY = '#1F4234';
const LIME = '#CDDE5C';
const TIER_COLORS: Record<string, string> = { Bronze: '#B9773E', Silver: '#AEB8BF', Gold: '#E2B93B', Platinum: '#E8ECEF' };
// The dark scrim that keeps white hero text readable over any cover photo.
const SCRIM_STRONG = 'rgba(6,14,10,0.78)';
const SCRIM_MID = 'rgba(6,14,10,0.45)';
const SCRIM_SOFT = 'rgba(6,14,10,0.2)';
const SCRIM_CLEAR = 'rgba(6,14,10,0.05)';
const ON_PHOTO = '#FFFFFF';
const ON_PHOTO_SOFT = 'rgba(255,255,255,0.86)';
const ON_PHOTO_CHIP = 'rgba(255,255,255,0.14)';
const ON_PHOTO_CHIP_HOVER = 'rgba(255,255,255,0.22)';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function memberInitials(m: AdminMember): string {
  return `${m.firstName.charAt(0)}${m.lastName.charAt(0)}`.toUpperCase();
}

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabParamList, 'AdminDashboard'>,
  NativeStackScreenProps<AdminStackParamList>
>;

interface NeedsCounts {
  enquiries: number;
  flagged: number;
}

export function AdminDashboardScreen({ navigation }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
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
    listEnquiries,
    getFlaggedReceipts,
  } = useAdmin();
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<AdminMember[]>([]);
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [allMembers, setAllMembers] = useState<AdminMember[]>([]);
  const [allMembersTotal, setAllMembersTotal] = useState(0);
  const [allMembersPage, setAllMembersPage] = useState(1);
  const [loadingAllMembers, setLoadingAllMembers] = useState(false);
  // The page that last failed to load, so "Try again" asks for it again.
  const [allMembersError, setAllMembersError] = useState<number | null>(null);
  const [dashboardError, setDashboardError] = useState(false);
  const [needs, setNeeds] = useState<NeedsCounts | null>(null);

  const loadDashboard = () => {
    setDashboardError(false);
    refreshDashboard().catch(() => setDashboardError(true));
  };

  // "Needs you": only things waiting on the admin. Any failure hides the list.
  const loadNeeds = async () => {
    try {
      const [pending, flagged] = await Promise.all([listEnquiries('pending'), getFlaggedReceipts()]);
      setNeeds({ enquiries: pending.length, flagged: flagged.length });
    } catch {
      setNeeds(null);
    }
  };

  // Refresh every time Home comes into view (this also covers the first
  // mount). Read through a ref so a period change, which loads on its own,
  // doesn't trigger a second fetch here.
  const onFocusRef = useRef({ loadDashboard, loadNeeds });
  onFocusRef.current = { loadDashboard, loadNeeds };
  useFocusEffect(
    useCallback(() => {
      onFocusRef.current.loadDashboard();
      onFocusRef.current.loadNeeds();
    }, []),
  );

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
    setAllMembersError(null);
    try {
      const result = await listAllMembers(page, MEMBERS_PAGE_SIZE);
      setAllMembers(result.members);
      setAllMembersTotal(result.total);
      setAllMembersPage(result.page);
    } catch {
      setAllMembers([]);
      setAllMembersError(page);
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

  const openMember = (m: AdminMember) => navigation.navigate('AdminMemberStats', { memberId: m.id });
  const memberRow = (m: AdminMember, desktop: boolean, isLast: boolean) => (
    <MemberRow key={m.id} m={m} desktop={desktop} isLast={isLast} onPress={() => openMember(m)} styles={styles} c={c} />
  );

  const needsItems = needs
    ? [
        { key: 'enquiries', count: needs.enquiries, title: 'Enquiries waiting', onPress: () => navigation.navigate('AdminEnquiries') },
        { key: 'flagged', count: needs.flagged, title: 'Receipts flagged', onPress: () => navigation.navigate('AdminFraudOversight') },
      ].filter((n) => n.count > 0)
    : [];

  const subtitle = `Here's how ${course.name || 'your club'} is tracking this ${dashboardPeriod === 'all' ? 'period' : dashboardPeriod}.`;

  const lastPage = Math.ceil(allMembersTotal / MEMBERS_PAGE_SIZE);
  const pagination = (
    <View style={styles.paginationRow}>
      <PageButton
        icon="chevron-back"
        accessibilityLabel="Previous page"
        disabled={allMembersPage <= 1 || loadingAllMembers}
        onPress={() => loadAllMembersPage(allMembersPage - 1)}
        styles={styles}
        c={c}
      />
      <Text style={styles.pageIndicator}>
        Page {allMembersPage} of {Math.max(1, Math.ceil(allMembersTotal / MEMBERS_PAGE_SIZE))}
      </Text>
      <PageButton
        icon="chevron-forward"
        accessibilityLabel="Next page"
        disabled={allMembersPage >= lastPage || loadingAllMembers}
        onPress={() => loadAllMembersPage(allMembersPage + 1)}
        styles={styles}
        c={c}
      />
    </View>
  );

  const allMembersList = (desktop: boolean) =>
    allMembersError !== null ? (
      <ErrorState onRetry={() => loadAllMembersPage(allMembersError)} />
    ) : loadingAllMembers && allMembers.length === 0 ? (
      <SkeletonRows rows={3} />
    ) : (
      <>
        {allMembers.length === 0 ? (
          <EmptyState icon="people-outline" title="No members yet." />
        ) : (
          <View>{allMembers.map((m, i) => memberRow(m, desktop, i === allMembers.length - 1))}</View>
        )}
        {pagination}
      </>
    );

  const tierBlock = <TierBreakdown tiers={dashboard?.tierDistribution ?? []} styles={styles} c={c} />;

  const rewardsBlock =
    !dashboard || dashboard.topRewards.length === 0 ? (
      <EmptyState icon="gift-outline" title="No redemptions in this period." />
    ) : (
      (() => {
        const maxRedemptions = Math.max(...dashboard.topRewards.map((r) => r.redemptions), 1);
        return dashboard.topRewards.map((r, i) => (
          <View key={r.rewardId} style={[styles.rewardRow, i > 0 && styles.rowDividerTop]}>
            <View style={styles.rewardAvatar}>
              <Text style={styles.rewardAvatarText}>{r.title.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rewardTitle} numberOfLines={1}>{r.title}</Text>
              <Text style={styles.rewardMeta}>{r.redemptions}× · {r.fcSpent.toLocaleString()} FC</Text>
              <View style={styles.rewardTrack}>
                <View style={[styles.rewardFill, { width: `${Math.max(4, (r.redemptions / maxRedemptions) * 100)}%` }]} />
              </View>
            </View>
          </View>
        ));
      })()
    );

  const searchBar = (
    <View style={styles.lookupBar}>
      <View style={{ flex: 1 }}>
        <TextField
          placeholder="Search by name or email"
          variant="onLight"
          icon="search"
          value={memberSearch}
          onChangeText={setMemberSearch}
          onSubmitEditing={handleSearchMembers}
          returnKeyType="search"
        />
      </View>
      <AdminButton label="Search" icon="search" onPress={handleSearchMembers} loading={searchingMembers} />
    </View>
  );

  const loadingOrError =
    dashboardLoading && !dashboard ? (
      <Tile>
        <SkeletonRows rows={3} />
      </Tile>
    ) : !dashboard && dashboardError ? (
      <ErrorState onRetry={loadDashboard} />
    ) : null;

  if (isDesktop) {
    const periodToggle = (
      <Segmented
        accessibilityLabel="Period"
        value={dashboardPeriod}
        onChange={(p) => setDashboardPeriod(p)}
        options={PERIODS.map((p) => ({ key: p, label: PERIOD_LABELS[p] }))}
      />
    );

    return (
      <AdminDesktopFrame activeKey="AdminDashboard" breadcrumb="Home" headerRight={periodToggle}>
        <HomeHero
          coverUrl={course.coverImageUrl}
          greetingText={greeting()}
          firstName={admin.firstName}
          subtitle={subtitle}
          height={200}
          titleSize={44}
          desktop
        >
          {needsItems.length > 0 ? (
            <View style={styles.dNeeds} accessibilityLabel="Needs you">
              {needsItems.map((n) => (
                <HeroNeed key={n.key} count={n.count} title={n.title} onPress={n.onPress} styles={styles} />
              ))}
            </View>
          ) : null}
        </HomeHero>

        {loadingOrError ??
          (dashboard ? (
            <>
              <View style={styles.dStatRow}>
                <View style={styles.dWideStat}>
                  <DesktopStatCard
                    label="FC Earned"
                    value={dashboard.totals.fcEarned.toLocaleString()}
                    icon="trending-up-outline"
                    deltaPct={dashboard.totals.fcEarnedDeltaPct}
                    showDelta={dashboardPeriod !== 'all'}
                    onPress={() => navigation.navigate('AdminReportDetail', { report: 'receipts', label: 'Flagrr Cash Earned', period: dashboardPeriod })}
                  />
                </View>
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
                  label="FC Redeemed"
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

              <View style={styles.dGrid}>
                <DesktopPanel title="Members Joined This Year" style={styles.dChartPanel}>
                  <BarChart data={dashboard.signupsByMonth} height={150} />
                </DesktopPanel>

                <DesktopPanel
                  title="Tier Distribution"
                  style={styles.dSidePanel}
                  onViewAll={() => navigation.navigate('AdminReportDetail', { report: 'members', label: 'Tier Distribution', period: 'all' })}
                >
                  {tierBlock}
                </DesktopPanel>

                <View style={styles.dSidePanel}>
                  <ScorecardUploadPanel />
                </View>
              </View>

              <View style={styles.dGrid}>
                <DesktopPanel
                  title="Top Redeemed Rewards"
                  style={styles.dHalfPanel}
                  onViewAll={() => navigation.navigate('AdminReportDetail', { report: 'redemptions', label: 'Top Redeemed Rewards', period: dashboardPeriod })}
                >
                  <View>{rewardsBlock}</View>
                </DesktopPanel>

                <DesktopPanel title="Look Up a Member" style={styles.dHalfPanel}>
                  {searchBar}
                  {memberResults.length > 0 ? (
                    <View>{memberResults.map((m, i) => memberRow(m, true, i === memberResults.length - 1))}</View>
                  ) : null}

                  <AdminButton
                    label="View All Members"
                    variant="plain"
                    iconRight={showAllMembers ? 'chevron-up' : 'chevron-down'}
                    onPress={handleToggleAllMembers}
                    style={{ alignSelf: 'center' }}
                  />

                  {showAllMembers ? allMembersList(true) : null}
                </DesktopPanel>
              </View>
            </>
          ) : null)}
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader
        title="Home"
        showBack={false}
        right={
          <View style={styles.headerRight}>
            <CircleButton
              icon="notifications-outline"
              accessibilityLabel="Notifications"
              onPress={() => navigation.navigate('AdminNotifications')}
              badge={unreadNotificationCount > 0 ? unreadNotificationCount : undefined}
              size={44}
            />
            <PressableScale
              onPress={() => navigation.navigate('AdminCourseProfile')}
              accessibilityRole="button"
              accessibilityLabel="Club Settings"
              style={styles.avatarButton}
            >
              <AdminHeaderAvatar logoUrl={course.logoUrl} size={36} />
            </PressableScale>
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <HomeHero
          coverUrl={course.coverImageUrl}
          greetingText={greeting()}
          firstName={admin.firstName}
          subtitle={subtitle}
          height={300}
          titleSize={40}
          desktop={false}
        />

        {needsItems.length > 0 ? (
          <View style={styles.section}>
            <Eyebrow style={styles.groupLabel}>Needs you</Eyebrow>
            <Tile padded={false}>
              {needsItems.map((n, i) => (
                <PressableScale
                  key={n.key}
                  onPress={n.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={`${n.count} ${n.title}`}
                  pressedScale={0.99}
                  style={[styles.needRow, i > 0 && styles.rowDividerTop]}
                >
                  <Text style={[styles.needCount, n.key === 'flagged' && { color: c.neg }]}>{n.count}</Text>
                  <Text style={styles.needTitle} numberOfLines={1}>{n.title}</Text>
                  <Ionicons name="chevron-forward" size={16} color={c.ink3} />
                </PressableScale>
              ))}
            </Tile>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Overview</Text>
          <Segmented
            accessibilityLabel="Period"
            fullWidth
            value={dashboardPeriod}
            onChange={(p) => setDashboardPeriod(p)}
            options={PERIODS.map((p) => ({ key: p, label: PERIOD_LABELS[p] }))}
          />
        </View>

        {loadingOrError ? (
          <View style={styles.section}>{loadingOrError}</View>
        ) : dashboard ? (
          <>
            <View style={styles.statsGrid}>
              <AdminStatCard
                label="Flagrr Cash Earned"
                value={dashboard.totals.fcEarned.toLocaleString()}
                icon="trending-up-outline"
                deltaPct={dashboard.totals.fcEarnedDeltaPct}
                showDelta={dashboardPeriod !== 'all'}
                width="100%"
                onPress={() => navigation.navigate('AdminReportDetail', { report: 'receipts', label: 'Flagrr Cash Earned', period: dashboardPeriod })}
              />
              <View style={styles.statsRow}>
                <AdminStatCard
                  label="Members"
                  value={dashboard.totals.members}
                  icon="people-outline"
                  showDelta={false}
                  fill
                  onPress={() => navigation.navigate('AdminReportDetail', { report: 'members', label: 'Members', period: 'all' })}
                />
                <AdminStatCard
                  label="New Members"
                  value={dashboard.totals.newMembers}
                  icon="person-add-outline"
                  showDelta={false}
                  fill
                  onPress={() => navigation.navigate('AdminReportDetail', { report: 'members', label: 'New Members', period: dashboardPeriod })}
                />
              </View>
              <View style={styles.statsRow}>
                <AdminStatCard
                  label="Flagrr Cash Redeemed"
                  value={dashboard.totals.fcRedeemed.toLocaleString()}
                  icon="swap-horizontal-outline"
                  deltaPct={dashboard.totals.fcRedeemedDeltaPct}
                  showDelta={dashboardPeriod !== 'all'}
                  fill
                  onPress={() => navigation.navigate('AdminReportDetail', { report: 'redemptions', label: 'Flagrr Cash Redeemed', period: dashboardPeriod })}
                />
                <AdminStatCard
                  label="Receipts Scanned"
                  value={dashboard.totals.receiptsScanned}
                  icon="receipt-outline"
                  deltaPct={dashboard.totals.receiptsScannedDeltaPct}
                  showDelta={dashboardPeriod !== 'all'}
                  fill
                  onPress={() => navigation.navigate('AdminReportDetail', { report: 'receipts', label: 'Receipts Scanned', period: dashboardPeriod })}
                />
              </View>
            </View>

            <Tile style={styles.section}>
              <Text accessibilityRole="header" style={styles.tileTitle}>Members Joined This Year</Text>
              <BarChart data={dashboard.signupsByMonth} height={120} />
            </Tile>

            <View style={styles.section}>
              <PressableScale
                style={styles.sectionHeaderRow}
                accessibilityRole="button"
                accessibilityLabel="Tier Distribution"
                pressedScale={0.99}
                onPress={() => navigation.navigate('AdminReportDetail', { report: 'members', label: 'Tier Distribution', period: 'all' })}
              >
                <Text style={styles.sectionTitleInline}>Tier Distribution</Text>
                <Ionicons name="chevron-forward" size={18} color={c.ink3} />
              </PressableScale>
              <Tile>{tierBlock}</Tile>
            </View>

            <View style={styles.section}>
              <ScorecardUploadPanel />
            </View>

            <View style={styles.section}>
              <PressableScale
                style={styles.sectionHeaderRow}
                accessibilityRole="button"
                accessibilityLabel="Top Redeemed Rewards"
                pressedScale={0.99}
                onPress={() => navigation.navigate('AdminReportDetail', { report: 'redemptions', label: 'Top Redeemed Rewards', period: dashboardPeriod })}
              >
                <Text style={styles.sectionTitleInline}>Top Redeemed Rewards</Text>
                <Ionicons name="chevron-forward" size={18} color={c.ink3} />
              </PressableScale>
              <Tile style={{ paddingVertical: 8 }}>{rewardsBlock}</Tile>
            </View>

            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Look Up a Member</Text>
              <Tile style={{ gap: 12 }}>
                <TextField
                  placeholder="Search by name or email"
                  variant="onLight"
                  icon="search"
                  value={memberSearch}
                  onChangeText={setMemberSearch}
                  onSubmitEditing={handleSearchMembers}
                  returnKeyType="search"
                />
                <AdminButton label="Search" icon="search" onPress={handleSearchMembers} loading={searchingMembers} size="lg" fullWidth />
                {memberResults.length > 0 ? (
                  <View>{memberResults.map((m, i) => memberRow(m, false, i === memberResults.length - 1))}</View>
                ) : null}
              </Tile>
            </View>

            <AdminButton
              label="View All Members"
              icon={showAllMembers ? 'chevron-up' : 'chevron-down'}
              onPress={handleToggleAllMembers}
              size="lg"
              fullWidth
              style={styles.section}
            />

            {showAllMembers ? <Tile style={[styles.section, { gap: 12 }]}>{allMembersList(false)}</Tile> : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────
// The club's cover photo under a dark scrim with the greeting in white
// Fraunces. With no cover yet, the Flagrr ground: Fairway with a big outline
// "18" in lime.
function HomeHero({
  coverUrl,
  greetingText,
  firstName,
  subtitle,
  height,
  titleSize,
  desktop,
  children,
}: {
  coverUrl: string | null | undefined;
  greetingText: string;
  firstName: string;
  subtitle: string;
  height: number;
  titleSize: number;
  desktop: boolean;
  children?: React.ReactNode;
}) {
  const motifSize = Math.min(height * 2.6, 520);
  const motifStyle: TextStyle =
    Platform.OS === 'web'
      ? ({ color: 'transparent', WebkitTextStroke: `3px ${LIME}`, opacity: 0.22 } as unknown as TextStyle)
      : { color: LIME, opacity: 0.12 };
  return (
    <View style={[heroStyles.hero, { height }]}>
      {coverUrl ? (
        <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" accessible={false} />
      ) : (
        <View style={[StyleSheet.absoluteFill, heroStyles.ground]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text
            style={[
              heroStyles.motif,
              { fontSize: motifSize, lineHeight: motifSize, bottom: -height * 0.28 },
              motifStyle,
            ]}
            numberOfLines={1}
          >
            18
          </Text>
        </View>
      )}
      <LinearGradient
        colors={desktop ? [SCRIM_STRONG, SCRIM_MID, SCRIM_SOFT] : [SCRIM_SOFT, SCRIM_CLEAR, SCRIM_STRONG]}
        locations={desktop ? [0, 0.55, 1] : [0, 0.3, 0.85]}
        start={{ x: 0, y: 0 }}
        end={desktop ? { x: 1, y: 0 } : { x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={heroStyles.row}>
        <View style={[heroStyles.copy, { paddingHorizontal: desktop ? 30 : 20, paddingBottom: desktop ? 24 : 20 }]}>
          <Text accessibilityRole="header" style={[heroStyles.title, { fontSize: titleSize, lineHeight: Math.round(titleSize * 1.02) }]}>
            {greetingText},{'\n'}
            <Text style={heroStyles.name}>{firstName}</Text>
          </Text>
          <Text style={heroStyles.sub} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
        {children}
      </View>
    </View>
  );
}

function HeroNeed({
  count,
  title,
  onPress,
  styles,
}: {
  count: number;
  title: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const [hovered, hoverHandlers] = useHover();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${count} ${title}`}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
      style={[styles.dNeed, hoverTransitionNoTransform, { backgroundColor: hovered ? ON_PHOTO_CHIP_HOVER : ON_PHOTO_CHIP }]}
    >
      <Text style={styles.dNeedCount}>{count}</Text>
      <Text style={styles.dNeedTitle} numberOfLines={1}>{title}</Text>
      <Ionicons name="chevron-forward" size={14} color={ON_PHOTO_SOFT} />
    </PressableScale>
  );
}

// ── Tiers ────────────────────────────────────────────────────────────────────
function TierBreakdown({ tiers, styles, c }: { tiers: TierCount[]; styles: ReturnType<typeof createStyles>; c: AdminColors }) {
  const counts = new Map(tiers.map((t) => [t.tier, t.count]));
  const extras = tiers.filter((t) => !TIER_ORDER.includes(t.tier)).map((t) => t.tier);
  const rows = [...TIER_ORDER, ...extras].map((tier) => ({ tier, count: counts.get(tier) ?? 0, color: TIER_COLORS[tier] ?? c.ink3 }));
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  if (total === 0) return <Muted>No members yet.</Muted>;
  const pct = (n: number) => Math.round((n / total) * 100);
  return (
    <View style={{ gap: 16 }}>
      <View
        style={styles.tierStack}
        accessible
        accessibilityRole="image"
        accessibilityLabel={rows.map((r) => `${r.tier} ${r.count}`).join(', ')}
      >
        {rows
          .filter((r) => r.count > 0)
          .map((r) => (
            <View key={r.tier} style={{ flex: r.count, backgroundColor: r.color }} />
          ))}
      </View>
      <View style={styles.tierLegend}>
        {rows.map((r) => (
          <View key={r.tier} style={styles.tierLegendItem}>
            <View style={[styles.tierSwatch, { backgroundColor: r.color }]} />
            <Text style={styles.tierName} numberOfLines={1}>{r.tier}</Text>
            <Text style={styles.tierCount}>{r.count.toLocaleString()}</Text>
            <Text style={styles.tierPct}>{pct(r.count)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Members ──────────────────────────────────────────────────────────────────
function MemberRow({
  m,
  desktop,
  isLast,
  onPress,
  styles,
  c,
}: {
  m: AdminMember;
  desktop: boolean;
  isLast: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  c: AdminColors;
}) {
  const [hovered, hoverHandlers] = useHover();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${m.firstName} ${m.lastName}, ${m.tier}, ${m.balance.toLocaleString()} FC`}
      pressedScale={0.99}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
      style={[
        styles.memberRow,
        desktop && hoverTransitionNoTransform,
        !isLast && styles.rowDivider,
        desktop && hovered && { backgroundColor: c.fill2 },
      ]}
    >
      <View style={styles.memberAvatar}>
        <Text style={styles.memberAvatarText}>{memberInitials(m)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.memberName} numberOfLines={1}>{m.firstName} {m.lastName}</Text>
        <Text style={styles.memberEmail} numberOfLines={1}>{m.email}</Text>
      </View>
      {desktop ? (
        <>
          <StatusPill label={m.tier} style={{ alignSelf: 'center' }} />
          <Text style={styles.memberBalance}>{m.balance.toLocaleString()} FC</Text>
        </>
      ) : (
        <>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.memberBalancePhone}>{m.balance.toLocaleString()} FC</Text>
            <Text style={styles.memberTierPhone}>{m.tier}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.ink3} />
        </>
      )}
    </PressableScale>
  );
}

function PageButton({
  icon,
  accessibilityLabel,
  disabled,
  onPress,
  styles,
  c,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  c: AdminColors;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[styles.pageButton, disabled && styles.pageButtonDisabled]}
    >
      <Ionicons name={icon} size={16} color={c.ink} />
    </PressableScale>
  );
}

const heroStyles = StyleSheet.create({
  hero: { borderRadius: adminRadius.lg, overflow: 'hidden', backgroundColor: FAIRWAY },
  ground: { backgroundColor: FAIRWAY, overflow: 'hidden' },
  motif: { position: 'absolute', right: '-2%', ...adminFont.title },
  row: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  copy: { flex: 1, minWidth: 0, justifyContent: 'flex-end' },
  title: { ...adminFont.title, color: ON_PHOTO, letterSpacing: -0.6 },
  name: { ...adminFont.titleItalic, color: LIME },
  sub: { ...adminFont.body, fontSize: 14.5, lineHeight: 20, color: ON_PHOTO_SOFT, marginTop: 10 },
});

function createStyles(c: AdminColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatarButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 48 },
    section: { marginTop: 18 },
    groupLabel: { paddingHorizontal: 4, marginBottom: 8 },
    sectionTitle: { ...adminFont.bodyBold, fontSize: 17, color: c.ink, marginBottom: 10 },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, marginBottom: 4 },
    sectionTitleInline: { ...adminFont.bodyBold, fontSize: 17, color: c.ink },
    tileTitle: { ...adminFont.bodyBold, fontSize: 17, color: c.ink, marginBottom: 14 },
    statsGrid: { gap: 10, marginTop: 14 },
    statsRow: { flexDirection: 'row', gap: 10 },
    rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.edge },
    rowDividerTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },

    // Needs you (phone)
    needRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingHorizontal: 16 },
    needCount: { ...adminFont.bodyBold, ...tabularNums, fontSize: 22, color: c.ink, minWidth: 26, textAlign: 'center' },
    needTitle: { flex: 1, ...adminFont.body, fontSize: 15.5, color: c.ink },

    // Tiers
    tierStack: { flexDirection: 'row', height: 14, borderRadius: adminRadius.pill, overflow: 'hidden', gap: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: c.edge },
    // One column: four tiers always fit, however narrow the tile gets.
    tierLegend: { gap: 10 },
    tierLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    // Hairline edge: Platinum (#E8ECEF) would vanish on a white tile.
    tierSwatch: { width: 10, height: 10, borderRadius: adminRadius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: c.edge },
    tierName: { flex: 1, ...adminFont.body, fontSize: 13.5, color: c.ink },
    tierCount: { ...adminFont.bodyBold, ...tabularNums, fontSize: 13.5, color: c.ink },
    tierPct: { ...adminFont.body, ...tabularNums, fontSize: 12.5, color: c.ink3, width: 38, textAlign: 'right' },

    // Top rewards
    rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
    rewardAvatar: { width: 44, height: 44, borderRadius: adminRadius.sm, backgroundColor: FAIRWAY, alignItems: 'center', justifyContent: 'center' },
    rewardAvatarText: { ...adminFont.bodyBold, fontSize: 16, color: LIME },
    rewardTitle: { ...adminFont.bodySemiBold, fontSize: 14.5, color: c.ink },
    rewardMeta: { ...adminFont.body, ...tabularNums, fontSize: 13, color: c.ink2, marginTop: 2 },
    rewardTrack: { height: 6, borderRadius: adminRadius.pill, backgroundColor: c.fill, marginTop: 8, overflow: 'hidden' },
    rewardFill: { height: '100%', borderRadius: adminRadius.pill, backgroundColor: c.bar },

    // Members
    lookupBar: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, paddingHorizontal: 6, borderRadius: adminRadius.sm },
    memberAvatar: { width: 34, height: 34, borderRadius: adminRadius.pill, backgroundColor: FAIRWAY, alignItems: 'center', justifyContent: 'center' },
    memberAvatarText: { ...adminFont.bodyBold, fontSize: 12.5, color: LIME },
    memberName: { ...adminFont.bodySemiBold, fontSize: 14, color: c.ink },
    memberEmail: { ...adminFont.body, fontSize: 12.5, color: c.ink2, marginTop: 1 },
    memberBalance: { ...adminFont.bodyBold, ...tabularNums, fontSize: 13.5, color: c.ink, width: 96, textAlign: 'right' },
    memberBalancePhone: { ...adminFont.bodyBold, ...tabularNums, fontSize: 13.5, color: c.ink },
    memberTierPhone: { ...adminFont.body, fontSize: 12.5, color: c.ink3, marginTop: 1 },
    paginationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 4 },
    pageButton: { width: 44, height: 44, borderRadius: adminRadius.pill, backgroundColor: c.fill, alignItems: 'center', justifyContent: 'center' },
    pageButtonDisabled: { opacity: 0.45 },
    pageIndicator: { ...adminFont.bodySemiBold, ...tabularNums, fontSize: 13, color: c.ink2 },

    // ---- desktop-web only (see useIsDesktopNav) ----
    dNeeds: { width: 300, flexShrink: 0, padding: 18, gap: 8, justifyContent: 'flex-end' },
    dNeed: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: adminRadius.md },
    dNeedCount: { ...adminFont.bodyBold, ...tabularNums, fontSize: 24, letterSpacing: -0.5, color: ON_PHOTO, minWidth: 28, textAlign: 'center' },
    dNeedTitle: { flex: 1, ...adminFont.bodySemiBold, fontSize: 13.5, color: ON_PHOTO },
    dStatRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', alignItems: 'stretch' },
    dWideStat: { flex: 2, minWidth: 340 },
    dGrid: { flexDirection: 'row', gap: 14, alignItems: 'stretch', flexWrap: 'wrap' },
    dChartPanel: { flex: 2, minWidth: 420 },
    dSidePanel: { flex: 1, minWidth: 260 },
    dHalfPanel: { flex: 1, minWidth: 380 },
  });
}
