import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAdminTheme } from '../../../context/ThemeContext';
import { useAdmin } from '../../../context/AdminContext';
import { adminFont, adminRadius } from '../../../theme/admin';
import { useHover, hoverTransition } from '../../../hooks/useHover';
import { actionLabel } from '../../../screens/superadmin/SuperAdminAuditLogScreen';
import { AdminButton, StatusPill, type StatusTone } from '../ui';
import { timeAgo } from './AdminActivityRail';
import type { DesktopNavigator } from './DesktopShell';

const TICKET_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  open: { label: 'Open', tone: 'amber' },
  in_progress: { label: 'In Progress', tone: 'pos' },
  resolved: { label: 'Resolved', tone: 'neutral' },
};

interface Row {
  id: string;
  title: string;
  body: string;
  when: string;
  unread?: boolean;
  status?: string;
  onPress?: () => void;
}

// The super-admin Activity inspector. A super_admin sees the audit log
// (there's no notifications feed at platform level); a support agent can't
// read the audit log, so they see their own recently updated tickets.
export function SuperAdminActivityRail() {
  const { c } = useAdminTheme();
  const navigation = useNavigation() as unknown as DesktopNavigator;
  const { admin, getAuditLog, getSupportInbox } = useAdmin();
  const isAgent = admin.role === 'support_agent';
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = isAgent
      ? getSupportInbox(undefined, undefined, 'mine').then((tickets) =>
          [...tickets]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, 8)
            .map<Row>((t) => ({
              id: t.id,
              title: t.subject,
              body: `${t.requesterName}${t.lastMessage ? `: ${t.lastMessage}` : ''}`,
              when: t.updatedAt,
              unread: t.hasUnread,
              status: t.status,
              onPress: () => navigation.navigate('SuperAdminSupportTicketChat', { ticketId: t.id }),
            })),
        )
      : getAuditLog().then((entries) =>
          entries.slice(0, 8).map<Row>((e) => ({
            id: e.id,
            title: e.adminName,
            body: `${actionLabel(e.action)}${e.targetLabel ? ` · ${e.targetLabel}` : ''}`,
            when: e.createdAt,
          })),
        );
    load
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
    // Loaded once per screen mount, like the rest of the desktop chrome.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAgent]);

  return (
    <View style={{ gap: 14 }}>
      <Text accessibilityRole="header" style={[styles.heading, { color: c.ink }]}>{isAgent ? 'Your tickets' : 'Activity'}</Text>
      {rows === null ? (
        <Text style={[styles.empty, { color: c.ink3 }]}>Loading…</Text>
      ) : rows.length === 0 ? (
        <Text style={[styles.empty, { color: c.ink2 }]}>{isAgent ? 'No tickets assigned to you yet.' : 'Nothing yet.'}</Text>
      ) : (
        <View>{rows.map((r) => <Entry key={r.id} r={r} />)}</View>
      )}
      <AdminButton
        label={isAgent ? 'Open inbox' : 'Show audit log'}
        fullWidth
        onPress={() => (isAgent ? navigation.navigate('SuperAdminTabs', { screen: 'SuperAdminSupport' }) : navigation.navigate('SuperAdminAuditLog'))}
      />
    </View>
  );
}

function Entry({ r }: { r: Row }) {
  const { c } = useAdminTheme();
  const [hovered, hoverHandlers] = useHover();
  return (
    <Pressable
      onPress={r.onPress}
      disabled={!r.onPress}
      accessibilityRole={r.onPress ? 'button' : 'text'}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
      style={[styles.item, hoverTransition, r.onPress && hovered && { backgroundColor: c.fill2 }]}
    >
      <View style={[styles.dot, { backgroundColor: r.unread ? c.accent : 'transparent' }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>{r.title}</Text>
        <Text style={[styles.body, { color: c.ink2 }]} numberOfLines={2}>{r.body}</Text>
        <View style={styles.meta}>
          <Text style={[styles.time, { color: c.ink3 }]}>{timeAgo(r.when)}</Text>
          {r.status && TICKET_STATUS[r.status] ? <StatusPill label={TICKET_STATUS[r.status].label} tone={TICKET_STATUS[r.status].tone} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: { ...adminFont.bodyBold, fontSize: 18 },
  empty: { ...adminFont.body, fontSize: 13.5, paddingVertical: 8 },
  item: { flexDirection: 'row', gap: 10, paddingVertical: 10, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: adminRadius.sm },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  title: { ...adminFont.bodySemiBold, fontSize: 14 },
  body: { ...adminFont.body, fontSize: 13, lineHeight: 18, marginTop: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  time: { ...adminFont.body, fontSize: 12 },
});
