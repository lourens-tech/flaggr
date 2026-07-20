import React, { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { FlagrrLogo } from '../../components/common/FlagrrLogo';
import { PillButton } from '../../components/common/PillButton';
import { TextField } from '../../components/common/TextField';
import { ApiError } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { ONBOARDING_BACKGROUNDS, colors, fontFamily, screenPadding, spacing } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUpStep2'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

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
        courseId: route.params.courseId,
        password,
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      Alert.alert('Couldn’t create your account', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.background}>
      {/* ImageBackground's inner <img> doesn't respect resizeMode="cover" on
          web (renders at native pixel size, causing horizontal overflow and a
          gap below) — an absolutely-positioned Image is the reliable fix. */}
      <Image
        source={ONBOARDING_BACKGROUNDS.signUpStep2}
        style={[StyleSheet.absoluteFill, styles.backgroundImageSize]}
        resizeMode="cover"
      />
      <StatusBar barStyle="light-content" />
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>

        <View style={styles.logoRow}>
          <FlagrrLogo size={36} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.form}>
            <TextField
              icon="mail-outline"
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
            <View style={{ height: spacing.md }} />
            <TextField
              icon="lock-closed-outline"
              placeholder="Password"
              isPassword
              returnKeyType="next"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (passwordError) setPasswordError(undefined);
                if (confirmPasswordError) setConfirmPasswordError(undefined);
              }}
              error={passwordError}
            />
            {!passwordError ? <Text style={styles.hint}>At least {MIN_PASSWORD_LENGTH} characters</Text> : null}
            <View style={{ height: spacing.md }} />
            <TextField
              icon="lock-closed-outline"
              placeholder="Confirm Password"
              isPassword
              returnKeyType="done"
              onSubmitEditing={handleSignUp}
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (confirmPasswordError) setConfirmPasswordError(undefined);
              }}
              error={confirmPasswordError}
            />

            <View style={{ height: spacing.lg }} />
            <PillButton label="Sign Up" loading={submitting} onPress={handleSignUp} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: colors.darkGreen },
  // react-native-web's <Image> bakes the source asset's intrinsic width/height
  // into its own style array, which otherwise wins over absoluteFill's inset
  // properties — explicit 100% here overrides that.
  backgroundImageSize: { width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlayDarkGreen },
  safeArea: { flex: 1, paddingHorizontal: screenPadding },
  backButton: { width: 32, height: 32, justifyContent: 'center', marginTop: spacing.sm },
  logoRow: { alignItems: 'center', marginTop: spacing.md },
  form: { marginTop: spacing.xl },
  hint: { fontFamily: fontFamily.body, fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4, marginLeft: 4 },
});
