import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily } from '../../../theme';
import { useThemeColors, type ThemeColors } from '../../../context/ThemeContext';
import { useAdmin } from '../../../context/AdminContext';
import { useHover, hoverTransition } from '../../../hooks/useHover';
import { actionLabel } from '../../../screens/superadmin/SuperAdminAuditLogScreen';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

// Right-rail "Recent Activity" feed for the super-admin desktop shell —
// reuses the same audit log the dedicated Audit Log screen shows, just
// surfaced more prominently, per the course-admin dashboard's equivalent
// rail (which uses the notifications feed instead — super_admin has no
// notifications concept, but does have this audit trail).
export function SuperAdminActivityRail() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { getAuditLog } = useAdmin();
  const [entries, setEntries] = useState<Array<{ id: string; action: string; adminName: string; targetLabel: string | null; createdAt: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    getAuditLog()
      .then((rows) => {
        if (!cancelled) setEntries(rows.slice(0, 6));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View>
      <Text style={styles.heading}>Recent Activity</Text>
      {entries.length === 0 ? (
        <Text style={styles.empty}>Nothing yet.</Text>
      ) : (
        entries.map((e, i) => (
          <ActivityEntry key={e.id} e={e} isLast={i === entries.length - 1} styles={styles} />
        ))
      )}
    </View>
  );
}

function ActivityEntry({
  e,
  isLast,
  styles,
}: {
  e: { id: string; action: string; adminName: string; targetLabel: string | null; createdAt: string };
  isLast: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const [hovered, hoverHandlers] = useHover();
  return (
    <View style={[styles.item, hoverTransition, hovered && styles.itemHover, isLast && styles.itemLast]} {...hoverHandlers}>
      <View style={styles.dot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.text}>
          <Text style={styles.textBold}>{e.adminName}</Text> — {actionLabel(e.action)}
          {e.targetLabel ? ` (${e.targetLabel})` : ''}
        </Text>
        <Text style={styles.time}>{timeAgo(e.createdAt)}</Text>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  heading: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  empty: { fontFamily: fontFamily.body, fontSize: 12.5, color: colors.textSecondary, paddingVertical: 8 },
  item: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemHover: { backgroundColor: colors.mintBgAlt },
  itemLast: { borderBottomWidth: 0 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, backgroundColor: colors.clubGreen },
  text: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 18, color: colors.textPrimary },
  textBold: { fontFamily: fontFamily.bodySemiBold },
  time: { fontFamily: fontFamily.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
}
