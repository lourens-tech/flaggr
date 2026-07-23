import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList, AdminTabParamList } from '../../navigation/types';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { TextField } from '../../components/common/TextField';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { AdminBroadcast } from '../../data/adminTypes';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabParamList, 'AdminPush'>,
  NativeStackScreenProps<AdminStackParamList>
>;

type TargetFilter = 'all' | 'all-members' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

const FILTERS: Array<{ label: string; value: TargetFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'All Members', value: 'all-members' },
  { label: 'Bronze', value: 'Bronze' },
  { label: 'Silver', value: 'Silver' },
  { label: 'Gold', value: 'Gold' },
  { label: 'Platinum', value: 'Platinum' },
];

function matchesFilter(b: AdminBroadcast, filter: TargetFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'all-members') return b.target === 'all';
  return b.target === filter;
}

function formatSentAt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function targetLabel(target: string): string {
  return target === 'all' ? 'All Members' : `${target} Tier`;
}

export function AdminPushScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { broadcasts, loadBroadcasts, sendBroadcast, deleteBroadcast } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<TargetFilter>('all');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return broadcasts.filter((b) => {
      if (!matchesFilter(b, filter)) return false;
      if (!query) return true;
      return b.title.toLowerCase().includes(query) || b.body.toLowerCase().includes(query);
    });
  }, [broadcasts, filter, search]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          await loadBroadcasts();
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const handleSendAgain = (item: AdminBroadcast) => {
    showAlert(
      'Send this again?',
      `This will send "${item.title}" to ${targetLabel(item.target)} again right now.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setResendingId(item.id);
            try {
              await sendBroadcast({ title: item.title, body: item.body, target: item.target });
            } catch (err) {
              const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
              showAlert('Couldn’t send', message);
            } finally {
              setResendingId(null);
            }
          },
        },
      ],
    );
  };

  const handleDelete = (item: AdminBroadcast) => {
    showAlert('Delete this notification?', 'This only removes it from your history — members who already received it keep it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBroadcast(item.id);
          } catch (err) {
            const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
            showAlert('Couldn’t delete', message);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: AdminBroadcast }) => (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.targetBadge}>
          <Text style={styles.targetBadgeText}>{targetLabel(item.target)}</Text>
        </View>
      </View>
      <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>
      <Text style={styles.cardMeta}>
        {formatSentAt(item.sentAt)} · {item.recipientCount} recipient{item.recipientCount === 1 ? '' : 's'}
      </Text>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleSendAgain(item)}
          disabled={resendingId === item.id}
        >
          {resendingId === item.id ? (
            <ActivityIndicator color={colors.clubGreen} size="small" />
          ) : (
            <>
              <Ionicons name="send-outline" size={15} color={colors.clubGreen} />
              <Text style={styles.actionButtonText}>Send Again</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item)}>
          <Ionicons name="trash-outline" size={15} color={colors.negative} />
          <Text style={[styles.actionButtonText, { color: colors.negative }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Push Notifications</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('AdminBroadcastCompose', undefined)}
            hitSlop={8}
            accessibilityLabel="New Notification"
            accessibilityRole="button"
          >
            <Ionicons name="add-circle" size={28} color={colors.white} />
          </TouchableOpacity>
        </View>
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

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(b) => b.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {broadcasts.length === 0
                ? 'No notifications sent yet — tap + to send your first one.'
                : 'No notifications match your search.'}
            </Text>
          }
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  header: {
    paddingHorizontal: screenPadding,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontFamily: fontFamily.headingDisplay, fontSize: fontSize.title, color: colors.white },
  searchArea: { paddingHorizontal: screenPadding, paddingTop: spacing.md, gap: spacing.sm },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filterPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.mintBgAlt },
  filterPillActive: { backgroundColor: colors.darkGreen },
  filterText: { fontFamily: fontFamily.heading, fontSize: 11, color: colors.textPrimary },
  filterTextActive: { color: colors.white },
  listContent: { padding: screenPadding, gap: spacing.sm },
  card: {
    backgroundColor: colors.mintBg,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 4,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  targetBadge: { backgroundColor: colors.background, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  targetBadgeText: { fontFamily: fontFamily.bodySemiBold, fontSize: 10, color: colors.textPrimary },
  cardBody: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  cardMeta: { fontFamily: fontFamily.body, fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  actionButtonText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.clubGreen },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
}
