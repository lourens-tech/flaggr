import React, { useCallback, useRef, useState, useMemo } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, type CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList, SuperAdminTabParamList } from '../../navigation/types';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { useHover, hoverTransition } from '../../hooks/useHover';
import { EmptyState, ErrorState, PageTitle, Segmented, SkeletonRows, StatusPill, Tile, type StatusTone } from '../../components/admin/ui';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { priorityBadges, ticketStatusBadges } from '../../theme';
import { useAdminTheme, useThemeColors } from '../../context/ThemeContext';
import type { SupportInboxTicket, SupportTicketPriority, SupportTicketStatus } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

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

const STATUS_TONE: Record<SupportTicketStatus, StatusTone> = { open: 'amber', in_progress: 'pos', resolved: 'neutral' };
const PRIORITY_TONE: Record<SupportTicketPriority, StatusTone> = { urgent: 'neg', high: 'amber', normal: 'neutral', low: 'neutral' };

const STATUS_SEGMENTS = FILTERS.map((f) => ({ key: f.value, label: f.label }));
const PRIORITY_MENU = PRIORITY_FILTERS.map((f) => ({ key: f.value, label: f.label }));
const ASSIGNED_MENU = ASSIGNED_FILTERS.map((f) => ({ key: f.value, label: f.label }));

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
  // Legacy palette only for the shared status/priority badge labels.
  const colors = useThemeColors();
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { admin, getSupportInbox } = useAdmin();
  const [filter, setFilter] = useState<SupportTicketStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<SupportTicketPriority | 'all'>('all');
  const [assignedFilter, setAssignedFilter] = useState<'all' | 'mine' | 'unassigned'>('all');
  const [tickets, setTickets] = useState<SupportInboxTicket[]>([]);
  const [loading, setLoading] = useState(true);
  // Set when the inbox fails to load (it used to fail silently); cleared on retry.
  const [error, setError] = useState(false);

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
      setError(false);
      load(filter, priorityFilter, assignedFilter).catch(() => setError(true));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter, priorityFilter, assignedFilter]),
  );

  const retry = () => {
    setError(false);
    load(filter, priorityFilter, assignedFilter).catch(() => setError(true));
  };

  const renderRow = (item: SupportInboxTicket, index: number) => (
    <TicketRow
      key={item.id}
      item={item}
      isFirst={index === 0}
      statusLabel={ticketStatusBadges(colors)[item.status].label}
      priorityLabel={priorityBadges(colors)[item.priority].label}
      assignedText={
        item.assignedAgentId === admin.id ? 'Assigned to you' : item.assignedAgentName ? `Assigned to ${item.assignedAgentName}` : 'Unassigned'
      }
      onPress={() => navigation.navigate('SuperAdminSupportTicketChat', { ticketId: item.id })}
      styles={styles}
    />
  );

  const priorityLabel = PRIORITY_MENU.find((o) => o.key === priorityFilter)?.label ?? '';
  const assignedLabel = ASSIGNED_MENU.find((o) => o.key === assignedFilter)?.label ?? '';

  const statusControl = (
    <Segmented options={STATUS_SEGMENTS} value={filter} onChange={setFilter} accessibilityLabel="Status" />
  );
  const menuPills = (
    <View style={styles.menuRow}>
      <MenuPill
        label={priorityLabel}
        options={PRIORITY_MENU}
        value={priorityFilter}
        onChange={setPriorityFilter}
        accessibilityLabel="Filter by priority"
      />
      <MenuPill
        label={assignedLabel}
        options={ASSIGNED_MENU}
        value={assignedFilter}
        onChange={setAssignedFilter}
        accessibilityLabel="Filter by assignee"
      />
    </View>
  );

  const emptyState = <EmptyState icon="chatbubbles-outline" title="No support tickets here yet." />;
  const errorState = <ErrorState onRetry={retry} />;

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminSupport" breadcrumb="Support Centre">
        <PageTitle>Support Centre</PageTitle>
        <View style={styles.dFilters}>
          {statusControl}
          {menuPills}
        </View>
        <Text style={styles.dSectionTitle} accessibilityRole="header">All Tickets</Text>
        {loading ? (
          <Tile style={styles.dList}>
            <SkeletonRows rows={5} />
          </Tile>
        ) : error ? (
          <View style={styles.dList}>{errorState}</View>
        ) : tickets.length === 0 ? (
          <Tile style={styles.dList}>{emptyState}</Tile>
        ) : (
          <Tile style={styles.dList} padded={false}>
            {tickets.map((item, i) => renderRow(item, i))}
          </Tile>
        )}
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="Support Centre" showBack={false} />

      <View style={styles.mFilters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {statusControl}
        </ScrollView>
        {menuPills}
      </View>

      {loading ? (
        <View style={styles.listContent}>
          <Tile>
            <SkeletonRows rows={5} />
          </Tile>
        </View>
      ) : error ? (
        <View style={styles.listContent}>{errorState}</View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(t) => t.id}
          renderItem={({ item, index }) => (
            <View style={[styles.groupSlice, index === 0 && styles.groupFirst, index === tickets.length - 1 && styles.groupLast]}>
              {renderRow(item, index)}
            </View>
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Tile>{emptyState}</Tile>}
        />
      )}
    </View>
  );
}

function TicketRow({
  item,
  isFirst,
  statusLabel,
  priorityLabel,
  assignedText,
  onPress,
  styles,
}: {
  item: SupportInboxTicket;
  isFirst: boolean;
  statusLabel: string;
  priorityLabel: string;
  assignedText: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const { c } = useAdminTheme();
  const [hovered, hoverHandlers] = useHover();
  return (
    <Pressable
      style={({ pressed }) => [styles.row, hoverTransition, !isFirst && styles.rowDivider, (hovered || pressed) && styles.rowHover]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.subject}, ${item.requesterName}, ${statusLabel}${item.hasUnread ? ', unread' : ''}`}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
    >
      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          {item.hasUnread ? <View style={styles.unreadDot} /> : null}
          <Text style={styles.subject} numberOfLines={1}>{item.subject}</Text>
        </View>
        <Text style={styles.requesterLine} numberOfLines={1}>
          {item.requesterName} · {REQUESTER_LABEL[item.requesterType] ?? item.requesterType}
        </Text>
        <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage ?? '—'}</Text>
        <Text style={styles.meta}>
          {relativeTime(item.updatedAt)} ·{' '}
          {assignedText}
        </Text>
      </View>
      <View style={styles.rowBadges}>
        {item.priority !== 'normal' ? <StatusPill label={priorityLabel} tone={PRIORITY_TONE[item.priority]} style={styles.badgeRight} /> : null}
        <StatusPill label={statusLabel} tone={STATUS_TONE[item.status]} style={styles.badgeRight} />
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.ink3} />
    </Pressable>
  );
}

// A compact pill that opens a small pop-up menu of choices, anchored under
// the pill (the kit has no menu yet, so it lives here).
function MenuPill<K extends string>({
  label,
  options,
  value,
  onChange,
  accessibilityLabel,
  disabled,
  busy,
}: {
  label: string;
  options: Array<{ key: K; label: string }>;
  value: K;
  onChange: (key: K) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  busy?: boolean;
}) {
  const { c } = useAdminTheme();
  const anchorRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number; h: number } | null>(null);
  const [hovered, hoverHandlers] = useHover();
  const win = useWindowDimensions();
  const open = () => {
    anchorRef.current?.measureInWindow((x, y, _w, h) => setAnchor({ x, y, h }));
  };
  const close = () => setAnchor(null);
  const pick = (key: K) => {
    setAnchor(null);
    onChange(key);
  };
  const left = anchor ? Math.max(8, Math.min(anchor.x, win.width - MENU_WIDTH - 8)) : 0;
  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        <Pressable
          onPress={open}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityLabel}: ${label}`}
          accessibilityState={{ expanded: anchor !== null, disabled: !!disabled, busy: !!busy }}
          onHoverIn={hoverHandlers.onMouseEnter}
          onHoverOut={hoverHandlers.onMouseLeave}
          style={[
            menuStyles.pill,
            hoverTransition,
            { backgroundColor: hovered && !disabled ? c.sel : c.fill },
            disabled && { opacity: 0.5 },
          ]}
        >
          <Text style={[menuStyles.pillText, { color: c.ink }]} numberOfLines={1}>{label}</Text>
          {busy ? <ActivityIndicator size="small" color={c.ink3} /> : <Ionicons name="chevron-down" size={13} color={c.ink3} />}
        </Pressable>
      </View>
      <Modal visible={anchor !== null} transparent statusBarTranslucent animationType="fade" onRequestClose={close}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Close menu" />
        {anchor ? (
          <View
            accessibilityRole="menu"
            accessibilityLabel={accessibilityLabel}
            style={[
              menuStyles.menu,
              { top: anchor.y + anchor.h + 6, left, backgroundColor: c.sheet, borderColor: c.edge },
            ]}
          >
            {options.map((o) => (
              <MenuItem key={o.key} label={o.label} selected={o.key === value} onPress={() => pick(o.key)} />
            ))}
          </View>
        ) : null}
      </Modal>
    </>
  );
}

function MenuItem({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { c } = useAdminTheme();
  const [hovered, hoverHandlers] = useHover();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityState={{ selected }}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
      style={({ pressed }) => [menuStyles.item, (hovered || pressed || selected) && { backgroundColor: selected ? c.sel : c.fill2 }]}
    >
      <Text style={[menuStyles.itemText, { color: c.ink }]} numberOfLines={1}>{label}</Text>
      {selected ? <Ionicons name="checkmark" size={16} color={c.icon} /> : null}
    </Pressable>
  );
}

const MENU_WIDTH = 220;

const menuStyles = StyleSheet.create({
  pill: { height: 38, minWidth: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: adminRadius.pill },
  pillText: { ...adminFont.bodySemiBold, fontSize: 13.5, flexShrink: 1 },
  menu: {
    position: 'absolute',
    width: MENU_WIDTH,
    padding: 6,
    borderRadius: adminRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 8,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 12, borderRadius: adminRadius.sm },
  itemText: { ...adminFont.body, fontSize: 14.5, flex: 1 },
});

function createStyles(c: AdminColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  mFilters: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  filterScroll: { flexGrow: 0, flexShrink: 0 },
  menuRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dFilters: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  dSectionTitle: { ...adminFont.bodyBold, fontSize: 17, color: c.ink, marginTop: 20 },
  dList: { marginTop: 10, maxWidth: 960, overflow: 'hidden' },
  listContent: { padding: 16, paddingBottom: 32 },
  // Phone: the FlatList rows read as one grouped tile.
  groupSlice: {
    backgroundColor: c.surface,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: c.edge,
    overflow: 'hidden',
  },
  groupFirst: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: adminRadius.md, borderTopRightRadius: adminRadius.md },
  groupLast: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: adminRadius.md, borderBottomRightRadius: adminRadius.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: 16, paddingVertical: 12 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },
  rowHover: { backgroundColor: c.fill2 },
  rowText: { flex: 1, minWidth: 0 },
  rowBadges: { gap: 4, alignItems: 'flex-end', flexShrink: 0 },
  badgeRight: { alignSelf: 'flex-end' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subject: { flex: 1, ...adminFont.bodyBold, fontSize: 15, color: c.ink },
  // The one live-data highlight on this screen.
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent },
  requesterLine: { ...adminFont.bodySemiBold, fontSize: 13, color: c.ink2, marginTop: 3 },
  lastMessage: { ...adminFont.body, fontSize: 13, color: c.ink2, marginTop: 2 },
  meta: { ...adminFont.body, ...tabularNums, fontSize: 12, color: c.ink3, marginTop: 3 },
});
}
