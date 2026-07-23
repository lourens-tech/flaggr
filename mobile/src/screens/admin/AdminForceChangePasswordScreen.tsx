import React, { useState, useMemo } from 'react';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

// Shown instead of the normal admin/staff nav whenever admin.mustChangePassword
// is true — currently only set for a newly-created staff account logging in
// with its system-generated temp password for the first time.
export function AdminForceChangePasswordScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { admin, changePassword, logout } = useAdmin();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!currentPassword || newPassword.length < 8) {
      showAlert('Missing info', 'Enter your temporary password and a new password (min. 8 characters).');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert('Passwords don’t match', 'Make sure both new password fields match.');
      return;
    }
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t change password', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Set Your Password</Text>
          <Text style={styles.headerSubtitle}>{admin.firstName} {admin.lastName}</Text>
        </View>
      </SafeAreaView>

      <View style={styles.content}>
        <Text style={styles.intro}>
          Welcome to Flagrr. Enter the temporary password you were emailed, then choose a new password for your
          account.
        </Text>

        <TextField
          placeholder="Temporary Password"
          variant="onLight"
          isPassword
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />
        <View style={{ height: spacing.md }} />
        <TextField placeholder="New Password" variant="onLight" isPassword value={newPassword} onChangeText={setNewPassword} />
        <View style={{ height: spacing.md }} />
        <TextField
          placeholder="Confirm New Password"
          variant="onLight"
          isPassword
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <View style={{ height: spacing.lg }} />
        <PillButton label="Set Password" onPress={handleSubmit} loading={saving} />

        <TouchableOpacity onPress={() => logout()} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
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
  content: { flex: 1, padding: screenPadding, paddingTop: spacing.xl },
  intro: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  logoutButton: { alignItems: 'center', marginTop: spacing.lg },
  logoutText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.negative },
});
}
