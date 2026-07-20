import React, { useState } from 'react';
import { Alert, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { FlagrrLogo } from '../../components/common/FlagrrLogo';
import { PillButton } from '../../components/common/PillButton';
import { TextField } from '../../components/common/TextField';
import { ApiError } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { colors, fontFamily, screenPadding, spacing } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginScreen({ navigation }: Props) {
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
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      Alert.alert('Couldn’t log in', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Reset your password',
      'Password reset isn’t available in the app yet — please contact your club for help getting back into your account.',
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
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
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (passwordError) setPasswordError(undefined);
            }}
            error={passwordError}
          />

          <TouchableOpacity
            style={styles.rememberRow}
            onPress={() => setKeepLoggedIn((v) => !v)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={keepLoggedIn ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={keepLoggedIn ? colors.lime : 'rgba(255,255,255,0.6)'}
            />
            <Text style={styles.rememberText}>Keep me logged in.</Text>
          </TouchableOpacity>

          <View style={{ height: spacing.lg }} />
          <PillButton
            label="Login"
            icon="arrow-forward"
            onPress={handleLogin}
            loading={submitting}
            disabled={!email || !password}
          />

          <TouchableOpacity style={styles.forgotRow} onPress={handleForgotPassword}>
            <Text style={styles.forgotText}>
              Forgot Password? <Text style={styles.forgotBold}>Recover here.</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.signupRow}
          onPress={() => navigation.navigate('SignUpStep1')}
        >
          <Text style={styles.signupText}>Don't have an account?</Text>
          <Text style={styles.signupBold}>Sign Up!</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.darkGreen },
  safeArea: { flex: 1, paddingHorizontal: screenPadding },
  backButton: { width: 32, height: 32, justifyContent: 'center', marginTop: spacing.sm },
  logoRow: { alignItems: 'center', marginTop: spacing.lg },
  form: { marginTop: spacing.xxl },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md },
  rememberText: { fontFamily: fontFamily.body, fontSize: 12, color: colors.white },
  forgotRow: { alignItems: 'center', marginTop: spacing.lg },
  forgotText: { fontFamily: fontFamily.body, fontSize: 13, color: colors.white },
  forgotBold: { fontFamily: fontFamily.bodySemiBold, color: colors.lime },
  signupRow: { alignItems: 'center', marginTop: 'auto', marginBottom: spacing.xl, gap: 4 },
  signupText: { fontFamily: fontFamily.body, fontSize: 13, color: colors.white },
  signupBold: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.lime },
});
