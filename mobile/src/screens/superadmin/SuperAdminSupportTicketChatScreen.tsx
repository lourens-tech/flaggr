import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { SupportInboxTicketThread, SupportTicketStatus } from '../../data/adminTypes';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminSupportTicketChat'>;

const STATUS_OPTIONS: Array<{ label: string; value: SupportTicketStatus }> = [
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
];

const REQUESTER_LABEL: Record<string, string> = {
  member: 'Member',
  course_admin: 'Course Admin',
  staff: 'Staff',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function SuperAdminSupportTicketChatScreen({ route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { ticketId } = route.params;
  const { getSupportInboxThread, replyToSupportInboxTicket, setSupportTicketStatus } = useAdmin();
  const [thread, setThread] = useState<SupportInboxTicketThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title={thread?.subject ?? 'Ticket'} />
      </SafeAreaView>

      {loading || !thread ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : (
        <>
          <View style={styles.requesterInfo}>
            <Text style={styles.requesterName}>{thread.requesterName}</Text>
            <Text style={styles.requesterEmail}>{thread.requesterEmail}</Text>
            <Text style={styles.requesterType}>{REQUESTER_LABEL[thread.requesterType] ?? thread.requesterType}</Text>
          </View>

          <View style={styles.statusRow}>
            {STATUS_OPTIONS.map((s) => (
              <TouchableOpacity
                key={s.value}
                onPress={() => handleStatusChange(s.value)}
                disabled={updatingStatus}
                style={[styles.statusPill, thread.status === s.value && styles.statusPillActive]}
              >
                <Text style={[styles.statusText, thread.status === s.value && styles.statusTextActive]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
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
                <Text style={styles.bubbleTime}>{formatTime(m.createdAt)}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.composer}>
            <View style={{ flex: 1 }}>
              <TextField placeholder="Type a reply…" variant="onLight" value={draft} onChangeText={setDraft} multiline />
            </View>
            <TouchableOpacity
              onPress={handleSend}
              disabled={sending || !draft.trim()}
              style={styles.sendButton}
              accessibilityLabel="Send reply"
              accessibilityRole="button"
            >
              {sending ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Ionicons name="send" size={18} color={colors.white} />
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  requesterInfo: { paddingHorizontal: screenPadding, paddingTop: spacing.sm },
  requesterName: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  requesterEmail: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 2 },
  requesterType: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.clubGreen, marginTop: 2 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: screenPadding, paddingBottom: spacing.sm },
  statusPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.mintBgAlt },
  statusPillActive: { backgroundColor: colors.darkGreen },
  statusText: { fontFamily: fontFamily.heading, fontSize: 11, color: colors.textPrimary },
  statusTextActive: { color: colors.white },
  messages: { padding: screenPadding, gap: spacing.sm, flexGrow: 1 },
  bubbleRow: { maxWidth: '80%' },
  bubbleRowLeft: { alignSelf: 'flex-start' },
  bubbleRowRight: { alignSelf: 'flex-end' },
  bubble: { borderRadius: radius.md, padding: spacing.sm },
  bubbleRequester: { backgroundColor: colors.inputBg },
  bubbleAgent: { backgroundColor: colors.clubGreen },
  bubbleText: { fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.textPrimary },
  bubbleTextAgent: { color: colors.white },
  bubbleTime: { fontFamily: fontFamily.body, fontSize: 9, color: colors.textSecondary, marginTop: 2, alignSelf: 'flex-end' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: screenPadding,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.clubGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
}
