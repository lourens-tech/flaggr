import React, { useState } from 'react';
import { Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { TextField } from '../../components/common/TextField';
import { FlagrrLogo } from '../../components/common/FlagrrLogo';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { useAdminTheme } from '../../context/ThemeContext';
import { adminFont, adminRadius } from '../../theme/admin';
import { AdminButton, Banner, FLAGRR_BACKDROP, Glass } from '../../components/admin/ui';

const SCRIM = ['rgba(6,14,10,0.5)', 'rgba(6,14,10,0.72)'] as const;

// Shown instead of the normal admin/staff nav whenever admin.mustChangePassword
// is true — currently only set for a newly-created staff account logging in
// with its system-generated temp password for the first time.
export function AdminForceChangePasswordScreen() {
  const { c, scheme } = useAdminTheme();
  const { width } = useWindowDimensions();
  // Wide windows get a glass card. Phones in dark mode put the form straight
  // on the darkened photo; in light mode the light fields need the card.
  const glassCard = width >= 600 || scheme === 'light';
  const { admin, changePassword, logout } = useAdmin();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  // Problems show in a banner on the card (they used to be alerts).
  const [error, setError] = useState<{ title: string; body: string } | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!currentPassword || newPassword.length < 8) {
      setError({ title: 'Missing info', body: 'Enter your temporary password and a new password (min. 8 characters).' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setError({ title: 'Passwords don’t match', body: 'Make sure both new password fields match.' });
      return;
    }
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      setError({ title: 'Couldn’t change password', body: message });
    } finally {
      setSaving(false);
    }
  };

  const form = (
    <>
      <Text accessibilityRole="header" style={[styles.title, { color: c.ink }]}>
        Set Your Password
      </Text>
      <Text style={[styles.name, { color: c.ink2 }]}>
        {admin.firstName} {admin.lastName}
      </Text>
      <Text style={[styles.intro, { color: c.ink2 }]}>
        Welcome to Flagrr. Enter the temporary password you were emailed, then choose a new password for your
        account.
      </Text>

      {error ? <Banner tone="neg" title={error.title} body={error.body} style={styles.banner} /> : null}

      <TextField
        placeholder="Temporary Password"
        variant="onLight"
        isPassword
        value={currentPassword}
        onChangeText={setCurrentPassword}
      />
      <View style={{ height: 12 }} />
      <TextField placeholder="New Password" variant="onLight" isPassword value={newPassword} onChangeText={setNewPassword} />
      <View style={{ height: 12 }} />
      <TextField
        placeholder="Confirm New Password"
        variant="onLight"
        isPassword
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <AdminButton label="Set Password" variant="accent" size="lg" fullWidth onPress={handleSubmit} loading={saving} style={styles.primary} />

      <TouchableOpacity onPress={() => logout()} style={styles.logoutButton} accessibilityRole="button">
        <Text style={[styles.logoutText, { color: c.neg }]}>Log Out</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <View style={[styles.screen, { backgroundColor: c.base }]}>
      <StatusBar barStyle="light-content" />
      <Image source={FLAGRR_BACKDROP} resizeMode="cover" style={styles.photo} accessible={false} />
      <LinearGradient colors={SCRIM} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.mark}>
            <FlagrrLogo color="lime" showTagline={false} size={72} />
          </View>

          {glassCard ? (
            <Glass radius={adminRadius.lg} style={[styles.card, styles.cardGlass]}>
              {form}
            </Glass>
          ) : (
            <View style={styles.card}>{form}</View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  photo: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 32 },
  mark: { alignItems: 'center', marginBottom: 22 },
  card: { width: 420, maxWidth: '100%', paddingVertical: 8 },
  cardGlass: { paddingHorizontal: 28, paddingTop: 28, paddingBottom: 22 },
  title: { ...adminFont.bodyBold, fontSize: 22 },
  name: { ...adminFont.body, fontSize: 13.5, marginTop: 2 },
  intro: { ...adminFont.body, fontSize: 14, lineHeight: 20, marginTop: 10, marginBottom: 16 },
  banner: { marginBottom: 14 },
  primary: { marginTop: 20 },
  logoutButton: { alignItems: 'center', justifyContent: 'center', marginTop: 10, minHeight: 44 },
  logoutText: { ...adminFont.bodySemiBold, fontSize: 15 },
});
