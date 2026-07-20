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

export function LoginScreen({ navigation }: Props) {
  const { login } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) return;
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      Alert.alert('Couldn’t log in', message);
    } finally {
      setSubmitting(false);
    }
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
            icon="person-outline"
            placeholder="Username or Email"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
          <View style={{ height: spacing.md }} />
          <TextField
            icon="lock-closed-outline"
            placeholder="Password"
            isPassword
            value={password}
            onChangeText={setPassword}
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
            disabled={!username || !password}
          />

          <TouchableOpacity style={styles.forgotRow}>
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
