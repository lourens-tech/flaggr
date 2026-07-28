import React, { useState, useMemo } from 'react';
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
import { fontFamily, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

type Props = NativeStackScreenProps<AuthStackParamList, 'AdminLogin'>;

export function AdminLoginScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { login } = useAdmin();
  // A course admin logs in with their email; a staff account logs in with
  // a username instead (see api/admin/index.ts's login action) — one field
  // accepts either.
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [identifierError, setIdentifierError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const trimmedIdentifier = identifier.trim();
    const nextIdentifierError = !trimmedIdentifier ? 'Email or username is required' : undefined;
    const nextPasswordError = !password ? 'Password is required' : undefined;
    setIdentifierError(nextIdentifierError);
    setPasswordError(nextPasswordError);
    return !nextIdentifierError && !nextPasswordError;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await login(identifier.trim(), password);
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
            icon="person-outline"
            placeholder="Admin Email or Staff Username"
            autoCapitalize="none"
            returnKeyType="next"
            value={identifier}
            onChangeText={(text) => {
              setIdentifier(text);
              if (identifierError) setIdentifierError(undefined);
            }}
            error={identifierError}
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
          <PillButton label="Login" icon="arrow-forward" onPress={handleLogin} loading={submitting} disabled={!identifier || !password} />

          <TouchableOpacity style={styles.forgotRow} onPress={() => navigation.navigate('AdminForgotPassword')}>
            <Text style={styles.forgotText}>
              Forgot Password? <Text style={styles.forgotBold}>Recover here.</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>
          Course admin accounts are set up by Flagrr — contact us if you need access or have trouble logging in.
        </Text>
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
  forgotRow: { alignItems: 'center', marginTop: spacing.lg },
  forgotText: { fontFamily: fontFamily.body, fontSize: 13, color: colors.white },
  forgotBold: { fontFamily: fontFamily.bodySemiBold, color: colors.lime },
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
}
