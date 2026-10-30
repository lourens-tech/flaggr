import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { timeAgo } from '../../components/admin/desktop/AdminActivityRail';
import { AdminButton, EmptyState, ErrorState, Eyebrow, PageTitle, Segmented, Tile } from '../../components/admin/ui';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { useAdminTheme } from '../../context/ThemeContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { useHover, hoverTransition } from '../../hooks/useHover';
import type { AdminNotification } from '../../data/adminTypes';
import { adminFont, adminRadius, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminNotifications'>;

type NotificationFilter = 'all' | 'unread' | 'receipts' | 'enquiries';

const FILTERS: Array<{ label: string; value: NotificationFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Unread', value: 'unread' },
  { label: 'Receipts', value: 'receipts' },
  { label: 'Enquiries', value: 'enquiries' },
];

function matchesFilter(n: AdminNotification, filter: NotificationFilter): boolean {
  if (filter === 'unread') return !n.read;
  if (filter === 'receipts') return !!n.receiptId;
  if (filter === 'enquiries') return !!n.enquiryId;
  return true;
}

function groupLabel(dateIso: string): string {
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

export function AdminNotificationsScreen({ navigation }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { notifications, loadNotifications, markNotificationRead } = useAdmin();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [error, setError] = useState(false);
  const [marking, setMarking] = useState(false);

  const load = useCallback(() => {
    setError(false);
    loadNotifications().catch(() => setError(true));
  }, [loadNotifications]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return notifications.filter((n) => {
      if (!matchesFilter(n, filter)) return false;
      if (!query) return true;
      return n.title.toLowerCase().includes(query) || n.body.toLowerCase().includes(query);
    });
  }, [notifications, filter, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, AdminNotification[]> = {};
    for (const n of filtered) {
      const label = groupLabel(n.date);
      groups[label] = groups[label] ?? [];
      groups[label].push(n);
    }
    const order = ['Today', 'Yesterday', 'This Week', 'Earlier'];
    return order.filter((l) => groups[l]?.length).map((label) => ({ label, entries: groups[label] }));
  }, [filtered]);

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

  const openNotification = (n: AdminNotification) => {
    if (!n.read) markNotificationRead(n.id);
    if (n.enquiryId) navigation.navigate('AdminEnquiryChat', { enquiryId: n.enquiryId });
    else if (n.receiptId) navigation.navigate('AdminFraudOversight');
  };

  const markAllButton =
    unread.length > 0 ? (
      <AdminButton label="Mark all as read" variant={isDesktop ? 'glass' : 'plain'} icon="checkmark-done-outline" onPress={markAll} loading={marking} />
    ) : null;

  const controls = (
    <View style={styles.controls}>
      <TextField placeholder="Search notifications" variant="onLight" icon="search" value={search} onChangeText={setSearch} />
      <Segmented
        accessibilityLabel="Filter activity"
        fullWidth={!isDesktop}
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((f) => ({ key: f.value, label: f.label }))}
      />
    </View>
  );

  const list = (
    <View style={{ gap: 22 }}>
      {error ? <ErrorState onRetry={load} /> : null}
      {grouped.length === 0 ? (
        error && notifications.length === 0 ? null : (
          <Tile>
            <EmptyState
              icon="notifications-outline"
              title={notifications.length === 0 ? 'No notifications yet.' : 'No notifications match your search.'}
            />
          </Tile>
        )
      ) : (
        grouped.map((group) => (
          <View key={group.label} style={{ gap: 8 }}>
            <Eyebrow style={styles.groupLabel}>{group.label}</Eyebrow>
            <Tile padded={false} style={styles.card}>
              {group.entries.map((n, i) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  isLast={i === group.entries.length - 1}
                  desktop={isDesktop}
                  onPress={() => openNotification(n)}
                  onMarkRead={() => markNotificationRead(n.id)}
                />
              ))}
            </Tile>
          </View>
        ))
      )}
    </View>
  );

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminDashboard" breadcrumb="Activity" showRail={false}>
        <View style={styles.dColumn}>
          <View style={styles.dTitleRow}>
            <PageTitle style={{ flex: 1 }}>Activity</PageTitle>
            {markAllButton}
          </View>
          {controls}
          {list}
        </View>
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="Activity" onBack={() => navigation.goBack()} right={markAllButton} />
      <View style={styles.searchArea}>{controls}</View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {list}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function NotificationRow({
  n,
  isLast,
  desktop,
  onPress,
  onMarkRead,
}: {
  n: AdminNotification;
  isLast: boolean;
  desktop: boolean;
  onPress: () => void;
  onMarkRead: () => void;
}) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const [hovered, hoverHandlers] = useHover();
  const actionable = !!n.enquiryId || !!n.receiptId;
  return (
    <View style={[styles.row, !isLast && styles.rowDivider, desktop && hoverTransition, desktop && actionable && hovered && { backgroundColor: c.fill2 }]}>
      <Pressable
        style={styles.rowMain}
        disabled={!actionable}
        onPress={onPress}
        accessibilityRole={actionable ? 'button' : 'text'}
        accessibilityLabel={`${n.read ? '' : 'Unread. '}${n.title}. ${n.body}. ${timeAgo(n.date)}`}
        onHoverIn={hoverHandlers.onMouseEnter}
        onHoverOut={hoverHandlers.onMouseLeave}
      >
        <View style={styles.iconWrap}>
          <Ionicons name={n.read ? 'checkmark-circle-outline' : 'notifications'} size={17} color={c.ink2} />
          {!n.read ? <View style={[styles.unreadDot, { backgroundColor: c.accent, borderColor: c.surface }]} /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.rowTitle}>{n.title}</Text>
          <Text style={styles.rowBody}>{n.body}</Text>
          <Text style={styles.rowTime}>{timeAgo(n.date)}</Text>
        </View>
        {actionable ? <Ionicons name="chevron-forward" size={16} color={c.ink3} style={{ alignSelf: 'center' }} /> : null}
      </Pressable>
      {!n.read && !actionable ? (
        <AdminButton label="Mark read" variant="plain" onPress={onMarkRead} accessibilityLabel={`Mark read: ${n.title}`} style={{ alignSelf: 'center' }} />
      ) : null}
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
    searchArea: { paddingHorizontal: 16, paddingBottom: 6 },
    controls: { gap: 12 },
    content: { padding: 16 },
    groupLabel: { paddingHorizontal: 4 },
    card: { overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'stretch', gap: 8, paddingHorizontal: 14 },
    rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.edge },
    rowMain: { flex: 1, flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 12, minHeight: 56 },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: adminRadius.pill,
      backgroundColor: c.fill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unreadDot: { position: 'absolute', top: -1, right: -1, width: 10, height: 10, borderRadius: adminRadius.pill, borderWidth: 2 },
    rowTitle: { ...adminFont.bodySemiBold, fontSize: 14.5, color: c.ink },
    rowBody: { ...adminFont.body, fontSize: 13.5, lineHeight: 19, color: c.ink2, marginTop: 2 },
    rowTime: { ...adminFont.body, fontSize: 12.5, color: c.ink3, marginTop: 4 },
    dColumn: { gap: 18, maxWidth: 820, width: '100%' },
    dTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  });
}
