import React, { useState } from 'react';
import { Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { FlagrrLogo } from '../../components/common/FlagrrLogo';
import { TextField } from '../../components/common/TextField';
import { AdminApiError } from '../../api/adminClient';
import { useAdmin } from '../../context/AdminContext';
import { useAdminTheme } from '../../context/ThemeContext';
import { adminFont, adminRadius } from '../../theme/admin';
import { AdminButton, Banner, FLAGRR_BACKDROP, Glass } from '../../components/admin/ui';

type Props = NativeStackScreenProps<AuthStackParamList, 'AdminLogin'>;

// White and lime sit straight on the darkened photo in both themes.
const ON_PHOTO = '#FFFFFF';
const ON_PHOTO_MUTED = 'rgba(244,245,240,0.72)';
const LIME = '#CDDE5C';
const SCRIM = ['rgba(6,14,10,0.5)', 'rgba(6,14,10,0.72)'] as const;

export function AdminLoginScreen({ navigation }: Props) {
  const { c, scheme } = useAdminTheme();
  const { width } = useWindowDimensions();
  // Wide windows get a glass card. Phones in dark mode put the form straight
  // on the darkened photo; in light mode the light fields need the card.
  const glassCard = width >= 600 || scheme === 'light';
  const { login } = useAdmin();
  // A course admin logs in with their email; a staff account logs in with
  // a username instead (see api/admin/index.ts's login action) — one field
  // accepts either.
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [identifierError, setIdentifierError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  // A failed login shows in a banner on the card (it used to be an alert).
  const [loginError, setLoginError] = useState<string | null>(null);

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
    setLoginError(null);
    setSubmitting(true);
    try {
      await login(identifier.trim(), password);
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      setLoginError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const form = (
    <>
      {loginError ? <Banner tone="neg" title="Couldn’t log in" body={loginError} style={styles.banner} /> : null}
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
      <View style={{ height: 12 }} />
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

      <AdminButton
        label="Login"
        variant="accent"
        size="lg"
        fullWidth
        onPress={handleLogin}
        loading={submitting}
        disabled={!identifier || !password}
        style={styles.primary}
      />

      <TouchableOpacity
        style={styles.linkRow}
        onPress={() => navigation.navigate('AdminForgotPassword')}
        accessibilityRole="button"
      >
        <Text style={[styles.linkText, { color: c.ink2 }]}>
          Forgot Password? <Text style={[styles.linkBold, { color: c.accentText }]}>Recover here.</Text>
        </Text>
      </TouchableOpacity>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: c.base }]}>
      <StatusBar barStyle="light-content" />
      <Image source={FLAGRR_BACKDROP} resizeMode="cover" style={styles.photo} accessible={false} />
      <LinearGradient colors={SCRIM} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={ON_PHOTO} />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.mark}>
            <FlagrrLogo color="lime" showTagline={false} size={72} />
            <Text style={styles.role}>Course Admin</Text>
          </View>

          {glassCard ? (
            <Glass radius={adminRadius.lg} style={[styles.card, styles.cardGlass]}>
              {form}
            </Glass>
          ) : (
            <View style={styles.card}>{form}</View>
          )}

          <Text style={styles.footerText}>
            Course admin accounts are set up by Flagrr — contact us if you need access or have trouble logging in.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  photo: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  safeArea: { flex: 1 },
  backButton: { width: 44, height: 44, justifyContent: 'center', marginLeft: 12, marginTop: 4 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingBottom: 32 },
  mark: { alignItems: 'center', gap: 10, marginBottom: 22 },
  role: { ...adminFont.bodyBold, fontSize: 12, letterSpacing: 1.7, textTransform: 'uppercase', color: LIME },
  card: { width: 420, maxWidth: '100%', paddingVertical: 8 },
  cardGlass: { paddingHorizontal: 28, paddingTop: 28, paddingBottom: 22 },
  banner: { marginBottom: 14 },
  primary: { marginTop: 20 },
  linkRow: { alignItems: 'center', justifyContent: 'center', marginTop: 10, minHeight: 44 },
  linkText: { ...adminFont.body, fontSize: 13.5 },
  linkBold: { ...adminFont.bodySemiBold },
  footerText: {
    ...adminFont.body,
    fontSize: 12.5,
    color: ON_PHOTO_MUTED,
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 18,
    maxWidth: 420,
  },
});
