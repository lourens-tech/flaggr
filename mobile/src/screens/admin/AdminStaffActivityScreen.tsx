import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { EmptyState, ErrorState, PageTitle, Segmented, SkeletonRows, Tile, type SegmentOption } from '../../components/admin/ui';
import { useAdminTheme } from '../../context/ThemeContext';
import type { StaffRedemption } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminStaffActivity'>;

// Staff, Club Admins and Activity read as one "Staff and Admins" page: each
// keeps its own route, and this segment (repeated on all three screens)
// swaps between them in place.
type StaffSection = 'AdminStaffList' | 'AdminClubAdmins' | 'AdminStaffActivity';
const STAFF_SECTIONS: SegmentOption<StaffSection>[] = [
  { key: 'AdminStaffList', label: 'Staff' },
  { key: 'AdminClubAdmins', label: 'Club Admins' },
  { key: 'AdminStaffActivity', label: 'Activity' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Who validated which reward, for whom, and when — any staff member can
// redeem any voucher (no per-till ownership, the same "anyone on the team"
// model the Support Centre inbox uses), so this is the only place a
// course_admin can see who actually did.
export function AdminStaffActivityScreen({ navigation }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { getStaffRedemptions } = useAdmin();
  const [redemptions, setRedemptions] = useState<StaffRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  // Load failures used to be swallowed silently; surface them with a retry.
  const [error, setError] = useState(false);

  const load = useCallback(async (isCancelled: () => boolean = () => false) => {
    setLoading(true);
    setError(false);
    try {
      const rows = await getStaffRedemptions();
      if (!isCancelled()) setRedemptions(rows);
    } catch {
      if (!isCancelled()) setError(true);
    } finally {
      if (!isCancelled()) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load(() => cancelled);
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const goToSection = (key: StaffSection) => {
    if (key === 'AdminStaffList') navigation.replace('AdminStaffList');
    else if (key === 'AdminClubAdmins') navigation.replace('AdminClubAdmins');
  };

  const sectionSegment = (
    <Segmented
      options={STAFF_SECTIONS}
      value="AdminStaffActivity"
      onChange={goToSection}
      accessibilityLabel="Staff and Admins section"
      fullWidth={!isDesktop}
    />
  );

  const renderBody = (item: StaffRedemption) => (
    <>
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
    </>
  );

  const emptyState = <EmptyState icon="qr-code-outline" title="No rewards have been redeemed at the till yet." />;

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminStaffList" breadcrumb="Staff and Admins" showRail={false}>
        <View style={styles.dHead}>
          <View style={styles.dTopBar}>{sectionSegment}</View>
          <PageTitle>Staff and Admins</PageTitle>
        </View>
        {error ? (
          <ErrorState onRetry={() => load()} />
        ) : loading ? (
          <Tile>
            <SkeletonRows rows={5} />
          </Tile>
        ) : redemptions.length === 0 ? (
          <Tile>{emptyState}</Tile>
        ) : (
          <View style={styles.dGrid}>
            {redemptions.map((item) => (
              <Tile key={item.code} style={styles.dCard}>
                {renderBody(item)}
              </Tile>
            ))}
          </View>
        )}
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="Redemption Activity" onBack={() => navigation.goBack()} />

      <View style={styles.segmentArea}>{sectionSegment}</View>

      {error ? (
        <View style={styles.listContent}>
          <ErrorState onRetry={() => load()} />
        </View>
      ) : loading ? (
        <View style={styles.listContent}>
          <Tile>
            <SkeletonRows rows={4} />
          </Tile>
        </View>
      ) : (
        <FlatList
          data={redemptions}
          keyExtractor={(r) => r.code}
          renderItem={({ item, index }) => (
            <View
              style={[
                styles.mRow,
                index === 0 && styles.mRowFirst,
                index === redemptions.length - 1 && styles.mRowLast,
              ]}
            >
              <View style={[styles.mRowInner, index > 0 && styles.mRowDivider]}>{renderBody(item)}</View>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Tile>{emptyState}</Tile>}
        />
      )}
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
    segmentArea: { paddingHorizontal: 16 },
    listContent: { padding: 16, paddingBottom: 32 },
    mRow: {
      backgroundColor: c.surface,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: c.edge,
      paddingLeft: 16,
    },
    mRowFirst: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: adminRadius.md, borderTopRightRadius: adminRadius.md },
    mRowLast: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: adminRadius.md, borderBottomRightRadius: adminRadius.md },
    mRowInner: { paddingVertical: 12, paddingRight: 16, gap: 3, minHeight: 52 },
    mRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 2 },
    cardTitle: { flex: 1, ...adminFont.bodyBold, fontSize: 15, color: c.ink },
    cardCost: { ...adminFont.bodyBold, ...tabularNums, fontSize: 14, color: c.accentText },
    cardMeta: { ...adminFont.body, fontSize: 13, color: c.ink2 },
    cardTime: { ...adminFont.bodyMedium, ...tabularNums, fontSize: 12, color: c.ink3, marginTop: 4 },
    dHead: { gap: 14 },
    dTopBar: { flexDirection: 'row', alignItems: 'center' },
    dGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    dCard: { flexGrow: 1, flexBasis: 300, gap: 3, paddingVertical: 16 },
  });
}
