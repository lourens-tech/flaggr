import React, { useState, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList, SuperAdminTabParamList } from '../../navigation/types';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { useHover, hoverTransition } from '../../hooks/useHover';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { PageTitle, StatusPill, Tile } from '../../components/admin/ui';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { ThemeToggleRow } from '../../components/common/ThemeToggleRow';
import type { ThemePreference } from '../../context/ThemeContext';
import { useAdminTheme } from '../../context/ThemeContext';
import { adminFont, adminRadius, type AdminColors } from '../../theme/admin';

type Props = CompositeScreenProps<
  BottomTabScreenProps<SuperAdminTabParamList, 'SuperAdminProfile'>,
  NativeStackScreenProps<SuperAdminStackParamList>
>;

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  support_agent: 'Support Agent',
};

// The basic profile tab for a `super_admin` or `support_agent` account —
// name, appearance, terms and logout (Support Agents, Audit Log and Fraud
// Oversight live in the sidebar and the More tab). Neither role is scoped to any single club,
// so there's no course logo to show here (unlike AdminStaffProfileScreen);
// a generic shield icon stands in for the platform-level identity instead.
export function SuperAdminProfileScreen({ navigation }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
  const { admin, updateThemePreference, logout } = useAdmin();

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

  // Shared by both layouts: identity, then grouped settings rows.
  const profileBody = (
    <>
      <View style={[styles.identity, isDesktop && styles.identityDesktop]}>
        <View style={styles.avatar}>
          <Ionicons name="shield-checkmark-outline" size={28} color={c.icon} />
        </View>
        <View style={[styles.identityText, isDesktop && styles.identityTextDesktop]}>
          {isDesktop ? (
            <PageTitle>{admin.firstName} {admin.lastName}</PageTitle>
          ) : (
            <Text style={styles.name}>{admin.firstName} {admin.lastName}</Text>
          )}
          <Text style={[styles.email, !isDesktop && styles.centerText]}>{admin.email}</Text>
        </View>
        <StatusPill label={ROLE_LABEL[admin.role] ?? admin.role} tone="neutral" style={styles.rolePill} />
      </View>

      <Text style={styles.cap} accessibilityRole="header">Appearance</Text>
      <Tile style={styles.groupTile}>
        <ThemeToggleRow onChange={handleThemeChange} disabled={savingTheme} />
      </Tile>

      <Text style={styles.cap} accessibilityRole="header">Legal</Text>
      <Tile style={styles.list} padded={false}>
        <SettingsRow label="Terms and Privacy" icon="document-text-outline" onPress={() => navigation.navigate('TermsPrivacy')} styles={styles} />
      </Tile>

      <Tile style={[styles.list, styles.logoutTile]} padded={false}>
        <SettingsRow label="Log Out" icon="log-out-outline" destructive onPress={handleLogout} styles={styles} />
      </Tile>
    </>
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminProfile" breadcrumb="Profile" showRail={false}>
        <Text style={styles.dEyebrow}>My Profile</Text>
        <View style={styles.dBody}>{profileBody}</View>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="My Profile" subtitle={`Flagrr ${ROLE_LABEL[admin.role] ?? admin.role}`} showBack={false} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {profileBody}
      </ScrollView>
    </View>
  );
}

function SettingsRow({
  label,
  icon,
  destructive,
  onPress,
  styles,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const { c } = useAdminTheme();
  const [hovered, hoverHandlers] = useHover();
  const fg = destructive ? c.neg : c.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      onHoverIn={hoverHandlers.onMouseEnter}
      onHoverOut={hoverHandlers.onMouseLeave}
      style={({ pressed }) => [styles.row, hoverTransition, (hovered || pressed) && styles.rowHover]}
    >
      <View style={[styles.rowIcon, destructive && styles.rowIconNeg]}>
        <Ionicons name={icon} size={18} color={destructive ? c.neg : c.icon} />
      </View>
      <Text style={[styles.rowText, { color: fg }]} numberOfLines={1}>{label}</Text>
      {destructive ? null : <Ionicons name="chevron-forward" size={15} color={c.ink3} />}
    </Pressable>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 16, paddingBottom: 64 },
  identity: { alignItems: 'center', gap: 8, paddingTop: 8 },
  identityDesktop: { flexDirection: 'row', gap: 16, paddingTop: 0 },
  identityText: { alignItems: 'center', gap: 2 },
  identityTextDesktop: { flex: 1, alignItems: 'flex-start', gap: 4 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...adminFont.bodyBold, fontSize: 20, color: c.ink, textAlign: 'center' },
  email: { ...adminFont.body, fontSize: 14, color: c.ink2 },
  centerText: { textAlign: 'center' },
  rolePill: { alignSelf: 'center' },
  cap: {
    ...adminFont.bodyBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: c.ink3,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 16,
  },
  groupTile: { padding: 14 },
  list: { overflow: 'hidden' },
  logoutTile: { marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14 },
  rowHover: { backgroundColor: c.fill2 },
  rowIcon: { width: 32, height: 32, borderRadius: adminRadius.sm, backgroundColor: c.fill, alignItems: 'center', justifyContent: 'center' },
  rowIconNeg: { backgroundColor: c.negBg },
  rowText: { ...adminFont.body, fontSize: 16, flex: 1 },
  dEyebrow: { ...adminFont.bodySemiBold, fontSize: 13.5, color: c.ink3, marginBottom: 10 },
  dBody: { maxWidth: 560 },
});
}
