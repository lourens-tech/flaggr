import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { DateField } from '../../components/common/DateField';
import { api, type Course } from '../../api/client';
import { useBento } from '../../context/ThemeContext';
import { friendlyError } from '../../utils/errors';
import { ONBOARDING_BACKGROUNDS } from '../../theme';
import { bentoLayout as L, bentoType } from '../../theme/bento';
import { BentoButton, BentoField, BentoIcon, LoadError, PickerSheet } from '../../components/bento';
import { AuthPhotoScreen, PhotoBackButton, PromptLink, SignUpHeader } from './authParts';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUpStep1'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sign up step 1 (Bento boards AppSignUp and the kept states G-A-SignUp1*,
// G-A-ClubSheet, G-A-DatePicker): name, email, phone, date of birth, golf
// club and referral code, then Next Step. Same fields, validation and
// navigation as before. The club list now says when it fails to load, with
// Try again (owner decision 24 Nov 2026: no silent failures).
export function SignUpStep1Screen({ navigation }: Props) {
  const { t } = useBento();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(true);
  // The failed load, kept to word its message (null while loading or loaded).
  const [coursesError, setCoursesError] = useState<{ err: unknown } | null>(null);
  const [clubSheetOpen, setClubSheetOpen] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();
  const [emailError, setEmailError] = useState<string | undefined>();
  const [dateOfBirthError, setDateOfBirthError] = useState<string | undefined>();
  const [courseError, setCourseError] = useState<string | undefined>();

  const loadCourses = useCallback(() => {
    setLoadingCourses(true);
    setCoursesError(null);
    api
      .courses()
      .then((list) => setCourses(list))
      .catch((err) => {
        setCourses([]);
        setCoursesError({ err });
      })
      .finally(() => setLoadingCourses(false));
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

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
    const nextDateOfBirthError = !dateOfBirth ? 'Date of birth is required' : undefined;
    const nextCourseError = !courseId ? 'Select your golf club' : undefined;

    setNameError(nextNameError);
    setEmailError(nextEmailError);
    setDateOfBirthError(nextDateOfBirthError);
    setCourseError(nextCourseError);
    return !nextNameError && !nextEmailError && !nextDateOfBirthError && !nextCourseError;
  };

  const handleNext = () => {
    if (!validate()) return;
    navigation.navigate('SignUpStep2', {
      firstName: firstName ?? '',
      lastName: rest.join(' '),
      email: email.trim(),
      phone,
      dateOfBirth: dateOfBirth!,
      courseId: courseId!,
      referralCode: referralCode.trim() || undefined,
    });
  };

  const selectedCourse = courses.find((c) => c.id === courseId);
  const clubPlaceholder = loadingCourses ? 'Loading golf clubs…' : 'Golf Club';
  // Nothing to choose from while the list loads or after it failed.
  const clubDisabled = loadingCourses || coursesError !== null;

  return (
    <AuthPhotoScreen photo={ONBOARDING_BACKGROUNDS.signUpStep1} gap={16}>
      <PhotoBackButton onPress={() => navigation.goBack()} />
      <View style={{ height: 96 }} />
      <SignUpHeader step={1} title="Create your account" />

      <BentoField
        label="Full Name"
        placeholder="Full Name"
        returnKeyType="next"
        value={fullName}
        onChangeText={(text) => {
          setFullName(text);
          if (nameError) setNameError(undefined);
        }}
        error={nameError}
      />
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
      <BentoField
        label="Phone Number"
        placeholder="Phone Number"
        keyboardType="phone-pad"
        returnKeyType="next"
        value={phone}
        onChangeText={setPhone}
      />

      {/* The native date pickers have no Bento equivalent yet: DateField stays (it draws the Bento field). */}
      <View style={{ gap: 8 }}>
        <Text style={[bentoType.label, { color: t.ink }]}>Date of Birth</Text>
        <DateField
          variant="onLight"
          placeholder="Date of Birth"
          value={dateOfBirth}
          onChange={(value) => {
            setDateOfBirth(value);
            if (dateOfBirthError) setDateOfBirthError(undefined);
          }}
          error={dateOfBirthError}
          maximumDate={new Date()}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={[bentoType.label, { color: t.ink }]}>Golf Club</Text>
        <Pressable
          onPress={() => setClubSheetOpen(true)}
          disabled={clubDisabled}
          accessibilityRole="button"
          accessibilityLabel={selectedCourse ? `Golf Club: ${selectedCourse.name}` : clubPlaceholder}
          accessibilityState={{ disabled: clubDisabled }}
          style={{
            minHeight: L.controlHeight,
            borderRadius: L.fieldRadius,
            borderWidth: 1,
            borderColor: courseError ? t.danger : t.hair,
            backgroundColor: t.tile,
            paddingLeft: 16,
            paddingRight: 48,
            justifyContent: 'center',
            opacity: clubDisabled ? 0.55 : 1,
          }}
        >
          <Text numberOfLines={1} style={{ fontSize: 16, color: selectedCourse ? t.ink : t.muted }}>
            {selectedCourse ? selectedCourse.name : clubPlaceholder}
          </Text>
          <View style={{ position: 'absolute', right: 16, top: 15 }}>
            <BentoIcon name="chevronDown" size={20} color={t.muted} strokeWidth={1.8} />
          </View>
        </Pressable>
        {courseError ? <Text style={[bentoType.helper, { color: t.danger }]}>{courseError}</Text> : null}
        {coursesError && !loadingCourses ? <LoadError body={friendlyError(coursesError.err)} onRetry={loadCourses} /> : null}
      </View>

      <BentoField
        label="Referral Code (optional)"
        placeholder="Referral Code (optional)"
        autoCapitalize="characters"
        returnKeyType="done"
        value={referralCode}
        onChangeText={setReferralCode}
      />

      <View style={{ height: 6 }} />
      <BentoButton label="Next Step" nub onPress={handleNext} />
      <PromptLink prompt="Already have an account?" link="Login!" split onPress={() => navigation.navigate('Login')} />

      <PickerSheet
        visible={clubSheetOpen}
        title="Golf Club"
        options={courses.map((c) => ({ value: c.id, label: c.name }))}
        selected={courseId}
        onSelect={(value) => {
          setCourseId(value);
          if (courseError) setCourseError(undefined);
          setClubSheetOpen(false);
        }}
        onClose={() => setClubSheetOpen(false)}
      />
    </AuthPhotoScreen>
  );
}
