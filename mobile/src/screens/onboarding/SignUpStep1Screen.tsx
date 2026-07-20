import React, { useState } from 'react';
import { ImageBackground, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { FlagrrLogo } from '../../components/common/FlagrrLogo';
import { PillButton } from '../../components/common/PillButton';
import { TextField } from '../../components/common/TextField';
import { GOLF_COURSE_BACKGROUND_URI, colors, fontFamily, screenPadding, spacing } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUpStep1'>;

export function SignUpStep1Screen({ navigation }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [golfClub, setGolfClub] = useState('');

  const canContinue = fullName.trim().length > 0 && email.trim().length > 0;
  const [firstName, ...rest] = fullName.trim().split(' ');

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

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.form}>
              <TextField icon="lock-closed-outline" placeholder="Full Name" value={fullName} onChangeText={setFullName} />
              <View style={{ height: spacing.md }} />
              <TextField placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
              <View style={{ height: spacing.md }} />
              <TextField placeholder="Phone Number" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
              <View style={{ height: spacing.md }} />
              <TextField placeholder="Birthday" value={birthday} onChangeText={setBirthday} />
              <View style={{ height: spacing.md }} />
              <TextField placeholder="Golf Club" value={golfClub} onChangeText={setGolfClub} />

              <View style={{ height: spacing.lg }} />
              <PillButton
                label="Next Step"
                disabled={!canContinue}
                onPress={() =>
                  navigation.navigate('SignUpStep2', {
                    firstName: firstName ?? '',
                    lastName: rest.join(' '),
                    email,
                  })
                }
              />
            </View>

            <TouchableOpacity style={styles.loginRow} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginText}>Already have an account?</Text>
              <Text style={styles.loginBold}>Login!</Text>
            </TouchableOpacity>
          </ScrollView>
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
  scrollContent: { flexGrow: 1, justifyContent: 'space-between' },
  form: { marginTop: spacing.xl },
  loginRow: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xl, gap: 4 },
  loginText: { fontFamily: fontFamily.body, fontSize: 13, color: colors.white },
  loginBold: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.lime },
});
