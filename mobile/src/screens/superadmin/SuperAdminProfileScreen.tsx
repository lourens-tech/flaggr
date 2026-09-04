import React, { useState, useMemo } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList, SuperAdminTabParamList } from '../../navigation/types';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { ThemeToggleRow } from '../../components/common/ThemeToggleRow';
import type { ThemePreference } from '../../context/ThemeContext';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

type Props = CompositeScreenProps<
  BottomTabScreenProps<SuperAdminTabParamList, 'SuperAdminProfile'>,
  NativeStackScreenProps<SuperAdminStackParamList>
>;

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  support_agent: 'Support Agent',
};

// The basic profile tab for a `super_admin` or `support_agent` account —
// name, appearance, and logout. Neither role is scoped to any single club,
// so there's no course logo to show here (unlike AdminStaffProfileScreen);
// a generic shield icon stands in for the platform-level identity instead.
export function SuperAdminProfileScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  const body = (
    <>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Ionicons name="shield-checkmark-outline" size={28} color={colors.clubGreen} />
          </View>
          <Text style={styles.name}>{admin.firstName} {admin.lastName}</Text>
          <Text style={styles.email}>{admin.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{ROLE_LABEL[admin.role] ?? admin.role}</Text>
          </View>
        </View>

        {admin.role === 'super_admin' ? (
          <>
            <Text style={styles.sectionTitle}>Support Agents</Text>
            <PillButton
              label="Manage Support Agents"
              icon="headset-outline"
              variant="outline"
              onPress={() => navigation.navigate('SuperAdminAgents')}
            />

            <Text style={styles.sectionTitle}>Accountability</Text>
            <PillButton
              label="View Audit Log"
              icon="document-text-outline"
              variant="outline"
              onPress={() => navigation.navigate('SuperAdminAuditLog')}
            />
            <View style={{ marginTop: spacing.sm }}>
              <PillButton
                label="Fraud Oversight"
                icon="shield-outline"
                variant="outline"
                onPress={() => navigation.navigate('SuperAdminFraudOversight')}
              />
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Appearance</Text>
        <ThemeToggleRow onChange={handleThemeChange} disabled={savingTheme} />

        <Text style={styles.sectionTitle}>Legal</Text>
        <PillButton
          label="Terms and Privacy"
          icon="shield-checkmark-outline"
          variant="outline"
          onPress={() => navigation.navigate('TermsPrivacy')}
        />

        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={18} color={colors.negative} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
    </>
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminProfile" breadcrumb="Profile" showRail={false}>
        <Text style={styles.dPageTitle}>My Profile</Text>
        <DesktopPanel title=" " style={{ maxWidth: 480 }}>
          {body}
        </DesktopPanel>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Profile</Text>
          <Text style={styles.headerSubtitle}>Flagrr {ROLE_LABEL[admin.role] ?? admin.role}</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {body}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  header: { paddingHorizontal: screenPadding, paddingVertical: spacing.md },
  headerTitle: { fontFamily: fontFamily.headingDisplay, fontSize: fontSize.title, color: colors.white },
  headerSubtitle: { fontFamily: fontFamily.body, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  content: { padding: screenPadding, paddingBottom: spacing.xl * 2 },
  avatarWrap: { alignItems: 'center', gap: 4, marginBottom: spacing.lg },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.mintBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontFamily: fontFamily.heading, fontSize: fontSize.cardTitle, color: colors.textPrimary },
  email: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  roleBadge: {
    backgroundColor: colors.mintBg,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 4,
  },
  roleBadgeText: { fontFamily: fontFamily.bodySemiBold, fontSize: 10, color: colors.textPrimary },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
  },
  logoutText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.negative },
  dPageTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.textPrimary },
});
}
