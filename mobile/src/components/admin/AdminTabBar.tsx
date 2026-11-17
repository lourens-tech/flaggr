import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useAdminTheme } from '../../context/ThemeContext';
import { useAdmin } from '../../context/AdminContext';
import { adminFont, adminRadius } from '../../theme/admin';
import { PressableScale } from '../motion';
import type { SideRail } from '../../hooks/useIsDesktopNav';
import { CountBadge, Glass } from './ui';

type IconName = keyof typeof Ionicons.glyphMap;

interface TabEntry {
  // A tab route name, or a stack screen for an entry that isn't a tab.
  route: string;
  label: string;
  icon: IconName;
}

// Five tabs at most, as Apple recommends; every other section is under More
// (AdminMoreScreen), which lists them all. Routes that aren't on the bar
// light up More while they're open.
const COURSE_ADMIN_TABS: TabEntry[] = [
  { route: 'AdminDashboard', label: 'Home', icon: 'home-outline' },
  { route: 'AdminEnquiries', label: 'Enquiries', icon: 'chatbubble-outline' },
  { route: 'AdminVouchers', label: 'Vouchers', icon: 'qr-code-outline' },
  { route: 'AdminRewards', label: 'Rewards', icon: 'gift-outline' },
  { route: 'AdminMore', label: 'More', icon: 'ellipsis-horizontal' },
];

// Support used to be hidden inside Profile for staff.
const STAFF_TABS: TabEntry[] = [
  { route: 'AdminVouchers', label: 'Vouchers', icon: 'qr-code-outline' },
  { route: 'AdminSupportTickets', label: 'Support', icon: 'headset-outline' },
  { route: 'AdminStaffProfile', label: 'Profile', icon: 'person-circle-outline' },
];

const SUPER_ADMIN_TABS: TabEntry[] = [
  { route: 'SuperAdminCourses', label: 'Courses', icon: 'business-outline' },
  { route: 'SuperAdminReports', label: 'Reports', icon: 'bar-chart-outline' },
  { route: 'SuperAdminSupport', label: 'Support', icon: 'headset-outline' },
  { route: 'SuperAdminAds', label: 'Ads', icon: 'albums-outline' },
  { route: 'SuperAdminMore', label: 'More', icon: 'ellipsis-horizontal' },
];

const SUPPORT_AGENT_TABS: TabEntry[] = [
  { route: 'SuperAdminSupport', label: 'Inbox', icon: 'headset-outline' },
  { route: 'SuperAdminProfile', label: 'Profile', icon: 'person-circle-outline' },
];

// Phone and narrow-window tab bar for every admin role: a floating glass
// capsule over the club's backdrop. `rail` turns it into a vertical rail on
// that side (see useSideRail: left on wide phone layouts, right beside a
// status strip down the right edge, as on the folded iPhone Duo). Desktop web
// uses DesktopShell's sidebar instead (the tab navigators pass a null tab bar
// there).
export function AdminTabBar({ state, navigation, rail = null }: BottomTabBarProps & { rail?: SideRail }) {
  const { c } = useAdminTheme();
  const { admin, unreadNotificationCount } = useAdmin();
  const insets = useSafeAreaInsets();

  const entries =
    admin.role === 'staff'
      ? STAFF_TABS
      : admin.role === 'super_admin'
        ? SUPER_ADMIN_TABS
        : admin.role === 'support_agent'
          ? SUPPORT_AGENT_TABS
          : COURSE_ADMIN_TABS;

  const focused = state.routes[state.index]?.name;
  const onBar = new Set(entries.map((e) => e.route));
  const moreEntry = entries.find((e) => e.route.endsWith('More'));

  if (rail) {
    // Icons only, with More pinned to the bottom (as on the iPhone Duo board).
    const railEntry = (entry: TabEntry) => {
      const isFocused = entry.route === focused || (entry === moreEntry && !!focused && !onBar.has(focused));
      const badge = entry === moreEntry && admin.role === 'course_admin' ? unreadNotificationCount : 0;
      return (
        <PressableScale
          key={entry.route}
          onPress={() => navigation.navigate(entry.route as never)}
          style={[styles.railTab, isFocused && { backgroundColor: c.sel }]}
          pressedScale={0.92}
          accessibilityRole="tab"
          accessibilityLabel={badge ? `${entry.label}, ${badge} unread` : entry.label}
          accessibilityState={{ selected: isFocused }}
        >
          <Ionicons name={entry.icon} size={22} color={isFocused ? c.ink : c.ink2} />
          {badge ? <CountBadge count={badge} style={styles.railBadge} /> : null}
        </PressableScale>
      );
    };
    return (
      <View style={[rail === 'right' ? styles.railWrapRight : styles.railWrap, { paddingTop: Math.max(insets.top, 10), paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Glass radius={adminRadius.pill} style={styles.rail} accessibilityRole="tablist">
          {entries.filter((e) => e !== moreEntry).map(railEntry)}
          <View style={{ flex: 1 }} />
          {moreEntry ? railEntry(moreEntry) : null}
        </Glass>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <Glass radius={adminRadius.pill} style={styles.bar} accessibilityRole="tablist">
        {entries.map((entry) => {
          const isFocused = entry.route === focused || (entry === moreEntry && !!focused && !onBar.has(focused));
          const badge = entry === moreEntry && admin.role === 'course_admin' ? unreadNotificationCount : 0;
          return (
            <PressableScale
              key={entry.route}
              onPress={() => navigation.navigate(entry.route as never)}
              style={[styles.tab, isFocused && { backgroundColor: c.sel }]}
              pressedScale={0.92}
              accessibilityRole="tab"
              accessibilityLabel={badge ? `${entry.label}, ${badge} unread` : entry.label}
              accessibilityState={{ selected: isFocused }}
            >
              <View>
                <Ionicons name={entry.icon} size={23} color={isFocused ? c.ink : c.ink3} />
                {badge ? <CountBadge count={badge} style={styles.badge} /> : null}
              </View>
              <Text style={[styles.label, { color: isFocused ? c.ink : c.ink3 }, isFocused && adminFont.bodySemiBold]} numberOfLines={1}>
                {entry.label}
              </Text>
            </PressableScale>
          );
        })}
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 6 },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 5, height: 66 },
  tab: { flex: 1, height: '100%', borderRadius: adminRadius.pill, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { ...adminFont.bodyMedium, fontSize: 11.5 },
  badge: { position: 'absolute', top: -6, right: -12 },
  railWrap: { paddingLeft: 10, paddingRight: 2 },
  railWrapRight: { paddingLeft: 2, paddingRight: 10 },
  rail: { flex: 1, width: 64, alignItems: 'center', paddingVertical: 8, gap: 6 },
  railTab: { width: 48, height: 48, borderRadius: adminRadius.pill, alignItems: 'center', justifyContent: 'center' },
  railBadge: { position: 'absolute', top: 0, right: -2 },
});
