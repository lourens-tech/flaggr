import React, { useState } from 'react';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { FlagrrLogo } from '../../components/common/FlagrrLogo';
import { PillButton } from '../../components/common/PillButton';
import { TextField } from '../../components/common/TextField';
import { AdminApiError } from '../../api/adminClient';
import { useAdmin } from '../../context/AdminContext';
import { showAlert } from '../../utils/alert';
import { colors, fontFamily, screenPadding, spacing } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'AdminLogin'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AdminLoginScreen({ navigation }: Props) {
  const { login } = useAdmin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
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
      await login(email.trim(), password);
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t log in', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>

        <View style={styles.logoRow}>
          <FlagrrLogo size={72} />
          <Text style={styles.subtitle}>Course Admin</Text>
        </View>

        <View style={styles.form}>
          <TextField
            icon="mail-outline"
            placeholder="Admin Email"
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

          <View style={{ height: spacing.lg }} />
          <PillButton label="Login" icon="arrow-forward" onPress={handleLogin} loading={submitting} disabled={!email || !password} />
        </View>

        <Text style={styles.footerText}>
          Course admin accounts are set up by Flagrr — contact us if you need access or have trouble logging in.
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.darkGreen },
  safeArea: { flex: 1, paddingHorizontal: screenPadding },
  backButton: { width: 32, height: 32, justifyContent: 'center', marginTop: spacing.sm },
  logoRow: { alignItems: 'center', marginTop: spacing.sm, gap: 8 },
  subtitle: { fontFamily: fontFamily.heading, fontSize: 16, color: colors.lime },
  form: { marginTop: spacing.xl },
  footerText: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 'auto',
    marginBottom: spacing.xl,
    lineHeight: 18,
  },
});
