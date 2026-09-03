import React, { useState, useMemo } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminCourseAdminCreate'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SuperAdminCourseAdminCreateScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDesktop = useIsDesktopNav();
  const { courseId, courseName } = route.params;
  const { createSuperAdminCourseAdmin } = useAdmin();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!firstName.trim() || !email.trim()) {
      showAlert('Missing info', 'First name and email are required.');
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      showAlert('Invalid email', 'Enter a valid email address.');
      return;
    }
    setSaving(true);
    try {
      await createSuperAdminCourseAdmin({ courseId, firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() });
      navigation.goBack();
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t add admin', message);
    } finally {
      setSaving(false);
    }
  };

  const pageTitle = `New Admin — ${courseName}`;

  const form = (
    <>
      <TextField placeholder="First Name" variant="onLight" value={firstName} onChangeText={setFirstName} />
      <View style={{ height: spacing.md }} />
      <TextField placeholder="Last Name" variant="onLight" value={lastName} onChangeText={setLastName} />
      <View style={{ height: spacing.md }} />
      <TextField
        placeholder="Email"
        variant="onLight"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <View style={{ height: spacing.lg }} />
      <PillButton label="Send Invite" onPress={handleSave} loading={saving} />
    </>
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminCourses" breadcrumb={pageTitle} showRail={false}>
        <Text style={styles.dPageTitle}>{pageTitle}</Text>
        <DesktopPanel title=" " style={{ maxWidth: 480 }}>
          {form}
        </DesktopPanel>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title={pageTitle} onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {form}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  content: { padding: screenPadding, paddingBottom: spacing.xl * 2 },
  dPageTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.textPrimary },
});
}
