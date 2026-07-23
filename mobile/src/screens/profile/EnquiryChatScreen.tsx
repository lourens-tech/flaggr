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
import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { useApp } from '../../context/AppContext';
import { ApiError } from '../../api/client';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { EnquiryStatus, MyEnquiryThread } from '../../data/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EnquiryChat'>;

// A fixed, theme-invariant palette — these are small self-contained status
// chips (own bg + fg pair), not surfaces that should flip with dark mode.
const STATUS_BADGE: Record<EnquiryStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: 'Pending', bg: '#FDE9C8', fg: '#8A5A00' },
  in_progress: { label: 'Chat in Progress', bg: '#CCF2E6', fg: '#00805A' },
  resolved: { label: 'Resolved', bg: '#E5E7EB', fg: '#4B5563' },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function EnquiryChatScreen({ route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { enquiryId } = route.params;
  const { getEnquiryThread, replyToEnquiry } = useApp();
  const [thread, setThread] = useState<MyEnquiryThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      setThread(await getEnquiryThread(enquiryId));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t load enquiry', message);
    } finally {
      setLoading(false);
    }
  }, [enquiryId, getEnquiryThread]);

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
      await replyToEnquiry(enquiryId, message);
      setDraft('');
      await load();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      const errMessage = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t send message', errMessage);
    } finally {
      setSending(false);
    }
  };

  const badge = thread ? STATUS_BADGE[thread.status] : null;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title={thread?.enquiryType ?? 'Enquiry'} />
      </SafeAreaView>

      {loading || !thread ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : (
        <>
          <View style={styles.statusRow}>
            {badge ? (
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
              </View>
            ) : null}
          </View>

          <ScrollView ref={scrollRef} contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
            {thread.messages.map((m) => (
              <View
                key={m.id}
                style={[styles.bubbleRow, m.senderType === 'member' ? styles.bubbleRowRight : styles.bubbleRowLeft]}
              >
                <View style={[styles.bubble, m.senderType === 'member' ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, m.senderType === 'member' && styles.bubbleTextMine]}>{m.body}</Text>
                </View>
                <Text style={styles.bubbleTime}>{formatTime(m.createdAt)}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.composer}>
            <View style={{ flex: 1 }}>
              <TextField placeholder="Type a message…" variant="onLight" value={draft} onChangeText={setDraft} multiline />
            </View>
            <TouchableOpacity
              onPress={handleSend}
              disabled={sending || !draft.trim()}
              style={styles.sendButton}
              accessibilityLabel="Send message"
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
  statusRow: { paddingHorizontal: screenPadding, paddingTop: spacing.md },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  badgeText: { fontFamily: fontFamily.bodySemiBold, fontSize: 10 },
  messages: { padding: screenPadding, gap: spacing.sm, flexGrow: 1 },
  bubbleRow: { maxWidth: '80%' },
  bubbleRowLeft: { alignSelf: 'flex-start' },
  bubbleRowRight: { alignSelf: 'flex-end' },
  bubble: { borderRadius: radius.md, padding: spacing.sm },
  bubbleTheirs: { backgroundColor: colors.inputBg },
  bubbleMine: { backgroundColor: colors.clubGreen },
  bubbleText: { fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.textPrimary },
  bubbleTextMine: { color: colors.white },
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
