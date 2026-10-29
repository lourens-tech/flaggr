import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { useLiveThread } from '../../hooks/useLiveThread';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { useHover, hoverTransition } from '../../hooks/useHover';
import { AdminButton, SkeletonRows, Tile } from '../../components/admin/ui';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { SupportInboxTicketThread, SupportTicketPriority, SupportTicketStatus } from '../../data/adminTypes';
import { adminFont, adminRadius, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminSupportTicketChat'>;

const STATUS_OPTIONS: Array<{ label: string; value: SupportTicketStatus }> = [
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
];

const PRIORITY_OPTIONS: Array<{ label: string; value: SupportTicketPriority }> = [
  { label: 'Low', value: 'low' },
  { label: 'Normal', value: 'normal' },
  { label: 'High', value: 'high' },
  { label: 'Urgent', value: 'urgent' },
];

const STATUS_MENU = STATUS_OPTIONS.map((o) => ({ key: o.value, label: o.label }));
const PRIORITY_MENU = PRIORITY_OPTIONS.map((o) => ({ key: o.value, label: o.label }));

const REQUESTER_LABEL: Record<string, string> = {
  member: 'Member',
  course_admin: 'Course Admin',
  staff: 'Staff',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function SuperAdminSupportTicketChatScreen({ route }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { ticketId } = route.params;
  const {
    admin,
    getSupportInboxThread,
    replyToSupportInboxTicket,
    setSupportTicketStatus,
    setSupportTicketPriority,
    claimSupportTicket,
    unassignSupportTicket,
  } = useAdmin();
  const [thread, setThread] = useState<SupportInboxTicketThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);
  const [updatingAssignment, setUpdatingAssignment] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      setThread(await getSupportInboxThread(ticketId));
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t load ticket', message);
    } finally {
      setLoading(false);
    }
  }, [ticketId, getSupportInboxThread]);

  useLiveThread(load);

  useEffect(() => {
    if (thread) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [thread?.messages.length]);

  const handleSend = async () => {
    const message = draft.trim();
    if (!message) return;
    setSending(true);
    try {
      await replyToSupportInboxTicket(ticketId, message);
      setDraft('');
      await load();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      const errMessage = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t send message', errMessage);
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (status: SupportTicketStatus) => {
    if (!thread || thread.status === status) return;
    setUpdatingStatus(true);
    try {
      await setSupportTicketStatus(ticketId, status);
      setThread((prev) => (prev ? { ...prev, status } : prev));
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t update status', message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePriorityChange = async (priority: SupportTicketPriority) => {
    if (!thread || thread.priority === priority) return;
    setUpdatingPriority(true);
    try {
      await setSupportTicketPriority(ticketId, priority);
      setThread((prev) => (prev ? { ...prev, priority } : prev));
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t update priority', message);
    } finally {
      setUpdatingPriority(false);
    }
  };

  const handleClaim = async () => {
    setUpdatingAssignment(true);
    try {
      await claimSupportTicket(ticketId);
      setThread((prev) => (prev ? { ...prev, assignedAgentId: admin.id, assignedAgentName: `${admin.firstName} ${admin.lastName}` } : prev));
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t claim ticket', message);
    } finally {
      setUpdatingAssignment(false);
    }
  };

  const handleUnassign = async () => {
    setUpdatingAssignment(true);
    try {
      await unassignSupportTicket(ticketId);
      setThread((prev) => (prev ? { ...prev, assignedAgentId: null, assignedAgentName: null } : prev));
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t release ticket', message);
    } finally {
      setUpdatingAssignment(false);
    }
  };

  const handleTakeOver = async () => {
    setUpdatingAssignment(true);
    try {
      await unassignSupportTicket(ticketId);
      await claimSupportTicket(ticketId);
      setThread((prev) => (prev ? { ...prev, assignedAgentId: admin.id, assignedAgentName: `${admin.firstName} ${admin.lastName}` } : prev));
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t take over ticket', message);
    } finally {
      setUpdatingAssignment(false);
    }
  };

  const body = loading || !thread ? (
    <View style={styles.loadingPad}>
      <SkeletonRows rows={4} />
    </View>
  ) : (
    <>
          <View style={styles.requesterInfo}>
            {isDesktop ? <Text style={styles.dSubject} accessibilityRole="header" numberOfLines={2}>{thread.subject}</Text> : null}
            <Text style={styles.requesterName} numberOfLines={1}>{thread.requesterName}</Text>
            <Text style={styles.requesterEmail} numberOfLines={1}>
              {thread.requesterEmail} · {REQUESTER_LABEL[thread.requesterType] ?? thread.requesterType}
            </Text>
          </View>

          {/* Toolbar above the thread: assignment, status and priority. */}
          <View style={styles.toolbar}>
            <View style={styles.assignment}>
              <Text style={styles.assignmentText} numberOfLines={1}>
                {thread.assignedAgentId === admin.id
                  ? 'Assigned to you'
                  : thread.assignedAgentName
                    ? `Assigned to ${thread.assignedAgentName}`
                    : 'Unassigned'}
              </Text>
              {updatingAssignment ? (
                <ActivityIndicator color={c.ink3} size="small" />
              ) : thread.assignedAgentId === null ? (
                <AdminButton label="Claim" variant="glass" onPress={handleClaim} />
              ) : thread.assignedAgentId === admin.id ? (
                <AdminButton label="Release" variant="glass" onPress={handleUnassign} />
              ) : (
                <AdminButton label="Take Over" variant="glass" onPress={handleTakeOver} />
              )}
            </View>
            <View style={styles.toolbarMenus}>
              <MenuPill
                label={`Status: ${STATUS_MENU.find((o) => o.key === thread.status)?.label ?? thread.status}`}
                options={STATUS_MENU}
                value={thread.status}
                onChange={handleStatusChange}
                accessibilityLabel="Status"
                disabled={updatingStatus}
                busy={updatingStatus}
              />
              <MenuPill
                label={`Priority: ${PRIORITY_MENU.find((o) => o.key === thread.priority)?.label ?? thread.priority}`}
                options={PRIORITY_MENU}
                value={thread.priority}
                onChange={handlePriorityChange}
                accessibilityLabel="Priority"
                disabled={updatingPriority}
                busy={updatingPriority}
              />
            </View>
          </View>

          <ScrollView ref={scrollRef} contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
            {thread.messages.map((m) => (
              <View
                key={m.id}
                style={[styles.bubbleRow, m.senderType === 'agent' ? styles.bubbleRowRight : styles.bubbleRowLeft]}
              >
                <View style={[styles.bubble, m.senderType === 'agent' ? styles.bubbleAgent : styles.bubbleRequester]}>
                  <Text style={[styles.bubbleText, m.senderType === 'agent' && styles.bubbleTextAgent]}>{m.body}</Text>
                </View>
                <Text style={[styles.bubbleTime, m.senderType === 'agent' ? styles.bubbleTimeRight : styles.bubbleTimeLeft]}>
                  {formatTime(m.createdAt)}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.composer}>
            <View style={{ flex: 1 }}>
              <TextField placeholder="Type a reply…" variant="onLight" value={draft} onChangeText={setDraft} multiline />
            </View>
            <Pressable
              onPress={handleSend}
              disabled={sending || !draft.trim()}
              style={[styles.sendButton, (sending || !draft.trim()) && styles.sendButtonIdle]}
              accessibilityLabel="Send reply"
              accessibilityRole="button"
              accessibilityState={{ disabled: sending || !draft.trim(), busy: sending }}
            >
              {sending ? (
                <ActivityIndicator color={c.onAccent} size="small" />
              ) : (
                <Ionicons name="send" size={18} color={c.onAccent} />
              )}
            </Pressable>
          </View>
    </>
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminSupport" breadcrumb={thread?.subject ?? 'Ticket'} showRail={false} scrollable={false}>
        <Tile style={styles.dChatCard} padded={false}>{body}</Tile>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AdminMobileHeader title={thread?.subject ?? 'Ticket'} />

      <Tile style={styles.mChatCard} padded={false}>{body}</Tile>
    </KeyboardAvoidingView>
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
  loadingPad: { padding: 20 },
  requesterInfo: { paddingHorizontal: 20, paddingTop: 16 },
  dSubject: { ...adminFont.bodyBold, fontSize: 18, color: c.ink, marginBottom: 4 },
  requesterName: { ...adminFont.bodySemiBold, fontSize: 15, color: c.ink },
  requesterEmail: { ...adminFont.body, fontSize: 13, color: c.ink2, marginTop: 2 },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.edge,
  },
  assignment: { flexDirection: 'row', alignItems: 'center', gap: 10, flexGrow: 1, flexShrink: 1, minWidth: 180 },
  assignmentText: { flexShrink: 1, ...adminFont.bodySemiBold, fontSize: 13.5, color: c.ink2 },
  toolbarMenus: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  messages: { paddingHorizontal: 20, paddingVertical: 18, gap: 6, flexGrow: 1 },
  bubbleRow: { maxWidth: '80%' },
  bubbleRowLeft: { alignSelf: 'flex-start' },
  bubbleRowRight: { alignSelf: 'flex-end' },
  bubble: { borderRadius: adminRadius.md, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleRequester: { backgroundColor: c.fill, borderBottomLeftRadius: 6 },
  // Fairway bubble with white text for the team's own replies (as in the mockup).
  bubbleAgent: { backgroundColor: '#1F4234', borderBottomRightRadius: 6 },
  bubbleText: { ...adminFont.body, fontSize: 14.5, lineHeight: 21, color: c.ink },
  bubbleTextAgent: { color: '#FFFFFF' },
  bubbleTime: { ...adminFont.body, fontSize: 11.5, color: c.ink3, marginTop: 3, marginBottom: 6, marginHorizontal: 6 },
  bubbleTimeLeft: { alignSelf: 'flex-start' },
  bubbleTimeRight: { alignSelf: 'flex-end' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.edge,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonIdle: { opacity: 0.45 },
  mChatCard: { flex: 1, marginHorizontal: 12, marginBottom: 12, overflow: 'hidden', borderRadius: adminRadius.lg },
  dChatCard: { flex: 1, overflow: 'hidden', borderRadius: adminRadius.lg },
});
}
