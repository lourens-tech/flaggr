import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { AdminNotification } from '../../data/adminTypes';

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
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { notifications, loadNotifications, markNotificationRead } = useAdmin();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<NotificationFilter>('all');

  useFocusEffect(
    useCallback(() => {
      loadNotifications().catch(() => {});
    }, [loadNotifications]),
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

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Notifications" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <View style={styles.searchArea}>
        <TextField
          placeholder="Search notifications"
          variant="onLight"
          icon="search"
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              onPress={() => setFilter(f.value)}
              style={[styles.filterPill, filter === f.value && styles.filterPillActive]}
              accessibilityLabel={`Filter ${f.label}`}
              accessibilityRole="button"
            >
              <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {grouped.length === 0 ? (
          <Text style={styles.emptyText}>
            {notifications.length === 0 ? 'No notifications yet.' : 'No notifications match your search.'}
          </Text>
        ) : (
          grouped.map((group) => (
            <View key={group.label} style={{ marginBottom: spacing.lg }}>
              <Text style={styles.groupLabel}>{group.label}</Text>
              <View style={styles.card}>
                {group.entries.map((n, i) => (
                  <TouchableOpacity
                    key={n.id}
                    style={[styles.row, i !== group.entries.length - 1 && styles.rowDivider]}
                    activeOpacity={n.enquiryId || n.receiptId ? 0.7 : 1}
                    disabled={!n.enquiryId && !n.receiptId}
                    onPress={() => {
                      if (!n.read) markNotificationRead(n.id);
                      if (n.enquiryId) navigation.navigate('AdminEnquiryChat', { enquiryId: n.enquiryId });
                      else if (n.receiptId) navigation.navigate('AdminFraudOversight');
                    }}
                  >
                    <Ionicons
                      name={n.read ? 'checkmark-circle-outline' : 'notifications'}
                      size={18}
                      color={colors.clubGreen}
                      style={{ marginTop: 2 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{n.title}</Text>
                      <Text style={styles.rowBody}>{n.body}</Text>
                    </View>
                    {!n.read && !n.enquiryId && !n.receiptId ? (
                      <TouchableOpacity onPress={() => markNotificationRead(n.id)}>
                        <Text style={styles.viewLink}>Mark read</Text>
                      </TouchableOpacity>
                    ) : n.enquiryId || n.receiptId ? (
                      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  searchArea: { paddingHorizontal: screenPadding, paddingTop: spacing.md, gap: spacing.sm },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filterPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.mintBgAlt },
  filterPillActive: { backgroundColor: colors.darkGreen },
  filterText: { fontFamily: fontFamily.heading, fontSize: 11, color: colors.textPrimary },
  filterTextActive: { color: colors.white },
  content: { padding: screenPadding },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  groupLabel: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.textPrimary, marginBottom: spacing.sm },
  card: { backgroundColor: colors.mintBgAlt, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm + 4, alignItems: 'flex-start' },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(31,66,52,0.08)' },
  rowTitle: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.small, color: colors.textPrimary },
  rowBody: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 2 },
  viewLink: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.clubGreen, marginTop: 2 },
});
}
