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
import { DesktopDataTable, TableText, type DesktopTableColumn } from '../../components/admin/desktop/DesktopDataTable';
import { EmptyState, ErrorState, PageTitle, SkeletonRows, Tile } from '../../components/admin/ui';
import { useAdminTheme } from '../../context/ThemeContext';
import type { AuditLogEntry } from '../../data/adminTypes';
import { adminFont, adminRadius, tabularNums, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminAuditLog'>;

export const ACTION_LABELS: Record<string, string> = {
  superAdminCourseCreate: 'Created club',
  golf_course_import: 'Imported course map',
  golf_course_publish: 'Published course map',
  golf_course_unpublish: 'Unpublished course map',
  golf_course_delete: 'Deleted course map',
  scorecard_photo_upload: 'Uploaded scorecard photo',
  superAdminCourseCancelSubscription: "Cancelled club's subscription",
  superAdminCourseReactivateSubscription: "Reactivated club's subscription",
  superAdminCourseArchive: 'Archived club',
  superAdminCourseUnarchive: 'Unarchived club',
  superAdminMemberRosterUpload: 'Uploaded member roster',
  superAdminBroadcastSend: 'Sent push notification',
  superAdminBroadcastDelete: 'Deleted push notification',
  superAdminCourseAdminCreate: 'Added course admin',
  superAdminCourseAdminResetPassword: "Reset course admin's password",
  superAdminCourseAdminRevoke: 'Revoked course admin access',
  superAdminCourseAdminReactivate: 'Reactivated course admin access',
  superAdminCourseAdminDelete: 'Deleted course admin',
  superAdminAdSave: 'Saved ad',
  superAdminAdDelete: 'Deleted ad',
  superAdminGiftFlagrrCash: 'Gifted/adjusted Flagrr Cash',
  superAdminRewardSave: 'Saved reward',
  superAdminRewardDelete: 'Deleted reward',
  supportAgentCreate: 'Added support agent',
  supportAgentResetPassword: "Reset support agent's password",
  supportAgentRevoke: 'Revoked support agent access',
  supportAgentReactivate: 'Reactivated support agent access',
  supportAgentDelete: 'Deleted support agent',
  superAdminConfirmReceiptFraud: 'Confirmed receipt as fraud',
  superAdminApproveReceipt: 'Approved flagged receipt',
  confirmReceiptFraud: 'Club confirmed receipt as fraud',
  approveReceipt: 'Club approved flagged receipt',
  superAdminCatalogProductSave: 'Saved catalog product',
  superAdminCatalogProductDelete: 'Deactivated catalog product',
  superAdminCatalogProductDeletePermanent: 'Permanently deleted catalog product',
  superAdminCatalogActivitySave: 'Saved catalog activity',
  superAdminCatalogActivityDelete: 'Deactivated catalog activity',
  superAdminCatalogActivityDeletePermanent: 'Permanently deleted catalog activity',
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function SuperAdminAuditLogScreen(_props: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { getAuditLog } = useAdmin();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // Set when loading the log fails (it used to fail silently); cleared on retry.
  const [error, setError] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter(
      (e) =>
        e.adminName.toLowerCase().includes(query) ||
        actionLabel(e.action).toLowerCase().includes(query) ||
        (e.targetLabel ?? '').toLowerCase().includes(query),
    );
  }, [entries, search]);

  const load = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      setLoading(true);
      setError(false);
      try {
        const rows = await getAuditLog();
        if (!isCancelled()) setEntries(rows);
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

  const renderRow = (item: AuditLogEntry, index: number) => (
    <View style={[styles.row, index > 0 && styles.rowDivider]}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardAction} numberOfLines={1}>{actionLabel(item.action)}</Text>
        <Text style={[styles.cardTime, { flexShrink: 0 }]}>{formatCreatedAt(item.createdAt)}</Text>
      </View>
      {item.targetLabel ? <Text style={styles.cardTarget} numberOfLines={1}>{item.targetLabel}</Text> : null}
      <Text style={styles.cardAdmin} numberOfLines={1}>{item.adminName}</Text>
    </View>
  );

  const columns: DesktopTableColumn<AuditLogEntry>[] = [
    {
      key: 'when',
      label: 'When',
      width: 170,
      render: (e) => <TableText muted>{formatCreatedAt(e.createdAt)}</TableText>,
      sortValue: (e) => new Date(e.createdAt).getTime(),
    },
    { key: 'admin', label: 'Admin', width: 180, render: (e) => <TableText>{e.adminName}</TableText>, sortValue: (e) => e.adminName.toLowerCase() },
    { key: 'action', label: 'Action', width: 260, render: (e) => <TableText>{actionLabel(e.action)}</TableText>, sortValue: (e) => actionLabel(e.action) },
    { key: 'target', label: 'Target', width: 260, render: (e) => <TableText muted>{e.targetLabel ?? ''}</TableText> },
  ];

  const searchField = <TextField placeholder="Search audit log" variant="onLight" icon="search" value={search} onChangeText={setSearch} />;

  // Distinguishes "nothing logged yet" from "nothing matches the search".
  const emptyState =
    entries.length === 0 ? (
      <EmptyState icon="document-text-outline" title="No actions recorded yet." />
    ) : (
      <EmptyState icon="search-outline" title="No entries match your search." body={`Nothing matches "${search.trim()}".`} />
    );
  const errorState = <ErrorState onRetry={() => load()} />;

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminAuditLog" breadcrumb="Audit Log" showRail={false}>
        <PageTitle>Audit Log</PageTitle>
        <View style={styles.dToolbar}>
          <Text style={styles.dSectionTitle} accessibilityRole="header">All Actions</Text>
          <View style={styles.dSearch}>{searchField}</View>
        </View>
        {loading ? (
          <Tile style={styles.dList}>
            <SkeletonRows rows={6} />
          </Tile>
        ) : error ? (
          <View style={styles.dList}>{errorState}</View>
        ) : filtered.length === 0 ? (
          <Tile style={styles.dList}>{emptyState}</Tile>
        ) : (
          <Tile style={[styles.dList, styles.dTable]} padded={false}>
            <DesktopDataTable columns={columns} rows={filtered} keyExtractor={(e) => e.id} />
          </Tile>
        )}
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="Audit Log" />

      <View style={styles.searchArea}>{searchField}</View>

      {loading ? (
        <View style={styles.listContent}>
          <Tile>
            <SkeletonRows rows={6} />
          </Tile>
        </View>
      ) : error ? (
        <View style={styles.listContent}>{errorState}</View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(e) => e.id}
          renderItem={({ item, index }) => (
            <View style={[styles.groupSlice, index === 0 && styles.groupFirst, index === filtered.length - 1 && styles.groupLast]}>
              {renderRow(item, index)}
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
  searchArea: { paddingHorizontal: 16, paddingTop: 12 },
  listContent: { padding: 16, paddingBottom: 32 },
  // Phone: the FlatList rows read as one grouped tile.
  groupSlice: {
    backgroundColor: c.surface,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: c.edge,
    overflow: 'hidden',
  },
  groupFirst: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: adminRadius.md, borderTopRightRadius: adminRadius.md },
  groupLast: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: adminRadius.md, borderBottomRightRadius: adminRadius.md },
  row: { paddingHorizontal: 16, paddingVertical: 12, gap: 3, minHeight: 52 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardAction: { flex: 1, minWidth: 0, ...adminFont.bodySemiBold, fontSize: 15, color: c.ink },
  cardTime: { ...adminFont.body, ...tabularNums, fontSize: 12, color: c.ink3 },
  cardTarget: { ...adminFont.body, fontSize: 13.5, color: c.ink2 },
  cardAdmin: { ...adminFont.body, fontSize: 12.5, color: c.ink3 },
  dToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 18 },
  dSectionTitle: { ...adminFont.bodyBold, fontSize: 17, color: c.ink },
  dSearch: { width: 300 },
  dList: { marginTop: 12 },
  dTable: { paddingHorizontal: 8, paddingVertical: 6, overflow: 'hidden', borderRadius: adminRadius.md },
});
}
