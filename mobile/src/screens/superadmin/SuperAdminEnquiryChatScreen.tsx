import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { AdminEnquiryThread } from '../../data/adminTypes';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminEnquiryChat'>;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// View-only — a super_admin can see any club's enquiry thread for
// oversight, but never replies into it; that conversation stays between
// the member and their own club's admins (see SuperAdminCourseEnquiriesScreen).
export function SuperAdminEnquiryChatScreen({ route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDesktop = useIsDesktopNav();
  const { courseId, enquiryId } = route.params;
  const { getSuperAdminEnquiryThread } = useAdmin();
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

  const body = loading || !thread ? (
    <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
  ) : (
    <>
      <View style={styles.memberInfo}>
        <Text style={styles.memberEmail}>{thread.memberEmail}</Text>
        <Text style={styles.enquiryType}>{thread.enquiryType}</Text>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
        {thread.messages.map((m) => (
          <View
            key={m.id}
            style={[styles.bubbleRow, m.senderType === 'admin' ? styles.bubbleRowRight : styles.bubbleRowLeft]}
          >
            <View style={[styles.bubble, m.senderType === 'admin' ? styles.bubbleAdmin : styles.bubbleMember]}>
              <Text style={[styles.bubbleText, m.senderType === 'admin' && styles.bubbleTextAdmin]}>{m.body}</Text>
            </View>
            <Text style={styles.bubbleTime}>{formatTime(m.createdAt)}</Text>
          </View>
        ))}
      </ScrollView>
    </>
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminCourses" breadcrumb={thread?.memberName ?? 'Enquiry'} showRail={false} scrollable={false}>
        <View style={styles.dChatCard}>{body}</View>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title={thread?.memberName ?? 'Enquiry'} />
      </SafeAreaView>

      {body}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  memberInfo: { paddingHorizontal: screenPadding, paddingTop: spacing.sm },
  memberEmail: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  enquiryType: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.clubGreen, marginTop: 2 },
  messages: { padding: screenPadding, gap: spacing.sm, flexGrow: 1 },
  bubbleRow: { maxWidth: '80%' },
  bubbleRowLeft: { alignSelf: 'flex-start' },
  bubbleRowRight: { alignSelf: 'flex-end' },
  bubble: { borderRadius: radius.md, padding: spacing.sm },
  bubbleMember: { backgroundColor: colors.inputBg },
  bubbleAdmin: { backgroundColor: colors.clubGreen },
  bubbleText: { fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.textPrimary },
  bubbleTextAdmin: { color: colors.white },
  bubbleTime: { fontFamily: fontFamily.body, fontSize: 9, color: colors.textSecondary, marginTop: 2, alignSelf: 'flex-end' },
  dChatCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
});
}
