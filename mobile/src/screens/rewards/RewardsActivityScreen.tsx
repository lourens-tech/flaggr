import React, { useMemo } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { HeaderAvatar } from '../../components/common/HeaderAvatar';
import { showAlert } from '../../utils/alert';
import { colors, fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import type { ActivityEntry } from '../../data/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Activity'>,
  NativeStackScreenProps<RootStackParamList>
>;

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

function formatTime(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function RewardsActivityScreen({ navigation }: Props) {
  const { activity, vouchers, unreadNotificationCount } = useApp();

  const handleEntryPress = (entry: ActivityEntry) => {
    if (entry.type !== 'redeem' || !entry.voucherId) return;
    const voucher = vouchers.find((v) => v.id === entry.voucherId);
    if (!voucher) {
      showAlert('Voucher not found', 'We couldn’t find this voucher’s details.');
      return;
    }
    if (voucher.status === 'active') {
      navigation.navigate('Voucher', { voucherId: voucher.id });
      return;
    }
    const label = voucher.variantLabel && voucher.variantLabel !== 'Standard' ? ` — ${voucher.variantLabel}` : '';
    showAlert(
      voucher.status === 'expired' ? 'Voucher expired' : 'Already redeemed',
      voucher.status === 'expired'
        ? `${voucher.rewardTitle}${label} has expired.`
        : `${voucher.rewardTitle}${label} has already been scanned and redeemed at the club.`,
    );
  };

  const grouped = useMemo(() => {
    const groups: Record<string, ActivityEntry[]> = {};
    for (const entry of activity) {
      const label = groupLabel(entry.date);
      groups[label] = groups[label] ?? [];
      groups[label].push(entry);
    }
    const order = ['Today', 'Yesterday', 'This Week', 'Earlier'];
    return order.filter((label) => groups[label]?.length).map((label) => ({ label, entries: groups[label] }));
  }, [activity]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Reward Activity</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name="notifications" size={20} color={colors.white} />
              {unreadNotificationCount > 0 ? <View style={styles.badge} /> : null}
            </TouchableOpacity>
            <HeaderAvatar size={30} />
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {grouped.length === 0 ? (
          <Text style={styles.emptyText}>No activity yet — play a round or scan a receipt to get started.</Text>
        ) : null}

        {grouped.map((group) => (
          <View key={group.label} style={{ marginBottom: spacing.lg }}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            <View style={styles.card}>
              {group.entries.map((entry, i) => {
                const isEarn = entry.type === 'earn';
                const isTappable = entry.type === 'redeem' && !!entry.voucherId;
                return (
                  <TouchableOpacity
                    key={entry.id}
                    activeOpacity={isTappable ? 0.7 : 1}
                    disabled={!isTappable}
                    onPress={() => handleEntryPress(entry)}
                    style={[styles.row, i !== group.entries.length - 1 && styles.rowDivider]}
                  >
                    <View style={styles.rowIcon}>
                      <Ionicons
                        name={isEarn ? 'add-circle' : 'checkmark-done-circle'}
                        size={20}
                        color={colors.clubGreen}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{entry.title}</Text>
                      <Text style={styles.rowSubtitle}>
                        {isEarn ? 'Earned' : 'Redeemed'} · {formatTime(entry.date)}
                      </Text>
                    </View>
                    <Text style={[styles.rowAmount, { color: isEarn ? colors.clubGreen : colors.textPrimary }]}>
                      {isEarn ? '+' : ''}
                      {entry.amount} FC
                    </Text>
                    {isTappable ? (
                      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  header: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
  },
  headerTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.white },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: { position: 'absolute', top: -2, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime },
  content: { padding: screenPadding },
  emptyText: { fontFamily: fontFamily.body, fontSize: fontSize.small, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
  groupLabel: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.textPrimary, marginBottom: spacing.sm },
  card: { backgroundColor: colors.mintBgAlt, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm + 4, gap: spacing.sm },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(31,66,52,0.08)' },
  rowIcon: { width: 24, alignItems: 'center' },
  rowTitle: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.small, color: colors.textPrimary },
  rowSubtitle: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 2 },
  rowAmount: { fontFamily: fontFamily.heading, fontSize: fontSize.label },
});
