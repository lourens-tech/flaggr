import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { useLiveThread } from '../../hooks/useLiveThread';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { SupportTicketStatus, SupportTicketThread } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums } from '../../theme/admin';
import { StatusPill, Tile, type StatusTone } from '../../components/admin/ui';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminSupportTicketChat'>;

// Same labels as theme/badges' ticketStatusBadges, with the admin status tones.
const TICKET_STATUS: Record<SupportTicketStatus, { label: string; tone: StatusTone }> = {
  open: { label: 'Open', tone: 'amber' },
  in_progress: { label: 'In Progress', tone: 'pos' },
  resolved: { label: 'Resolved', tone: 'neutral' },
};

// The admin's own bubbles sit on the Fairway ground with white text, the
// same as the Enquiries chat.
const FAIRWAY = '#1F4234';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function AdminSupportTicketChatScreen({ route }: Props) {
  const { c } = useAdminTheme();
  const isDesktop = useIsDesktopNav();
  const { ticketId } = route.params;
  const { getSupportTicketThread, replyToSupportTicket } = useAdmin();
  const [thread, setThread] = useState<SupportTicketThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      setThread(await getSupportTicketThread(ticketId));
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t load ticket', message);
    } finally {
      setLoading(false);
    }
  }, [ticketId, getSupportTicketThread]);

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
      await replyToSupportTicket(ticketId, message);
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

  const status = thread ? TICKET_STATUS[thread.status] : null;
  const sendDisabled = sending || !draft.trim();

  const body = loading || !thread ? (
    <ActivityIndicator color={c.accentText} style={{ marginTop: 32 }} />
  ) : (
    <>
      <View style={[styles.statusRow, isDesktop && [styles.dThreadHead, { borderBottomColor: c.edge }]]}>
        {isDesktop ? (
          <Text style={[styles.dSubject, { color: c.ink }]} numberOfLines={1}>
            {thread.subject}
          </Text>
        ) : null}
        {status ? <StatusPill label={status.label} tone={status.tone} /> : null}
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={[styles.messages, isDesktop && { paddingHorizontal: 24 }]} showsVerticalScrollIndicator={false}>
        {thread.messages.map((m) => {
          const mine = m.senderType === 'requester';
          return (
            <View key={m.id} style={[styles.bubbleRow, mine ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : [styles.bubbleTheirs, { backgroundColor: c.fill }]]}>
                <Text style={[styles.bubbleText, { color: mine ? '#FFFFFF' : c.ink }]}>{m.body}</Text>
              </View>
              <Text style={[styles.bubbleTime, { color: c.ink3 }, mine ? styles.bubbleTimeRight : styles.bubbleTimeLeft]}>
                {formatTime(m.createdAt)}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.composer, { borderTopColor: c.edge }, isDesktop && { paddingHorizontal: 18 }]}>
        <View style={{ flex: 1 }}>
          <TextField placeholder="Type a message…" variant="onLight" value={draft} onChangeText={setDraft} multiline />
        </View>
        <TouchableOpacity
          onPress={handleSend}
          disabled={sendDisabled}
          style={[styles.sendButton, { backgroundColor: c.accent }, sendDisabled && !sending && { opacity: 0.45 }]}
          accessibilityLabel="Send message"
          accessibilityRole="button"
          accessibilityState={{ disabled: sendDisabled, busy: sending }}
        >
          {sending ? <ActivityIndicator color={c.onAccent} size="small" /> : <Ionicons name="send" size={18} color={c.onAccent} />}
        </TouchableOpacity>
      </View>
    </>
  );

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminSupportTickets" breadcrumb={thread?.subject ?? 'Ticket'} showRail={false} scrollable={false}>
        <Tile padded={false} style={styles.dChatCard}>
          {body}
        </Tile>
      </AdminDesktopFrame>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AdminMobileHeader title={thread?.subject ?? 'Ticket'} />

      {body}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  statusRow: { paddingHorizontal: 16, paddingTop: 12 },
  dThreadHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dSubject: { flex: 1, ...adminFont.bodyBold, fontSize: 18 },
  messages: { padding: 16, gap: 6, flexGrow: 1 },
  bubbleRow: { maxWidth: '80%' },
  bubbleRowLeft: { alignSelf: 'flex-start' },
  bubbleRowRight: { alignSelf: 'flex-end' },
  bubble: { borderRadius: adminRadius.md, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleTheirs: { borderBottomLeftRadius: adminRadius.sm },
  bubbleMine: { backgroundColor: FAIRWAY, borderBottomRightRadius: adminRadius.sm },
  bubbleText: { ...adminFont.body, fontSize: 14.5, lineHeight: 21 },
  bubbleTime: { ...adminFont.body, ...tabularNums, fontSize: 11.5, marginTop: 4, marginBottom: 6, marginHorizontal: 6 },
  bubbleTimeLeft: { alignSelf: 'flex-start' },
  bubbleTimeRight: { alignSelf: 'flex-end' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dChatCard: { flex: 1, overflow: 'hidden', borderRadius: adminRadius.lg },
});
