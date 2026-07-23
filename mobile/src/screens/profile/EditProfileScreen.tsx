import React, { useState, useMemo } from 'react';
import { ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { DateField } from '../../components/common/DateField';
import { PillButton } from '../../components/common/PillButton';
import { useApp } from '../../context/AppContext';
import { ApiError } from '../../api/client';
import { showAlert } from '../../utils/alert';
import { screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EditProfileScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, updateProfile } = useApp();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(user.dateOfBirth);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [nameError, setNameError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmedName = firstName.trim();
    const trimmedEmail = email.trim();
    const nextNameError = !trimmedName ? 'First name is required' : undefined;
    const nextEmailError = !EMAIL_PATTERN.test(trimmedEmail) ? 'Enter a valid email address' : undefined;
    setNameError(nextNameError);
    setEmailError(nextEmailError);
    if (nextNameError || nextEmailError) return;

    setSaving(true);
    try {
      await updateProfile({
        firstName: trimmedName,
        lastName: lastName.trim(),
        email: trimmedEmail,
        phone: phone.trim() || undefined,
        dateOfBirth: dateOfBirth ?? undefined,
      });
      navigation.goBack();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t save changes', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Edit Profile" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TextField
          icon="person-outline"
          placeholder="First Name"
          variant="onLight"
          value={firstName}
          onChangeText={(text) => {
            setFirstName(text);
            if (nameError) setNameError(undefined);
          }}
          error={nameError}
        />
        <View style={{ height: spacing.md }} />
        <TextField icon="person-outline" placeholder="Last Name" variant="onLight" value={lastName} onChangeText={setLastName} />
        <View style={{ height: spacing.md }} />
        <TextField
          icon="mail-outline"
          placeholder="Email"
          variant="onLight"
          autoCapitalize="none"
          keyboardType="email-address"
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
          variant="onLight"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <View style={{ height: spacing.md }} />
        <DateField
          placeholder="Date of Birth"
          variant="onLight"
          value={dateOfBirth}
          onChange={setDateOfBirth}
          maximumDate={new Date()}
        />

        <View style={{ height: spacing.xl }} />
        <PillButton label="Save Changes" onPress={handleSave} loading={saving} />
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  content: { padding: screenPadding },
});
}
