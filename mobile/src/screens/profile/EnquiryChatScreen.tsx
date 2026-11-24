import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { TextField } from '../../components/common/TextField';
import { useApp } from '../../context/AppContext';
import { useBento } from '../../context/ThemeContext';
import { useLiveThread } from '../../hooks/useLiveThread';
import { showAlert } from '../../utils/alert';
import { friendlyError } from '../../utils/errors';
import { screenPadding, spacing } from '../../theme';
import type { ThemeColors } from '../../context/ThemeContext';
import { useBentoLegacy } from '../../components/bento/legacy';
import { BentoScreen, ChatBubble, StatusPill, type PillTone } from '../../components/bento';
import type { EnquiryStatus, MyEnquiryThread } from '../../data/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EnquiryChat'>;

const STATUS: Record<EnquiryStatus, { label: string; tone: PillTone }> = {
  pending: { label: 'Pending', tone: 'warn' },
  in_progress: { label: 'Chat in Progress', tone: 'accent' },
  resolved: { label: 'Resolved', tone: 'muted' },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Layout from G-E-ChatLive / ChatLoading / ChatSending / ChatResolved / ChatNew.
export function EnquiryChatScreen({ navigation, route }: Props) {
  const { t } = useBento();
  const { colors } = useBentoLegacy();
  const composerStyles = useMemo(() => createComposerStyles(colors), [colors]);
  const { enquiryId } = route.params;
  const { getEnquiryThread, replyToEnquiry } = useApp();
  const [thread, setThread] = useState<MyEnquiryThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);

  const load = useCallback(async () => {
    try {
      setThread(await getEnquiryThread(enquiryId));
    } catch (err) {
      // Comes back with every 12 s refresh while loading keeps failing (G-E-ChatLoadError).
      showAlert('Couldn’t load enquiry', friendlyError(err));
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
      showAlert('Couldn’t send message', friendlyError(err));
    } finally {
      setSending(false);
    }
  };

  const status = thread ? STATUS[thread.status] : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.ground }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BentoScreen title={thread?.enquiryType ?? 'Enquiry'} onBack={() => navigation.goBack()} scroll={false} contentStyle={{ flex: 1, paddingBottom: 0 }}>
        {loading || !thread ? (
          <View style={{ alignItems: 'center', paddingVertical: 36 }}>
            <ActivityIndicator size="large" color={t.accent} />
          </View>
        ) : (
          <>
            {status ? (
              <View style={{ alignItems: 'center' }}>
                <StatusPill label={status.label} tone={status.tone} style={{ alignSelf: 'center' }} />
              </View>
            ) : null}
            <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
              {thread.messages.map((m) => (
                <ChatBubble key={m.id} text={m.body} mine={m.senderType === 'member'} meta={formatTime(m.createdAt)} />
              ))}
            </ScrollView>
          </>
        )}
      </BentoScreen>

      {/* Composer kept as before: the shared ChatComposer has no sending spinner yet (see report). */}
      {!loading && thread ? (
        <View style={composerStyles.composer}>
          <View style={{ flex: 1 }}>
            <TextField placeholder="Type a message…" variant="onLight" value={draft} onChangeText={setDraft} multiline />
          </View>
          <TouchableOpacity onPress={handleSend} disabled={sending || !draft.trim()} style={composerStyles.sendButton} accessibilityLabel="Send message" accessibilityRole="button">
            {sending ? <ActivityIndicator color={colors.white} size="small" /> : <Ionicons name="send" size={18} color={colors.white} />}
          </TouchableOpacity>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function createComposerStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
      backgroundColor: colors.darkGreen,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
