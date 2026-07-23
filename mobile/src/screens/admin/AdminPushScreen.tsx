import React, { useCallback, useState } from 'react';
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
import { showAlert } from '../../utils/alert';
import { colors, fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import type { AdminBroadcast } from '../../data/adminTypes';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabParamList, 'AdminPush'>,
  NativeStackScreenProps<AdminStackParamList>
>;

function formatSentAt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function targetLabel(target: string): string {
  return target === 'all' ? 'All Members' : `${target} Tier`;
}

export function AdminPushScreen({ navigation }: Props) {
  const { broadcasts, loadBroadcasts, sendBroadcast, deleteBroadcast } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);

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

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={broadcasts}
          keyExtractor={(b) => b.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No notifications sent yet — tap + to send your first one.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  header: {
    paddingHorizontal: screenPadding,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontFamily: fontFamily.headingDisplay, fontSize: fontSize.title, color: colors.white },
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
  targetBadge: { backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  targetBadgeText: { fontFamily: fontFamily.bodySemiBold, fontSize: 10, color: colors.darkGreen },
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
