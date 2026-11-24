import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { ApiError } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { useBento } from '../../context/ThemeContext';
import { showAlert } from '../../utils/alert';
import { friendlyError } from '../../utils/errors';
import { ONBOARDING_BACKGROUNDS } from '../../theme';
import { BentoButton, BentoField, BentoIcon, H1 } from '../../components/bento';
import { AuthPhotoScreen, PasswordField, PhotoBackButton, PromptLink, authTitle } from './authParts';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_ERROR = 'Something went wrong. Please try again.';

// Login (Bento boards AppLogin and the kept Login states G-A-Login*): back,
// "Welcome back", Email, Password with the eye, Keep me logged in, Login,
// "Forgot Password? Recover here." and the sign-up link. Same validation,
// call and navigation as before.
export function LoginScreen({ navigation }: Props) {
  const { t } = useBento();
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const trimmedEmail = email.trim();
    const nextEmailError = !trimmedEmail
      ? 'Email is required'
      : !EMAIL_PATTERN.test(trimmedEmail)
        ? 'Enter a valid email address'
        : undefined;
    const nextPasswordError = !password ? 'Password is required' : undefined;

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    return !nextEmailError && !nextPasswordError;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await login(email.trim(), password, keepLoggedIn);
    } catch (err) {
      // Server messages written for members stay word for word; raw technical
      // text becomes plain wording (owner decision 24 Nov 2026).
      const message = err instanceof ApiError ? friendlyError(err, GENERIC_ERROR) : GENERIC_ERROR;
      showAlert('Couldn’t log in', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPhotoScreen photo={ONBOARDING_BACKGROUNDS.signUpStep1} gap={14}>
      <PhotoBackButton onPress={() => navigation.goBack()} />
      <View style={{ height: 112 }} />
      <H1 style={authTitle(36)}>Welcome back</H1>

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
        returnKeyType="done"
        onSubmitEditing={handleLogin}
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          if (passwordError) setPasswordError(undefined);
        }}
        error={passwordError}
      />

      <Pressable
        onPress={() => setKeepLoggedIn((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityLabel="Keep me logged in."
        accessibilityState={{ checked: keepLoggedIn }}
        aria-checked={keepLoggedIn}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, alignSelf: 'flex-start' }}
      >
        <View
          style={
            keepLoggedIn
              ? { width: 24, height: 24, borderRadius: 8, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }
              : { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, borderColor: t.muted }
          }
        >
          {keepLoggedIn ? <BentoIcon name="check" size={16} color={t.accentInk} strokeWidth={2.4} /> : null}
        </View>
        <Text style={{ fontSize: 15, color: t.ink }}>Keep me logged in.</Text>
      </Pressable>

      <BentoButton
        label="Login"
        nub={!submitting}
        onPress={handleLogin}
        loading={submitting}
        disabled={!email || !password}
        style={submitting ? { opacity: 0.45 } : undefined}
      />

      <PromptLink prompt="Forgot Password?" link="Recover here." size={14} onPress={() => navigation.navigate('ForgotPassword')} />
      <PromptLink prompt="Don't have an account?" link="Sign Up!" split onPress={() => navigation.navigate('SignUpStep1')} />
    </AuthPhotoScreen>
  );
}
