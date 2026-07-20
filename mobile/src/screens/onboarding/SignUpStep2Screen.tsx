import React, { useState } from 'react';
import { Alert, ImageBackground, KeyboardAvoidingView, Platform, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { FlagrrLogo } from '../../components/common/FlagrrLogo';
import { PillButton } from '../../components/common/PillButton';
import { TextField } from '../../components/common/TextField';
import { ApiError } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { GOLF_COURSE_BACKGROUND_URI, colors, screenPadding, spacing } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUpStep2'>;

export function SignUpStep2Screen({ navigation, route }: Props) {
  const { signup } = useApp();
  const [username, setUsername] = useState(route.params.email ?? '');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSignUp = async () => {
    setSubmitting(true);
    try {
      await signup({
        firstName: route.params.firstName,
        lastName: route.params.lastName,
        email: username.trim(),
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
    <ImageBackground
      source={{ uri: GOLF_COURSE_BACKGROUND_URI }}
      style={styles.background}
      resizeMode="cover"
    >
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
              icon="person-outline"
              placeholder="Username or Email"
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />
            <View style={{ height: spacing.md }} />
            <TextField icon="lock-closed-outline" placeholder="Password" isPassword value={password} onChangeText={setPassword} />

            <View style={{ height: spacing.lg }} />
            <PillButton
              label="Sign Up"
              disabled={!password || password.length < 8}
              loading={submitting}
              onPress={handleSignUp}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: colors.darkGreen },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlayDarkGreen },
  safeArea: { flex: 1, paddingHorizontal: screenPadding },
  backButton: { width: 32, height: 32, justifyContent: 'center', marginTop: spacing.sm },
  logoRow: { alignItems: 'center', marginTop: spacing.md },
  form: { marginTop: spacing.xl },
});
