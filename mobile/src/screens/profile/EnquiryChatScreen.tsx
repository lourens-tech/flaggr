import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ScrollViewInstance } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { useBento } from '../../context/ThemeContext';
import { useLiveThread } from '../../hooks/useLiveThread';
import { showAlert } from '../../utils/alert';
import { friendlyError } from '../../utils/errors';
import { BentoScreen, ChatBubble, ChatComposer, StatusPill, type PillTone } from '../../components/bento';
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
  const insets = useSafeAreaInsets();
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

      {/* Bento composer (G-E-ChatLive / ChatSending): same rules as before: Send is disabled until
          something is typed and while sending, shows a spinner while sending, and keeps the draft on failure. */}
      {!loading && thread ? (
        <ChatComposer value={draft} onChangeText={setDraft} onSend={handleSend} sending={sending} bottomInset={insets.bottom} />
      ) : null}
    </KeyboardAvoidingView>
  );
}
