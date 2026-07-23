import React, { useState, useMemo } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { ThemeToggleRow } from '../../components/common/ThemeToggleRow';
import type { ThemePreference } from '../../context/ThemeContext';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

// The basic profile tab for a `staff` account — just their name/email and
// logout. Password resets for a staff account are course-admin-managed
// (Manage Staff > Reset Password) rather than self-service. Everything a
// course_admin gets on AdminCourseProfileScreen (course settings, logo,
// cover photo) is deliberately out of reach here too.
export function AdminStaffProfileScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Profile</Text>
          <Text style={styles.headerSubtitle}>{course.name}</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={28} color={colors.clubGreen} />
          </View>
          <Text style={styles.name}>{admin.firstName} {admin.lastName}</Text>
          <Text style={styles.email}>Username: {admin.username}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>Staff</Text>
          </View>
        </View>

        <Text style={styles.helpText}>
          Your name and username are managed by your course admin. Contact them if these need to change.
        </Text>

        <Text style={styles.sectionTitle}>Appearance</Text>
        <ThemeToggleRow onChange={handleThemeChange} disabled={savingTheme} />

        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={18} color={colors.negative} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
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
    marginBottom: spacing.xs,
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
  helpText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.tiny,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
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
});
}
