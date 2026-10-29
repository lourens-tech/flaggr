import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, type CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList, SuperAdminTabParamList } from '../../navigation/types';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { useHover, hoverTransition } from '../../hooks/useHover';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { DesktopDataTable, TableText, type DesktopTableColumn } from '../../components/admin/desktop/DesktopDataTable';
import { DesktopStatCard } from '../../components/admin/desktop/DesktopStatCard';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import {
  AdminButton,
  CircleButton,
  EmptyState,
  ErrorState,
  FLAGRR_BACKDROP,
  Segmented,
  SkeletonRows,
  StatusPill,
  Tile,
  type StatusTone,
} from '../../components/admin/ui';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { SuperAdminCourseSummary } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

type Props = CompositeScreenProps<
  BottomTabScreenProps<SuperAdminTabParamList, 'SuperAdminCourses'>,
  NativeStackScreenProps<SuperAdminStackParamList>
>;

type StatusFilter = 'all' | 'active' | 'pending' | 'archived';
const STATUS_FILTERS: StatusFilter[] = ['all', 'active', 'pending', 'archived'];
const STATUS_FILTER_LABELS: Record<StatusFilter, string> = { all: 'All', active: 'Active', pending: 'Pending', archived: 'Archived' };

// The photo header's scrim: darkest behind the text, fading towards the
// right so the course photo still reads (same treatment as the mockup).
const HERO_SCRIM = ['rgba(6,14,10,0.78)', 'rgba(6,14,10,0.45)', 'rgba(6,14,10,0.2)'] as const;
const ON_PHOTO = '#FFFFFF';

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

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

interface Badge {
  label: string;
  tone: StatusTone;
}

function statusBadge(c: SuperAdminCourseSummary): Badge {
  if (c.archivedAt) return { label: 'Archived', tone: 'neutral' };
  if (c.onboardingCompletedAt === null) return { label: 'Setup Pending', tone: 'amber' };
  switch (c.subscriptionStatus) {
    case 'past_due':
      return { label: 'Past Due', tone: 'neg' };
    case 'canceled':
      return { label: 'Canceled', tone: 'neutral' };
    case 'trialing':
      return { label: 'Trialing', tone: 'amber' };
    default:
      return { label: 'Active', tone: 'pos' };
  }
}

// A live club gets the Fairway crest with lime initials; anything archived,
// mid-setup, canceled or past due gets a neutral one.
function isLive(course: SuperAdminCourseSummary): boolean {
  return courseBucket(course) === 'active' && course.subscriptionStatus !== 'canceled' && course.subscriptionStatus !== 'past_due';
}

function ClubCrest({ course, size = 44 }: { course: SuperAdminCourseSummary; size?: number }) {
  const { c } = useAdminTheme();
  const live = isLive(course);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: adminRadius.sm,
        backgroundColor: live ? '#1F4234' : c.fill,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Text style={{ ...adminFont.bodyBold, fontSize: size >= 44 ? 14 : 13, color: live ? '#CDDE5C' : c.ink2 }}>{initials(course.name)}</Text>
    </View>
  );
}

interface MenuAction {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  danger?: boolean;
}

interface CourseActions {
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

interface CourseCardProps extends CourseActions {
  course: SuperAdminCourseSummary;
  pending: boolean;
}

// The ⋯ button and its action sheet (a bottom sheet on phones, a centred
// sheet on desktop). While an action is in flight it shows a spinner instead.
function CourseMenu({ course, pending, actions }: { course: SuperAdminCourseSummary; pending: boolean; actions: CourseActions }) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const [menuOpen, setMenuOpen] = useState(false);
  const isArchived = courseBucket(course) === 'archived';

  const menuActions: MenuAction[] = [
    { key: 'enquiries', label: 'Enquiries', icon: 'chatbubbles-outline', onPress: actions.onEnquiries },
    { key: 'admins', label: 'Manage Admins', icon: 'person-add-outline', onPress: actions.onManageAdmins },
    course.subscriptionStatus === 'canceled'
      ? { key: 'reactivate', label: 'Reactivate Subscription', icon: 'refresh-outline', onPress: actions.onReactivateSubscription }
      : { key: 'cancel', label: 'Cancel Subscription', icon: 'close-circle-outline', onPress: actions.onCancelSubscription, danger: true },
    isArchived
      ? { key: 'unarchive', label: 'Unarchive Club', icon: 'archive-outline', onPress: actions.onUnarchive }
      : { key: 'archive', label: 'Archive Club', icon: 'archive-outline', onPress: actions.onArchive },
  ];

  return (
    <>
      {pending ? (
        <ActivityIndicator size="small" color={c.ink2} style={{ width: 36, height: 36 }} />
      ) : (
        <CircleButton
          icon="ellipsis-horizontal"
          size={36}
          onPress={() => setMenuOpen(true)}
          accessibilityLabel={`More actions for ${course.name}`}
        />
      )}

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity
          style={[styles.menuBackdrop, { backgroundColor: c.scrim }, isDesktop && styles.menuBackdropDesktop]}
          activeOpacity={1}
          onPress={() => setMenuOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        >
          <Pressable style={[styles.menuSheet, isDesktop && styles.menuSheetDesktop]} onPress={() => {}} accessibilityRole="menu">
            <Text style={styles.menuSheetTitle} numberOfLines={1}>{course.name}</Text>
            {menuActions.map((action, i) => (
              <React.Fragment key={action.key}>
                {i === menuActions.length - 2 ? <View style={styles.menuDivider} /> : null}
                <Pressable
                  style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: c.fill2 }]}
                  accessibilityRole="menuitem"
                  onPress={() => {
                    setMenuOpen(false);
                    action.onPress();
                  }}
                >
                  <Ionicons name={action.icon} size={18} color={action.danger ? c.neg : c.ink2} />
                  <Text style={[styles.menuRowText, action.danger && { color: c.neg }]}>{action.label}</Text>
                </Pressable>
              </React.Fragment>
            ))}
          </Pressable>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// Phone: one club per card — identity and status, the two counts, the
// pending hint, then its four manage links.
function CourseCard({ course, pending, ...actions }: CourseCardProps) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);

  const bucket = courseBucket(course);
  const badge = statusBadge(course);
  const isPending = bucket === 'pending';
  const isArchived = bucket === 'archived';
  const iconColor = isArchived ? c.ink3 : c.icon;

  const link = (icon: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void) => (
    <AdminButton label={label} icon={icon} variant="glass" onPress={onPress} style={styles.cardLink} />
  );

  return (
    <Tile style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardIdentity}>
          <ClubCrest course={course} />
          <View style={styles.cardIdentityText}>
            <Text style={styles.cardTitle} numberOfLines={1}>{course.name}</Text>
            <Text style={styles.cardSlug} numberOfLines={1}>flagrr.com/{course.slug}</Text>
          </View>
        </View>
        <View style={styles.cardTopRight}>
          <StatusPill label={badge.label} tone={badge.tone} />
          <CourseMenu course={course} pending={pending} actions={actions} />
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Ionicons name="people-outline" size={16} color={iconColor} />
          <View>
            <Text style={styles.statValue}>{course.memberCount}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
        </View>
        <View style={styles.statChip}>
          <Ionicons name="person-outline" size={16} color={iconColor} />
          <View>
            <Text style={styles.statValue}>{course.adminCount}</Text>
            <Text style={styles.statLabel}>Admins</Text>
          </View>
        </View>
      </View>

      {isPending ? (
        <View style={styles.hintRow}>
          <Ionicons name="information-circle-outline" size={16} color={c.amber} />
          <Text style={styles.hintText}>Awaiting its first admin invite before it can go live</Text>
        </View>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.actionsRow}>
        {isPending ? (
          <AdminButton label="Invite Admin" icon="person-add-outline" variant="glass" onPress={actions.onManageAdmins} style={styles.cardLinkFull} />
        ) : null}
        {link('megaphone-outline', 'Ads', actions.onManageAds)}
        {link('gift-outline', 'Rewards', actions.onManageRewards)}
        {link('pricetags-outline', 'Catalog', actions.onCatalog)}
        {link('cloud-upload-outline', 'Members', actions.onMemberList)}
      </View>
    </Tile>
  );
}

// Small neutral link used in the desktop table's Manage column.
function ManageChip({ icon, label, onPress, accessibilityLabel }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; accessibilityLabel: string }) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const [hovered, hoverHandlers] = useHover();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
      style={[styles.chip, hoverTransition, hovered && { backgroundColor: c.sel }]}
    >
      <Ionicons name={icon} size={14} color={c.icon} />
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

function AddCourseCard({ onPress, style }: { onPress: () => void; style?: object }) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
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
        <Ionicons name="add" size={20} color={c.ink} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.ghostTitle}>Add a new club</Text>
        <Text style={styles.ghostSubtitle}>Onboard a course and invite its first admin</Text>
      </View>
    </TouchableOpacity>
  );
}

// "Good afternoon." over Flagrr's own course photo, with the club summary.
function CoursesHero({ summary, compact }: { summary: string; compact?: boolean }) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  return (
    <View style={[styles.hero, compact && styles.heroCompact]}>
      <Image source={FLAGRR_BACKDROP} resizeMode="cover" style={StyleSheet.absoluteFill} accessible={false} accessibilityIgnoresInvertColors />
      <LinearGradient colors={HERO_SCRIM} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.heroContent, compact && styles.heroContentCompact]}>
        <Text style={styles.heroEyebrow}>Courses</Text>
        <Text accessibilityRole="header" style={[styles.heroTitle, compact && styles.heroTitleCompact]}>{greeting()}.</Text>
        <Text style={styles.heroSubtitle} numberOfLines={2}>{summary}</Text>
      </View>
    </View>
  );
}

export function SuperAdminCoursesScreen({ navigation }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
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
  const [loadError, setLoadError] = useState(false);
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
        setLoadError(false);
        try {
          await loadSuperAdminCourses();
        } catch {
          if (!cancelled) setLoadError(true);
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

  // Retry after a failed load (same call as on focus).
  const retryLoad = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      await loadSuperAdminCourses();
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

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

  const handleReactivateSubscription = (course: SuperAdminCourseSummary) => {
    showAlert(
      'Reactivate this subscription?',
      `${course.name}'s course admin and staff accounts will be able to log in again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reactivate',
          onPress: async () => {
            setPendingCourseId(course.id);
            try {
              await reactivateSuperAdminCourseSubscription(course.id);
            } catch (err) {
              const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
              showAlert('Couldn’t reactivate subscription', message);
            } finally {
              setPendingCourseId(null);
            }
          },
        },
      ],
    );
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

  const handleUnarchive = (course: SuperAdminCourseSummary) => {
    showAlert('Unarchive this club?', `${course.name} will show in the club list again.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unarchive',
        onPress: async () => {
          setPendingCourseId(course.id);
          try {
            await unarchiveSuperAdminCourse(course.id);
          } catch (err) {
            const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
            showAlert('Couldn’t unarchive club', message);
          } finally {
            setPendingCourseId(null);
          }
        },
      },
    ]);
  };

  const actionsFor = (item: SuperAdminCourseSummary): CourseActions => ({
    onManageAds: () => navigation.navigate('SuperAdminCourseAds', { courseId: item.id, courseName: item.name }),
    onManageRewards: () =>
      navigation.navigate('SuperAdminCourseRewards', { courseId: item.id, courseName: item.name, fbPerRand: item.fbPerRand }),
    onCatalog: () =>
      navigation.navigate('SuperAdminCourseCatalog', { courseId: item.id, courseName: item.name, fbPerRand: item.fbPerRand }),
    onMemberList: () => navigation.navigate('SuperAdminCourseMemberList', { courseId: item.id, courseName: item.name }),
    onEnquiries: () => navigation.navigate('SuperAdminCourseEnquiries', { courseId: item.id, courseName: item.name }),
    onManageAdmins: () => navigation.navigate('SuperAdminCourseAdmins', { courseId: item.id, courseName: item.name }),
    onCancelSubscription: () => handleCancelSubscription(item),
    onReactivateSubscription: () => handleReactivateSubscription(item),
    onArchive: () => handleArchive(item),
    onUnarchive: () => handleUnarchive(item),
  });

  const renderCard = (item: SuperAdminCourseSummary) => (
    <CourseCard key={item.id} course={item} pending={pendingCourseId === item.id} {...actionsFor(item)} />
  );

  const filterTabs = (
    <Segmented
      accessibilityLabel="Filter clubs"
      options={STATUS_FILTERS.map((f) => ({ key: f, label: STATUS_FILTER_LABELS[f], count: counts[f] }))}
      value={statusFilter}
      onChange={setStatusFilter}
    />
  );

  const searchField = <TextField placeholder="Search courses or clubs" variant="onLight" icon="search" value={search} onChangeText={setSearch} />;

  const summary = `${superAdminCourses.length} club${superAdminCourses.length === 1 ? '' : 's'} on Flagrr${counts.pending > 0 ? ` · ${counts.pending} awaiting setup` : ''}`;
  const showAddCard = statusFilter === 'all' || statusFilter === 'active';

  if (isDesktop) {
    const memberTotal = superAdminCourses.reduce((sum, course) => sum + course.memberCount, 0);
    const pastDue = superAdminCourses.filter((course) => course.subscriptionStatus === 'past_due').length;

    const columns: DesktopTableColumn<SuperAdminCourseSummary>[] = [
      {
        key: 'club',
        label: 'Club',
        width: 260,
        sortValue: (row) => row.name.toLowerCase(),
        render: (row) => (
          <View style={styles.clubCell}>
            <ClubCrest course={row} size={38} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>{row.name}</Text>
              <Text style={styles.cardSlug} numberOfLines={1}>flagrr.com/{row.slug}</Text>
            </View>
          </View>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        width: 200,
        sortValue: (row) => statusBadge(row).label,
        render: (row) => {
          const badge = statusBadge(row);
          return (
            <View style={{ gap: 4 }}>
              <StatusPill label={badge.label} tone={badge.tone} />
              {courseBucket(row) === 'pending' ? (
                <Text style={styles.tableHint} numberOfLines={2}>Awaiting its first admin invite before it can go live</Text>
              ) : null}
            </View>
          );
        },
      },
      {
        key: 'members',
        label: 'Members',
        width: 96,
        align: 'right',
        sortValue: (row) => row.memberCount,
        render: (row) => <TableText>{row.memberCount}</TableText>,
      },
      {
        key: 'admins',
        label: 'Admins',
        width: 86,
        align: 'right',
        sortValue: (row) => row.adminCount,
        render: (row) => <TableText>{row.adminCount}</TableText>,
      },
      {
        key: 'manage',
        label: 'Manage',
        width: 380,
        render: (row) => {
          const actions = actionsFor(row);
          return (
            <View style={styles.chipRow}>
              {courseBucket(row) === 'pending' ? (
                <ManageChip icon="person-add-outline" label="Invite Admin" onPress={actions.onManageAdmins} accessibilityLabel={`Invite Admin for ${row.name}`} />
              ) : null}
              <ManageChip icon="megaphone-outline" label="Ads" onPress={actions.onManageAds} accessibilityLabel={`Ads for ${row.name}`} />
              <ManageChip icon="gift-outline" label="Rewards" onPress={actions.onManageRewards} accessibilityLabel={`Rewards for ${row.name}`} />
              <ManageChip icon="pricetags-outline" label="Catalog" onPress={actions.onCatalog} accessibilityLabel={`Catalog for ${row.name}`} />
              <ManageChip icon="cloud-upload-outline" label="Members" onPress={actions.onMemberList} accessibilityLabel={`Members for ${row.name}`} />
            </View>
          );
        },
      },
      {
        key: 'more',
        label: '',
        width: 56,
        align: 'right',
        render: (row) => <CourseMenu course={row} pending={pendingCourseId === row.id} actions={actionsFor(row)} />,
      },
    ];

    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminCourses" breadcrumb="Courses">
        <CoursesHero summary={summary} />

        <View style={styles.dStrip}>
          <DesktopStatCard label="Clubs on Flagrr" value={superAdminCourses.length} icon="business-outline" />
          <DesktopStatCard label="Members" value={memberTotal} icon="people-outline" />
          <DesktopStatCard label="Awaiting setup" value={counts.pending} icon="hourglass-outline" />
          <DesktopStatCard label="Past due" value={pastDue} icon="alert-circle-outline" />
        </View>

        <View style={styles.dToolbar}>
          {filterTabs}
          <View style={{ flex: 1 }} />
          <View style={styles.dSearchWrap}>{searchField}</View>
          <AdminButton label="New Course" icon="add" variant="accent" onPress={() => navigation.navigate('SuperAdminCourseCreate')} />
        </View>

        {loadError ? (
          <ErrorState onRetry={retryLoad} />
        ) : loading ? (
          <Tile>
            <SkeletonRows rows={5} />
          </Tile>
        ) : filtered.length === 0 ? (
          <Tile>
            {superAdminCourses.length === 0 ? (
              <EmptyState icon="business-outline" title="No courses yet — add one." />
            ) : (
              <EmptyState icon="search-outline" title="No courses match your search." />
            )}
          </Tile>
        ) : (
          <Tile padded={false} style={styles.dTableTile}>
            <DesktopDataTable columns={columns} rows={filtered} keyExtractor={(row) => row.id} />
            {showAddCard ? (
              <View style={styles.dAddRow}>
                <AddCourseCard onPress={() => navigation.navigate('SuperAdminCourseCreate')} />
              </View>
            ) : null}
          </Tile>
        )}
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader
        title="Courses"
        showBack={false}
        right={
          <View style={styles.headerActions}>
            <CircleButton icon="map-outline" onPress={() => navigation.navigate('SuperAdminCourseMaps')} accessibilityLabel="Course maps" size={44} />
            <CircleButton icon="add" onPress={() => navigation.navigate('SuperAdminCourseCreate')} accessibilityLabel="Add Course" size={44} />
          </View>
        }
      />

      <FlatList
        data={loading || loadError ? [] : filtered}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => renderCard(item)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.mHeader}>
            <CoursesHero summary={summary} compact />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabsScroll}>
              {filterTabs}
            </ScrollView>
            {searchField}
          </View>
        }
        ListEmptyComponent={
          loadError ? (
            <ErrorState onRetry={retryLoad} />
          ) : loading ? (
            <Tile>
              <SkeletonRows rows={4} />
            </Tile>
          ) : (
            <Tile padded={false}>
              {superAdminCourses.length === 0 ? (
                <EmptyState icon="business-outline" title="No courses yet — tap + to add one." />
              ) : (
                <EmptyState icon="search-outline" title="No courses match your search." />
              )}
            </Tile>
          )
        }
        ListFooterComponent={
          !loading && !loadError && filtered.length > 0 && showAddCard ? (
            <AddCourseCard onPress={() => navigation.navigate('SuperAdminCourseCreate')} />
          ) : null
        }
      />
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    // flexGrow 0: react-native-web gives ScrollView flex-grow/shrink 1 by
    // default, which squashed this row to a clipped sliver on phones.
    filterTabsScroll: { flexGrow: 0, flexShrink: 0 },
    mHeader: { gap: 12, marginBottom: 2 },
    listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40, gap: 12 },

    hero: { height: 170, borderRadius: adminRadius.lg, overflow: 'hidden', justifyContent: 'flex-end' },
    heroCompact: { height: 132, borderRadius: adminRadius.md },
    heroContent: { paddingHorizontal: 30, paddingBottom: 22 },
    heroContentCompact: { paddingHorizontal: 18, paddingBottom: 16 },
    heroEyebrow: { ...adminFont.bodyBold, fontSize: 11.5, letterSpacing: 1.3, textTransform: 'uppercase', color: ON_PHOTO, opacity: 0.8 },
    heroTitle: { ...adminFont.title, fontSize: 44, letterSpacing: -0.8, lineHeight: 48, color: ON_PHOTO, marginTop: 6 },
    heroTitleCompact: { fontSize: 30, lineHeight: 34, marginTop: 4 },
    heroSubtitle: { ...adminFont.body, ...tabularNums, fontSize: 15, color: ON_PHOTO, opacity: 0.86, marginTop: 6 },

    card: { gap: 12 },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    cardIdentity: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
    cardIdentityText: { flex: 1, minWidth: 0, gap: 1 },
    cardTitle: { ...adminFont.bodySemiBold, fontSize: 15.5, color: c.ink },
    cardSlug: { ...adminFont.body, fontSize: 12.5, color: c.ink2 },
    cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
    statsRow: { flexDirection: 'row', gap: 8 },
    statChip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.fill, borderRadius: adminRadius.sm, paddingHorizontal: 12, paddingVertical: 9 },
    statValue: { ...adminFont.bodyBold, ...tabularNums, fontSize: 15, color: c.ink },
    statLabel: { ...adminFont.body, fontSize: 12.5, color: c.ink2 },
    hintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.amberBg, borderRadius: adminRadius.sm, paddingHorizontal: 12, paddingVertical: 9 },
    hintText: { flex: 1, ...adminFont.body, fontSize: 13, color: c.ink },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.edge },
    actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    cardLink: { height: 44, flexGrow: 1, flexBasis: '40%' },
    cardLinkFull: { height: 44, flexBasis: '100%' },

    menuBackdrop: { flex: 1, justifyContent: 'flex-end' },
    menuBackdropDesktop: { justifyContent: 'center', alignItems: 'center' },
    menuSheet: {
      backgroundColor: c.sheet,
      borderTopLeftRadius: adminRadius.lg,
      borderTopRightRadius: adminRadius.lg,
      paddingHorizontal: 12,
      paddingTop: 18,
      paddingBottom: 28,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.edge,
    },
    menuSheetDesktop: { width: 360, borderRadius: adminRadius.lg, paddingBottom: 12 },
    menuSheetTitle: { ...adminFont.bodyBold, fontSize: 17, color: c.ink, marginBottom: 6, marginHorizontal: 12 },
    menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 12, borderRadius: adminRadius.sm },
    menuRowText: { ...adminFont.body, fontSize: 15.5, color: c.ink },
    menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: c.edge, marginVertical: 4, marginHorizontal: 12 },

    ghostCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 58,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: c.edge,
      borderRadius: adminRadius.md,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    ghostCardHover: { backgroundColor: c.fill2 },
    ghostIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.fill, alignItems: 'center', justifyContent: 'center' },
    ghostTitle: { ...adminFont.bodySemiBold, fontSize: 14.5, color: c.ink },
    ghostSubtitle: { ...adminFont.body, fontSize: 12.5, color: c.ink2, marginTop: 1 },

    dStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
    dToolbar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 18, marginBottom: 12 },
    dSearchWrap: { width: 280 },
    dTableTile: { overflow: 'hidden', paddingVertical: 4 },
    dAddRow: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 },
    clubCell: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    tableHint: { ...adminFont.body, fontSize: 12.5, color: c.amber },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 11, borderRadius: adminRadius.pill, backgroundColor: c.fill },
    chipText: { ...adminFont.bodySemiBold, fontSize: 13, color: c.ink },
  });
}
