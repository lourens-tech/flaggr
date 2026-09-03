import React, { useCallback, useState, useMemo } from 'react';
import { ActivityIndicator, FlatList, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { fontFamily, fontSize, radius, screenPadding, spacing, ticketStatusBadges } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { SupportTicketStatus, SupportTicketSummary } from '../../data/adminTypes';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminSupportTickets'>;

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

// A ticket to the Flagrr team itself — separate from the club's own
// Enquiries inbox (member <-> this club's admins).
export function AdminSupportTicketsScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDesktop = useIsDesktopNav();
  const { listSupportTickets } = useAdmin();
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const rows = await listSupportTickets();
          if (!cancelled) setTickets(rows);
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

  const renderItem = ({ item }: { item: SupportTicketSummary }) => {
    const badge = ticketStatusBadges(colors)[item.status];
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('AdminSupportTicketChat', { ticketId: item.id })}
        activeOpacity={0.8}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.rowTop}>
            <Text style={styles.subject} numberOfLines={1}>{item.subject}</Text>
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

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="" breadcrumb="Support Centre" showRail={false}>
        <View style={styles.dHeadRow}>
          <Text style={styles.dPageTitle}>Support Centre</Text>
          <TouchableOpacity style={styles.dAddButton} onPress={() => navigation.navigate('AdminSupportTicketCreate')}>
            <Ionicons name="add" size={16} color={colors.darkGreen} />
            <Text style={styles.dAddButtonText}>New Ticket</Text>
          </TouchableOpacity>
        </View>
        <DesktopPanel title="Your Tickets">
          {loading ? (
            <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.md }} />
          ) : tickets.length === 0 ? (
            <Text style={styles.emptyText}>No support tickets yet.</Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {tickets.map((item) => (
                <React.Fragment key={item.id}>{renderItem({ item })}</React.Fragment>
              ))}
            </View>
          )}
        </DesktopPanel>
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader
          title="Support Centre"
          onBack={() => navigation.goBack()}
          right={
            <TouchableOpacity
              onPress={() => navigation.navigate('AdminSupportTicketCreate')}
              hitSlop={8}
              accessibilityLabel="New Ticket"
              accessibilityRole="button"
            >
              <Ionicons name="add-circle" size={26} color={colors.white} />
            </TouchableOpacity>
          }
        />
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No support tickets yet — tap + to log one.</Text>}
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  listContent: { padding: screenPadding, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subject: { flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
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
  dHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dPageTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.textPrimary },
  dAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.lime,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dAddButtonText: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.darkGreen },
});
}
