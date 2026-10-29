import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { DesktopDataTable, TableAvatarCell, type DesktopTableColumn } from '../../components/admin/desktop/DesktopDataTable';
import { AdminButton, CircleButton, EmptyState, ErrorState, Muted, PageTitle, SkeletonRows, StatusPill, Tile } from '../../components/admin/ui';
import { useHover, hoverTransition } from '../../hooks/useHover';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { CourseAdminAccount } from '../../data/adminTypes';
import { adminFont, adminRadius, type AdminColors } from '../../theme/admin';

function clubInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Compact text action for an admin row (Reset Password / Revoke / Delete).
function RowAction({
  icon,
  label,
  onPress,
  disabled,
  danger,
  busy,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  busy?: boolean;
}) {
  const { c } = useAdminTheme();
  const [hovered, hoverHandlers] = useHover();
  const fg = danger ? c.neg : c.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
      style={[
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 36, minWidth: 44, paddingHorizontal: 12, borderRadius: adminRadius.pill, backgroundColor: danger ? c.negBg : c.fill },
        hoverTransition,
        hovered && !disabled && { opacity: 0.85 },
        disabled && !busy && { opacity: 0.45 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={c.ink2} size="small" />
      ) : (
        <>
          <Ionicons name={icon} size={15} color={fg} />
          <Text style={{ ...adminFont.bodySemiBold, fontSize: 13, color: fg }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminCourseAdmins'>;

// Same shape as SuperAdminAgentsScreen (support agents), just scoped to one
// club's course_admin accounts instead of every platform-wide support agent —
// lets a super_admin add a second admin, reset a password, or revoke/
// reactivate/delete access without touching the database directly.
export function SuperAdminCourseAdminsScreen({ navigation, route }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { courseId, courseName } = route.params;
  const {
    getSuperAdminCourseAdmins,
    resetSuperAdminCourseAdminPassword,
    revokeSuperAdminCourseAdmin,
    reactivateSuperAdminCourseAdmin,
    deleteSuperAdminCourseAdmin,
  } = useAdmin();
  const [admins, setAdmins] = useState<CourseAdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setAdmins(await getSuperAdminCourseAdmins(courseId));
    } catch (err) {
      setLoadError(true);
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t load admins', message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!cancelled) await load();
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId]),
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return admins;
    return admins.filter(
      (a) => `${a.firstName} ${a.lastName}`.toLowerCase().includes(query) || a.email.toLowerCase().includes(query),
    );
  }, [admins, search]);

  const handleResetPassword = (item: CourseAdminAccount) => {
    showAlert(
      'Reset this password?',
      `A new temporary password will be emailed to ${item.email}, and they'll be asked to choose their own on next login.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            setBusyId(item.id);
            try {
              await resetSuperAdminCourseAdminPassword(item.id);
              await load();
              showAlert('Password reset', `A new temporary password has been emailed to ${item.email}.`);
            } catch (err) {
              const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
              showAlert('Couldn’t reset password', message);
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const handleToggleAccess = (item: CourseAdminAccount) => {
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
              if (isRevoked) await reactivateSuperAdminCourseAdmin(item.id);
              else await revokeSuperAdminCourseAdmin(item.id);
              await load();
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

  const handleDelete = (item: CourseAdminAccount) => {
    showAlert('Remove this admin?', 'They will lose access immediately and their account will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusyId(item.id);
          try {
            await deleteSuperAdminCourseAdmin(item.id);
            setAdmins((prev) => prev.filter((a) => a.id !== item.id));
          } catch (err) {
            const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
            showAlert('Couldn’t remove admin', message);
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const actionsFor = (item: CourseAdminAccount) => (
    <View style={styles.actions}>
      <RowAction icon="key-outline" label="Reset Password" onPress={() => handleResetPassword(item)} disabled={busyId === item.id} />
      <RowAction
        icon={item.revoked ? 'lock-open-outline' : 'lock-closed-outline'}
        label={item.revoked ? 'Reactivate' : 'Revoke'}
        onPress={() => handleToggleAccess(item)}
        disabled={busyId === item.id}
        busy={busyId === item.id}
      />
      <RowAction icon="trash-outline" label="Delete" danger onPress={() => handleDelete(item)} disabled={busyId === item.id} />
    </View>
  );

  const statusFor = (item: CourseAdminAccount) => (
    <View style={styles.statusCell}>
      <StatusPill label={item.revoked ? 'Revoked' : 'Active'} tone={item.revoked ? 'neg' : 'pos'} />
      {item.mustChangePassword ? <StatusPill label="Hasn't logged in yet" tone="neutral" /> : null}
    </View>
  );

  const searchField = <TextField placeholder="Search admins" variant="onLight" icon="search" value={search} onChangeText={setSearch} />;

  const stateBlock = (emptyText: string) =>
    loadError ? (
      <ErrorState onRetry={load} />
    ) : loading ? (
      <Tile>
        <SkeletonRows rows={3} />
      </Tile>
    ) : filtered.length === 0 ? (
      <Tile padded={false}>
        <EmptyState icon={admins.length === 0 ? 'people-outline' : 'search-outline'} title={admins.length === 0 ? emptyText : 'No admins match your search.'} />
      </Tile>
    ) : null;

  if (isDesktop) {
    const columns: DesktopTableColumn<CourseAdminAccount>[] = [
      {
        key: 'admin',
        label: 'Admin',
        width: 300,
        sortValue: (row) => `${row.firstName} ${row.lastName}`.toLowerCase(),
        render: (row) => <TableAvatarCell name={`${row.firstName} ${row.lastName}`} subtitle={row.email} />,
      },
      {
        key: 'status',
        label: 'Status',
        width: 240,
        sortValue: (row) => (row.revoked ? 1 : 0),
        render: statusFor,
      },
      { key: 'actions', label: '', width: 380, align: 'right', render: actionsFor },
    ];

    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminCourses" breadcrumb={`Courses › ${courseName} › Course Admins`}>
        <View style={styles.dHeadRow}>
          <View style={styles.crest}>
            <Text style={styles.crestText}>{clubInitials(courseName)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <PageTitle>{courseName}</PageTitle>
            <Muted style={styles.dSection}>Course Admins</Muted>
          </View>
          <AdminButton
            label="Add Admin"
            icon="add"
            variant="accent"
            onPress={() => navigation.navigate('SuperAdminCourseAdminCreate', { courseId, courseName })}
          />
        </View>
        <View style={styles.dToolbar}>
          <View style={styles.dSearchWrap}>{searchField}</View>
        </View>
        {stateBlock('No admins yet.') ?? (
          <Tile padded={false} style={styles.dTableTile}>
            <DesktopDataTable columns={columns} rows={filtered} keyExtractor={(row) => row.id} />
          </Tile>
        )}
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader
        title="Course Admins"
        subtitle={courseName}
        right={
          <CircleButton
            icon="add"
            size={44}
            onPress={() => navigation.navigate('SuperAdminCourseAdminCreate', { courseId, courseName })}
            accessibilityLabel="Add Admin"
          />
        }
      />

      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {searchField}
        {stateBlock('No admins yet — tap + to add one.') ?? (
          <Tile padded={false} style={styles.mList}>
            {filtered.map((item, i) => (
              <View key={item.id} style={[styles.mRow, i > 0 && styles.mRowRule]}>
                <View style={styles.mRowTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.firstName} {item.lastName}</Text>
                  <StatusPill label={item.revoked ? 'Revoked' : 'Active'} tone={item.revoked ? 'neg' : 'pos'} style={styles.flex0} />
                </View>
                <Text style={styles.cardEmail} numberOfLines={1}>{item.email}</Text>
                {item.mustChangePassword ? <Text style={styles.pendingText}>Hasn't logged in yet</Text> : null}
                <View style={styles.mActions}>{actionsFor(item)}</View>
              </View>
            ))}
          </Tile>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40, gap: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 },
  statusCell: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flex0: { flexShrink: 0 },
  mList: { overflow: 'hidden' },
  mRow: { paddingHorizontal: 16, paddingVertical: 14, gap: 3 },
  mRowRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },
  mRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  mActions: { marginTop: 10, alignItems: 'flex-start' },
  cardTitle: { flex: 1, minWidth: 0, ...adminFont.bodySemiBold, fontSize: 15.5, color: c.ink },
  cardEmail: { ...adminFont.body, fontSize: 13.5, color: c.ink2 },
  pendingText: { ...adminFont.body, fontSize: 12.5, color: c.ink3, fontStyle: 'italic' },
  dHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  crest: { width: 48, height: 48, borderRadius: adminRadius.sm, backgroundColor: '#1F4234', alignItems: 'center', justifyContent: 'center' },
  crestText: { ...adminFont.bodyBold, fontSize: 16, color: '#CDDE5C' },
  dSection: { marginTop: 2, fontSize: 15 },
  dToolbar: { flexDirection: 'row', marginTop: 18, marginBottom: 12 },
  dSearchWrap: { width: 300 },
  dTableTile: { overflow: 'hidden', paddingVertical: 4 },
});
}
