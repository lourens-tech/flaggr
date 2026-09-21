import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StatusBar, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, type CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList, SuperAdminTabParamList } from '../../navigation/types';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { useHover, hoverTransition } from '../../hooks/useHover';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { SuperAdminCourseSummary } from '../../data/adminTypes';

type Props = CompositeScreenProps<
  BottomTabScreenProps<SuperAdminTabParamList, 'SuperAdminCourses'>,
  NativeStackScreenProps<SuperAdminStackParamList>
>;

type StatusFilter = 'all' | 'active' | 'pending' | 'archived';
const STATUS_FILTERS: StatusFilter[] = ['all', 'active', 'pending', 'archived'];
const STATUS_FILTER_LABELS: Record<StatusFilter, string> = { all: 'All', active: 'Active', pending: 'Pending', archived: 'Archived' };

// A club's lifecycle bucket — distinct from its billing subscriptionStatus
// (badge()) below, which still varies within the "active" bucket
// (trialing/active/past_due/canceled all count as "active" here since
// none of them are archived or mid-setup).
function courseBucket(c: SuperAdminCourseSummary): Exclude<StatusFilter, 'all'> {
  if (c.archivedAt) return 'archived';
  if (c.onboardingCompletedAt === null) return 'pending';
  return 'active';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

interface Badge {
  label: string;
  bg: string;
  fg: string;
}

function statusBadge(c: SuperAdminCourseSummary, colors: ThemeColors): Badge {
  if (c.archivedAt) return { label: 'Archived', bg: colors.border, fg: colors.textSecondary };
  if (c.onboardingCompletedAt === null) return { label: 'Setup Pending', bg: colors.warningBg, fg: colors.warning };
  switch (c.subscriptionStatus) {
    case 'past_due':
      return { label: 'Past Due', bg: colors.dangerBg, fg: colors.negative };
    case 'canceled':
      return { label: 'Canceled', bg: colors.border, fg: colors.textSecondary };
    case 'trialing':
      return { label: 'Trialing', bg: colors.lime, fg: colors.darkGreen };
    default:
      return { label: 'Active', bg: colors.mintBg, fg: colors.clubGreen };
  }
}

interface MenuAction {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  danger?: boolean;
}

interface CourseCardProps {
  course: SuperAdminCourseSummary;
  pending: boolean;
  onManageAds: () => void;
  onManageRewards: () => void;
  onCatalog: () => void;
  onMemberList: () => void;
  onEnquiries: () => void;
  onManageAdmins: () => void;
  onCancelSubscription: () => void;
  onReactivateSubscription: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
}

function CourseCard({
  course,
  pending,
  onManageAds,
  onManageRewards,
  onCatalog,
  onMemberList,
  onEnquiries,
  onManageAdmins,
  onCancelSubscription,
  onReactivateSubscription,
  onArchive,
  onUnarchive,
}: CourseCardProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [hovered, hoverHandlers] = useHover();
  const [menuOpen, setMenuOpen] = useState(false);

  const bucket = courseBucket(course);
  const badge = statusBadge(course, colors);
  const isPending = bucket === 'pending';
  const isArchived = bucket === 'archived';

  const menuActions: MenuAction[] = [
    { key: 'enquiries', label: 'Enquiries', icon: 'chatbubbles-outline', onPress: onEnquiries },
    { key: 'admins', label: 'Manage Admins', icon: 'person-add-outline', onPress: onManageAdmins },
    course.subscriptionStatus === 'canceled'
      ? { key: 'reactivate', label: 'Reactivate Subscription', icon: 'refresh-outline', onPress: onReactivateSubscription }
      : { key: 'cancel', label: 'Cancel Subscription', icon: 'close-circle-outline', onPress: onCancelSubscription, danger: true },
    isArchived
      ? { key: 'unarchive', label: 'Unarchive Club', icon: 'archive-outline', onPress: onUnarchive }
      : { key: 'archive', label: 'Archive Club', icon: 'archive-outline', onPress: onArchive },
  ];

  return (
    <View style={[styles.card, hoverTransition, hovered && styles.cardHover]} {...hoverHandlers}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardIdentity}>
          <View style={[styles.avatar, { backgroundColor: bucket === 'active' && course.subscriptionStatus !== 'canceled' && course.subscriptionStatus !== 'past_due' ? colors.clubGreen : colors.textMuted }]}>
            <Text style={styles.avatarText}>{initials(course.name)}</Text>
          </View>
          <View style={styles.cardIdentityText}>
            <Text style={styles.cardTitle} numberOfLines={1}>{course.name}</Text>
            <Text style={styles.cardSlug} numberOfLines={1}>flagrr.com/{course.slug}</Text>
          </View>
        </View>
        <View style={styles.cardTopRight}>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
          </View>
          {pending ? (
            <ActivityIndicator size="small" color={colors.clubGreen} style={{ width: 32, height: 32 }} />
          ) : (
            <TouchableOpacity
              style={styles.moreButton}
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`More actions for ${course.name}`}
              hitSlop={6}
            >
              <Ionicons name="ellipsis-vertical" size={17} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <View style={[styles.statIcon, isArchived && styles.statIconMuted]}>
            <Ionicons name="people-outline" size={14} color={isArchived ? colors.textSecondary : colors.clubGreen} />
          </View>
          <View>
            <Text style={styles.statValue}>{course.memberCount}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
        </View>
        <View style={styles.statChip}>
          <View style={[styles.statIcon, isArchived && styles.statIconMuted]}>
            <Ionicons name="person-outline" size={14} color={isArchived ? colors.textSecondary : colors.clubGreen} />
          </View>
          <View>
            <Text style={styles.statValue}>{course.adminCount}</Text>
            <Text style={styles.statLabel}>Admins</Text>
          </View>
        </View>
      </View>

      {isPending ? (
        <View style={styles.hintRow}>
          <Ionicons name="information-circle-outline" size={15} color={colors.warning} />
          <Text style={styles.hintText}>Awaiting its first admin invite before it can go live</Text>
        </View>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.actionsRow}>
        {isPending ? (
          <TouchableOpacity style={styles.pillButtonSolid} onPress={onManageAdmins}>
            <Ionicons name="person-add-outline" size={14} color={colors.white} />
            <Text style={styles.pillButtonSolidText}>Invite Admin</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.pillButton} onPress={onManageAds}>
          <Ionicons name="megaphone-outline" size={14} color={colors.darkGreen} />
          <Text style={styles.pillButtonText}>Ads</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pillButton} onPress={onManageRewards}>
          <Ionicons name="gift-outline" size={14} color={colors.darkGreen} />
          <Text style={styles.pillButtonText}>Rewards</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pillButton} onPress={onCatalog}>
          <Ionicons name="pricetags-outline" size={14} color={colors.darkGreen} />
          <Text style={styles.pillButtonText}>Catalog</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pillButton} onPress={onMemberList}>
          <Ionicons name="cloud-upload-outline" size={14} color={colors.darkGreen} />
          <Text style={styles.pillButtonText}>Members</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menuSheet} onPress={() => {}}>
            <Text style={styles.menuSheetTitle} numberOfLines={1}>{course.name}</Text>
            {menuActions.map((action, i) => (
              <React.Fragment key={action.key}>
                {i === menuActions.length - 2 ? <View style={styles.menuDivider} /> : null}
                <TouchableOpacity
                  style={styles.menuRow}
                  onPress={() => {
                    setMenuOpen(false);
                    action.onPress();
                  }}
                >
                  <Ionicons name={action.icon} size={17} color={action.danger ? colors.negative : colors.textPrimary} />
                  <Text style={[styles.menuRowText, action.danger && { color: colors.negative }]}>{action.label}</Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </Pressable>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function AddCourseCard({ onPress, style }: { onPress: () => void; style?: object }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [hovered, hoverHandlers] = useHover();

  return (
    <TouchableOpacity
      style={[styles.ghostCard, hoverTransition, hovered && styles.ghostCardHover, style]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Add a new club"
      {...hoverHandlers}
    >
      <View style={styles.ghostIcon}>
        <Ionicons name="add" size={20} color={colors.white} />
      </View>
      <Text style={styles.ghostTitle}>Add a new club</Text>
      <Text style={styles.ghostSubtitle}>Onboard a course and invite its first admin</Text>
    </TouchableOpacity>
  );
}

export function SuperAdminCoursesScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDesktop = useIsDesktopNav();
  const {
    superAdminCourses,
    loadSuperAdminCourses,
    cancelSuperAdminCourseSubscription,
    reactivateSuperAdminCourseSubscription,
    archiveSuperAdminCourse,
    unarchiveSuperAdminCourse,
  } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [pendingCourseId, setPendingCourseId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = { all: superAdminCourses.length, active: 0, pending: 0, archived: 0 };
    for (const c of superAdminCourses) result[courseBucket(c)] += 1;
    return result;
  }, [superAdminCourses]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return superAdminCourses.filter((c) => {
      if (statusFilter !== 'all' && courseBucket(c) !== statusFilter) return false;
      if (!query) return true;
      return c.name.toLowerCase().includes(query) || c.slug.toLowerCase().includes(query);
    });
  }, [superAdminCourses, search, statusFilter]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          await loadSuperAdminCourses();
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const handleCancelSubscription = (course: SuperAdminCourseSummary) => {
    showAlert(
      'Cancel this subscription?',
      `${course.name}'s course admin and staff accounts will be blocked from logging in until reactivated. Members can still use the app, but earn Flagrr Cash at the standard rate instead of the club's own rate. You can reactivate at any time.`,
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            setPendingCourseId(course.id);
            try {
              await cancelSuperAdminCourseSubscription(course.id);
            } catch (err) {
              const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
              showAlert('Couldn’t cancel subscription', message);
            } finally {
              setPendingCourseId(null);
            }
          },
        },
      ],
    );
  };

  const handleReactivateSubscription = async (course: SuperAdminCourseSummary) => {
    setPendingCourseId(course.id);
    try {
      await reactivateSuperAdminCourseSubscription(course.id);
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t reactivate subscription', message);
    } finally {
      setPendingCourseId(null);
    }
  };

  const handleArchive = (course: SuperAdminCourseSummary) => {
    showAlert(
      'Archive this club?',
      `${course.name} will be hidden from the active club list. Nothing is deleted, and you can unarchive it again at any time.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          onPress: async () => {
            setPendingCourseId(course.id);
            try {
              await archiveSuperAdminCourse(course.id);
            } catch (err) {
              const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
              showAlert('Couldn’t archive club', message);
            } finally {
              setPendingCourseId(null);
            }
          },
        },
      ],
    );
  };

  const handleUnarchive = async (course: SuperAdminCourseSummary) => {
    setPendingCourseId(course.id);
    try {
      await unarchiveSuperAdminCourse(course.id);
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t unarchive club', message);
    } finally {
      setPendingCourseId(null);
    }
  };

  const renderCard = (item: SuperAdminCourseSummary, style?: object) => (
    <View key={item.id} style={style}>
      <CourseCard
        course={item}
        pending={pendingCourseId === item.id}
        onManageAds={() => navigation.navigate('SuperAdminCourseAds', { courseId: item.id, courseName: item.name })}
        onManageRewards={() =>
          navigation.navigate('SuperAdminCourseRewards', { courseId: item.id, courseName: item.name, fbPerRand: item.fbPerRand })
        }
        onCatalog={() =>
          navigation.navigate('SuperAdminCourseCatalog', { courseId: item.id, courseName: item.name, fbPerRand: item.fbPerRand })
        }
        onMemberList={() => navigation.navigate('SuperAdminCourseMemberList', { courseId: item.id, courseName: item.name })}
        onEnquiries={() => navigation.navigate('SuperAdminCourseEnquiries', { courseId: item.id, courseName: item.name })}
        onManageAdmins={() => navigation.navigate('SuperAdminCourseAdmins', { courseId: item.id, courseName: item.name })}
        onCancelSubscription={() => handleCancelSubscription(item)}
        onReactivateSubscription={() => handleReactivateSubscription(item)}
        onArchive={() => handleArchive(item)}
        onUnarchive={() => handleUnarchive(item)}
      />
    </View>
  );

  const filterTabs = (
    <View style={styles.filterTabs}>
      {STATUS_FILTERS.map((f) => (
        <TouchableOpacity
          key={f}
          style={[styles.filterTab, statusFilter === f && styles.filterTabActive]}
          onPress={() => setStatusFilter(f)}
        >
          <Text style={[styles.filterTabText, statusFilter === f && styles.filterTabTextActive]}>
            {STATUS_FILTER_LABELS[f]} <Text style={styles.filterTabCount}>{counts[f]}</Text>
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const searchArea = (
    <View style={styles.searchArea}>
      <TextField placeholder="Search courses or clubs" variant="onLight" icon="search" value={search} onChangeText={setSearch} />
    </View>
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminCourses" breadcrumb="Courses">
        <View style={styles.dHeadRow}>
          <View>
            <Text style={styles.dPageTitle}>Courses</Text>
            <Text style={styles.dPageSubtitle}>
              {superAdminCourses.length} club{superAdminCourses.length === 1 ? '' : 's'} on Flagrr
              {counts.pending > 0 ? ` · ${counts.pending} awaiting setup` : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.dAddButton} onPress={() => navigation.navigate('SuperAdminCourseCreate')}>
            <Ionicons name="add" size={16} color={colors.darkGreen} />
            <Text style={styles.dAddButtonText}>New Course</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.dToolbar}>
          {filterTabs}
          <View style={styles.dSearchWrap}>{searchArea}</View>
        </View>
        {loading ? (
          <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>
            {superAdminCourses.length === 0 ? 'No courses yet — add one.' : 'No courses match your search.'}
          </Text>
        ) : (
          <View style={styles.grid}>
            {filtered.map((item) => renderCard(item, styles.gridCell))}
            {statusFilter === 'all' || statusFilter === 'active' ? (
              <AddCourseCard style={styles.gridCell} onPress={() => navigation.navigate('SuperAdminCourseCreate')} />
            ) : null}
          </View>
        )}
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Courses</Text>
            <Text style={styles.headerSubtitle}>
              {superAdminCourses.length} club{superAdminCourses.length === 1 ? '' : 's'} on Flagrr
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('SuperAdminCourseCreate')}
            hitSlop={8}
            accessibilityLabel="Add Course"
            accessibilityRole="button"
          >
            <Ionicons name="add-circle" size={26} color={colors.white} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabsScroll} contentContainerStyle={{ paddingHorizontal: screenPadding }}>
        {filterTabs}
      </ScrollView>
      {searchArea}

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => renderCard(item)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {superAdminCourses.length === 0 ? 'No courses yet — tap + to add one.' : 'No courses match your search.'}
            </Text>
          }
          ListFooterComponent={
            filtered.length > 0 && (statusFilter === 'all' || statusFilter === 'active') ? (
              <AddCourseCard onPress={() => navigation.navigate('SuperAdminCourseCreate')} />
            ) : null
          }
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
    paddingVertical: spacing.md,
  },
  headerTitle: { fontFamily: fontFamily.headingDisplay, fontSize: fontSize.title, color: colors.white },
  headerSubtitle: { fontFamily: fontFamily.body, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  searchArea: { paddingHorizontal: screenPadding, paddingTop: spacing.sm, gap: spacing.xs },
  filterTabsScroll: { marginTop: spacing.md },
  filterTabs: { flexDirection: 'row', gap: 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, padding: 4, alignSelf: 'flex-start' },
  filterTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  filterTabActive: { backgroundColor: colors.darkGreen },
  filterTabText: { fontFamily: fontFamily.bodyMedium, fontSize: 12.5, color: colors.textSecondary },
  filterTabTextActive: { color: colors.white },
  filterTabCount: { opacity: 0.65 },
  listContent: { padding: screenPadding, gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
  gridCell: { flexGrow: 1, flexBasis: 360, maxWidth: 460 },
  dToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  dSearchWrap: { minWidth: 260 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHover: {
    borderColor: colors.clubGreen,
    transform: [{ translateY: -2 }],
    shadowColor: colors.clubGreen,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  cardIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, minWidth: 0 },
  cardIdentityText: { flex: 1, minWidth: 0, gap: 1 },
  avatar: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontFamily: fontFamily.headingBold, fontSize: 14, color: colors.white },
  cardTitle: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  cardSlug: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textMuted },
  cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: fontFamily.bodySemiBold, fontSize: 10.5 },
  moreButton: { width: 30, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.mintBgAlt, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, flex: 1 },
  statIcon: { width: 26, height: 26, borderRadius: radius.pill, backgroundColor: colors.mintBg, alignItems: 'center', justifyContent: 'center' },
  statIconMuted: { backgroundColor: colors.border },
  statValue: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.textPrimary },
  statLabel: { fontFamily: fontFamily.body, fontSize: 10.5, color: colors.textSecondary },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.warningBg, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8 },
  hintText: { flex: 1, fontFamily: fontFamily.body, fontSize: 11.5, color: colors.warning },
  divider: { height: 1, backgroundColor: colors.border },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pillButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.mintBgAlt, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  pillButtonText: { fontFamily: fontFamily.bodyMedium, fontSize: 12, color: colors.darkGreen },
  pillButtonSolid: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.clubGreen, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  pillButtonSolidText: { fontFamily: fontFamily.bodySemiBold, fontSize: 12, color: colors.white },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuSheet: { backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: 2 },
  menuSheetTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.cardTitle, color: colors.textPrimary, marginBottom: spacing.sm },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  menuRowText: { fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.textPrimary },
  menuDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  ghostCard: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.inputBorder,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: spacing.lg,
    minHeight: 170,
  },
  ghostCardHover: { borderColor: colors.clubGreen, backgroundColor: colors.mintBgAlt },
  ghostIcon: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.clubGreen, alignItems: 'center', justifyContent: 'center' },
  ghostTitle: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.textPrimary },
  ghostSubtitle: { fontFamily: fontFamily.body, fontSize: 11.5, color: colors.textMuted, textAlign: 'center', maxWidth: 220 },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  dHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dPageTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.textPrimary },
  dPageSubtitle: { fontFamily: fontFamily.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  dAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.lime,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dAddButtonText: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.darkGreen },
});
}
