import React, { useCallback, useState, useMemo } from 'react';
import { ActivityIndicator, FlatList, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, type CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList, SuperAdminTabParamList } from '../../navigation/types';
import { useAdmin } from '../../context/AdminContext';
import { fontFamily, fontSize, priorityBadges, radius, screenPadding, spacing, ticketStatusBadges } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { SupportInboxTicket, SupportTicketPriority, SupportTicketStatus } from '../../data/adminTypes';

type Props = CompositeScreenProps<
  BottomTabScreenProps<SuperAdminTabParamList, 'SuperAdminSupport'>,
  NativeStackScreenProps<SuperAdminStackParamList>
>;

const FILTERS: Array<{ label: string; value: SupportTicketStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
];

const PRIORITY_FILTERS: Array<{ label: string; value: SupportTicketPriority | 'all' }> = [
  { label: 'Any Priority', value: 'all' },
  { label: 'Urgent', value: 'urgent' },
  { label: 'High', value: 'high' },
  { label: 'Normal', value: 'normal' },
  { label: 'Low', value: 'low' },
];

const ASSIGNED_FILTERS: Array<{ label: string; value: 'all' | 'mine' | 'unassigned' }> = [
  { label: 'Everyone', value: 'all' },
  { label: 'Mine', value: 'mine' },
  { label: 'Unassigned', value: 'unassigned' },
];

const REQUESTER_LABEL: Record<string, string> = {
  member: 'Member',
  course_admin: 'Course Admin',
  staff: 'Staff',
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

// Every support ticket across every club — a member/course_admin/staff's
// ticket to the Flagrr team itself, answerable by any super_admin or
// support_agent. A ticket auto-assigns to whoever first replies (or can be
// explicitly claimed/released — see the ticket chat screen) so two agents
// don't double-work the same conversation, but any agent can still see and
// reply to any ticket regardless of who it's assigned to.
export function SuperAdminSupportInboxScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { admin, getSupportInbox } = useAdmin();
  const [filter, setFilter] = useState<SupportTicketStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<SupportTicketPriority | 'all'>('all');
  const [assignedFilter, setAssignedFilter] = useState<'all' | 'mine' | 'unassigned'>('all');
  const [tickets, setTickets] = useState<SupportInboxTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (f: SupportTicketStatus | 'all', p: SupportTicketPriority | 'all', a: 'all' | 'mine' | 'unassigned') => {
      setLoading(true);
      try {
        setTickets(await getSupportInbox(f === 'all' ? undefined : f, p === 'all' ? undefined : p, a === 'all' ? undefined : a));
      } finally {
        setLoading(false);
      }
    },
    [getSupportInbox],
  );

  useFocusEffect(
    useCallback(() => {
      load(filter, priorityFilter, assignedFilter).catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter, priorityFilter, assignedFilter]),
  );

  const renderItem = ({ item }: { item: SupportInboxTicket }) => {
    const badge = ticketStatusBadges(colors)[item.status];
    const priorityBadge = priorityBadges(colors)[item.priority];
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('SuperAdminSupportTicketChat', { ticketId: item.id })}
        activeOpacity={0.8}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.rowTop}>
            <Text style={styles.subject} numberOfLines={1}>{item.subject}</Text>
            {item.hasUnread ? <View style={styles.unreadDot} /> : null}
          </View>
          <Text style={styles.requesterLine} numberOfLines={1}>
            {item.requesterName} · {REQUESTER_LABEL[item.requesterType] ?? item.requesterType}
          </Text>
          <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage ?? '—'}</Text>
          <Text style={styles.meta}>
            {relativeTime(item.updatedAt)} ·{' '}
            {item.assignedAgentId === admin.id ? 'Assigned to you' : item.assignedAgentName ? `Assigned to ${item.assignedAgentName}` : 'Unassigned'}
          </Text>
        </View>
        <View style={{ gap: 4, alignItems: 'flex-end' }}>
          {item.priority !== 'normal' ? (
            <View style={[styles.badge, { backgroundColor: priorityBadge.bg }]}>
              <Text style={[styles.badgeText, { color: priorityBadge.fg }]}>{priorityBadge.label}</Text>
            </View>
          ) : null}
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Support Centre</Text>
        </View>
      </SafeAreaView>

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

      <View style={styles.filterRow}>
        {PRIORITY_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            onPress={() => setPriorityFilter(f.value)}
            style={[styles.filterPill, priorityFilter === f.value && styles.filterPillActive]}
          >
            <Text style={[styles.filterText, priorityFilter === f.value && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.filterRow}>
        {ASSIGNED_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            onPress={() => setAssignedFilter(f.value)}
            style={[styles.filterPill, assignedFilter === f.value && styles.filterPillActive]}
          >
            <Text style={[styles.filterText, assignedFilter === f.value && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No support tickets here yet.</Text>}
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  header: { paddingHorizontal: screenPadding, paddingVertical: spacing.md },
  headerTitle: { fontFamily: fontFamily.headingDisplay, fontSize: fontSize.title, color: colors.white },
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
  subject: { flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.negative },
  requesterLine: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.clubGreen, marginTop: 2 },
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
});
}
