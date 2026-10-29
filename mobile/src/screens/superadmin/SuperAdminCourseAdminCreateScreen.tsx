import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { PageTitle, Tile } from '../../components/admin/ui';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { spacing } from '../../theme';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminCourseAdminCreate'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SuperAdminCourseAdminCreateScreen({ navigation, route }: Props) {
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
      <SuperAdminDesktopFrame activeKey="SuperAdminCourses" breadcrumb={`Courses › ${courseName} › Course Admins`} showRail={false}>
        <PageTitle>{pageTitle}</PageTitle>
        <Tile style={styles.dCard}>{form}</Tile>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="New Admin" subtitle={courseName} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Tile>{form}</Tile>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 16, paddingBottom: spacing.xl * 2 },
  dCard: { maxWidth: 520, marginTop: 16, padding: 24 },
});
