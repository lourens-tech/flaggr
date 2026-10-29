import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { DesktopDataTable, TableAvatarCell, type DesktopTableColumn } from '../../components/admin/desktop/DesktopDataTable';
import { AdminButton, CircleButton, EmptyState, ErrorState, PageTitle, SkeletonRows, StatusPill, Tile } from '../../components/admin/ui';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { SupportAgent } from '../../data/adminTypes';
import { adminFont, adminRadius, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminAgents'>;

export function SuperAdminAgentsScreen({ navigation }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { supportAgents, loadSupportAgents, resetSupportAgentPassword, revokeSupportAgent, reactivateSupportAgent, deleteSupportAgent } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // Set when loading the agents fails (it used to fail silently); cleared on retry.
  const [error, setError] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return supportAgents;
    return supportAgents.filter(
      (a) => `${a.firstName} ${a.lastName}`.toLowerCase().includes(query) || a.email.toLowerCase().includes(query),
    );
  }, [supportAgents, search]);

  const load = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      setLoading(true);
      setError(false);
      try {
        await loadSupportAgents();
      } catch {
        if (!isCancelled()) setError(true);
      } finally {
        if (!isCancelled()) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load(() => cancelled);
      return () => {
        cancelled = true;
      };
    }, [load]),
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

  const statusPills = (item: SupportAgent) => (
    <View style={styles.pillRow}>
      <StatusPill label={item.revoked ? 'Revoked' : 'Active'} tone={item.revoked ? 'neg' : 'pos'} />
      {item.mustChangePassword ? <StatusPill label="Hasn't logged in yet" tone="amber" /> : null}
    </View>
  );

  const actions = (item: SupportAgent) => (
    <View style={styles.cardActions}>
      <AdminButton label="Reset Password" icon="key-outline" variant="glass" onPress={() => handleResetPassword(item)} disabled={busyId === item.id} />
      <AdminButton
        label={item.revoked ? 'Reactivate' : 'Revoke'}
        icon={item.revoked ? 'lock-open-outline' : 'lock-closed-outline'}
        variant="glass"
        onPress={() => handleToggleAccess(item)}
        loading={busyId === item.id}
      />
      <AdminButton label="Delete" icon="trash-outline" variant="danger" onPress={() => handleDelete(item)} disabled={busyId === item.id} />
    </View>
  );

  const renderItem = ({ item }: { item: SupportAgent }) => (
    <Tile style={styles.card}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.firstName} {item.lastName}</Text>
      </View>
      <Text style={styles.cardEmail} numberOfLines={1}>{item.email}</Text>
      {statusPills(item)}
      {actions(item)}
    </Tile>
  );

  const columns: DesktopTableColumn<SupportAgent>[] = [
    {
      key: 'agent',
      label: 'Agent',
      width: 260,
      render: (a) => <TableAvatarCell name={`${a.firstName} ${a.lastName}`} subtitle={a.email} />,
      sortValue: (a) => `${a.firstName} ${a.lastName}`.toLowerCase(),
    },
    { key: 'status', label: 'Status', width: 220, render: statusPills, sortValue: (a) => (a.revoked ? 1 : 0) },
    { key: 'actions', label: 'Actions', width: 420, align: 'right', render: actions },
  ];

  const searchField = <TextField placeholder="Search agents" variant="onLight" icon="search" value={search} onChangeText={setSearch} />;
  const errorState = <ErrorState onRetry={() => load()} />;

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame
        activeKey="SuperAdminAgents"
        breadcrumb="Support Agents"
        headerRight={<AdminButton label="Add Agent" icon="add" variant="accent" onPress={() => navigation.navigate('SuperAdminAgentCreate')} />}
      >
        <PageTitle>Support Agents</PageTitle>
        <View style={styles.dToolbar}>
          <Text style={styles.dSectionTitle} accessibilityRole="header">All Agents</Text>
          <View style={styles.dSearch}>{searchField}</View>
        </View>
        {loading ? (
          <Tile style={styles.dList}>
            <SkeletonRows rows={4} />
          </Tile>
        ) : error ? (
          <View style={styles.dList}>{errorState}</View>
        ) : filtered.length === 0 ? (
          <Tile style={styles.dList}>
            <EmptyState
              icon={supportAgents.length === 0 ? 'people-outline' : 'search-outline'}
              title={supportAgents.length === 0 ? 'No support agents yet.' : 'No agents match your search.'}
            />
          </Tile>
        ) : (
          <Tile style={[styles.dList, styles.dTable]} padded={false}>
            <DesktopDataTable columns={columns} rows={filtered} keyExtractor={(a) => a.id} />
          </Tile>
        )}
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader
        title="Support Agents"
        right={
          <CircleButton icon="add" onPress={() => navigation.navigate('SuperAdminAgentCreate')} accessibilityLabel="Add Support Agent" />
        }
      />

      <View style={styles.searchArea}>{searchField}</View>

      {loading ? (
        <View style={styles.listContent}>
          <Tile>
            <SkeletonRows rows={4} />
          </Tile>
        </View>
      ) : error ? (
        <View style={styles.listContent}>{errorState}</View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(a) => a.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Tile>
              <EmptyState
                icon={supportAgents.length === 0 ? 'people-outline' : 'search-outline'}
                title={supportAgents.length === 0 ? 'No support agents yet — tap + to add one.' : 'No agents match your search.'}
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
  searchArea: { paddingHorizontal: 16, paddingTop: 12 },
  listContent: { padding: 16, paddingBottom: 32, gap: 10 },
  card: { gap: 6 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, minWidth: 0, ...adminFont.bodyBold, fontSize: 15.5, color: c.ink },
  cardEmail: { ...adminFont.body, fontSize: 13.5, color: c.ink2 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  dToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 18 },
  dSectionTitle: { ...adminFont.bodyBold, fontSize: 17, color: c.ink },
  dSearch: { width: 300 },
  dList: { marginTop: 12 },
  dTable: { paddingHorizontal: 8, paddingVertical: 6, overflow: 'hidden', borderRadius: adminRadius.md },
});
}
