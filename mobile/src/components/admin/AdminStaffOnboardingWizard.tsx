import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextField } from '../common/TextField';
import { PillButton } from '../common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { AdminStaff } from '../../data/adminTypes';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEP_COUNT = 3;

// Chained right after AdminOnboardingWizard closes (see
// AdminContext.showStaffOnboardingWizard) — a short guided flow for inviting
// the course's first staff member. Gated by course.staffOnboardingCompletedAt
// (server-side, survives reinstalls), with a session-only "skip for now"
// dismissal, same pattern as the course-details wizard.
export function AdminStaffOnboardingWizard() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { course, createStaff, dismissStaffOnboardingWizard, completeStaffOnboarding } = useAdmin();

  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdStaff, setCreatedStaff] = useState<AdminStaff | null>(null);

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

  const handleSendInvite = async () => {
    setSaving(true);
    try {
      const created = await createStaff({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() });
      setCreatedStaff(created);
      setStep(2);
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t add staff member', message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddAnother = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setCreatedStaff(null);
    setStep(1);
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await completeStaffOnboarding();
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t finish setup', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={dismissStaffOnboardingWizard}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.progressRow}>
            {Array.from({ length: STEP_COUNT }).map((_, i) => (
              <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
            ))}
          </View>
          <TouchableOpacity onPress={dismissStaffOnboardingWizard} accessibilityLabel="Skip for now" hitSlop={8}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {step === 0 ? (
            <>
              <Ionicons name="people-outline" size={40} color={colors.clubGreen} style={styles.stepIcon} />
              <Text style={styles.title}>Add Your Team</Text>
              <Text style={styles.subtitle}>
                Invite a staff member so they can validate members' reward vouchers at {course.name || 'your course'}.
                You can always add more later from Manage Staff.
              </Text>
              <View style={{ height: spacing.lg }} />
              <PillButton label="Let's Add a Staff Member" onPress={() => setStep(1)} />
            </>
          ) : null}

          {step === 1 ? (
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
                A username will be generated and emailed to them, along with a temporary password and a login link.
              </Text>
              <View style={{ height: spacing.lg }} />
              <PillButton
                label="Send Invite"
                onPress={() => {
                  if (validateDetails()) handleSendInvite();
                }}
                loading={saving}
              />
            </>
          ) : null}

          {step === 2 && createdStaff ? (
            <>
              <Ionicons name="checkmark-circle" size={48} color={colors.clubGreen} style={styles.successIcon} />
              <Text style={styles.title}>Staff Member Added</Text>
              <Text style={styles.helpTextCentered}>{createdStaff.firstName} has been emailed their login details.</Text>
              <Text style={styles.sectionTitle}>Login Username</Text>
              <View style={styles.usernameBox}>
                <Text style={styles.usernameText}>{createdStaff.username}</Text>
              </View>
              <View style={{ height: spacing.lg }} />
              <PillButton label="Done" onPress={handleFinish} loading={saving} />
              <TouchableOpacity onPress={handleAddAnother} style={styles.addAnotherButton} disabled={saving}>
                <Text style={styles.addAnotherText}>Add Another Staff Member</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  progressRow: { flexDirection: 'row', gap: 6 },
  progressDot: { width: 22, height: 4, borderRadius: 2, backgroundColor: colors.inputBorder },
  progressDotActive: { backgroundColor: colors.clubGreen },
  skipText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.textSecondary },
  content: { padding: screenPadding, paddingTop: spacing.xl, alignItems: 'stretch' },
  stepIcon: { alignSelf: 'center', marginBottom: spacing.md },
  title: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.textPrimary, textAlign: 'center' },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
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
  usernameBox: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    height: 53,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  usernameText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  successIcon: { alignSelf: 'center', marginBottom: spacing.sm },
  addAnotherButton: { alignItems: 'center', marginTop: spacing.md },
  addAnotherText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textSecondary },
});
}
