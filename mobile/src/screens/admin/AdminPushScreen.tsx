import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList, AdminTabParamList } from '../../navigation/types';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import {
  AdminButton,
  CircleButton,
  EmptyState,
  ErrorState,
  PageTitle,
  Segmented,
  SkeletonRows,
  StatusPill,
  Tile,
} from '../../components/admin/ui';
import { AdminApiError } from '../../api/adminClient';
import { TextField } from '../../components/common/TextField';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { AdminBroadcast } from '../../data/adminTypes';
import { adminFont } from '../../theme/admin';

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
  const { c } = useAdminTheme();
  const isDesktop = useIsDesktopNav();
  const { broadcasts, loadBroadcasts, sendBroadcast, deleteBroadcast } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<TargetFilter>('all');
  // Load failures used to be swallowed silently; surface them with a retry.
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

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
        setError(false);
        try {
          await loadBroadcasts();
        } catch {
          if (!cancelled) setError(true);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reloadKey]),
  );

  const retry = () => setReloadKey((k) => k + 1);

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
    <Tile style={[styles.card, isDesktop && styles.dCard]}>
      <Text style={[styles.cardTitle, { color: c.ink }]} numberOfLines={1}>{item.title}</Text>
      <StatusPill label={targetLabel(item.target)} tone="neutral" style={styles.targetPill} />
      <Text style={[styles.cardBody, { color: c.ink2 }]} numberOfLines={2}>{item.body}</Text>
      <Text style={[styles.cardMeta, { color: c.ink3 }]}>
        {formatSentAt(item.sentAt)} · {item.recipientCount} recipient{item.recipientCount === 1 ? '' : 's'}
      </Text>
      <View style={styles.cardActions}>
        <AdminButton
          variant="glass"
          icon="send-outline"
          label="Send Again"
          onPress={() => handleSendAgain(item)}
          disabled={resendingId === item.id}
          loading={resendingId === item.id}
          style={!isDesktop && styles.mAction}
        />
        <AdminButton
          variant="danger"
          icon="trash-outline"
          label="Delete"
          onPress={() => handleDelete(item)}
          style={!isDesktop && styles.mAction}
        />
      </View>
    </Tile>
  );

  const searchAndFilters = (
    <View style={[styles.searchArea, isDesktop && styles.dSearchArea]}>
      <View style={isDesktop ? styles.dSearch : undefined}>
        <TextField placeholder="Search notifications" variant="onLight" icon="search" value={search} onChangeText={setSearch} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
        <Segmented<TargetFilter>
          options={FILTERS.map((f) => ({ key: f.value, label: f.label }))}
          value={filter}
          onChange={setFilter}
          accessibilityLabel="Filter by audience"
        />
      </ScrollView>
    </View>
  );

  const emptyOrError = (emptyTitle: string) =>
    error ? (
      <ErrorState onRetry={retry} />
    ) : (
      <Tile>
        <EmptyState icon="megaphone-outline" title={emptyTitle} />
      </Tile>
    );

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminPush" breadcrumb="Push Notifications">
        <View style={styles.dHeadRow}>
          <PageTitle>Push Notifications</PageTitle>
          <AdminButton variant="accent" icon="add" label="New Notification" onPress={() => navigation.navigate('AdminBroadcastCompose', undefined)} />
        </View>
        {searchAndFilters}
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: c.ink }]}>Sent Notifications</Text>
        {loading ? (
          <Tile>
            <SkeletonRows rows={4} />
          </Tile>
        ) : error || filtered.length === 0 ? (
          emptyOrError(broadcasts.length === 0 ? 'No notifications sent yet.' : 'No notifications match your search.')
        ) : (
          <View style={styles.dGrid}>
            {filtered.map((item) => (
              <React.Fragment key={item.id}>{renderItem({ item })}</React.Fragment>
            ))}
          </View>
        )}
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader
        title="Push Notifications"
        showBack={false}
        right={
          <CircleButton
            icon="add"
            size={44}
            onPress={() => navigation.navigate('AdminBroadcastCompose', undefined)}
            accessibilityLabel="New Notification"
          />
        }
      />

      {searchAndFilters}

      {loading ? (
        <View style={styles.listContent}>
          <Tile>
            <SkeletonRows rows={4} />
          </Tile>
        </View>
      ) : error ? (
        <View style={styles.listContent}>
          <ErrorState onRetry={retry} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(b) => b.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={emptyOrError(
            broadcasts.length === 0
              ? 'No notifications sent yet — tap + to send your first one.'
              : 'No notifications match your search.',
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  searchArea: { paddingHorizontal: 16, paddingTop: 4, gap: 10 },
  dSearchArea: { paddingHorizontal: 0, paddingTop: 16, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  dSearch: { flex: 1, minWidth: 220, maxWidth: 360 },
  filterBar: { flexGrow: 0 },
  listContent: { padding: 16, paddingBottom: 48, gap: 12 },
  card: { gap: 6 },
  dCard: { flexGrow: 1, flexBasis: 360, maxWidth: 620 },
  cardTitle: { ...adminFont.bodyBold, fontSize: 15.5 },
  targetPill: { marginTop: 2 },
  cardBody: { ...adminFont.body, fontSize: 13.5, lineHeight: 19, marginTop: 2 },
  cardMeta: { ...adminFont.body, fontSize: 12.5, marginTop: 4 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  mAction: { height: 44 },
  sectionTitle: { ...adminFont.bodyBold, fontSize: 17, marginTop: 22, marginBottom: 12 },
  dHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  dGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
});
