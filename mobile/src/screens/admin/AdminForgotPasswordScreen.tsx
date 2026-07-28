import React, { useMemo, useState } from 'react';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { FlagrrLogo } from '../../components/common/FlagrrLogo';
import { PillButton } from '../../components/common/PillButton';
import { TextField } from '../../components/common/TextField';
import { adminApi, AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

type Props = NativeStackScreenProps<AuthStackParamList, 'AdminForgotPassword'>;

export function AdminForgotPasswordScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleRequestCode = async () => {
    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier) {
      showAlert('Enter your email or username', 'Use whichever you normally log in with.');
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.forgotPassword(trimmedIdentifier);
      setStep('reset');
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t send code', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!code.trim()) {
      showAlert('Enter the code', 'Check your email for the 6-digit code we sent you.');
      return;
    }
    if (newPassword.length < 8) {
      showAlert('Password too short', 'Your new password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert('Passwords don’t match', 'Make sure both passwords are the same.');
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
      showAlert('Couldn’t reset password', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity
          onPress={() => (step === 'reset' ? setStep('request') : navigation.goBack())}
          hitSlop={12}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>

        <View style={styles.logoRow}>
          <FlagrrLogo size={72} />
          <Text style={styles.subtitle}>Reset Password</Text>
        </View>

        {step === 'request' ? (
          <View style={styles.form}>
            <Text style={styles.helperText}>
              Enter the email or username on your account and we'll send you a code to reset your password.
            </Text>
            <View style={{ height: spacing.md }} />
            <TextField
              icon="person-outline"
              placeholder="Admin Email or Staff Username"
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleRequestCode}
              value={identifier}
              onChangeText={setIdentifier}
            />
            <View style={{ height: spacing.lg }} />
            <PillButton
              label="Send Code"
              icon="arrow-forward"
              onPress={handleRequestCode}
              loading={submitting}
              disabled={!identifier}
            />
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.helperText}>Enter the code we emailed you and choose a new password.</Text>
            <View style={{ height: spacing.md }} />
            <TextField
              icon="keypad-outline"
              placeholder="6-digit code"
              keyboardType="number-pad"
              returnKeyType="next"
              value={code}
              onChangeText={setCode}
            />
            <View style={{ height: spacing.md }} />
            <TextField
              icon="lock-closed-outline"
              placeholder="New password"
              isPassword
              returnKeyType="next"
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <View style={{ height: spacing.md }} />
            <TextField
              icon="lock-closed-outline"
              placeholder="Confirm new password"
              isPassword
              returnKeyType="done"
              onSubmitEditing={handleResetPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <View style={{ height: spacing.lg }} />
            <PillButton
              label="Update Password"
              icon="checkmark"
              onPress={handleResetPassword}
              loading={submitting}
              disabled={!code || !newPassword || !confirmPassword}
            />

            <TouchableOpacity style={styles.resendRow} onPress={handleRequestCode} disabled={submitting}>
              <Text style={styles.resendText}>
                Didn't get a code? <Text style={styles.resendBold}>Send it again.</Text>
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.darkGreen },
  safeArea: { flex: 1, paddingHorizontal: screenPadding },
  backButton: { width: 32, height: 32, justifyContent: 'center', marginTop: spacing.sm },
  logoRow: { alignItems: 'center', marginTop: spacing.sm, gap: 8 },
  subtitle: { fontFamily: fontFamily.heading, fontSize: 16, color: colors.lime },
  form: { marginTop: spacing.xl },
  helperText: { fontFamily: fontFamily.body, fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 18 },
  resendRow: { alignItems: 'center', marginTop: spacing.lg },
  resendText: { fontFamily: fontFamily.body, fontSize: 13, color: colors.white },
  resendBold: { fontFamily: fontFamily.bodySemiBold, color: colors.lime },
});
}
