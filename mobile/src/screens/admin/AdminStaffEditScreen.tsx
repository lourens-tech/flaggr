import React, { useEffect, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { colors, fontFamily, fontSize, screenPadding, spacing } from '../../theme';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminStaffEdit'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AdminStaffEditScreen({ navigation, route }: Props) {
  const { staff, createStaff, updateStaff, deleteStaff } = useAdmin();
  const existing = staff.find((s) => s.id === route.params?.staffId);

  const [firstName, setFirstName] = useState(existing?.firstName ?? '');
  const [lastName, setLastName] = useState(existing?.lastName ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: existing ? 'Edit Staff Member' : 'New Staff Member' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (!firstName.trim() || !email.trim()) {
      showAlert('Missing info', 'First name and email are required.');
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      showAlert('Invalid email', 'Enter a valid email address.');
      return;
    }
    if (newPassword && newPassword.length < 8) {
      showAlert('Invalid password', 'New password must be at least 8 characters.');
      return;
    }

    setSaving(true);
    try {
      if (existing) {
        await updateStaff({
          id: existing.id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password: newPassword.trim() || undefined,
        });
      } else {
        await createStaff({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() });
        showAlert('Staff member added', `${firstName.trim()} has been emailed their login details.`);
      }
      navigation.goBack();
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t save staff member', message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!existing) return;
    showAlert('Remove this staff member?', 'They will lose access immediately and their account will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await deleteStaff(existing.id);
            navigation.goBack();
          } catch (err) {
            const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
            showAlert('Couldn’t remove staff member', message);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title={existing ? 'Edit Staff Member' : 'New Staff Member'} onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

        {existing ? (
          <>
            <Text style={styles.sectionTitle}>Reset Password</Text>
            <TextField
              placeholder="New Password (leave blank to keep current)"
              variant="onLight"
              isPassword
              value={newPassword}
              onChangeText={setNewPassword}
            />
          </>
        ) : (
          <Text style={styles.helpText}>
            A temporary password will be generated and emailed to them along with a login link. They'll be asked to
            set their own password the first time they log in.
          </Text>
        )}

        <View style={{ height: spacing.lg }} />
        <PillButton label={existing ? 'Save Changes' : 'Add Staff Member'} onPress={handleSave} loading={saving} />

        {existing ? (
          <TouchableOpacity onPress={handleDelete} style={styles.deleteButton} disabled={saving}>
            <Text style={styles.deleteText}>Remove Staff Member</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  content: { padding: screenPadding, paddingBottom: spacing.xl * 2 },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.cardTitle,
    color: colors.darkGreen,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  helpText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.tiny,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  deleteButton: { alignItems: 'center', marginTop: spacing.lg },
  deleteText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.negative },
});
