import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useApp } from '../../context/AppContext';
import { colors, fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import type { EnquiryStatus, MyEnquirySummary } from '../../data/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MyEnquiries'>;

const STATUS_BADGE: Record<EnquiryStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: 'Pending', bg: '#FDE9C8', fg: '#8A5A00' },
  in_progress: { label: 'Chat in Progress', bg: '#CCF2E6', fg: colors.clubGreen },
  resolved: { label: 'Resolved', bg: '#E5E7EB', fg: colors.textSecondary },
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function MyEnquiriesScreen({ navigation }: Props) {
  const { listMyEnquiries } = useApp();
  const [enquiries, setEnquiries] = useState<MyEnquirySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const rows = await listMyEnquiries();
          if (!cancelled) setEnquiries(rows);
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

  const renderItem = ({ item }: { item: MyEnquirySummary }) => {
    const badge = STATUS_BADGE[item.status];
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('EnquiryChat', { enquiryId: item.id })}
        activeOpacity={0.8}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.rowTop}>
            <Text style={styles.enquiryType}>{item.enquiryType}</Text>
            {item.hasUnread ? <View style={styles.unreadDot} /> : null}
          </View>
          <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage ?? '—'}</Text>
          <Text style={styles.meta}>{relativeTime(item.updatedAt)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="My Enquiries" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={enquiries}
          keyExtractor={(e) => e.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>You haven't sent any enquiries yet.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  listContent: { padding: screenPadding, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  enquiryType: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.negative },
  lastMessage: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 2 },
  meta: { fontFamily: fontFamily.body, fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontFamily: fontFamily.bodySemiBold, fontSize: 9 },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
