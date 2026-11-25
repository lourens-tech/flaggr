import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { useBento } from '../../context/ThemeContext';
import { friendlyError } from '../../utils/errors';
import { relativeTime } from '../../utils/relativeTime';
import { Appear, BentoIcon, BentoScreen, BentoTile, EmptyState, GlassIconButton, LoadError, StatusPill, type PillTone } from '../../components/bento';
import type { EnquiryStatus, MyEnquirySummary } from '../../data/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MyEnquiries'>;

const STATUS: Record<EnquiryStatus, { label: string; tone: PillTone }> = {
  pending: { label: 'Pending', tone: 'warn' },
  in_progress: { label: 'Chat in Progress', tone: 'accent' },
  resolved: { label: 'Resolved', tone: 'muted' },
};

// Layout from G-E-EnquiriesLive / EnquiriesLoading and AppEnquiriesEmpty.
export function MyEnquiriesScreen({ navigation }: Props) {
  const { t } = useBento();
  const { listMyEnquiries } = useApp();
  const [enquiries, setEnquiries] = useState<MyEnquirySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped by Try again to run the same load as a focus does.
  const [attempt, setAttempt] = useState(0);

  // Reloads, with the spinner, every time the screen comes into view.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        setError(null);
        try {
          const rows = await listMyEnquiries();
          if (!cancelled) setEnquiries(rows);
        } catch (err) {
          // Owner decision (24 Nov 2026): a failed load shows a message with Try again (it used to look like "no enquiries").
          if (!cancelled) setError(friendlyError(err));
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attempt]),
  );

  return (
    <BentoScreen
      title="My Enquiries"
      onBack={() => navigation.goBack()}
      // Approved small addition (24 Nov 2026): "+" opens Contact.
      headerRight={<GlassIconButton icon="plus" accessibilityLabel="New enquiry" onPress={() => navigation.navigate('Contact')} />}
    >
      <View style={{ height: 4 }} />
      {loading ? (
        <View style={{ alignItems: 'center', paddingVertical: 36 }}>
          <ActivityIndicator size="large" color={t.accent} />
        </View>
      ) : error ? (
        <LoadError body={error} onRetry={() => setAttempt((a) => a + 1)} />
      ) : enquiries.length === 0 ? (
        <Appear>
          <EmptyState
            icon="chatBubbleWide"
            title="No enquiries"
            body="You haven't sent any enquiries yet."
            // Approved small addition (24 Nov 2026): "Contact Your Club" on the empty list.
            actionLabel="Contact Your Club"
            onAction={() => navigation.navigate('Contact')}
          />
        </Appear>
      ) : (
        <Appear>
          <BentoTile padding={0} innerStyle={{ paddingHorizontal: 16 }}>
            {enquiries.map((item, i) => {
              const status = STATUS[item.status];
              return (
                <Pressable
                  key={item.id}
                  onPress={() => navigation.navigate('EnquiryChat', { enquiryId: item.id })}
                  accessibilityRole="button"
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
                      <Text style={{ flexShrink: 1, fontSize: 15, fontWeight: '600', color: t.ink }}>{item.enquiryType}</Text>
                      {/* An unread club reply; clears once the chat has been opened. */}
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
