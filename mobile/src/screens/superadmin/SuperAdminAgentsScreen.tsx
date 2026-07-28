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
import type { SupportAgent } from '../../data/adminTypes';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminAgents'>;

export function SuperAdminAgentsScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { supportAgents, loadSupportAgents, resetSupportAgentPassword, revokeSupportAgent, reactivateSupportAgent, deleteSupportAgent } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return supportAgents;
    return supportAgents.filter(
      (a) => `${a.firstName} ${a.lastName}`.toLowerCase().includes(query) || a.email.toLowerCase().includes(query),
    );
  }, [supportAgents, search]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          await loadSupportAgents();
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

  const handleResetPassword = (item: SupportAgent) => {
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
              await resetSupportAgentPassword(item.id);
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

  const handleToggleAccess = (item: SupportAgent) => {
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
              if (isRevoked) await reactivateSupportAgent(item.id);
              else await revokeSupportAgent(item.id);
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

  const handleDelete = (item: SupportAgent) => {
    showAlert('Remove this support agent?', 'They will lose access immediately and their account will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusyId(item.id);
          try {
            await deleteSupportAgent(item.id);
          } catch (err) {
            const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
            showAlert('Couldn’t remove support agent', message);
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: SupportAgent }) => (
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
          title="Support Agents"
          onBack={() => navigation.goBack()}
          right={
            <TouchableOpacity
              onPress={() => navigation.navigate('SuperAdminAgentCreate')}
              hitSlop={8}
              accessibilityLabel="Add Support Agent"
              accessibilityRole="button"
            >
              <Ionicons name="add-circle" size={26} color={colors.white} />
            </TouchableOpacity>
          }
        />
      </SafeAreaView>

      <View style={styles.searchArea}>
        <TextField placeholder="Search agents" variant="onLight" icon="search" value={search} onChangeText={setSearch} />
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
              {supportAgents.length === 0 ? 'No support agents yet — tap + to add one.' : 'No agents match your search.'}
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
