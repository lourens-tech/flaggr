import React, { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { ApiError } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { showAlert } from '../../utils/alert';
import { friendlyError } from '../../utils/errors';
import { ONBOARDING_BACKGROUNDS } from '../../theme';
import { BentoButton, BentoField } from '../../components/bento';
import { AuthPhotoScreen, LegalLine, PasswordField, PhotoBackButton, SignUpHeader } from './authParts';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUpStep2'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const GENERIC_ERROR = 'Something went wrong. Please try again.';

// Sign up step 2 (Bento boards AppSignUp2 and the kept states G-A-SignUp2*,
// G-A-SignUpFailed): email, password with the "At least 8 characters" hint,
// confirmation, Sign Up. Same validation and call as before. The Terms of
// Use and Privacy Notice line under Sign Up opens Terms and Privacy (owner
// decision 24 Nov 2026; drawn in the style of G-A-LandingStore's line).
export function SignUpStep2Screen({ navigation, route }: Props) {
  const { signup } = useApp();
  const [email, setEmail] = useState(route.params.email ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const trimmedEmail = email.trim();
    const nextEmailError = !trimmedEmail
      ? 'Email is required'
      : !EMAIL_PATTERN.test(trimmedEmail)
        ? 'Enter a valid email address'
        : undefined;
    const nextPasswordError =
      password.length < MIN_PASSWORD_LENGTH ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters` : undefined;
    const nextConfirmPasswordError =
      !nextPasswordError && confirmPassword !== password ? 'Passwords do not match' : undefined;

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setConfirmPasswordError(nextConfirmPasswordError);
    return !nextEmailError && !nextPasswordError && !nextConfirmPasswordError;
  };

  const handleSignUp = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await signup({
        firstName: route.params.firstName,
        lastName: route.params.lastName,
        email: email.trim(),
        phone: route.params.phone || undefined,
        dateOfBirth: route.params.dateOfBirth,
        courseId: route.params.courseId,
        referralCode: route.params.referralCode,
        password,
      });
    } catch (err) {
      // Server messages written for members stay word for word; raw technical
      // text becomes plain wording (owner decision 24 Nov 2026).
      const message = err instanceof ApiError ? friendlyError(err, GENERIC_ERROR) : GENERIC_ERROR;
      showAlert('Couldn’t create your account', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPhotoScreen photo={ONBOARDING_BACKGROUNDS.signUpStep2} gap={16}>
      <PhotoBackButton onPress={() => navigation.goBack()} />
      <View style={{ height: 96 }} />
      <SignUpHeader step={2} title="Set a password" />

      <BentoField
        label="Email"
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        returnKeyType="next"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (emailError) setEmailError(undefined);
        }}
        error={emailError}
      />
      <PasswordField
        label="Password"
        placeholder="Password"
        returnKeyType="next"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          if (passwordError) setPasswordError(undefined);
          if (confirmPasswordError) setConfirmPasswordError(undefined);
        }}
        helper={`At least ${MIN_PASSWORD_LENGTH} characters`}
        error={passwordError}
      />
      <PasswordField
        label="Confirm Password"
        placeholder="Confirm Password"
        returnKeyType="done"
        onSubmitEditing={handleSignUp}
        value={confirmPassword}
        onChangeText={(text) => {
          setConfirmPassword(text);
          if (confirmPasswordError) setConfirmPasswordError(undefined);
        }}
        error={confirmPasswordError}
      />

      <View style={{ height: 6 }} />
      <BentoButton label="Sign Up" nub={!submitting} loading={submitting} onPress={handleSignUp} style={submitting ? { opacity: 0.45 } : undefined} />
      <LegalLine
        onTerms={() => navigation.navigate('TermsPrivacy', { section: 'terms' })}
        onPrivacy={() => navigation.navigate('TermsPrivacy', { section: 'privacy' })}
      />
    </AuthPhotoScreen>
  );
}
