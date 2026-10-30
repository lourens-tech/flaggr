import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList, SuperAdminTabParamList } from '../../navigation/types';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { AdminButton, CircleButton, EmptyState, ErrorState, PageTitle, Segmented, SkeletonRows, StatusPill, Tile } from '../../components/admin/ui';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { AdminApiError } from '../../api/adminClient';
import { TextField } from '../../components/common/TextField';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { SuperAdminBroadcast } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

type Props = CompositeScreenProps<
  BottomTabScreenProps<SuperAdminTabParamList, 'SuperAdminPush'>,
  NativeStackScreenProps<SuperAdminStackParamList>
>;

type TargetFilter = 'all' | 'all-members' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'course_admins';

const FILTERS: Array<{ label: string; value: TargetFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'All Members', value: 'all-members' },
  { label: 'Bronze', value: 'Bronze' },
  { label: 'Silver', value: 'Silver' },
  { label: 'Gold', value: 'Gold' },
  { label: 'Platinum', value: 'Platinum' },
  { label: 'Course Admins', value: 'course_admins' },
];
const FILTER_OPTIONS = FILTERS.map((f) => ({ key: f.value, label: f.label }));

function matchesFilter(b: SuperAdminBroadcast, filter: TargetFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'all-members') return b.target === 'all';
  return b.target === filter;
}

function formatSentAt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function targetLabel(target: string, courseName?: string | null): string {
  const base = target === 'all' ? 'All Members' : target === 'course_admins' ? 'Course Admins' : `${target} Tier`;
  return courseName ? `${base} — ${courseName}` : base;
}

export function SuperAdminPushScreen({ navigation }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { superAdminBroadcasts, loadSuperAdminBroadcasts, sendSuperAdminBroadcast, deleteSuperAdminBroadcast } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<TargetFilter>('all');
  // Set when loading the history fails (it used to fail silently); cleared on retry.
  const [error, setError] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return superAdminBroadcasts.filter((b) => {
      if (!matchesFilter(b, filter)) return false;
      if (!query) return true;
      return b.title.toLowerCase().includes(query) || b.body.toLowerCase().includes(query);
    });
  }, [superAdminBroadcasts, filter, search]);

  const load = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      setLoading(true);
      setError(false);
      try {
        await loadSuperAdminBroadcasts();
      } catch {
        if (!isCancelled()) setError(true);
      } finally {
        if (!isCancelled()) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load(() => cancelled);
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const handleSendAgain = (item: SuperAdminBroadcast) => {
    showAlert(
      'Send this again?',
      `This will send "${item.title}" to ${targetLabel(item.target, item.courseName)} again right now.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setResendingId(item.id);
            try {
              await sendSuperAdminBroadcast({ title: item.title, body: item.body, target: item.target, courseId: item.courseId });
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

  const handleDelete = (item: SuperAdminBroadcast) => {
    showAlert('Delete this notification?', 'This only removes it from your history — recipients who already received it keep it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSuperAdminBroadcast(item.id);
          } catch (err) {
            const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
            showAlert('Couldn’t delete', message);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: SuperAdminBroadcast }) => (
    <Tile style={styles.card}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <StatusPill label={targetLabel(item.target, item.courseName)} tone="neutral" style={styles.targetBadge} />
      </View>
      <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>
      <View style={styles.cardFoot}>
        <Text style={styles.cardMeta}>
          {formatSentAt(item.sentAt)} · {item.recipientCount} recipient{item.recipientCount === 1 ? '' : 's'}
        </Text>
        <View style={styles.cardActions}>
          <AdminButton
            label="Send Again"
            icon="send-outline"
            variant="glass"
            onPress={() => handleSendAgain(item)}
            loading={resendingId === item.id}
          />
          <AdminButton label="Delete" icon="trash-outline" variant="danger" onPress={() => handleDelete(item)} />
        </View>
      </View>
    </Tile>
  );

  const searchField = <TextField placeholder="Search notifications" variant="onLight" icon="search" value={search} onChangeText={setSearch} />;
  const filterControl = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
      <Segmented options={FILTER_OPTIONS} value={filter} onChange={setFilter} accessibilityLabel="Audience filter" />
    </ScrollView>
  );

  const errorState = <ErrorState onRetry={() => load()} />;

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame
        activeKey="SuperAdminPush"
        breadcrumb="Push Notifications"
        headerRight={
          <AdminButton
            label="New Notification"
            icon="add"
            variant="accent"
            onPress={() => navigation.navigate('SuperAdminBroadcastCompose', undefined)}
          />
        }
      >
        <PageTitle>Push Notifications</PageTitle>
        <View style={styles.dToolbar}>
          <View style={styles.dSearch}>{searchField}</View>
          {filterControl}
        </View>
        <Text style={styles.dSectionTitle} accessibilityRole="header">Sent Notifications</Text>
        {loading ? (
          <Tile style={styles.dList}>
            <SkeletonRows rows={4} />
          </Tile>
        ) : error ? (
          <View style={styles.dList}>{errorState}</View>
        ) : filtered.length === 0 ? (
          <Tile style={styles.dList}>
            <EmptyState
              icon={superAdminBroadcasts.length === 0 ? 'notifications-outline' : 'search-outline'}
              title={superAdminBroadcasts.length === 0 ? 'No notifications sent yet.' : 'No notifications match your search.'}
            />
          </Tile>
        ) : (
          <View style={[styles.dList, { gap: 10 }]}>
            {filtered.map((item) => (
              <React.Fragment key={item.id}>{renderItem({ item })}</React.Fragment>
            ))}
          </View>
        )}
      </SuperAdminDesktopFrame>
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
            onPress={() => navigation.navigate('SuperAdminBroadcastCompose', undefined)}
            accessibilityLabel="New Notification"
          />
        }
      />

      <View style={styles.searchArea}>
        {searchField}
        {filterControl}
      </View>

      {loading ? (
        <View style={styles.listContent}>
          <Tile>
            <SkeletonRows rows={4} />
          </Tile>
        </View>
      ) : error ? (
        <View style={styles.listContent}>{errorState}</View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(b) => b.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Tile>
              <EmptyState
                icon={superAdminBroadcasts.length === 0 ? 'notifications-outline' : 'search-outline'}
                title={
                  superAdminBroadcasts.length === 0
                    ? 'No notifications sent yet — tap + to send your first one.'
                    : 'No notifications match your search.'
                }
              />
            </Tile>
          }
        />
      )}
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  searchArea: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  filterScroll: { flexGrow: 0 },
  listContent: { padding: 16, paddingBottom: 32, gap: 10 },
  card: { gap: 6 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardTitle: { flex: 1, minWidth: 0, ...adminFont.bodyBold, fontSize: 15.5, color: c.ink },
  // Shrinks and truncates so a club-scoped label ("Course Admins — {club}")
  // can't push past the card edge on a phone.
  targetBadge: { flexShrink: 1, maxWidth: '45%', alignSelf: 'center' },
  cardBody: { ...adminFont.body, fontSize: 14, lineHeight: 20, color: c.ink2 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  cardMeta: { flex: 1, minWidth: 160, ...adminFont.body, ...tabularNums, fontSize: 12.5, color: c.ink3 },
  cardActions: { flexDirection: 'row', gap: 8 },
  dToolbar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' },
  dSearch: { width: 300 },
  dSectionTitle: { ...adminFont.bodyBold, fontSize: 17, color: c.ink, marginTop: 20 },
  dList: { marginTop: 10, maxWidth: 960, borderRadius: adminRadius.md },
});
}
