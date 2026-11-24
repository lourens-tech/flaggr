import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { showAlert } from '../../utils/alert';
import { useBento } from '../../context/ThemeContext';
import { BentoIcon, BentoScreen, BentoTile, EmptyState, GlassIconButton } from '../../components/bento';
import type { AppNotification } from '../../data/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

type Group = 'Today' | 'Yesterday' | 'This Week' | 'Earlier';
const ORDER: Group[] = ['Today', 'Yesterday', 'This Week', 'Earlier'];

function groupLabel(dateIso: string): Group {
  const date = new Date(dateIso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  const daysAgo = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo <= 7) return 'This Week';
  return 'Earlier';
}

// The time on the right of each row, as the boards show it per group: the clock
// time for Today and Yesterday ("14:05"), the weekday for This Week ("Sat"), the
// date for Earlier ("12 Nov"). Formatted in the device's locale, like Home's date line.
function rowTime(dateIso: string, group: Group): string {
  const d = new Date(dateIso);
  if (group === 'Today' || group === 'Yesterday') return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  // "This Week" also holds rows exactly 7 days old (groupLabel); their weekday is today's, which
  // would read as today, so those show the date instead.
  if (group === 'This Week' && d.getDay() !== new Date().getDay()) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function NotificationsScreen({ navigation }: Props) {
  const { t } = useBento();
  const { notifications, markNotificationRead } = useApp();

  const grouped = useMemo(() => {
    const groups: Partial<Record<Group, AppNotification[]>> = {};
    for (const n of notifications) {
      const label = groupLabel(n.date);
      groups[label] = [...(groups[label] ?? []), n];
    }
    return ORDER.filter((l) => groups[l]?.length).map((label) => ({ label, entries: groups[label]! }));
  }, [notifications]);

  return (
    <BentoScreen
      title="Notifications"
      onBack={() => navigation.goBack()}
      headerRight={
        // Approved addition (24 Nov 2026): the board's gear opens Notification Preferences.
        <GlassIconButton icon="notificationSettings" onPress={() => navigation.navigate('NotificationPreferences')} accessibilityLabel="Notification Preferences" />
      }
    >
      {grouped.length === 0 ? (
        <>
          <View style={{ height: 12 }} />
          {/* Owner-approved empty state (24 Nov 2026), board G-A-NotifEmpty. */}
          <EmptyState icon="notificationBell" title="No notifications yet" body="Updates about your receipts, rewards and enquiries will show here." />
        </>
      ) : (
        <>
          <View style={{ height: 6 }} />
          {grouped.map((group) => (
            <React.Fragment key={group.label}>
              <Text accessibilityRole="header" style={{ fontSize: 13, fontWeight: '600', letterSpacing: 0.12 * 13, textTransform: 'uppercase', color: t.muted, marginTop: 6 }}>
                {group.label}
              </Text>
              <BentoTile padding={0} innerStyle={{ paddingHorizontal: 16 }}>
                {group.entries.map((n, i) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    time={rowTime(n.date, group.label)}
                    first={i === 0}
                    onOpen={() => {
                      if (!n.read) markNotificationRead(n.id);
                      if (n.enquiryId) navigation.navigate('EnquiryChat', { enquiryId: n.enquiryId });
                    }}
                    // Owner decision (24 Nov 2026): no silent failures. "View" only marks the row read, so a
                    // failure says so (the row is unread again); opening an enquiry still goes ahead.
                    onView={() =>
                      markNotificationRead(n.id).then((ok) => {
                        if (!ok) showAlert('Couldn’t mark as read', 'Something went wrong. Please try again.');
                      })
                    }
                  />
                ))}
              </BentoTile>
            </React.Fragment>
          ))}
        </>
      )}
    </BentoScreen>
  );
}

// One row (board G-A-NotifGroups): an unread dot, a 40 pt chip (bell when unread,
// check when read), title and time, body, then a chevron for enquiry replies or a
// "View" link that only marks the row read. Only enquiry rows are tappable.
function NotificationRow({
  n,
  time,
  first,
  onOpen,
  onView,
}: {
  n: AppNotification;
  time: string;
  first: boolean;
  onOpen: () => void;
  onView: () => void;
}) {
  const { t } = useBento();
  const content = (
    <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 14, alignItems: 'flex-start' }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 16, backgroundColor: n.read ? 'transparent' : t.accent }} />
      <View
        accessibilityRole="image"
        accessibilityLabel={n.read ? 'Read' : 'Unread'}
        style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}
      >
        <BentoIcon name={n.read ? 'check' : 'notificationBell'} size={19} color={t.accent} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ flexShrink: 1, fontSize: 15, fontWeight: '600', color: t.ink }}>{n.title}</Text>
          <Text numberOfLines={1} style={{ flexShrink: 0, fontSize: 12, color: t.muted }}>
            {time}
          </Text>
        </View>
        <Text style={{ fontSize: 14, lineHeight: 20, color: t.muted, marginTop: 3 }}>{n.body}</Text>
      </View>
      {n.enquiryId ? (
        <View style={{ alignSelf: 'center' }}>
          <BentoIcon name="chevronRight" size={16} color={t.muted} strokeWidth={1.8} />
        </View>
      ) : (
        <Pressable
          onPress={onView}
          accessibilityRole="button"
          accessibilityLabel={`View, ${n.title}`}
          accessibilityHint="Marks this notification as read"
          style={{ alignSelf: 'center', minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: t.accent }}>View</Text>
        </Pressable>
      )}
    </View>
  );
  const divider = first ? null : { borderTopWidth: 1, borderTopColor: t.hair };
  if (!n.enquiryId) {
    return (
      <View testID={`notification-${n.id}`} style={divider}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={`notification-${n.id}`}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${n.title}. ${n.body}`}
      style={({ pressed }) => [divider, { opacity: pressed ? 0.7 : 1 }]}
    >
      {content}
    </Pressable>
  );
}
