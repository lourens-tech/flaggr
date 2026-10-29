import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAdminTheme } from '../../context/ThemeContext';
import { useAdmin } from '../../context/AdminContext';
import { adminFont, adminRadius } from '../../theme/admin';
import { getAdminNavGroups, getSuperAdminNavGroups, type DesktopNavItem, type NavIcon } from '../../navigation/adminNavConfig';
import { goTo, type DesktopNavigator } from '../../components/admin/desktop/DesktopShell';
import { CountBadge, PageTitle } from '../../components/admin/ui';

// Sections already on the phone tab bar (see components/admin/AdminTabBar).
const ON_TAB_BAR = new Set([
  'AdminDashboard',
  'AdminEnquiries',
  'AdminVouchers',
  'AdminRewards',
  'SuperAdminCourses',
  'SuperAdminReports',
  'SuperAdminSupport',
  'SuperAdminAds',
]);

interface Row {
  key: string;
  label: string;
  icon: NavIcon;
  count?: number;
  onPress: () => void;
}

// The phone "More" tab for course admins and super admins: every section
// that isn't on the tab bar, grouped the same way as the desktop sidebar.
export function AdminMoreScreen() {
  const { c } = useAdminTheme();
  const navigation = useNavigation() as unknown as DesktopNavigator;
  const { admin, course, unreadNotificationCount } = useAdmin();
  const isSuper = admin.role === 'super_admin';
  const groups = isSuper ? getSuperAdminNavGroups(admin.role) : getAdminNavGroups(admin.role);

  const sections = groups
    .map((g) => ({
      label: g.label,
      rows: g.items
        .filter((i) => !ON_TAB_BAR.has(i.key))
        .map<Row>((i: DesktopNavItem) => ({ key: i.key, label: i.label, icon: i.icon, onPress: () => goTo(navigation, i.target) })),
    }))
    .filter((s) => s.rows.length > 0);

  // The notifications page (the bell on desktop) lives under Members here.
  if (!isSuper) {
    const members = sections.find((s) => s.label === 'Members');
    members?.rows.push({
      key: 'AdminNotifications',
      label: 'Activity',
      icon: 'notifications-outline',
      count: unreadNotificationCount,
      onPress: () => navigation.navigate('AdminNotifications'),
    });
  }

  const roleLine = isSuper ? 'Super admin · Flagrr' : `Course admin · ${course.name}`;
  const openProfile = () =>
    isSuper
      ? navigation.navigate('SuperAdminTabs', { screen: 'SuperAdminProfile' })
      : navigation.navigate('AdminTabs', { screen: 'AdminCourseProfile' });

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <PageTitle>More</PageTitle>

        <Pressable
          onPress={openProfile}
          accessibilityRole="button"
          accessibilityLabel={`${admin.firstName} ${admin.lastName}, ${roleLine}`}
          style={[styles.profile, { backgroundColor: c.surface, borderColor: c.edge }]}
        >
          <View style={[styles.av, { backgroundColor: c.fill }]}>
            <Text style={[styles.avText, { color: c.ink }]}>{`${admin.firstName.charAt(0)}${admin.lastName.charAt(0)}`.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>{admin.firstName} {admin.lastName}</Text>
            <Text style={[styles.role, { color: c.ink2 }]} numberOfLines={1}>{roleLine}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.ink3} />
        </Pressable>

        {sections.map((s) => (
          <View key={s.label || 'top'}>
            {s.label ? <Text style={[styles.cap, { color: c.ink3 }]}>{s.label}</Text> : <View style={{ height: 20 }} />}
            <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.edge }]}>
              {s.rows.map((r, i) => (
                <Pressable
                  key={r.key}
                  onPress={r.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={r.count ? `${r.label}, ${r.count} unread` : r.label}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.fill2 }]}
                >
                  <View style={[styles.ic, { backgroundColor: c.fill }]}>
                    <Ionicons name={r.icon} size={18} color={c.icon} />
                  </View>
                  <View style={[styles.rowMain, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge }]}>
                    <Text style={[styles.rowText, { color: c.ink }]} numberOfLines={1}>{r.label}</Text>
                    {r.count ? <CountBadge count={r.count} /> : null}
                    <Ionicons name="chevron-forward" size={15} color={c.ink3} />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  body: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16, padding: 14, borderRadius: adminRadius.md, borderWidth: StyleSheet.hairlineWidth, minHeight: 72 },
  av: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avText: { ...adminFont.bodyBold, fontSize: 15 },
  name: { ...adminFont.bodySemiBold, fontSize: 16.5 },
  role: { ...adminFont.body, fontSize: 13.5, marginTop: 2 },
  cap: { ...adminFont.bodyBold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 24, marginBottom: 8, marginLeft: 16 },
  list: { borderRadius: adminRadius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14 },
  ic: { width: 32, height: 32, borderRadius: adminRadius.sm, alignItems: 'center', justifyContent: 'center' },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, marginLeft: 12, paddingRight: 14 },
  rowText: { ...adminFont.body, fontSize: 16, flex: 1 },
});
