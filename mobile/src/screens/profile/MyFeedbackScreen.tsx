import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { api } from '../../api/client';
import { useBento } from '../../context/ThemeContext';
import { friendlyError } from '../../utils/errors';
import { relativeTime } from '../../utils/relativeTime';
import { Appear, BentoIcon, BentoScreen, BentoTile, EmptyState, GlassIconButton, LoadError, StatusPill } from '../../components/bento';
import type { MyFeedbackSummary } from '../../data/types';
import { FEEDBACK_STATUS, feedbackTitle } from './feedbackLabels';

type Props = NativeStackScreenProps<RootStackParamList, 'MyFeedback'>;

// My Feedback (owner decisions 24 and 25 Nov 2026; mockup approved 25 Nov): the member's
// Give Feedback submissions with the Flagrr team's replies. Same layout as My Enquiries.
export function MyFeedbackScreen({ navigation }: Props) {
  const { t } = useBento();
  const [items, setItems] = useState<MyFeedbackSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped by Try again to run the same load as a focus does.
  const [attempt, setAttempt] = useState(0);

  // Reloads, with the spinner, every time the screen comes into view (so a reply read in
  // the thread clears its dot, and feedback just sent from Give Feedback shows up).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        setError(null);
        try {
          const rows = await api.myFeedback();
          if (!cancelled) setItems(rows);
        } catch (err) {
          if (!cancelled) setError(friendlyError(err));
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [attempt]),
  );

  return (
    <BentoScreen
      title="My Feedback"
      onBack={() => navigation.goBack()}
      headerRight={<GlassIconButton icon="plus" accessibilityLabel="Give Feedback" onPress={() => navigation.navigate('GiveFeedback')} />}
    >
      <View style={{ height: 4 }} />
      {loading ? (
        <View style={{ alignItems: 'center', paddingVertical: 36 }}>
          <ActivityIndicator size="large" color={t.accent} />
        </View>
      ) : error ? (
        <LoadError title="Couldn’t load your feedback" body={error} onRetry={() => setAttempt((a) => a + 1)} />
      ) : items.length === 0 ? (
        <Appear>
          <EmptyState
            icon="chatBubble"
            title="No feedback yet"
            body="Ideas, bugs and kind words you send from Give Feedback show up here, with the Flagrr team’s replies."
            actionLabel="Give Feedback"
            onAction={() => navigation.navigate('GiveFeedback')}
          />
        </Appear>
      ) : (
        <Appear>
          <BentoTile padding={0} innerStyle={{ paddingHorizontal: 16 }}>
            {items.map((item, i) => {
              const status = FEEDBACK_STATUS[item.status];
              const title = feedbackTitle(item.category);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => navigation.navigate('FeedbackThread', { ticketId: item.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`${title}${item.hasUnread ? ', unread reply' : ''}. ${status.label}`}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 12,
                    paddingVertical: 13,
                    borderTopWidth: i ? 1 : 0,
                    borderTopColor: t.hair,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 13, marginTop: 2, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <BentoIcon name="chatBubble" size={20} color={t.accent} strokeWidth={1.8} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ flexShrink: 1, fontSize: 15, fontWeight: '600', color: t.ink }}>{title}</Text>
                      {/* An unread reply from the Flagrr team; clears once the thread has been opened. */}
                      {item.hasUnread ? <View accessibilityRole="image" accessibilityLabel="Unread reply" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.danger }} /> : null}
                    </View>
                    <Text numberOfLines={1} style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>
                      {item.lastMessage ?? '—'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <StatusPill label={status.label} tone={status.tone} />
                      <Text style={{ fontSize: 12, color: t.muted }}>{relativeTime(item.updatedAt)}</Text>
                    </View>
                  </View>
                  <View style={{ marginTop: 12 }}>
                    <BentoIcon name="chevronRight" size={16} color={t.muted} strokeWidth={1.8} />
                  </View>
                </Pressable>
              );
            })}
          </BentoTile>
        </Appear>
      )}
    </BentoScreen>
  );
}
