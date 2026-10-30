import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAdminTheme } from '../../../context/ThemeContext';
import { useAdmin } from '../../../context/AdminContext';
import { adminFont, adminRadius } from '../../../theme/admin';
import { useHover, hoverTransition } from '../../../hooks/useHover';
import { AdminButton, Segmented } from '../ui';
import type { AdminNotification } from '../../../data/adminTypes';

// Older enquiry notifications can predate the enquiry_id linkage — fall
// back to the title/body so they're still clickable instead of a dead row.
export function isActionable(n: AdminNotification): boolean {
  return !!n.enquiryId || !!n.receiptId || /enquiry/i.test(`${n.title} ${n.body}`);
}

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

type Filter = 'all' | 'enquiries' | 'receipts';

interface Props {
  notifications: AdminNotification[];
  onPress: (n: AdminNotification) => void;
  onShowAll?: () => void;
  footer?: React.ReactNode;
}

// The desktop Activity inspector — the same notifications feed as the bell
// and AdminNotificationsScreen, with quick filters and Mark all as read.
export function AdminActivityRail({ notifications, onPress, onShowAll, footer }: Props) {
  const { c } = useAdminTheme();
  const { markNotificationRead } = useAdmin();
  const [filter, setFilter] = useState<Filter>('all');
  const [marking, setMarking] = useState(false);

  const shown = notifications
    .filter((n) => (filter === 'all' ? true : filter === 'enquiries' ? !!n.enquiryId || /enquiry/i.test(`${n.title} ${n.body}`) : !!n.receiptId))
    .slice(0, 8);
  const unread = notifications.filter((n) => !n.read);

  // There's no bulk endpoint, so this marks each unread item in turn.
  const markAll = async () => {
    setMarking(true);
    try {
      await Promise.all(unread.map((n) => markNotificationRead(n.id)));
    } finally {
      setMarking(false);
    }
  };

  return (
    <View style={{ gap: 18 }}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={[styles.heading, { color: c.ink }]}>Activity</Text>
        {unread.length > 0 ? <AdminButton label="Mark all as read" variant="plain" onPress={markAll} loading={marking} /> : null}
      </View>
      <Segmented
        accessibilityLabel="Filter activity"
        fullWidth
        value={filter}
        onChange={setFilter}
        options={[
          { key: 'all', label: 'All' },
          { key: 'enquiries', label: 'Enquiries' },
          { key: 'receipts', label: 'Receipts' },
        ]}
      />
      <View>
        {shown.length === 0 ? (
          <Text style={[styles.empty, { color: c.ink2 }]}>Nothing here yet.</Text>
        ) : (
          shown.map((n) => <ActivityItem key={n.id} n={n} onPress={onPress} />)
        )}
      </View>
      {onShowAll ? <AdminButton label="Show all activity" onPress={onShowAll} fullWidth /> : null}
      {footer}
    </View>
  );
}

function ActivityItem({ n, onPress }: { n: AdminNotification; onPress: (n: AdminNotification) => void }) {
  const { c } = useAdminTheme();
  const [hovered, hoverHandlers] = useHover();
  const actionable = isActionable(n);
  return (
    <Pressable
      onPress={() => onPress(n)}
      disabled={!actionable}
      accessibilityRole={actionable ? 'button' : 'text'}
      accessibilityLabel={`${n.read ? '' : 'Unread. '}${n.title}. ${n.body}. ${timeAgo(n.date)}`}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
      style={[styles.item, hoverTransition, actionable && hovered && { backgroundColor: c.fill2 }]}
    >
      <View style={[styles.dot, { backgroundColor: n.read ? 'transparent' : c.accent }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>{n.title}</Text>
        <Text style={[styles.body, { color: c.ink2 }]} numberOfLines={2}>{n.body}</Text>
        <Text style={[styles.time, { color: c.ink3 }]}>{timeAgo(n.date)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { ...adminFont.bodyBold, fontSize: 18 },
  empty: { ...adminFont.body, fontSize: 13.5, paddingVertical: 8 },
  item: { flexDirection: 'row', gap: 10, paddingVertical: 10, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: adminRadius.sm },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  title: { ...adminFont.bodySemiBold, fontSize: 14 },
  body: { ...adminFont.body, fontSize: 13, lineHeight: 18, marginTop: 1 },
  time: { ...adminFont.body, fontSize: 12, marginTop: 3 },
});
