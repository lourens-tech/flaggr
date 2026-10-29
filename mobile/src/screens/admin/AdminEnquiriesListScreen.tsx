import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList, AdminTabParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { useHover, hoverTransitionNoTransform } from '../../hooks/useHover';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { EmptyState, ErrorState, PageTitle, Segmented, SkeletonRows, StatusPill, Tile, type StatusTone } from '../../components/admin/ui';
import { useAdminTheme } from '../../context/ThemeContext';
import type { AdminEnquirySummary, EnquiryStatus } from '../../data/adminTypes';
import { adminFont, adminRadius } from '../../theme/admin';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabParamList, 'AdminEnquiries'>,
  NativeStackScreenProps<AdminStackParamList>
>;

const FILTERS: Array<{ label: string; value: EnquiryStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Chat in Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
];

// Status pill per enquiry status: waiting is amber, an active chat is
// positive, a resolved one is neutral.
const STATUS_PILL: Record<EnquiryStatus, { label: string; tone: StatusTone }> = {
  pending: { label: 'Pending', tone: 'amber' },
  in_progress: { label: 'Chat in Progress', tone: 'pos' },
  resolved: { label: 'Resolved', tone: 'neutral' },
};

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

export function AdminEnquiriesListScreen({ navigation }: Props) {
  const isDesktop = useIsDesktopNav();
  const { listEnquiries } = useAdmin();
  const [filter, setFilter] = useState<EnquiryStatus | 'all'>('all');
  const [enquiries, setEnquiries] = useState<AdminEnquirySummary[]>([]);
  const [loading, setLoading] = useState(true);
  // Load failures used to be swallowed silently; surface them with a retry.
  const [error, setError] = useState(false);

  const load = useCallback(
    async (f: EnquiryStatus | 'all') => {
      setLoading(true);
      try {
        setEnquiries(await listEnquiries(f === 'all' ? undefined : f));
      } finally {
        setLoading(false);
      }
    },
    [listEnquiries],
  );

  useFocusEffect(
    useCallback(() => {
      setError(false);
      load(filter).catch(() => setError(true));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter]),
  );

  const retry = () => {
    setError(false);
    load(filter).catch(() => setError(true));
  };

  const open = (item: AdminEnquirySummary) => navigation.navigate('AdminEnquiryChat', { enquiryId: item.id });

  const filterRow = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={isDesktop ? undefined : styles.filterScroll}>
      <Segmented
        options={FILTERS.map((f) => ({ key: f.value, label: f.label }))}
        value={filter}
        onChange={setFilter}
        accessibilityLabel="Status filter"
      />
    </ScrollView>
  );

  const emptyState = <EmptyState icon="chatbubble-outline" title="No enquiries here yet." />;

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminEnquiries" breadcrumb="Enquiries">
        <PageTitle>Enquiries</PageTitle>
        <DesktopPanel title="All Enquiries" style={styles.dPane}>
          {filterRow}
          {error ? (
            <ErrorState onRetry={retry} />
          ) : loading ? (
            <SkeletonRows rows={5} />
          ) : enquiries.length === 0 ? (
            emptyState
          ) : (
            <View style={styles.dList}>
              {enquiries.map((item) => (
                <EnquiryRow key={item.id} item={item} onPress={() => open(item)} desktop />
              ))}
            </View>
          )}
        </DesktopPanel>
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="Enquiries" showBack={false} />

      {filterRow}

      {error ? (
        <View style={styles.listContent}>
          <ErrorState onRetry={retry} />
        </View>
      ) : loading ? (
        <View style={styles.listContent}>
          <Tile>
            <SkeletonRows rows={5} />
          </Tile>
        </View>
      ) : (
        <FlatList
          data={enquiries}
          keyExtractor={(e) => e.id}
          renderItem={({ item, index }) => (
            <EnquiryRow item={item} onPress={() => open(item)} first={index === 0} last={index === enquiries.length - 1} />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Tile>{emptyState}</Tile>}
        />
      )}
    </View>
  );
}

function EnquiryRow({
  item,
  onPress,
  desktop,
  first,
  last,
}: {
  item: AdminEnquirySummary;
  onPress: () => void;
  desktop?: boolean;
  first?: boolean;
  last?: boolean;
}) {
  const { c } = useAdminTheme();
  const [hovered, hoverHandlers] = useHover();
  const status = STATUS_PILL[item.status];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.memberName}, ${status.label}${item.hasUnread ? ', unread' : ''}`}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
      style={({ pressed }) => [
        desktop
          ? [styles.dRow, hoverTransitionNoTransform, (hovered || pressed) && { backgroundColor: c.fill2 }]
          : [
              styles.mRow,
              { backgroundColor: pressed ? c.surface2 : c.surface, borderColor: c.edge },
              first && styles.mRowFirst,
              last && styles.mRowLast,
            ],
      ]}
    >
      <View style={styles.dotCol}>{item.hasUnread ? <View style={[styles.unreadDot, { backgroundColor: c.accent }]} /> : null}</View>
      <View style={[styles.rowMain, !desktop && !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge }]}>
        <View style={styles.rowTop}>
          <Text style={[styles.memberName, { color: c.ink }]} numberOfLines={1}>{item.memberName}</Text>
          <Text style={[styles.time, { color: c.ink3 }]}>{relativeTime(item.updatedAt)}</Text>
        </View>
        <Text style={[styles.lastMessage, { color: c.ink2 }]} numberOfLines={1}>{item.lastMessage ?? '—'}</Text>
        <View style={styles.rowBottom}>
          <Text style={[styles.meta, { color: c.ink3 }]} numberOfLines={1}>{item.enquiryType}</Text>
          <StatusPill label={status.label} tone={status.tone} />
          {desktop ? null : <Ionicons name="chevron-forward" size={15} color={c.ink3} />}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  filterBar: { flexGrow: 0 },
  filterScroll: { paddingHorizontal: 16 },
  listContent: { padding: 16, paddingBottom: 32 },
  dPane: { borderRadius: adminRadius.lg },
  dList: { gap: 2 },
  dRow: { flexDirection: 'row', borderRadius: adminRadius.md, minHeight: 52 },
  mRow: { flexDirection: 'row', borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, minHeight: 52 },
  mRowFirst: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: adminRadius.md, borderTopRightRadius: adminRadius.md },
  mRowLast: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: adminRadius.md, borderBottomRightRadius: adminRadius.md },
  dotCol: { width: 28, alignItems: 'center', paddingTop: 19 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  rowMain: { flex: 1, minWidth: 0, paddingVertical: 12, paddingRight: 14 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberName: { ...adminFont.bodyBold, fontSize: 15, flex: 1 },
  time: { ...adminFont.bodyMedium, fontSize: 12 },
  lastMessage: { ...adminFont.body, fontSize: 13.5, marginTop: 3 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  meta: { ...adminFont.bodyMedium, fontSize: 12, flex: 1 },
});
