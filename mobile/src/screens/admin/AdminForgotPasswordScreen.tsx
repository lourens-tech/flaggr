import React, { useState } from 'react';
import { Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { FlagrrLogo } from '../../components/common/FlagrrLogo';
import { TextField } from '../../components/common/TextField';
import { adminApi, AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import { adminFont, adminRadius } from '../../theme/admin';
import { AdminButton, Banner, FLAGRR_BACKDROP, Glass } from '../../components/admin/ui';

type Props = NativeStackScreenProps<AuthStackParamList, 'AdminForgotPassword'>;

// White and lime sit straight on the darkened photo in both themes.
const ON_PHOTO = '#FFFFFF';
const LIME = '#CDDE5C';
const SCRIM = ['rgba(6,14,10,0.5)', 'rgba(6,14,10,0.72)'] as const;

export function AdminForgotPasswordScreen({ navigation }: Props) {
  const { c, scheme } = useAdminTheme();
  const { width } = useWindowDimensions();
  // Wide windows get a glass card. Phones in dark mode put the form straight
  // on the darkened photo; in light mode the light fields need the card.
  const glassCard = width >= 600 || scheme === 'light';
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Problems show in a banner on the card (they used to be alerts).
  const [error, setError] = useState<{ title: string; body: string } | null>(null);

  const handleRequestCode = async () => {
    const trimmedIdentifier = identifier.trim();
    setError(null);
    if (!trimmedIdentifier) {
      setError({ title: 'Enter your email or username', body: 'Use whichever you normally log in with.' });
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.forgotPassword(trimmedIdentifier);
      setStep('reset');
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      setError({ title: 'Couldn’t send code', body: message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    setError(null);
    if (!code.trim()) {
      setError({ title: 'Enter the code', body: 'Check your email for the 6-digit code we sent you.' });
      return;
    }
    if (newPassword.length < 8) {
      setError({ title: 'Password too short', body: 'Your new password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setError({ title: 'Passwords don’t match', body: 'Make sure both passwords are the same.' });
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.resetPassword(identifier.trim(), code.trim(), newPassword);
      showAlert('Password reset', 'Your password has been changed. You can now log in with it.', [
        { text: 'OK', onPress: () => navigation.navigate('AdminLogin') },
      ]);
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      setError({ title: 'Couldn’t reset password', body: message });
    } finally {
      setSubmitting(false);
    }
  };

  const form =
    step === 'request' ? (
      <>
        <Text style={[styles.helperText, { color: c.ink2 }]}>
          Enter the email or username on your account and we'll send you a code to reset your password.
        </Text>
        {error ? <Banner tone="neg" title={error.title} body={error.body} style={styles.banner} /> : null}
        <TextField
          icon="person-outline"
          placeholder="Admin Email or Staff Username"
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={handleRequestCode}
          value={identifier}
          onChangeText={setIdentifier}
        />
        <AdminButton
          label="Send Code"
          variant="accent"
          size="lg"
          fullWidth
          onPress={handleRequestCode}
          loading={submitting}
          disabled={!identifier}
          style={styles.primary}
        />
      </>
    ) : (
      <>
        <Text style={[styles.helperText, { color: c.ink2 }]}>Enter the code we emailed you and choose a new password.</Text>
        {error ? <Banner tone="neg" title={error.title} body={error.body} style={styles.banner} /> : null}
        <TextField
          icon="keypad-outline"
          placeholder="6-digit code"
          keyboardType="number-pad"
          returnKeyType="next"
          value={code}
          onChangeText={setCode}
        />
        <View style={{ height: 12 }} />
        <TextField
          icon="lock-closed-outline"
          placeholder="New password"
          isPassword
          returnKeyType="next"
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <View style={{ height: 12 }} />
        <TextField
          icon="lock-closed-outline"
          placeholder="Confirm new password"
          isPassword
          returnKeyType="done"
          onSubmitEditing={handleResetPassword}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <AdminButton
          label="Update Password"
          variant="accent"
          size="lg"
          fullWidth
          onPress={handleResetPassword}
          loading={submitting}
          disabled={!code || !newPassword || !confirmPassword}
          style={styles.primary}
        />

        <TouchableOpacity style={styles.linkRow} onPress={handleRequestCode} disabled={submitting} accessibilityRole="button">
          <Text style={[styles.linkText, { color: c.ink2 }]}>
            Didn't get a code? <Text style={[styles.linkBold, { color: c.accentText }]}>Send it again.</Text>
          </Text>
        </TouchableOpacity>
      </>
    );

  return (
    <View style={[styles.container, { backgroundColor: c.base }]}>
      <StatusBar barStyle="light-content" />
      <Image source={FLAGRR_BACKDROP} resizeMode="cover" style={styles.photo} accessible={false} />
      <LinearGradient colors={SCRIM} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity
          onPress={() => {
            setError(null);
            if (step === 'reset') setStep('request');
            else navigation.goBack();
          }}
          hitSlop={12}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={ON_PHOTO} />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.mark}>
            <FlagrrLogo color="lime" showTagline={false} size={72} />
            <Text style={styles.role}>Reset Password</Text>
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
  container: { flex: 1 },
  photo: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  safeArea: { flex: 1 },
  backButton: { width: 44, height: 44, justifyContent: 'center', marginLeft: 12, marginTop: 4 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingBottom: 32 },
  mark: { alignItems: 'center', gap: 10, marginBottom: 22 },
  role: { ...adminFont.bodyBold, fontSize: 12, letterSpacing: 1.7, textTransform: 'uppercase', color: LIME },
  card: { width: 420, maxWidth: '100%', paddingVertical: 8 },
  cardGlass: { paddingHorizontal: 28, paddingTop: 28, paddingBottom: 22 },
  helperText: { ...adminFont.body, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  banner: { marginBottom: 14 },
  primary: { marginTop: 20 },
  linkRow: { alignItems: 'center', justifyContent: 'center', marginTop: 10, minHeight: 44 },
  linkText: { ...adminFont.body, fontSize: 13.5 },
  linkBold: { ...adminFont.bodySemiBold },
});
