import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { useHover, hoverTransition } from '../../hooks/useHover';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { TableAvatarCell, TableTag } from '../../components/admin/desktop/DesktopDataTable';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { AdminStaff } from '../../data/adminTypes';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminStaffList'>;

// react-native-web passes unknown style keys straight through to the DOM —
// this suppresses the browser's default focus ring on the search input,
// which isn't part of RN's typed style props (see DesktopShell's search box).
const webNoOutline = { outlineStyle: 'none' } as unknown as { outlineWidth: number };

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
  colors,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: IconActionTone;
  onPress: () => void;
  disabled?: boolean;
  label: string;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const [hovered, hoverHandlers] = useHover();
  const toneColors: Record<IconActionTone, { bg: string; fg: string }> = {
    edit: { bg: colors.mintBgAlt, fg: colors.clubGreen },
    positive: { bg: colors.mintBgAlt, fg: colors.clubGreen },
    caution: { bg: colors.warningBg, fg: colors.warning },
    danger: { bg: colors.dangerBg, fg: colors.negative },
  };
  const lit = hovered && !disabled;
  const t = toneColors[tone];
  return (
    <TouchableOpacity
      style={[styles.dIconBtn, hoverTransition, lit && { backgroundColor: t.bg }, disabled && styles.dIconBtnDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityRole="button"
      {...hoverHandlers}
    >
      <Ionicons name={icon} size={16} color={lit ? t.fg : colors.textMuted} />
    </TouchableOpacity>
  );
}

// Desktop-only row — avatar + name/username, email, meta chips (redemption
// count, "never logged in"), a status pill, and icon-button actions. Mobile
// keeps its own full-bleed card (renderItem below) untouched.
function DesktopStaffRow({
  item,
  isLast,
  busy,
  onEdit,
  onToggleAccess,
  onDelete,
  colors,
  styles,
}: {
  item: AdminStaff;
  isLast: boolean;
  busy: boolean;
  onEdit: () => void;
  onToggleAccess: () => void;
  onDelete: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const [hovered, hoverHandlers] = useHover();
  return (
    <View style={[styles.dRow, hoverTransition, hovered && styles.dRowHover, isLast && styles.dRowLast]} {...hoverHandlers}>
      <View style={{ flex: 1.3, minWidth: 0 }}>
        <TableAvatarCell name={`${item.firstName} ${item.lastName}`} subtitle={item.username} />
      </View>
      <Text style={styles.dRowEmail} numberOfLines={1}>{item.email}</Text>
      <View style={styles.dRowMeta}>
        <View style={styles.dMetaChip}>
          <Ionicons name="swap-horizontal-outline" size={13} color={colors.textMuted} />
          <Text style={styles.dMetaChipText}>
            <Text style={styles.dMetaChipNum}>{item.redemptionCount}</Text> redemption{item.redemptionCount === 1 ? '' : 's'}
          </Text>
        </View>
        {item.mustChangePassword ? (
          <View style={styles.dMetaChipWarn}>
            <Ionicons name="time-outline" size={12} color={colors.warning} />
            <Text style={styles.dMetaChipWarnText}>Never logged in</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.dRowStatus}>
        <TableTag label={item.revoked ? 'Revoked' : 'Active'} tone={item.revoked ? 'red' : 'green'} />
      </View>
      <View style={styles.dRowActions}>
        <IconAction
          icon="create-outline"
          tone="edit"
          label={`Edit ${item.firstName} ${item.lastName}`}
          onPress={onEdit}
          disabled={busy}
          colors={colors}
          styles={styles}
        />
        {busy ? (
          <View style={styles.dIconBtn}>
            <ActivityIndicator color={colors.clubGreen} size="small" />
          </View>
        ) : (
          <IconAction
            icon={item.revoked ? 'lock-open-outline' : 'lock-closed-outline'}
            tone={item.revoked ? 'positive' : 'caution'}
            label={item.revoked ? `Reactivate ${item.firstName} ${item.lastName}` : `Revoke ${item.firstName} ${item.lastName}`}
            onPress={onToggleAccess}
            colors={colors}
            styles={styles}
          />
        )}
        <IconAction
          icon="trash-outline"
          tone="danger"
          label={`Delete ${item.firstName} ${item.lastName}`}
          onPress={onDelete}
          disabled={busy}
          colors={colors}
          styles={styles}
        />
      </View>
    </View>
  );
}

export function AdminStaffListScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDesktop = useIsDesktopNav();
  const { staff, loadStaff, revokeStaff, reactivateStaff, deleteStaff, course, reopenStaffOnboardingWizard } = useAdmin();
  const [loading, setLoading] = useState(true);
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

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          await loadStaff();
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

  const renderItem = ({ item }: { item: AdminStaff }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('AdminStaffEdit', { staffId: item.id })}
    >
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.firstName} {item.lastName}</Text>
        <View style={[styles.statusBadge, item.revoked && styles.statusBadgeRevoked]}>
          <Text style={[styles.statusBadgeText, item.revoked && styles.statusBadgeTextRevoked]}>
            {item.revoked ? 'Revoked' : 'Active'}
          </Text>
        </View>
      </View>
      <Text style={styles.cardEmail} numberOfLines={1}>Username: {item.username}</Text>
      <Text style={styles.cardEmail} numberOfLines={1}>{item.email}</Text>
      <Text style={styles.cardEmail} numberOfLines={1}>
        {item.redemptionCount} redemption{item.redemptionCount === 1 ? '' : 's'}
      </Text>
      {item.mustChangePassword ? <Text style={styles.pendingText}>Hasn't logged in yet</Text> : null}

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('AdminStaffEdit', { staffId: item.id })}
          disabled={busyId === item.id}
        >
          <Ionicons name="create-outline" size={15} color={colors.clubGreen} />
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleToggleAccess(item)} disabled={busyId === item.id}>
          {busyId === item.id ? (
            <ActivityIndicator color={colors.clubGreen} size="small" />
          ) : (
            <>
              <Ionicons name={item.revoked ? 'lock-open-outline' : 'lock-closed-outline'} size={15} color={colors.clubGreen} />
              <Text style={styles.actionButtonText}>{item.revoked ? 'Reactivate' : 'Revoke'}</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item)} disabled={busyId === item.id}>
          <Ionicons name="trash-outline" size={15} color={colors.negative} />
          <Text style={[styles.actionButtonText, { color: colors.negative }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const onboardingBanner = course.staffOnboardingCompletedAt === null ? (
    <TouchableOpacity style={styles.onboardingBanner} onPress={reopenStaffOnboardingWizard} activeOpacity={0.85}>
      <Ionicons name="people-outline" size={18} color={colors.darkGreen} />
      <Text style={styles.onboardingBannerText}>Invite your team</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.darkGreen} />
    </TouchableOpacity>
  ) : null;

  const searchAndFilters = (
    <View style={styles.searchArea}>
      <TextField placeholder="Search staff" variant="onLight" icon="search" value={search} onChangeText={setSearch} />
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
  );

  const desktopToolbar = (
    <View style={styles.dToolbar}>
      <View style={[styles.dSearchBox, hoverTransition, searchFocused && styles.dSearchBoxFocused]}>
        <Ionicons name="search" size={15} color={searchFocused ? colors.clubGreen : colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search by name, username or email"
          placeholderTextColor={colors.textMuted}
          style={[styles.dSearchInput, webNoOutline]}
        />
      </View>
      <View style={styles.dFilterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <TouchableOpacity
              key={f.value}
              onPress={() => setFilter(f.value)}
              style={[styles.dFilterPill, active && styles.dFilterPillActive]}
              accessibilityLabel={`Filter ${f.label}`}
              accessibilityRole="button"
            >
              <Text style={[styles.dFilterText, active && styles.dFilterTextActive]}>{f.label}</Text>
              <Text style={[styles.dFilterCount, active && styles.dFilterCountActive]}>{filterCounts[f.value]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminStaffList" breadcrumb="Staff and Club Admins">
        <View style={styles.dHeadRow}>
          <Text style={styles.dPageTitle}>Staff and Club Admins</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity style={styles.dSecondaryButton} onPress={() => navigation.navigate('AdminClubAdmins')}>
              <Ionicons name="person-add-outline" size={15} color={colors.textPrimary} />
              <Text style={styles.dSecondaryButtonText}>Club Admins</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dSecondaryButton} onPress={() => navigation.navigate('AdminStaffActivity')}>
              <Ionicons name="time-outline" size={15} color={colors.textPrimary} />
              <Text style={styles.dSecondaryButtonText}>Activity</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dAddButton} onPress={() => navigation.navigate('AdminStaffEdit', undefined)}>
              <Ionicons name="add" size={16} color={colors.darkGreen} />
              <Text style={styles.dAddButtonText}>Add Staff</Text>
            </TouchableOpacity>
          </View>
        </View>
        {onboardingBanner}
        <DesktopPanel title="Staff Members">
          {desktopToolbar}
          {loading ? (
            <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.md }} />
          ) : filtered.length === 0 ? (
            <Text style={styles.emptyText}>{staff.length === 0 ? 'No staff members yet.' : 'No staff match your search.'}</Text>
          ) : (
            <View style={styles.dRows}>
              {filtered.map((item, i) => (
                <DesktopStaffRow
                  key={item.id}
                  item={item}
                  isLast={i === filtered.length - 1}
                  busy={busyId === item.id}
                  onEdit={() => navigation.navigate('AdminStaffEdit', { staffId: item.id })}
                  onToggleAccess={() => handleToggleAccess(item)}
                  onDelete={() => handleDelete(item)}
                  colors={colors}
                  styles={styles}
                />
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
        <ScreenHeader
          title="Staff"
          onBack={() => navigation.goBack()}
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <TouchableOpacity
                onPress={() => navigation.navigate('AdminStaffActivity')}
                hitSlop={8}
                accessibilityLabel="Redemption Activity"
                accessibilityRole="button"
              >
                <Ionicons name="time-outline" size={24} color={colors.white} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('AdminStaffEdit', undefined)}
                hitSlop={8}
                accessibilityLabel="Add Staff Member"
                accessibilityRole="button"
              >
                <Ionicons name="add-circle" size={26} color={colors.white} />
              </TouchableOpacity>
            </View>
          }
        />
      </SafeAreaView>

      {searchAndFilters}
      {onboardingBanner}

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {staff.length === 0 ? 'No staff members yet — tap + to add one.' : 'No staff match your search.'}
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
  searchArea: { paddingHorizontal: screenPadding, paddingTop: spacing.md, gap: spacing.sm },
  onboardingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.mintBg,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    marginHorizontal: screenPadding,
    marginTop: spacing.md,
  },
  onboardingBannerText: { flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.darkGreen },
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
  statusBadge: { backgroundColor: colors.background, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  statusBadgeRevoked: { backgroundColor: colors.dangerBg },
  statusBadgeText: { fontFamily: fontFamily.bodySemiBold, fontSize: 10, color: colors.textPrimary },
  statusBadgeTextRevoked: { color: colors.negative },
  cardEmail: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  pendingText: { fontFamily: fontFamily.body, fontSize: 10, color: colors.textSecondary, fontStyle: 'italic' },
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
  dHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  dPageTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.textPrimary },
  dSecondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  dSecondaryButtonText: { fontFamily: fontFamily.bodySemiBold, fontSize: 12.5, color: colors.textPrimary },
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
  dToolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  dSearchBox: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dSearchBoxFocused: { borderColor: colors.clubGreen, backgroundColor: colors.surface },
  dSearchInput: { flex: 1, fontFamily: fontFamily.body, fontSize: 13, color: colors.textPrimary, padding: 0 },
  dFilterRow: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.mintBgAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    padding: 3,
  },
  dFilterPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 7, borderRadius: radius.pill },
  dFilterPillActive: { backgroundColor: colors.darkGreen },
  dFilterText: { fontFamily: fontFamily.bodySemiBold, fontSize: 12, color: colors.textSecondary },
  dFilterTextActive: { color: colors.white },
  dFilterCount: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10.5,
    color: colors.textSecondary,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 99,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  dFilterCountActive: { color: colors.white, backgroundColor: 'rgba(255,255,255,0.18)' },
  dRows: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm },
  dRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dRowHover: { backgroundColor: colors.mintBgAlt },
  dRowLast: { borderBottomWidth: 0 },
  dRowEmail: { flex: 1.4, minWidth: 0, fontFamily: fontFamily.body, fontSize: 12.5, color: colors.textSecondary },
  dRowMeta: { flex: 1.1, gap: 5, minWidth: 130 },
  dMetaChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dMetaChipText: { fontFamily: fontFamily.body, fontSize: 11.5, color: colors.textSecondary },
  dMetaChipNum: { fontFamily: fontFamily.bodySemiBold, color: colors.textPrimary },
  dMetaChipWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.warningBg,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  dMetaChipWarnText: { fontFamily: fontFamily.bodyMedium, fontSize: 11, color: colors.warning },
  dRowStatus: { width: 84 },
  dRowActions: { flexDirection: 'row', gap: 4, flexShrink: 0 },
  dIconBtn: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  dIconBtnDisabled: { opacity: 0.4 },
});
}
