import React, { useCallback, useState, useMemo } from 'react';
import { ActivityIndicator, FlatList, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { enquiryStatusBadges, fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { AdminEnquirySummary, EnquiryStatus } from '../../data/adminTypes';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminCourseEnquiries'>;

const FILTERS: Array<{ label: string; value: EnquiryStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Chat in Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
];

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Read-only oversight into one club's own enquiries inbox (member <->
// course_admin) — a super_admin can see every conversation, but can't
// reply into one; that stays between the member and their club.
export function SuperAdminCourseEnquiriesScreen({ route, navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDesktop = useIsDesktopNav();
  const { courseId, courseName } = route.params;
  const { getSuperAdminCourseEnquiries } = useAdmin();
  const [filter, setFilter] = useState<EnquiryStatus | 'all'>('all');
  const [enquiries, setEnquiries] = useState<AdminEnquirySummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (f: EnquiryStatus | 'all') => {
      setLoading(true);
      try {
        setEnquiries(await getSuperAdminCourseEnquiries(courseId, f === 'all' ? undefined : f));
      } finally {
        setLoading(false);
      }
    },
    [courseId, getSuperAdminCourseEnquiries],
  );

  useFocusEffect(
    useCallback(() => {
      load(filter).catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter]),
  );

  const renderItem = ({ item }: { item: AdminEnquirySummary }) => {
    const badge = enquiryStatusBadges(colors)[item.status];
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('SuperAdminEnquiryChat', { courseId, enquiryId: item.id })}
        activeOpacity={0.8}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.rowTop}>
            <Text style={styles.memberName} numberOfLines={1}>{item.memberName}</Text>
          </View>
          <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage ?? '—'}</Text>
          <Text style={styles.meta}>{item.enquiryType} · {relativeTime(item.updatedAt)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  const filterRow = (
    <View style={styles.filterRow}>
      {FILTERS.map((f) => (
        <TouchableOpacity
          key={f.value}
          onPress={() => setFilter(f.value)}
          style={[styles.filterPill, filter === f.value && styles.filterPillActive]}
        >
          <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>{f.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminCourses" breadcrumb={`${courseName} Enquiries`} showRail={false}>
        <Text style={styles.dPageTitle}>{courseName} — Enquiries</Text>
        <DesktopPanel title="All Enquiries">
          {filterRow}
          {loading ? (
            <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.md }} />
          ) : enquiries.length === 0 ? (
            <Text style={styles.emptyText}>No enquiries here yet.</Text>
          ) : (
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {enquiries.map((item) => (
                <React.Fragment key={item.id}>{renderItem({ item })}</React.Fragment>
              ))}
            </View>
          )}
        </DesktopPanel>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title={`${courseName} Enquiries`} onBack={() => navigation.goBack()} />
      </SafeAreaView>

      {filterRow}

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={enquiries}
          keyExtractor={(e) => e.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No enquiries here yet.</Text>}
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
  },
  filterPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.mintBgAlt },
  filterPillActive: { backgroundColor: colors.darkGreen },
  filterText: { fontFamily: fontFamily.heading, fontSize: 11, color: colors.textPrimary },
  filterTextActive: { color: colors.white },
  listContent: { padding: screenPadding, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberName: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  lastMessage: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 2 },
  meta: { fontFamily: fontFamily.body, fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontFamily: fontFamily.bodySemiBold, fontSize: 9 },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  dPageTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.textPrimary },
});
}
