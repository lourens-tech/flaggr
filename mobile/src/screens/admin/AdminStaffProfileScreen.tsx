import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList, AdminTabParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { AdminHeaderAvatar } from '../../components/common/AdminHeaderAvatar';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { ThemeToggleRow } from '../../components/common/ThemeToggleRow';
import type { ThemePreference } from '../../context/ThemeContext';
import { useAdminTheme } from '../../context/ThemeContext';
import { adminFont } from '../../theme/admin';
import { Eyebrow, PageTitle, StatusPill, Tile } from '../../components/admin/ui';
import { useHover, hoverTransition } from '../../hooks/useHover';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabParamList, 'AdminStaffProfile'>,
  NativeStackScreenProps<AdminStackParamList>
>;

// One tappable row of a grouped list: icon, label, chevron.
function ProfileRow({
  icon,
  label,
  onPress,
  danger,
  first,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  first?: boolean;
}) {
  const { c } = useAdminTheme();
  const [hovered, hoverHandlers] = useHover();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.listRow,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },
        hoverTransition,
        hovered && { backgroundColor: c.fill2 },
      ]}
      {...hoverHandlers}
    >
      <Ionicons name={icon} size={18} color={danger ? c.neg : c.icon} />
      <Text style={[styles.listRowLabel, { color: danger ? c.neg : c.ink }]} numberOfLines={1}>
        {label}
      </Text>
      {danger ? null : <Ionicons name="chevron-forward" size={16} color={c.ink3} />}
    </TouchableOpacity>
  );
}

// The basic profile tab for a `staff` account — just their name/email and
// logout. Password resets for a staff account are course-admin-managed
// (Manage Staff > Reset Password) rather than self-service. Everything a
// course_admin gets on AdminCourseProfileScreen (course settings, logo,
// cover photo) is deliberately out of reach here too.
export function AdminStaffProfileScreen({ navigation }: Props) {
  const { c } = useAdminTheme();
  const isDesktop = useIsDesktopNav();
  const { admin, course, updateThemePreference, logout } = useAdmin();

  const [savingTheme, setSavingTheme] = useState(false);

  const handleThemeChange = async (preference: ThemePreference) => {
    setSavingTheme(true);
    try {
      await updateThemePreference(preference);
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t update appearance', message);
    } finally {
      setSavingTheme(false);
    }
  };

  const handleLogout = () => {
    showAlert('Log out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const body = (
    <>
      <View>
        <Tile style={styles.idTile}>
          <AdminHeaderAvatar logoUrl={course.logoUrl} size={64} />
          <Text style={[styles.name, { color: c.ink }]}>
            {admin.firstName} {admin.lastName}
          </Text>
          <Text style={[styles.email, { color: c.ink2 }]}>Username: {admin.username}</Text>
          <StatusPill label="Staff" tone="neutral" style={styles.roleBadge} />
        </Tile>
        <Text style={[styles.foot, { color: c.ink2 }]}>
          Your name and username are managed by your course admin. Contact them if these need to change.
        </Text>
      </View>

      <View>
        <Eyebrow style={styles.groupLabel}>Support Centre</Eyebrow>
        <Tile padded={false} style={styles.listTile}>
          <ProfileRow first icon="headset-outline" label="Support Centre" onPress={() => navigation.navigate('AdminSupportTickets')} />
        </Tile>
      </View>

      <View>
        <Eyebrow style={styles.groupLabel}>Appearance</Eyebrow>
        <Tile>
          <ThemeToggleRow onChange={handleThemeChange} disabled={savingTheme} />
        </Tile>
      </View>

      <View>
        <Eyebrow style={styles.groupLabel}>Legal</Eyebrow>
        <Tile padded={false} style={styles.listTile}>
          <ProfileRow first icon="shield-checkmark-outline" label="Terms and Privacy" onPress={() => navigation.navigate('TermsPrivacy')} />
          <ProfileRow danger icon="log-out-outline" label="Log Out" onPress={handleLogout} />
        </Tile>
      </View>
    </>
  );

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminStaffProfile" breadcrumb="Profile" showRail={false}>
        <PageTitle>My Profile</PageTitle>
        <View style={styles.dColumn}>{body}</View>
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      {/* A tab root: nothing to go back to. */}
      <AdminMobileHeader title="My Profile" subtitle={course.name} showBack={false} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {body}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48, gap: 20 },
  dColumn: { maxWidth: 520, width: '100%', gap: 20 },
  idTile: { alignItems: 'center', gap: 4, paddingVertical: 24 },
  name: { ...adminFont.bodyBold, fontSize: 20, marginTop: 8, textAlign: 'center' },
  email: { ...adminFont.body, fontSize: 13.5, textAlign: 'center' },
  roleBadge: { alignSelf: 'center', marginTop: 6 },
  foot: { ...adminFont.body, fontSize: 12.5, lineHeight: 18, marginTop: 8, marginHorizontal: 16 },
  groupLabel: { marginLeft: 16, marginBottom: 8 },
  listTile: { overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16 },
  listRowLabel: { flex: 1, ...adminFont.bodyMedium, fontSize: 15 },
});
