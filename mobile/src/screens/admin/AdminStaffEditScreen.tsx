import React, { useEffect, useState, useMemo } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { AdminStaff } from '../../data/adminTypes';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminStaffEdit'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WIZARD_STEP_COUNT = 3;

export function AdminStaffEditScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { staff, createStaff, updateStaff, deleteStaff } = useAdmin();
  const existing = staff.find((s) => s.id === route.params?.staffId);

  const [firstName, setFirstName] = useState(existing?.firstName ?? '');
  const [lastName, setLastName] = useState(existing?.lastName ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  // Adding a new staff member walks through a short wizard (details, review,
  // success) rather than one plain form — editing an existing one keeps the
  // simple form below, since there's nothing to "confirm" there.
  const [wizardStep, setWizardStep] = useState(0);
  const [createdStaff, setCreatedStaff] = useState<AdminStaff | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: existing ? 'Edit Staff Member' : 'New Staff Member' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateDetails = () => {
    if (!firstName.trim() || !email.trim()) {
      showAlert('Missing info', 'First name and email are required.');
      return false;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      showAlert('Invalid email', 'Enter a valid email address.');
      return false;
    }
    return true;
  };

  const handleSaveEdit = async () => {
    if (!validateDetails()) return;
    if (newPassword && newPassword.length < 8) {
      showAlert('Invalid password', 'New password must be at least 8 characters.');
      return;
    }
    if (!existing) return;

    setSaving(true);
    try {
      await updateStaff({
        id: existing.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password: newPassword.trim() || undefined,
      });
      navigation.goBack();
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t save staff member', message);
    } finally {
      setSaving(false);
    }
  };

  const handleSendInvite = async () => {
    setSaving(true);
    try {
      const created = await createStaff({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() });
      setCreatedStaff(created);
      setWizardStep(2);
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t add staff member', message);
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

  // --- Editing an existing staff member: unchanged simple form ---
  if (existing) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="light-content" />
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <ScreenHeader title="Edit Staff Member" onBack={() => navigation.goBack()} />
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
          <Text style={styles.helpText}>
            Just used to send login details — staff log in with a username instead, so this can be shared by more
            than one staff member (e.g. a shared shop inbox).
          </Text>

          <Text style={styles.sectionTitle}>Login Username</Text>
          <View style={styles.usernameBox}>
            <Text style={styles.usernameText}>{existing.username}</Text>
          </View>
          <Text style={styles.sectionTitle}>Reset Password</Text>
          <TextField
            placeholder="New Password (leave blank to keep current)"
            variant="onLight"
            isPassword
            value={newPassword}
            onChangeText={setNewPassword}
          />

          <View style={{ height: spacing.lg }} />
          <PillButton label="Save Changes" onPress={handleSaveEdit} loading={saving} />

          <TouchableOpacity onPress={handleDelete} style={styles.deleteButton} disabled={saving}>
            <Text style={styles.deleteText}>Remove Staff Member</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // --- Adding a new staff member: details -> review -> success wizard ---
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="New Staff Member" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <View style={styles.progressRow}>
        {Array.from({ length: WIZARD_STEP_COUNT }).map((_, i) => (
          <View key={i} style={[styles.progressDot, i <= wizardStep && styles.progressDotActive]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {wizardStep === 0 ? (
          <>
            <Text style={styles.title}>Staff Details</Text>
            <View style={{ height: spacing.md }} />
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
            <Text style={styles.helpText}>
              Just used to send login details — staff log in with a username instead, so this can be shared by more
              than one staff member (e.g. a shared shop inbox).
            </Text>
            <View style={{ height: spacing.lg }} />
            <PillButton
              label="Next: Review"
              onPress={() => {
                if (validateDetails()) setWizardStep(1);
              }}
            />
          </>
        ) : null}

        {wizardStep === 1 ? (
          <>
            <Text style={styles.title}>Review and Send</Text>
            <View style={{ height: spacing.md }} />
            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Name</Text>
              <Text style={styles.reviewValue}>{firstName.trim()} {lastName.trim()}</Text>
              <View style={{ height: spacing.sm }} />
              <Text style={styles.reviewLabel}>Email</Text>
              <Text style={styles.reviewValue}>{email.trim()}</Text>
            </View>
            <Text style={styles.helpText}>
              A username will be generated and emailed to them, along with a temporary password and a login link.
              They'll be asked to set their own password the first time they log in.
            </Text>
            <View style={{ height: spacing.lg }} />
            <PillButton label="Send Invite" onPress={handleSendInvite} loading={saving} />
            <TouchableOpacity onPress={() => setWizardStep(0)} style={styles.backButton} disabled={saving}>
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {wizardStep === 2 && createdStaff ? (
          <>
            <Ionicons name="checkmark-circle" size={48} color={colors.clubGreen} style={styles.successIcon} />
            <Text style={styles.title}>Staff Member Added</Text>
            <Text style={styles.helpTextCentered}>
              {createdStaff.firstName} has been emailed their login details.
            </Text>
            <Text style={styles.sectionTitle}>Login Username</Text>
            <View style={styles.usernameBox}>
              <Text style={styles.usernameText}>{createdStaff.username}</Text>
            </View>
            <View style={{ height: spacing.lg }} />
            <PillButton label="Done" onPress={() => navigation.goBack()} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: screenPadding, paddingTop: spacing.md },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.inputBorder },
  progressDotActive: { backgroundColor: colors.clubGreen },
  content: { padding: screenPadding, paddingBottom: spacing.xl * 2 },
  title: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.textPrimary },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.cardTitle,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  helpText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.tiny,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  helpTextCentered: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  reviewCard: {
    backgroundColor: colors.mintBg,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  reviewLabel: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  reviewValue: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary, marginTop: 2 },
  usernameBox: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    height: 53,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  usernameText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  successIcon: { alignSelf: 'center', marginBottom: spacing.sm },
  backButton: { alignItems: 'center', marginTop: spacing.md },
  backButtonText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textSecondary },
  deleteButton: { alignItems: 'center', marginTop: spacing.lg },
  deleteText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.negative },
});
}
