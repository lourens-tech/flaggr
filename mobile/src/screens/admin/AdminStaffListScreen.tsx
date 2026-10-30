import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { useHover, hoverTransition } from '../../hooks/useHover';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { DesktopDataTable, TableAvatarCell, TableText, type DesktopTableColumn } from '../../components/admin/desktop/DesktopDataTable';
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
  type SegmentOption,
} from '../../components/admin/ui';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { AdminStaff } from '../../data/adminTypes';
import { adminFont, adminRadius, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminStaffList'>;

// react-native-web passes unknown style keys straight through to the DOM —
// this suppresses the browser's default focus ring on the search input,
// which isn't part of RN's typed style props (see DesktopShell's search box).
const webNoOutline = { outlineStyle: 'none' } as unknown as { outlineWidth: number };

// Staff, Club Admins and Activity read as one "Staff and Admins" page: each
// keeps its own route, and this segment (repeated on all three screens)
// swaps between them in place.
type StaffSection = 'AdminStaffList' | 'AdminClubAdmins' | 'AdminStaffActivity';
const STAFF_SECTIONS: SegmentOption<StaffSection>[] = [
  { key: 'AdminStaffList', label: 'Staff' },
  { key: 'AdminClubAdmins', label: 'Club Admins' },
  { key: 'AdminStaffActivity', label: 'Activity' },
];

type StatusFilter = 'all' | 'active' | 'revoked';

const FILTERS: Array<{ label: string; value: StatusFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Revoked', value: 'revoked' },
];

type IconActionTone = 'edit' | 'positive' | 'caution' | 'danger';

function IconAction({
  icon,
  tone,
  onPress,
  disabled,
  label,
  c,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: IconActionTone;
  onPress: () => void;
  disabled?: boolean;
  label: string;
  c: AdminColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const [hovered, hoverHandlers] = useHover();
  const toneColors: Record<IconActionTone, { bg: string; fg: string }> = {
    edit: { bg: c.fill, fg: c.ink },
    positive: { bg: c.posBg, fg: c.pos },
    caution: { bg: c.amberBg, fg: c.amber },
    danger: { bg: c.negBg, fg: c.neg },
  };
  const lit = hovered && !disabled;
  const t = toneColors[tone];
  return (
    <Pressable
      style={[styles.dIconBtn, hoverTransition, lit && { backgroundColor: t.bg }, disabled && styles.dIconBtnDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityRole="button"
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
    >
      <Ionicons name={icon} size={16} color={lit ? t.fg : c.ink2} />
    </Pressable>
  );
}

export function AdminStaffListScreen({ navigation }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { staff, loadStaff, revokeStaff, reactivateStaff, deleteStaff, course, reopenStaffOnboardingWizard } = useAdmin();
  const [loading, setLoading] = useState(true);
  // Load failures used to be swallowed silently; surface them with a retry.
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [searchFocused, setSearchFocused] = useState(false);

  const filterCounts = useMemo<Record<StatusFilter, number>>(
    () => ({
      all: staff.length,
      active: staff.filter((s) => !s.revoked).length,
      revoked: staff.filter((s) => s.revoked).length,
    }),
    [staff],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return staff.filter((s) => {
      if (filter === 'active' && s.revoked) return false;
      if (filter === 'revoked' && !s.revoked) return false;
      if (!query) return true;
      return (
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query) ||
        s.username.toLowerCase().includes(query)
      );
    });
  }, [staff, filter, search]);

  const load = useCallback(async (isCancelled: () => boolean = () => false) => {
    setLoading(true);
    setError(false);
    try {
      await loadStaff();
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
    if (key === 'AdminClubAdmins') navigation.replace('AdminClubAdmins');
    else if (key === 'AdminStaffActivity') navigation.replace('AdminStaffActivity');
  };

  const sectionSegment = (
    <Segmented
      options={STAFF_SECTIONS}
      value="AdminStaffList"
      onChange={goToSection}
      accessibilityLabel="Staff and Admins section"
      fullWidth={!isDesktop}
    />
  );

  const handleToggleAccess = (item: AdminStaff) => {
    const isRevoked = item.revoked;
    showAlert(
      isRevoked ? 'Reactivate access?' : 'Revoke access?',
      isRevoked
        ? `${item.firstName} ${item.lastName} will be able to log in again.`
        : `${item.firstName} ${item.lastName} will no longer be able to log in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isRevoked ? 'Reactivate' : 'Revoke',
          style: isRevoked ? 'default' : 'destructive',
          onPress: async () => {
            setBusyId(item.id);
            try {
              if (isRevoked) await reactivateStaff(item.id);
              else await revokeStaff(item.id);
            } catch (err) {
              const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
              showAlert('Couldn’t update access', message);
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const handleDelete = (item: AdminStaff) => {
    showAlert('Remove this staff member?', 'They will lose access immediately and their account will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusyId(item.id);
          try {
            await deleteStaff(item.id);
          } catch (err) {
            const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
            showAlert('Couldn’t remove staff member', message);
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item, index }: { item: AdminStaff; index: number }) => {
    const first = index === 0;
    const last = index === filtered.length - 1;
    return (
      <Pressable
        onPress={() => navigation.navigate('AdminStaffEdit', { staffId: item.id })}
        accessibilityRole="button"
        accessibilityLabel={`${item.firstName} ${item.lastName}, ${item.revoked ? 'Revoked' : 'Active'}`}
        style={({ pressed }) => [
          styles.mRow,
          { backgroundColor: pressed ? c.surface2 : c.surface },
          first && styles.mRowFirst,
          last && styles.mRowLast,
        ]}
      >
        <View style={[styles.mRowInner, !first && styles.mRowDivider]}>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.firstName} {item.lastName}</Text>
            <StatusPill label={item.revoked ? 'Revoked' : 'Active'} tone={item.revoked ? 'neg' : 'pos'} />
          </View>
          <Text style={styles.cardMeta} numberOfLines={1}>Username: {item.username}</Text>
          <Text style={styles.cardMeta} numberOfLines={1}>{item.email}</Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {item.redemptionCount} redemption{item.redemptionCount === 1 ? '' : 's'}
          </Text>
          {item.mustChangePassword ? <Text style={styles.pendingText}>Hasn't logged in yet</Text> : null}

          <View style={styles.cardActions}>
            <AdminButton
              label="Edit"
              icon="create-outline"
              variant="plain"
              onPress={() => navigation.navigate('AdminStaffEdit', { staffId: item.id })}
              disabled={busyId === item.id}
              style={styles.mActionBtn}
            />
            <AdminButton
              label={item.revoked ? 'Reactivate' : 'Revoke'}
              icon={item.revoked ? 'lock-open-outline' : 'lock-closed-outline'}
              variant="plain"
              onPress={() => handleToggleAccess(item)}
              disabled={busyId === item.id}
              loading={busyId === item.id}
              style={styles.mActionBtn}
            />
            <AdminButton
              label="Delete"
              icon="trash-outline"
              variant="danger"
              onPress={() => handleDelete(item)}
              disabled={busyId === item.id}
              style={styles.mActionBtn}
            />
          </View>
        </View>
      </Pressable>
    );
  };

  const onboardingBanner = course.staffOnboardingCompletedAt === null ? (
    <Pressable
      style={({ pressed }) => [styles.onboardingBanner, pressed && { opacity: 0.85 }]}
      onPress={reopenStaffOnboardingWizard}
      accessibilityRole="button"
    >
      <Ionicons name="people-outline" size={20} color={c.pos} />
      <Text style={styles.onboardingBannerText}>Invite your team</Text>
      <Ionicons name="chevron-forward" size={16} color={c.ink3} />
    </Pressable>
  ) : null;

  const filterSegment = (
    <Segmented
      options={FILTERS.map((f) => ({ key: f.value, label: f.label, count: filterCounts[f.value] }))}
      value={filter}
      onChange={setFilter}
      accessibilityLabel="Status filter"
    />
  );

  const desktopToolbar = (
    <View style={styles.dToolbar}>
      <View style={[styles.dSearchBox, hoverTransition, searchFocused && styles.dSearchBoxFocused]}>
        <Ionicons name="search" size={15} color={searchFocused ? c.ink : c.ink3} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search by name, username or email"
          placeholderTextColor={c.ink3}
          style={[styles.dSearchInput, webNoOutline]}
        />
      </View>
      {filterSegment}
    </View>
  );

  if (isDesktop) {
    const columns: DesktopTableColumn<AdminStaff>[] = [
      {
        key: 'name',
        label: 'Name',
        width: 250,
        render: (item) => <TableAvatarCell name={`${item.firstName} ${item.lastName}`} subtitle={item.username} />,
        sortValue: (item) => `${item.firstName} ${item.lastName}`.toLowerCase(),
      },
      {
        key: 'email',
        label: 'Email',
        width: 230,
        render: (item) => <TableText muted>{item.email}</TableText>,
        sortValue: (item) => item.email.toLowerCase(),
      },
      {
        key: 'redemptions',
        label: 'Redemptions',
        width: 170,
        render: (item) => (
          <View style={styles.dMetaCell}>
            <TableText>
              {item.redemptionCount} redemption{item.redemptionCount === 1 ? '' : 's'}
            </TableText>
            {item.mustChangePassword ? <StatusPill label="Never logged in" tone="amber" /> : null}
          </View>
        ),
        sortValue: (item) => item.redemptionCount,
      },
      {
        key: 'status',
        label: 'Status',
        width: 100,
        render: (item) => <StatusPill label={item.revoked ? 'Revoked' : 'Active'} tone={item.revoked ? 'neg' : 'pos'} />,
        sortValue: (item) => (item.revoked ? 1 : 0),
      },
      {
        key: 'actions',
        label: '',
        width: 120,
        align: 'right',
        render: (item) => {
          const busy = busyId === item.id;
          return (
            <View style={styles.dRowActions}>
              <IconAction
                icon="create-outline"
                tone="edit"
                label={`Edit ${item.firstName} ${item.lastName}`}
                onPress={() => navigation.navigate('AdminStaffEdit', { staffId: item.id })}
                disabled={busy}
                c={c}
                styles={styles}
              />
              {busy ? (
                <View style={styles.dIconBtn}>
                  <ActivityIndicator color={c.ink2} size="small" />
                </View>
              ) : (
                <IconAction
                  icon={item.revoked ? 'lock-open-outline' : 'lock-closed-outline'}
                  tone={item.revoked ? 'positive' : 'caution'}
                  label={item.revoked ? `Reactivate ${item.firstName} ${item.lastName}` : `Revoke ${item.firstName} ${item.lastName}`}
                  onPress={() => handleToggleAccess(item)}
                  c={c}
                  styles={styles}
                />
              )}
              <IconAction
                icon="trash-outline"
                tone="danger"
                label={`Delete ${item.firstName} ${item.lastName}`}
                onPress={() => handleDelete(item)}
                disabled={busy}
                c={c}
                styles={styles}
              />
            </View>
          );
        },
      },
    ];

    return (
      <AdminDesktopFrame activeKey="AdminStaffList" breadcrumb="Staff and Admins" scrollable={false}>
        <View style={styles.dHead}>
          <View style={styles.dTopBar}>
            {sectionSegment}
            <View style={{ flex: 1 }} />
            <AdminButton label="Add Staff" icon="add" variant="accent" onPress={() => navigation.navigate('AdminStaffEdit', undefined)} />
          </View>
          <PageTitle>Staff and Admins</PageTitle>
        </View>
        {onboardingBanner}
        <Tile padded={false} style={styles.dTableTile}>
          {desktopToolbar}
          {error ? (
            <View style={styles.dPad}>
              <ErrorState onRetry={() => load()} />
            </View>
          ) : loading ? (
            <View style={styles.dPad}>
              <SkeletonRows rows={5} />
            </View>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title={staff.length === 0 ? 'No staff members yet.' : 'No staff match your search.'}
            />
          ) : (
            <DesktopDataTable columns={columns} rows={filtered} keyExtractor={(item) => item.id} />
          )}
        </Tile>
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader
        title="Staff"
        onBack={() => navigation.goBack()}
        right={
          <CircleButton
            icon="add"
            accessibilityLabel="Add Staff Member"
            onPress={() => navigation.navigate('AdminStaffEdit', undefined)}
          />
        }
      />

      <View style={styles.searchArea}>
        {sectionSegment}
        <TextField placeholder="Search staff" variant="onLight" icon="search" value={search} onChangeText={setSearch} />
        {filterSegment}
        {onboardingBanner}
      </View>

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
          data={filtered}
          keyExtractor={(s) => s.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Tile>
              <EmptyState
                icon="people-outline"
                title={staff.length === 0 ? 'No staff members yet — tap + to add one.' : 'No staff match your search.'}
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
    searchArea: { paddingHorizontal: 16, gap: 12 },
    onboardingBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.posBg,
      borderRadius: adminRadius.md,
      paddingHorizontal: 16,
      minHeight: 52,
    },
    onboardingBannerText: { flex: 1, ...adminFont.bodyBold, fontSize: 15, color: c.ink },
    listContent: { padding: 16, paddingBottom: 32 },
    mRow: {
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: c.edge,
      paddingLeft: 16,
    },
    mRowFirst: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: adminRadius.md, borderTopRightRadius: adminRadius.md },
    mRowLast: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: adminRadius.md, borderBottomRightRadius: adminRadius.md },
    mRowInner: { paddingVertical: 12, paddingRight: 16, gap: 3, minHeight: 52 },
    mRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 },
    cardTitle: { flex: 1, ...adminFont.bodyBold, fontSize: 15, color: c.ink },
    cardMeta: { ...adminFont.body, fontSize: 13, color: c.ink2 },
    pendingText: { ...adminFont.body, fontSize: 12.5, color: c.amber, fontStyle: 'italic' },
    cardActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6, marginLeft: -6 },
    mActionBtn: { height: 44 },
    // Desktop
    dHead: { gap: 14 },
    dTopBar: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    dTableTile: { flex: 1, minHeight: 0, overflow: 'hidden' },
    dPad: { padding: 18 },
    dToolbar: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: 14 },
    dSearchBox: {
      flex: 1,
      minWidth: 220,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      height: 40,
      backgroundColor: c.fill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.edge,
      borderRadius: adminRadius.pill,
      paddingHorizontal: 14,
    },
    dSearchBoxFocused: { borderColor: c.focus, borderWidth: 1.5 },
    dSearchInput: { flex: 1, ...adminFont.body, fontSize: 14, color: c.ink, padding: 0 },
    dMetaCell: { gap: 5 },
    dRowActions: { flexDirection: 'row', gap: 4, flexShrink: 0 },
    dIconBtn: { width: 34, height: 34, borderRadius: adminRadius.pill, alignItems: 'center', justifyContent: 'center' },
    dIconBtnDisabled: { opacity: 0.4 },
  });
}
