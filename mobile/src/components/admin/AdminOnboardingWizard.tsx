import React, { useMemo, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextField } from '../common/TextField';
import { PillButton } from '../common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { pickAndResizeAvatar, pickAndResizeCoverImage, AvatarPermissionError } from '../../utils/pickAvatar';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEP_COUNT = 4;

// First-login setup wizard for a course_admin — walks through the same
// fields/actions as Course Profile (name/contact/address, logo, cover photo)
// as a guided stepper instead of one long form. Gated by
// AdminContext.showOnboardingWizard: server-side (course.onboardingCompletedAt)
// so it survives reinstalls, with a session-only "skip for now" dismissal.
export function AdminOnboardingWizard() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    course,
    updateCourseProfile,
    updateCourseLogo,
    updateCourseCover,
    dismissOnboardingWizard,
    completeOnboarding,
  } = useAdmin();

  const [step, setStep] = useState(0);
  const [name, setName] = useState(course.name);
  const [contactEmail, setContactEmail] = useState(course.contactEmail ?? '');
  const [contactPhone, setContactPhone] = useState(course.contactPhone ?? '');
  const [address, setAddress] = useState(course.address ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const handleSaveDetails = async () => {
    if (!name.trim()) {
      showAlert('Missing info', 'Course name is required.');
      return;
    }
    if (contactEmail.trim() && !EMAIL_PATTERN.test(contactEmail.trim())) {
      showAlert('Invalid email', 'Enter a valid contact email address.');
      return;
    }
    setSaving(true);
    try {
      await updateCourseProfile({
        name: name.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        address: address.trim(),
      });
      setStep(2);
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t save', message);
    } finally {
      setSaving(false);
    }
  };

  const handlePickLogo = async () => {
    setUploadingLogo(true);
    try {
      const result = await pickAndResizeAvatar();
      if (result) await updateCourseLogo(result);
    } catch (err) {
      if (err instanceof AvatarPermissionError) showAlert('Permission needed', err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handlePickCover = async () => {
    setUploadingCover(true);
    try {
      const result = await pickAndResizeCoverImage();
      if (result) await updateCourseCover(result);
    } catch (err) {
      if (err instanceof AvatarPermissionError) showAlert('Permission needed', err.message);
    } finally {
      setUploadingCover(false);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await completeOnboarding();
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t finish setup', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={dismissOnboardingWizard}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.progressRow}>
            {Array.from({ length: STEP_COUNT }).map((_, i) => (
              <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
            ))}
          </View>
          <TouchableOpacity onPress={dismissOnboardingWizard} accessibilityLabel="Skip for now" hitSlop={8}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {step === 0 ? (
            <>
              <Ionicons name="golf-outline" size={40} color={colors.clubGreen} style={styles.stepIcon} />
              <Text style={styles.title}>Welcome to Flagrr</Text>
              <Text style={styles.subtitle}>
                Let's get {course.name || 'your course'} set up — it only takes a couple of minutes. You can always
                finish this later from Course Profile.
              </Text>
              <View style={{ height: spacing.lg }} />
              <PillButton label="Let's Get Started" onPress={() => setStep(1)} />
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Text style={styles.title}>Course Details</Text>
              <Text style={styles.subtitle}>This shows up on your members' profiles and reward vouchers.</Text>
              <View style={{ height: spacing.lg }} />
              <TextField placeholder="Course Name" variant="onLight" value={name} onChangeText={setName} />
              <View style={{ height: spacing.md }} />
              <TextField
                placeholder="Contact Email"
                variant="onLight"
                autoCapitalize="none"
                keyboardType="email-address"
                value={contactEmail}
                onChangeText={setContactEmail}
              />
              <View style={{ height: spacing.md }} />
              <TextField
                placeholder="Contact Phone"
                variant="onLight"
                keyboardType="phone-pad"
                value={contactPhone}
                onChangeText={setContactPhone}
              />
              <View style={{ height: spacing.md }} />
              <TextField placeholder="Address" variant="onLight" value={address} onChangeText={setAddress} />
              <View style={{ height: spacing.lg }} />
              <PillButton label="Save and Continue" onPress={handleSaveDetails} loading={saving} />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={styles.title}>Add Your Logo</Text>
              <Text style={styles.subtitle}>Shown in the admin app and on your members' Course Profile.</Text>
              <View style={{ height: spacing.lg }} />
              <TouchableOpacity style={styles.logoPicker} onPress={handlePickLogo} disabled={uploadingLogo}>
                {course.logoUrl ? (
                  <Image source={{ uri: course.logoUrl }} style={styles.logoImage} />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Ionicons name="business-outline" size={28} color={colors.clubGreen} />
                  </View>
                )}
                <Text style={styles.pickerHint}>{uploadingLogo ? 'Uploading…' : 'Tap to upload a logo'}</Text>
              </TouchableOpacity>
              <View style={{ height: spacing.lg }} />
              <PillButton label="Continue" onPress={() => setStep(3)} />
              <TouchableOpacity onPress={() => setStep(3)} style={styles.skipStepButton}>
                <Text style={styles.skipStepText}>Skip this step</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text style={styles.title}>Add a Reports Cover Photo</Text>
              <Text style={styles.subtitle}>Shown at the top of your Reports dashboard.</Text>
              <View style={{ height: spacing.lg }} />
              <TouchableOpacity style={styles.coverPicker} onPress={handlePickCover} disabled={uploadingCover}>
                {course.coverImageUrl ? (
                  <Image source={{ uri: course.coverImageUrl }} style={styles.coverImage} />
                ) : (
                  <View style={styles.coverPlaceholder}>
                    <Ionicons name="image-outline" size={28} color={colors.clubGreen} />
                    <Text style={styles.pickerHint}>{uploadingCover ? 'Uploading…' : 'Tap to upload a cover photo'}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <View style={{ height: spacing.lg }} />
              <PillButton label="Finish Setup" onPress={handleFinish} loading={saving} />
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
  logoPicker: { alignSelf: 'center', alignItems: 'center', gap: spacing.xs },
  logoImage: { width: 96, height: 96, borderRadius: radius.md },
  logoPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: colors.imagePlaceholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerHint: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.clubGreen },
  coverPicker: { width: '100%', height: 140, borderRadius: radius.md, overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.imagePlaceholder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  skipStepButton: { alignItems: 'center', marginTop: spacing.md },
  skipStepText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.textSecondary },
});
}
