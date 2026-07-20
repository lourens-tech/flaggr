import React, { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { FlagrrLogo } from '../../components/common/FlagrrLogo';
import { PillButton } from '../../components/common/PillButton';
import { TextField } from '../../components/common/TextField';
import { SelectField } from '../../components/common/SelectField';
import { api, type Course } from '../../api/client';
import { ONBOARDING_BACKGROUNDS, colors, fontFamily, screenPadding, spacing } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUpStep1'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignUpStep1Screen({ navigation }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [nameError, setNameError] = useState<string | undefined>();
  const [emailError, setEmailError] = useState<string | undefined>();
  const [courseError, setCourseError] = useState<string | undefined>();

  useEffect(() => {
    api
      .courses()
      .then((list) => {
        setCourses(list);
        if (list.length === 1) setCourseId(list[0].id);
      })
      .catch(() => setCourses([]))
      .finally(() => setLoadingCourses(false));
  }, []);

  const [firstName, ...rest] = fullName.trim().split(' ');

  const validate = () => {
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const nextNameError = !trimmedName ? 'Full name is required' : undefined;
    const nextEmailError = !trimmedEmail
      ? 'Email is required'
      : !EMAIL_PATTERN.test(trimmedEmail)
        ? 'Enter a valid email address'
        : undefined;
    const nextCourseError = !courseId ? 'Select your golf club' : undefined;

    setNameError(nextNameError);
    setEmailError(nextEmailError);
    setCourseError(nextCourseError);
    return !nextNameError && !nextEmailError && !nextCourseError;
  };

  const handleNext = () => {
    if (!validate()) return;
    navigation.navigate('SignUpStep2', {
      firstName: firstName ?? '',
      lastName: rest.join(' '),
      email: email.trim(),
      phone,
      courseId: courseId!,
    });
  };

  return (
    <View style={styles.background}>
      {/* ImageBackground's inner <img> doesn't respect resizeMode="cover" on
          web (renders at native pixel size, causing horizontal overflow and a
          gap below) — an absolutely-positioned Image is the reliable fix. */}
      <Image
        source={ONBOARDING_BACKGROUNDS.signUpStep1}
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

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.form}>
              <TextField
                icon="person-outline"
                placeholder="Full Name"
                returnKeyType="next"
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  if (nameError) setNameError(undefined);
                }}
                error={nameError}
              />
              <View style={{ height: spacing.md }} />
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
                icon="call-outline"
                placeholder="Phone Number"
                keyboardType="phone-pad"
                returnKeyType="next"
                value={phone}
                onChangeText={setPhone}
              />
              <View style={{ height: spacing.md }} />
              <TextField
                icon="calendar-outline"
                placeholder="Birthday"
                returnKeyType="next"
                value={birthday}
                onChangeText={setBirthday}
              />
              <View style={{ height: spacing.md }} />
              <SelectField
                placeholder={loadingCourses ? 'Loading golf clubs…' : 'Golf Club'}
                options={courses.map((c) => ({ label: c.name, value: c.id }))}
                value={courseId}
                onChange={(value) => {
                  setCourseId(value);
                  if (courseError) setCourseError(undefined);
                }}
                disabled={loadingCourses}
              />
              {courseError ? <Text style={styles.errorText}>{courseError}</Text> : null}

              <View style={{ height: spacing.lg }} />
              <PillButton label="Next Step" onPress={handleNext} />
            </View>

            <TouchableOpacity style={styles.loginRow} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginText}>Already have an account?</Text>
              <Text style={styles.loginBold}>Login!</Text>
            </TouchableOpacity>
          </ScrollView>
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
  scrollContent: { flexGrow: 1, justifyContent: 'space-between' },
  form: { marginTop: spacing.xl },
  loginRow: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xl, gap: 4 },
  loginText: { fontFamily: fontFamily.body, fontSize: 13, color: colors.white },
  loginBold: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.lime },
  errorText: { color: colors.negative, fontFamily: fontFamily.body, fontSize: 12, marginTop: 4, marginLeft: 4 },
});
