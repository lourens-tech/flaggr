import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TextField } from '../common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import type { AdminStaff } from '../../data/adminTypes';
import { adminFont, adminRadius } from '../../theme/admin';
import { AdminButton, AdminSessionBackdrop, Eyebrow } from './ui';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEP_COUNT = 3;

// Chained right after AdminOnboardingWizard closes (see
// AdminContext.showStaffOnboardingWizard) — a short guided flow for inviting
// the course's first staff member. Gated by course.staffOnboardingCompletedAt
// (server-side, survives reinstalls), with a session-only "skip for now"
// dismissal, same pattern as the course-details wizard.
// A centred sheet over a scrim on desktop; full screen on phones.
export function AdminStaffOnboardingWizard() {
  const { c } = useAdminTheme();
  const isDesktop = useIsDesktopNav();
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

  const header = (
    <View style={[styles.header, isDesktop && styles.headerDesktop]}>
      <View style={styles.progressRow} accessibilityLabel={`Step ${step + 1} of ${STEP_COUNT}`}>
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <View key={i} style={[styles.progressDot, { backgroundColor: c.bar }, i <= step && [styles.progressDotActive, { backgroundColor: c.ink }]]} />
        ))}
      </View>
      <TouchableOpacity onPress={dismissStaffOnboardingWizard} accessibilityLabel="Skip for now" accessibilityRole="button" hitSlop={8} style={styles.skipButton}>
        <Text style={[styles.skipText, { color: c.accentText }]}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );

  const content = (
    <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]} showsVerticalScrollIndicator={false}>
      {step === 0 ? (
        <>
          <View style={[styles.stepIcon, { backgroundColor: c.fill }]}>
            <Ionicons name="people-outline" size={30} color={c.icon} />
          </View>
          <Text style={[styles.bigTitle, { color: c.ink }]}>Add Your Team</Text>
          <Text style={[styles.subtitle, { color: c.ink2 }]}>
            Invite a staff member so they can validate members' reward vouchers at {course.name || 'your course'}.
            You can always add more later from Manage Staff.
          </Text>
          <View style={styles.actions}>
            <AdminButton label="Let's Add a Staff Member" variant="accent" size="lg" fullWidth onPress={() => setStep(1)} />
          </View>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Text style={[styles.title, { color: c.ink }]}>Staff Details</Text>
          <View style={styles.fields}>
            <TextField placeholder="First Name" variant="onLight" value={firstName} onChangeText={setFirstName} />
            <TextField placeholder="Last Name" variant="onLight" value={lastName} onChangeText={setLastName} />
            <TextField
              placeholder="Email"
              variant="onLight"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <Text style={[styles.helpText, { color: c.ink2 }]}>
            A username will be generated and emailed to them, along with a temporary password and a login link.
          </Text>
          <View style={styles.actions}>
            <AdminButton
              label="Send Invite"
              variant="accent"
              size="lg"
              fullWidth
              onPress={() => {
                if (validateDetails()) handleSendInvite();
              }}
              loading={saving}
            />
          </View>
        </>
      ) : null}

      {step === 2 && createdStaff ? (
        <>
          <Ionicons name="checkmark-circle" size={52} color={c.icon} style={styles.successIcon} />
          <Text style={[styles.title, { color: c.ink }]}>Staff Member Added</Text>
          <Text style={[styles.subtitle, { color: c.ink2 }]}>{createdStaff.firstName} has been emailed their login details.</Text>
          <Eyebrow style={styles.usernameLabel}>Login Username</Eyebrow>
          <View style={[styles.usernameBox, { backgroundColor: c.fill, borderColor: c.edge }]}>
            <Text style={[styles.usernameText, { color: c.ink }]} selectable>
              {createdStaff.username}
            </Text>
          </View>
          <View style={styles.actions}>
            <AdminButton label="Done" variant="accent" size="lg" fullWidth onPress={handleFinish} loading={saving} />
            <AdminButton label="Add Another Staff Member" variant="plain" onPress={handleAddAnother} disabled={saving} style={styles.secondaryAction} />
          </View>
        </>
      ) : null}
    </ScrollView>
  );

  if (isDesktop) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={dismissStaffOnboardingWizard}>
        <View style={[styles.overlayRoot, { backgroundColor: c.scrim }]}>
          <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: c.sheet, borderColor: c.edge }]}>
            {header}
            {content}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={dismissStaffOnboardingWizard}>
      <AdminSessionBackdrop>
        <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
          {header}
          {content}
        </SafeAreaView>
      </AdminSessionBackdrop>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  overlayRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: {
    width: 560,
    maxWidth: '100%',
    maxHeight: '90%',
    borderRadius: adminRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 30 },
    shadowOpacity: 0.35,
    shadowRadius: 60,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerDesktop: { paddingHorizontal: 22, paddingTop: 18 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressDot: { width: 8, height: 8, borderRadius: 4 },
  progressDotActive: { width: 22 },
  skipButton: { minHeight: 44, justifyContent: 'center' },
  skipText: { ...adminFont.bodySemiBold, fontSize: 14 },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32, alignItems: 'stretch' },
  contentDesktop: { paddingHorizontal: 26, paddingTop: 18, paddingBottom: 26 },
  stepIcon: { alignSelf: 'center', width: 64, height: 64, borderRadius: adminRadius.md, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  bigTitle: { ...adminFont.title, fontSize: 34, letterSpacing: -0.6, textAlign: 'center' },
  title: { ...adminFont.bodyBold, fontSize: 22, textAlign: 'center' },
  subtitle: { ...adminFont.body, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10 },
  fields: { gap: 12, marginTop: 20 },
  helpText: { ...adminFont.body, fontSize: 13, lineHeight: 19, marginTop: 12, marginHorizontal: 4 },
  actions: { marginTop: 24, gap: 6 },
  secondaryAction: { alignSelf: 'center', minHeight: 44 },
  successIcon: { alignSelf: 'center', marginBottom: 10 },
  usernameLabel: { marginTop: 24, marginBottom: 8, marginLeft: 4 },
  usernameBox: {
    borderRadius: adminRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  usernameText: { ...adminFont.bodyBold, fontSize: 18, letterSpacing: 0.4 },
});
