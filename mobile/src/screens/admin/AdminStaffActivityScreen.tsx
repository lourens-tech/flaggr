import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { StaffRedemption } from '../../data/adminTypes';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminStaffActivity'>;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Who validated which reward, for whom, and when — any staff member can
// redeem any voucher (no per-till ownership, the same "anyone on the team"
// model the Support Centre inbox uses), so this is the only place a
// course_admin can see who actually did.
export function AdminStaffActivityScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDesktop = useIsDesktopNav();
  const { getStaffRedemptions } = useAdmin();
  const [redemptions, setRedemptions] = useState<StaffRedemption[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const rows = await getStaffRedemptions();
          if (!cancelled) setRedemptions(rows);
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

  const renderItem = ({ item }: { item: StaffRedemption }) => (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.rewardTitle}
          {item.variantLabel && item.variantLabel !== 'Standard' ? ` (${item.variantLabel})` : ''}
        </Text>
        <Text style={styles.cardCost}>{item.cost} FC</Text>
      </View>
      <Text style={styles.cardMeta} numberOfLines={1}>For {item.memberName}</Text>
      <Text style={styles.cardMeta} numberOfLines={1}>
        Redeemed by {item.staffName}
        {item.staffRole === 'course_admin' ? ' (you)' : ''}
      </Text>
      <Text style={styles.cardTime}>{formatDate(item.redeemedAt)} · {item.code}</Text>
    </View>
  );

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminStaffList" breadcrumb="Redemption Activity" showRail={false}>
        <Text style={styles.dPageTitle}>Redemption Activity</Text>
        <DesktopPanel title="All Redemptions">
          {loading ? (
            <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.md }} />
          ) : redemptions.length === 0 ? (
            <Text style={styles.emptyText}>No rewards have been redeemed at the till yet.</Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {redemptions.map((item) => (
                <React.Fragment key={item.code}>{renderItem({ item })}</React.Fragment>
              ))}
            </View>
          )}
        </DesktopPanel>
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Redemption Activity" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={redemptions}
          keyExtractor={(r) => r.code}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No rewards have been redeemed at the till yet.</Text>}
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
  cardCost: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.clubGreen },
  cardMeta: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  cardTime: { fontFamily: fontFamily.body, fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  dPageTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.textPrimary },
});
}
