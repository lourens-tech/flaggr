import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { AuditLogEntry } from '../../data/adminTypes';

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
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function SuperAdminAuditLogScreen(_props: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDesktop = useIsDesktopNav();
  const { getAuditLog } = useAdmin();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const rows = await getAuditLog();
          if (!cancelled) setEntries(rows);
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

  const renderItem = ({ item }: { item: AuditLogEntry }) => (
    <View style={[styles.card, !isDesktop && styles.mCard]}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardAction} numberOfLines={1}>{actionLabel(item.action)}</Text>
        <Text style={[styles.cardTime, { flexShrink: 0 }]}>{formatCreatedAt(item.createdAt)}</Text>
      </View>
      {item.targetLabel ? <Text style={styles.cardTarget} numberOfLines={1}>{item.targetLabel}</Text> : null}
      <Text style={styles.cardAdmin} numberOfLines={1}>{item.adminName}</Text>
    </View>
  );

  const searchArea = (
    <View style={styles.searchArea}>
      <TextField placeholder="Search audit log" variant="onLight" icon="search" value={search} onChangeText={setSearch} />
    </View>
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminAuditLog" breadcrumb="Audit Log" showRail={false}>
        <Text style={styles.dPageTitle}>Audit Log</Text>
        <DesktopPanel title="All Actions">
          {searchArea}
          {loading ? (
            <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.md }} />
          ) : filtered.length === 0 ? (
            <Text style={styles.emptyText}>{entries.length === 0 ? 'No actions recorded yet.' : 'No entries match your search.'}</Text>
          ) : (
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {filtered.map((item) => (
                <React.Fragment key={item.id}>{renderItem({ item })}</React.Fragment>
              ))}
            </View>
          )}
        </DesktopPanel>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="Audit Log" />

      {searchArea}

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(e) => e.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {entries.length === 0 ? 'No actions recorded yet.' : 'No entries match your search.'}
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
  // Phone-only card surface — `card` is also rendered inside the desktop panel.
  mCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardAction: { flex: 1, minWidth: 0, fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  cardTime: { fontFamily: fontFamily.body, fontSize: 10, color: colors.textSecondary },
  cardTarget: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  cardAdmin: { fontFamily: fontFamily.body, fontSize: 10, color: colors.textSecondary, fontStyle: 'italic' },
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
