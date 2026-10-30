import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { useAdminTheme } from '../../context/ThemeContext';
import type { SupportTicketStatus, SupportTicketSummary } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums } from '../../theme/admin';
import {
  AdminButton,
  CircleButton,
  EmptyState,
  ErrorState,
  Eyebrow,
  PageTitle,
  SkeletonRows,
  StatusPill,
  Tile,
  type StatusTone,
} from '../../components/admin/ui';
import { useHover, hoverTransition } from '../../hooks/useHover';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminSupportTickets'>;

// Same labels as theme/badges' ticketStatusBadges, with the admin status tones.
const TICKET_STATUS: Record<SupportTicketStatus, { label: string; tone: StatusTone }> = {
  open: { label: 'Open', tone: 'amber' },
  in_progress: { label: 'In Progress', tone: 'pos' },
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

function TicketRow({ item, first, onPress }: { item: SupportTicketSummary; first: boolean; onPress: () => void }) {
  const { c } = useAdminTheme();
  const [hovered, hoverHandlers] = useHover();
  const status = TICKET_STATUS[item.status];
  return (
    <TouchableOpacity
      style={[
        styles.row,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },
        hoverTransition,
        hovered && { backgroundColor: c.fill2 },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${item.subject}, ${status.label}${item.hasUnread ? ', unread' : ''}`}
      {...hoverHandlers}
    >
      <View style={styles.unreadSlot}>{item.hasUnread ? <View style={[styles.unreadDot, { backgroundColor: c.badge }]} /> : null}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.rowTop}>
          <Text style={[styles.subject, { color: c.ink }]} numberOfLines={1}>
            {item.subject}
          </Text>
          <Text style={[styles.meta, { color: c.ink3 }]}>{relativeTime(item.updatedAt)}</Text>
        </View>
        <Text style={[styles.lastMessage, { color: c.ink2 }]} numberOfLines={1}>
          {item.lastMessage ?? '—'}
        </Text>
        <StatusPill label={status.label} tone={status.tone} style={styles.status} />
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.ink3} />
    </TouchableOpacity>
  );
}

// A ticket to the Flagrr team itself — separate from the club's own
// Enquiries inbox (member <-> this club's admins).
export function AdminSupportTicketsScreen({ navigation }: Props) {
  const isDesktop = useIsDesktopNav();
  const { listSupportTickets } = useAdmin();
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  // Set when the list fails to load (it used to fail silently); cleared on retry.
  const [error, setError] = useState(false);

  const loadTickets = async (isCancelled: () => boolean = () => false) => {
    setLoading(true);
    setError(false);
    try {
      const rows = await listSupportTickets();
      if (!isCancelled()) setTickets(rows);
    } catch {
      if (!isCancelled()) setError(true);
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadTickets(() => cancelled);
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const openTicket = (item: SupportTicketSummary) => navigation.navigate('AdminSupportTicketChat', { ticketId: item.id });

  const list = (emptyTitle: string) =>
    loading ? (
      <Tile>
        <SkeletonRows rows={4} />
      </Tile>
    ) : error ? (
      <ErrorState onRetry={() => loadTickets()} />
    ) : tickets.length === 0 ? (
      <Tile>
        <EmptyState icon="headset-outline" title={emptyTitle} />
      </Tile>
    ) : (
      <Tile padded={false} style={[styles.listTile, isDesktop && { borderRadius: adminRadius.lg }]}>
        {tickets.map((item, i) => (
          <TicketRow key={item.id} item={item} first={i === 0} onPress={() => openTicket(item)} />
        ))}
      </Tile>
    );

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminSupportTickets" breadcrumb="Flagrr Support" showRail={false}>
        <View style={styles.dHeadRow}>
          <PageTitle>Support Centre</PageTitle>
          <AdminButton
            label="New Ticket"
            icon="add"
            variant="accent"
            onPress={() => navigation.navigate('AdminSupportTicketCreate')}
          />
        </View>
        <View style={styles.dPane}>
          <Eyebrow style={styles.groupLabel}>Your Tickets</Eyebrow>
          {list('No support tickets yet.')}
        </View>
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader
        title="Support Centre"
        onBack={() => navigation.goBack()}
        right={<CircleButton icon="add" size={44} accessibilityLabel="New Ticket" onPress={() => navigation.navigate('AdminSupportTicketCreate')} />}
      />

      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {list('No support tickets yet — tap + to log one.')}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48 },
  listTile: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 12, paddingRight: 16, paddingLeft: 8 },
  unreadSlot: { width: 10, alignItems: 'center' },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subject: { flex: 1, ...adminFont.bodySemiBold, fontSize: 15 },
  lastMessage: { ...adminFont.body, fontSize: 13.5, marginTop: 3 },
  meta: { ...adminFont.body, ...tabularNums, fontSize: 12.5 },
  status: { marginTop: 8 },
  groupLabel: { marginLeft: 16, marginBottom: 8 },
  dHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  dPane: { maxWidth: 760, width: '100%' },
});
