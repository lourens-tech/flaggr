import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
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
import { Segmented, SkeletonRows } from '../../components/admin/ui';
import { PressableScale } from '../../components/motion';
import type { AdminEnquiryThread, EnquiryStatus } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums } from '../../theme/admin';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminEnquiryChat'>;

const STATUS_OPTIONS: Array<{ label: string; value: EnquiryStatus }> = [
  { label: 'Pending', value: 'pending' },
  { label: 'Chat in Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function AdminEnquiryChatScreen({ route }: Props) {
  const { c } = useAdminTheme();
  const isDesktop = useIsDesktopNav();
  const { enquiryId } = route.params;
  const { getEnquiryThread, replyToEnquiry, setEnquiryStatus } = useAdmin();
  const [thread, setThread] = useState<AdminEnquiryThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      setThread(await getEnquiryThread(enquiryId));
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t load enquiry', message);
    } finally {
      setLoading(false);
    }
  }, [enquiryId, getEnquiryThread]);

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
      await replyToEnquiry(enquiryId, message);
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

  const handleStatusChange = async (status: EnquiryStatus) => {
    if (!thread || thread.status === status) return;
    setUpdatingStatus(true);
    try {
      await setEnquiryStatus(enquiryId, status);
      setThread((prev) => (prev ? { ...prev, status } : prev));
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t update status', message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const statusControl = thread ? (
    <View pointerEvents={updatingStatus ? 'none' : 'auto'} style={updatingStatus ? styles.statusBusy : undefined}>
      <Segmented
        options={STATUS_OPTIONS.map((s) => ({ key: s.value, label: s.label }))}
        value={thread.status}
        onChange={(status) => {
          if (!updatingStatus) handleStatusChange(status);
        }}
        accessibilityLabel="Enquiry status"
      />
    </View>
  ) : null;

  const body = loading || !thread ? (
    <View style={styles.loading}>
      <SkeletonRows rows={4} />
    </View>
  ) : (
    <>
      {isDesktop ? (
        <View style={[styles.dHead, { borderBottomColor: c.edge }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(thread.memberName)}</Text>
          </View>
          <View style={styles.dHeadText}>
            <Text style={[styles.dName, { color: c.ink }]} numberOfLines={1}>{thread.memberName}</Text>
            <Text style={[styles.memberEmail, { color: c.ink2 }]} numberOfLines={1}>{thread.memberEmail}</Text>
            <Text style={[styles.enquiryType, { color: c.ink3 }]} numberOfLines={1}>{thread.enquiryType}</Text>
          </View>
          {statusControl}
        </View>
      ) : (
        <View style={[styles.mHead, { borderBottomColor: c.edge }]}>
          <View style={styles.memberInfo}>
            <Text style={[styles.memberEmail, { color: c.ink2 }]} numberOfLines={1}>{thread.memberEmail}</Text>
            <Text style={[styles.enquiryType, { color: c.ink3 }]} numberOfLines={1}>{thread.enquiryType}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusBar} contentContainerStyle={styles.statusScroll}>
            {statusControl}
          </ScrollView>
        </View>
      )}

      <ScrollView ref={scrollRef} contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
        {thread.messages.map((m) => (
          <View
            key={m.id}
            style={[styles.bubbleRow, m.senderType === 'admin' ? styles.bubbleRowRight : styles.bubbleRowLeft]}
          >
            <View style={[styles.bubble, m.senderType === 'admin' ? styles.bubbleAdmin : [styles.bubbleMember, { backgroundColor: c.fill }]]}>
              <Text style={[styles.bubbleText, { color: c.ink }, m.senderType === 'admin' && styles.bubbleTextAdmin]}>{m.body}</Text>
            </View>
            <Text style={[styles.bubbleTime, { color: c.ink3 }, m.senderType === 'admin' ? styles.bubbleTimeRight : styles.bubbleTimeLeft]}>
              {formatTime(m.createdAt)}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.composer, { borderTopColor: c.edge }]}>
        <View style={{ flex: 1 }}>
          <TextField
            placeholder="Type a reply…"
            variant="onLight"
            value={draft}
            onChangeText={setDraft}
            multiline
          />
        </View>
        <PressableScale
          onPress={handleSend}
          disabled={sending || !draft.trim()}
          style={[styles.sendButton, { backgroundColor: c.accent }, (sending || !draft.trim()) && styles.sendDisabled]}
          accessibilityLabel="Send reply"
          accessibilityRole="button"
          accessibilityState={{ disabled: sending || !draft.trim(), busy: sending }}
        >
          {sending ? (
            <ActivityIndicator color={c.onAccent} size="small" />
          ) : (
            <Ionicons name="arrow-up" size={20} color={c.onAccent} />
          )}
        </PressableScale>
      </View>
    </>
  );

  if (isDesktop) {
    return (
      <AdminDesktopFrame
        activeKey="AdminEnquiries"
        breadcrumb={thread?.memberName ?? 'Enquiry'}
        showRail={false}
        scrollable={false}
      >
        <View style={[styles.dChatCard, { backgroundColor: c.surface, borderColor: c.edge }]}>{body}</View>
      </AdminDesktopFrame>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AdminMobileHeader title={thread?.memberName ?? 'Enquiry'} />

      <View style={[styles.mThread, { backgroundColor: c.surface, borderColor: c.edge }]}>{body}</View>
    </KeyboardAvoidingView>
  );
}

// Two initials for the member avatar ("Sipho Dlamini" -> "SD").
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join('')
    .toUpperCase();
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  loading: { padding: 20 },
  mThread: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: adminRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  mHead: { borderBottomWidth: StyleSheet.hairlineWidth, paddingTop: 12, paddingBottom: 12, gap: 10 },
  memberInfo: { paddingHorizontal: 16, gap: 2 },
  statusBar: { flexGrow: 0 },
  statusScroll: { paddingHorizontal: 16 },
  statusBusy: { opacity: 0.6 },
  dHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    // Fairway crest with lime initials, as on every member avatar.
    backgroundColor: '#1F4234',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...adminFont.bodyBold, fontSize: 15, color: '#CDDE5C' },
  dHeadText: { flex: 1, minWidth: 200 },
  dName: { ...adminFont.bodyBold, fontSize: 18 },
  memberEmail: { ...adminFont.body, fontSize: 13.5 },
  enquiryType: { ...adminFont.bodySemiBold, fontSize: 12.5 },
  messages: { paddingVertical: 20, paddingHorizontal: 20, gap: 6, flexGrow: 1 },
  bubbleRow: { maxWidth: '80%' },
  bubbleRowLeft: { alignSelf: 'flex-start' },
  bubbleRowRight: { alignSelf: 'flex-end' },
  bubble: { borderRadius: adminRadius.md, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleMember: { borderBottomLeftRadius: adminRadius.sm },
  // Sent replies sit on Fairway with white text in both schemes.
  bubbleAdmin: { backgroundColor: '#1F4234', borderBottomRightRadius: adminRadius.sm },
  bubbleText: { ...adminFont.body, fontSize: 14.5, lineHeight: 21 },
  bubbleTextAdmin: { color: '#FFFFFF' },
  bubbleTime: { ...adminFont.body, ...tabularNums, fontSize: 11.5, marginTop: 4, marginBottom: 6, marginHorizontal: 6 },
  bubbleTimeLeft: { alignSelf: 'flex-start' },
  bubbleTimeRight: { alignSelf: 'flex-end' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.45 },
  dChatCard: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: adminRadius.lg,
    overflow: 'hidden',
  },
});
