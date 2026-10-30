import React, { useCallback, useState, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { EmptyState, ErrorState, Muted, PageTitle, Segmented, SkeletonRows, StatusPill, Tile, type StatusTone } from '../../components/admin/ui';
import { useHover, hoverTransition } from '../../hooks/useHover';
import { useAdminTheme } from '../../context/ThemeContext';
import type { AdminEnquirySummary, EnquiryStatus } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminCourseEnquiries'>;

const FILTERS: Array<{ label: string; value: EnquiryStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Chat in Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
];

const STATUS_TONE: Record<EnquiryStatus, StatusTone> = { pending: 'amber', in_progress: 'pos', resolved: 'neutral' };

function statusLabel(status: EnquiryStatus): string {
  return FILTERS.find((f) => f.value === status)?.label ?? status;
}

function clubInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// One enquiry in the grouped list: member, last message, type and age, status.
function EnquiryRow({ item, first, onPress }: { item: AdminEnquirySummary; first: boolean; onPress: () => void }) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const [hovered, hoverHandlers] = useHover();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.memberName}, ${statusLabel(item.status)}`}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
      style={({ pressed }) => [styles.row, hoverTransition, !first && styles.rowRule, (hovered || pressed) && { backgroundColor: c.fill2 }]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.memberName} numberOfLines={1}>{item.memberName}</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage ?? '—'}</Text>
        <Text style={styles.meta} numberOfLines={1}>{item.enquiryType} · {relativeTime(item.updatedAt)}</Text>
      </View>
      <StatusPill label={statusLabel(item.status)} tone={STATUS_TONE[item.status]} style={styles.pill} />
      <Ionicons name="chevron-forward" size={16} color={c.ink3} />
    </Pressable>
  );
}

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
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { courseId, courseName } = route.params;
  const { getSuperAdminCourseEnquiries } = useAdmin();
  const [filter, setFilter] = useState<EnquiryStatus | 'all'>('all');
  const [enquiries, setEnquiries] = useState<AdminEnquirySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(
    async (f: EnquiryStatus | 'all') => {
      setLoading(true);
      setLoadError(false);
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
      load(filter).catch(() => setLoadError(true));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter]),
  );

  const filterRow = (
    <Segmented
      accessibilityLabel="Status filter"
      options={FILTERS.map((f) => ({ key: f.value, label: f.label }))}
      value={filter}
      onChange={setFilter}
    />
  );

  const list = loadError ? (
    <ErrorState onRetry={() => load(filter).catch(() => setLoadError(true))} />
  ) : loading ? (
    <Tile>
      <SkeletonRows rows={4} />
    </Tile>
  ) : enquiries.length === 0 ? (
    <Tile padded={false}>
      <EmptyState icon="chatbubbles-outline" title="No enquiries here yet." />
    </Tile>
  ) : (
    <Tile padded={false} style={styles.listTile}>
      {enquiries.map((item, i) => (
        <EnquiryRow
          key={item.id}
          item={item}
          first={i === 0}
          onPress={() => navigation.navigate('SuperAdminEnquiryChat', { courseId, enquiryId: item.id })}
        />
      ))}
    </Tile>
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminCourses" breadcrumb={`Courses › ${courseName} › Enquiries`} showRail={false}>
        <View style={styles.dHeadRow}>
          <View style={styles.crest}>
            <Text style={styles.crestText}>{clubInitials(courseName)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <PageTitle>{courseName}</PageTitle>
            <Muted style={styles.dSection}>Enquiries</Muted>
          </View>
        </View>
        <View style={styles.dToolbar}>{filterRow}</View>
        {list}
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="Enquiries" subtitle={courseName} />

      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.segScroll}>
          {filterRow}
        </ScrollView>
        {list}
      </ScrollView>
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40, gap: 12 },
  // flexGrow 0: react-native-web gives ScrollView flex-grow/shrink 1 by default.
  segScroll: { flexGrow: 0, flexShrink: 0 },
  listTile: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 72, paddingHorizontal: 16, paddingVertical: 12 },
  rowRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },
  memberName: { ...adminFont.bodySemiBold, fontSize: 15, color: c.ink },
  lastMessage: { ...adminFont.body, fontSize: 13.5, color: c.ink2, marginTop: 2 },
  meta: { ...adminFont.body, ...tabularNums, fontSize: 12.5, color: c.ink3, marginTop: 3 },
  pill: { flexShrink: 0, alignSelf: 'center' },
  dHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  crest: { width: 48, height: 48, borderRadius: adminRadius.sm, backgroundColor: '#1F4234', alignItems: 'center', justifyContent: 'center' },
  crestText: { ...adminFont.bodyBold, fontSize: 16, color: '#CDDE5C' },
  dSection: { marginTop: 2, fontSize: 15 },
  dToolbar: { flexDirection: 'row', marginTop: 18, marginBottom: 12 },
});
}
