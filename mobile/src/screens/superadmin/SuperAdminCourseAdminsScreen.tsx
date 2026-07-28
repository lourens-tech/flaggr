import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { CourseAdminAccount } from '../../data/adminTypes';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminCourseAdmins'>;

// Same shape as SuperAdminAgentsScreen (support agents), just scoped to one
// club's course_admin accounts instead of every platform-wide support agent —
// lets a super_admin add a second admin, reset a password, or revoke/
// reactivate/delete access without touching the database directly.
export function SuperAdminCourseAdminsScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAdmins(await getSuperAdminCourseAdmins(courseId));
    } catch (err) {
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

  const renderItem = ({ item }: { item: CourseAdminAccount }) => (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.firstName} {item.lastName}</Text>
        <View style={[styles.statusBadge, item.revoked && styles.statusBadgeRevoked]}>
          <Text style={[styles.statusBadgeText, item.revoked && styles.statusBadgeTextRevoked]}>
            {item.revoked ? 'Revoked' : 'Active'}
          </Text>
        </View>
      </View>
      <Text style={styles.cardEmail} numberOfLines={1}>{item.email}</Text>
      {item.mustChangePassword ? <Text style={styles.pendingText}>Hasn't logged in yet</Text> : null}

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleResetPassword(item)} disabled={busyId === item.id}>
          <Ionicons name="key-outline" size={15} color={colors.clubGreen} />
          <Text style={styles.actionButtonText}>Reset Password</Text>
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
    </View>
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader
          title={courseName}
          onBack={() => navigation.goBack()}
          right={
            <TouchableOpacity
              onPress={() => navigation.navigate('SuperAdminCourseAdminCreate', { courseId, courseName })}
              hitSlop={8}
              accessibilityLabel="Add Admin"
              accessibilityRole="button"
            >
              <Ionicons name="add-circle" size={26} color={colors.white} />
            </TouchableOpacity>
          }
        />
      </SafeAreaView>

      <View style={styles.searchArea}>
        <TextField placeholder="Search admins" variant="onLight" icon="search" value={search} onChangeText={setSearch} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(a) => a.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {admins.length === 0 ? 'No admins yet — tap + to add one.' : 'No admins match your search.'}
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
  searchArea: { paddingHorizontal: screenPadding, paddingTop: spacing.md },
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
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, rowGap: spacing.xs, marginTop: spacing.xs },
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
