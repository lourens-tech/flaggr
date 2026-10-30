import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { useLiveThread } from '../../hooks/useLiveThread';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { SkeletonRows, StatusPill, Tile, type StatusTone } from '../../components/admin/ui';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { AdminEnquiryThread, EnquiryStatus } from '../../data/adminTypes';
import { adminFont, adminRadius, type AdminColors } from '../../theme/admin';

// Same labels as the club's enquiries list (SuperAdminCourseEnquiriesScreen).
const STATUS: Record<EnquiryStatus, { label: string; tone: StatusTone }> = {
  pending: { label: 'Pending', tone: 'amber' },
  in_progress: { label: 'Chat in Progress', tone: 'pos' },
  resolved: { label: 'Resolved', tone: 'neutral' },
};

function personInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminEnquiryChat'>;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// View-only — a super_admin can see any club's enquiry thread for
// oversight, but never replies into it; that conversation stays between
// the member and their own club's admins (see SuperAdminCourseEnquiriesScreen).
export function SuperAdminEnquiryChatScreen({ route }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { courseId, enquiryId } = route.params;
  const { getSuperAdminEnquiryThread, superAdminCourses } = useAdmin();
  // For the breadcrumb only; this route doesn't carry the club's name.
  const clubName = superAdminCourses.find((course) => course.id === courseId)?.name;
  const breadcrumb = ['Courses', clubName, 'Enquiries'].filter(Boolean).join(' › ');
  const [thread, setThread] = useState<AdminEnquiryThread | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      setThread(await getSuperAdminEnquiryThread(courseId, enquiryId));
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t load enquiry', message);
    } finally {
      setLoading(false);
    }
  }, [courseId, enquiryId, getSuperAdminEnquiryThread]);

  useLiveThread(load);

  useEffect(() => {
    if (thread) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [thread?.messages.length]);

  const readOnlyNote = (
    <View style={styles.readOnly} accessibilityRole="text">
      <Ionicons name="information-circle-outline" size={18} color={c.ink2} />
      <Text style={styles.readOnlyText}>Read only. Only the club's admins can reply to their members' enquiries.</Text>
    </View>
  );

  const messages = thread ? (
    <ScrollView ref={scrollRef} contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
      {thread.messages.map((m) => (
        <View
          key={m.id}
          style={[styles.bubbleRow, m.senderType === 'admin' ? styles.bubbleRowRight : styles.bubbleRowLeft]}
        >
          <View style={[styles.bubble, m.senderType === 'admin' ? styles.bubbleAdmin : styles.bubbleMember]}>
            <Text style={[styles.bubbleText, m.senderType === 'admin' && styles.bubbleTextAdmin]}>{m.body}</Text>
          </View>
          <Text style={[styles.bubbleTime, m.senderType === 'admin' && styles.bubbleTimeRight]}>{formatTime(m.createdAt)}</Text>
        </View>
      ))}
    </ScrollView>
  ) : null;

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminCourses" breadcrumb={breadcrumb} showRail={false} scrollable={false}>
        <View style={styles.dChatCard}>
          {loading || !thread ? (
            <View style={{ padding: 24 }}>
              <SkeletonRows rows={4} />
            </View>
          ) : (
            <>
              <View style={styles.threadHead}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{personInitials(thread.memberName)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.threadName} numberOfLines={1}>{thread.memberName}</Text>
                  <Text style={styles.threadMeta} numberOfLines={1}>{thread.memberEmail} · {thread.enquiryType}</Text>
                </View>
                <StatusPill label={STATUS[thread.status].label} tone={STATUS[thread.status].tone} style={{ alignSelf: 'center' }} />
              </View>
              {messages}
              <View style={styles.dNoteWrap}>{readOnlyNote}</View>
            </>
          )}
        </View>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title={thread?.memberName ?? 'Enquiry'} />

      {loading || !thread ? (
        <View style={styles.mPad}>
          <Tile>
            <SkeletonRows rows={4} />
          </Tile>
        </View>
      ) : (
        <>
          <View style={styles.memberInfo}>
            <Text style={styles.memberEmail} numberOfLines={1}>{thread.memberEmail}</Text>
            <Text style={styles.enquiryType} numberOfLines={1}>{thread.enquiryType}</Text>
            <StatusPill label={STATUS[thread.status].label} tone={STATUS[thread.status].tone} />
          </View>
          <Tile padded={false} style={styles.mChatCard}>
            {messages}
          </Tile>
          <View style={styles.mNoteWrap}>{readOnlyNote}</View>
        </>
      )}
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  mPad: { paddingHorizontal: 16 },
  memberInfo: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  memberEmail: { ...adminFont.body, fontSize: 13, color: c.ink2, flexShrink: 1 },
  enquiryType: { ...adminFont.bodySemiBold, fontSize: 13, color: c.ink },
  mChatCard: { flex: 1, marginHorizontal: 16, overflow: 'hidden' },
  mNoteWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 },
  messages: { padding: 18, gap: 10, flexGrow: 1 },
  bubbleRow: { maxWidth: '80%' },
  bubbleRowLeft: { alignSelf: 'flex-start' },
  bubbleRowRight: { alignSelf: 'flex-end' },
  bubble: { borderRadius: adminRadius.md, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMember: { backgroundColor: c.fill },
  // Club replies keep the Fairway bubble with white text in both schemes.
  bubbleAdmin: { backgroundColor: '#1F4234' },
  bubbleText: { ...adminFont.body, fontSize: 15, lineHeight: 21, color: c.ink },
  bubbleTextAdmin: { color: '#FFFFFF' },
  bubbleTime: { ...adminFont.body, fontSize: 11.5, color: c.ink3, marginTop: 4, marginHorizontal: 6 },
  bubbleTimeRight: { alignSelf: 'flex-end' },
  readOnly: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.fill, borderRadius: adminRadius.sm, paddingHorizontal: 14, paddingVertical: 12 },
  readOnlyText: { flex: 1, ...adminFont.body, fontSize: 13, color: c.ink2 },
  dChatCard: {
    flex: 1,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.edge,
    borderRadius: adminRadius.lg,
    overflow: 'hidden',
  },
  threadHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.edge,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1F4234', alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...adminFont.bodyBold, fontSize: 14, color: '#CDDE5C' },
  threadName: { ...adminFont.bodyBold, fontSize: 16, color: c.ink },
  threadMeta: { ...adminFont.body, fontSize: 13, color: c.ink2, marginTop: 1 },
  dNoteWrap: { paddingHorizontal: 18, paddingBottom: 18 },
});
}
