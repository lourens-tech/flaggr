import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { AdminStaff } from '../../data/adminTypes';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminStaffList'>;

type StatusFilter = 'all' | 'active' | 'revoked';

const FILTERS: Array<{ label: string; value: StatusFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Revoked', value: 'revoked' },
];

export function AdminStaffListScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { staff, loadStaff, revokeStaff, reactivateStaff, deleteStaff, course, reopenStaffOnboardingWizard } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

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

      {course.staffOnboardingCompletedAt === null ? (
        <TouchableOpacity style={styles.onboardingBanner} onPress={reopenStaffOnboardingWizard} activeOpacity={0.85}>
          <Ionicons name="people-outline" size={18} color={colors.darkGreen} />
          <Text style={styles.onboardingBannerText}>Invite your team</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.darkGreen} />
        </TouchableOpacity>
      ) : null}

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
});
}
