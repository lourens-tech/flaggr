import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { api, ApiError } from '../../api/client';
import { showAlert } from '../../utils/alert';
import { friendlyError } from '../../utils/errors';
import { BentoButton, BentoField, BentoScreen, Body, H1, showToast } from '../../components/bento';
import { PasswordField, PromptLink, authTitle } from './authParts';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_ERROR = 'Something went wrong. Please try again.';

// Reset password, two steps on one screen (Bento board AppForgot and the
// kept states G-A-Reset*, G-A-ResendToast): ask for a code by email, then
// enter the code and a new password. Same checks, alerts and calls as
// before; "Send it again." now confirms with a "Code sent" toast (owner
// decision 24 Nov 2026).
export function ForgotPasswordScreen({ navigation }: Props) {
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Server messages written for members stay word for word; raw technical
  // text becomes plain wording (owner decision 24 Nov 2026).
  const failureMessage = (err: unknown) => (err instanceof ApiError ? friendlyError(err, GENERIC_ERROR) : GENERIC_ERROR);

  const handleRequestCode = async (resend = false) => {
    const trimmedEmail = email.trim();
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      showAlert('Enter a valid email', 'Please enter the email address on your Flagrr account.');
      return;
    }
    setSubmitting(true);
    try {
      await api.forgotPassword(trimmedEmail);
      setStep('reset');
      if (resend) showToast('Code sent', 'Check your email for the new code.');
    } catch (err) {
      showAlert('Couldn’t send code', failureMessage(err));
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
      await api.resetPassword(email.trim(), code.trim(), newPassword);
      showAlert('Password reset', 'Your password has been changed. You can now log in with it.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err) {
      showAlert('Couldn’t reset password', failureMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <BentoScreen gap={16} onBack={() => (step === 'reset' ? setStep('request') : navigation.goBack())}>
        <View style={{ height: 18 }} />
        <H1 style={authTitle(32)}>Reset Password</H1>

        {step === 'request' ? (
          <>
            <Body muted style={{ fontSize: 16, lineHeight: 24 }}>
              Enter the email address on your account and we'll send you a code to reset your password.
            </Body>
            <BentoField
              label="Email"
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="done"
              onSubmitEditing={() => handleRequestCode()}
              value={email}
              onChangeText={setEmail}
            />
            <View style={{ height: 6 }} />
            <BentoButton
              label="Send Code"
              nub={!submitting}
              onPress={() => handleRequestCode()}
              loading={submitting}
              disabled={!email}
              style={submitting ? { opacity: 0.45 } : undefined}
            />
          </>
        ) : (
          <>
            <Body muted style={{ fontSize: 16, lineHeight: 24 }}>
              Enter the code we sent to {email} and choose a new password.
            </Body>
            <BentoField
              label="6-digit code"
              placeholder="6-digit code"
              keyboardType="number-pad"
              returnKeyType="next"
              value={code}
              onChangeText={setCode}
            />
            <PasswordField label="New password" placeholder="New password" returnKeyType="next" value={newPassword} onChangeText={setNewPassword} />
            <PasswordField
              label="Confirm new password"
              placeholder="Confirm new password"
              returnKeyType="done"
              onSubmitEditing={handleResetPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <View style={{ height: 6 }} />
            <BentoButton
              label="Update Password"
              nub={!submitting}
              onPress={handleResetPassword}
              loading={submitting}
              disabled={!code || !newPassword || !confirmPassword}
              style={submitting ? { opacity: 0.45 } : undefined}
            />
            <PromptLink prompt="Didn't get a code?" link="Send it again." disabled={submitting} onPress={() => handleRequestCode(true)} />
          </>
        )}
      </BentoScreen>
    </KeyboardAvoidingView>
  );
}
