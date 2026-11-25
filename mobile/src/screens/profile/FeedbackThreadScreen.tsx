import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ScrollViewInstance } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { api } from '../../api/client';
import { useBento } from '../../context/ThemeContext';
import { useLiveThread } from '../../hooks/useLiveThread';
import { showAlert } from '../../utils/alert';
import { friendlyError } from '../../utils/errors';
import { BentoScreen, ChatBubble, ChatComposer, StatusPill } from '../../components/bento';
import type { MyFeedbackThread } from '../../data/types';
import { FEEDBACK_STATUS, feedbackTitle } from './feedbackLabels';

type Props = NativeStackScreenProps<RootStackParamList, 'FeedbackThread'>;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// One My Feedback thread (mockup approved 25 Nov 2026): the member's messages on the right,
// the Flagrr team's on the left with a "Flagrr Support" label, and the same message box as
// My Enquiries (owner decision 25 Nov: members can reply; a reply on a Resolved thread
// reopens it). Opening it marks the team's replies read (server side).
export function FeedbackThreadScreen({ navigation, route }: Props) {
  const { t } = useBento();
  const insets = useSafeAreaInsets();
  const { ticketId } = route.params;
  const [thread, setThread] = useState<MyFeedbackThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);

  const load = useCallback(async () => {
    try {
      setThread(await api.feedbackThread(ticketId));
    } catch (err) {
      showAlert('Couldn’t load feedback', friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  // Same refresh as an enquiry chat: on focus, every 12 s, and on any push received while open.
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
      setThread(await api.replyToFeedback(ticketId, message));
      setDraft('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      // The draft is kept so the member can try again.
      showAlert('Couldn’t send message', friendlyError(err));
    } finally {
      setSending(false);
    }
  };

  const status = thread ? FEEDBACK_STATUS[thread.status] : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.ground }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BentoScreen title={thread ? feedbackTitle(thread.category) : 'Feedback'} onBack={() => navigation.goBack()} scroll={false} contentStyle={{ flex: 1, paddingBottom: 0 }}>
        {loading || !thread ? (
          <View style={{ alignItems: 'center', paddingVertical: 36 }}>
            {/* Stays while a load keeps failing; the 12 s refresh tries again (as Enquiry Chat). */}
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
              {thread.messages.map((m) => {
                const mine = m.senderType === 'requester';
                return <ChatBubble key={m.id} text={m.body} mine={mine} sender={mine ? undefined : 'Flagrr Support'} meta={formatTime(m.createdAt)} />;
              })}
            </ScrollView>
          </>
        )}
      </BentoScreen>

      {!loading && thread ? (
        <ChatComposer value={draft} onChangeText={setDraft} onSend={handleSend} sending={sending} bottomInset={insets.bottom} />
      ) : null}
    </KeyboardAvoidingView>
  );
}
