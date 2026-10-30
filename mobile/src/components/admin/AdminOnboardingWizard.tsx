import React, { useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TextField } from '../common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { pickAndResizeAvatar, pickAndResizeCoverImage, AvatarPermissionError } from '../../utils/pickAvatar';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { adminFont, adminRadius } from '../../theme/admin';
import { AdminButton, AdminSessionBackdrop } from './ui';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEP_COUNT = 4;

// Brand constants for the club crest placeholder (Fairway ground, lime mark).
const FAIRWAY = '#1F4234';
const LIME = '#CDDE5C';
// Dark wash over a photo or crest while it uploads, so the white spinner reads.
const PHOTO_SCRIM = 'rgba(6,14,10,0.6)';

// First-login setup wizard for a course_admin — walks through the same
// fields/actions as Course Profile (name/contact/address, logo, cover photo)
// as a guided stepper instead of one long form. Gated by
// AdminContext.showOnboardingWizard: server-side (course.onboardingCompletedAt)
// so it survives reinstalls, with a session-only "skip for now" dismissal.
// A centred sheet over a scrim on desktop; full screen on phones.
export function AdminOnboardingWizard() {
  const { c } = useAdminTheme();
  const isDesktop = useIsDesktopNav();
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

  const header = (
    <View style={[styles.header, isDesktop && styles.headerDesktop]}>
      <View style={styles.progressRow} accessibilityLabel={`Step ${step + 1} of ${STEP_COUNT}`}>
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <View key={i} style={[styles.progressDot, { backgroundColor: c.bar }, i <= step && [styles.progressDotActive, { backgroundColor: c.ink }]]} />
        ))}
      </View>
      <TouchableOpacity onPress={dismissOnboardingWizard} accessibilityLabel="Skip for now" accessibilityRole="button" hitSlop={8} style={styles.skipButton}>
        <Text style={[styles.skipText, { color: c.accentText }]}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );

  const content = (
    <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]} showsVerticalScrollIndicator={false}>
      {step === 0 ? (
        <>
          <View style={[styles.stepIcon, { backgroundColor: c.fill }]}>
            <Ionicons name="golf-outline" size={30} color={c.icon} />
          </View>
          <Text style={[styles.bigTitle, { color: c.ink }]}>Welcome to Flagrr</Text>
          <Text style={[styles.subtitle, { color: c.ink2 }]}>
            Let's get {course.name || 'your course'} set up — it only takes a couple of minutes. You can always
            finish this later from Course Profile.
          </Text>
          <View style={styles.actions}>
            <AdminButton label="Let's Get Started" variant="accent" size="lg" fullWidth onPress={() => setStep(1)} />
          </View>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Text style={[styles.title, { color: c.ink }]}>Course Details</Text>
          <Text style={[styles.subtitle, { color: c.ink2 }]}>This shows up on your members' profiles and reward vouchers.</Text>
          <View style={styles.fields}>
            <TextField placeholder="Course Name" variant="onLight" value={name} onChangeText={setName} />
            <TextField
              placeholder="Contact Email"
              variant="onLight"
              autoCapitalize="none"
              keyboardType="email-address"
              value={contactEmail}
              onChangeText={setContactEmail}
            />
            <TextField
              placeholder="Contact Phone"
              variant="onLight"
              keyboardType="phone-pad"
              value={contactPhone}
              onChangeText={setContactPhone}
            />
            <TextField placeholder="Address" variant="onLight" value={address} onChangeText={setAddress} />
          </View>
          <View style={styles.actions}>
            <AdminButton label="Save and Continue" variant="accent" size="lg" fullWidth onPress={handleSaveDetails} loading={saving} />
          </View>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Text style={[styles.title, { color: c.ink }]}>Add Your Logo</Text>
          <Text style={[styles.subtitle, { color: c.ink2 }]}>Shown in the admin app and on your members' Course Profile.</Text>
          <TouchableOpacity
            style={styles.logoPicker}
            onPress={handlePickLogo}
            disabled={uploadingLogo}
            accessibilityRole="button"
            accessibilityLabel={uploadingLogo ? 'Uploading…' : 'Tap to upload a logo'}
          >
            <View style={[styles.logoFrame, { borderColor: c.edge }]}>
              {course.logoUrl ? (
                <Image source={{ uri: course.logoUrl }} style={styles.fill} />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Ionicons name="business-outline" size={30} color={LIME} />
                </View>
              )}
              {uploadingLogo ? (
                <View style={[styles.overlay, { backgroundColor: PHOTO_SCRIM }]}>
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              ) : null}
            </View>
            <Text style={[styles.pickerHint, { color: c.accentText }]}>{uploadingLogo ? 'Uploading…' : 'Tap to upload a logo'}</Text>
          </TouchableOpacity>
          <View style={styles.actions}>
            <AdminButton label="Continue" variant="accent" size="lg" fullWidth onPress={() => setStep(3)} />
            <AdminButton label="Skip this step" variant="plain" onPress={() => setStep(3)} style={styles.secondaryAction} />
          </View>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Text style={[styles.title, { color: c.ink }]}>Add a Reports Cover Photo</Text>
          <Text style={[styles.subtitle, { color: c.ink2 }]}>Shown at the top of your Reports dashboard.</Text>
          <TouchableOpacity
            style={[styles.coverPicker, { backgroundColor: c.surface2, borderColor: c.edge }]}
            onPress={handlePickCover}
            disabled={uploadingCover}
            accessibilityRole="button"
            accessibilityLabel={uploadingCover ? 'Uploading…' : 'Tap to upload a cover photo'}
          >
            {course.coverImageUrl ? (
              <Image source={{ uri: course.coverImageUrl }} style={styles.fill} resizeMode="cover" />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Ionicons name="image-outline" size={28} color={c.icon} />
                <Text style={[styles.pickerHint, { color: c.accentText }]}>{uploadingCover ? 'Uploading…' : 'Tap to upload a cover photo'}</Text>
              </View>
            )}
            {uploadingCover && course.coverImageUrl ? (
              <View style={[styles.overlay, { backgroundColor: PHOTO_SCRIM }]}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : null}
            {uploadingCover && !course.coverImageUrl ? (
              <ActivityIndicator color={c.accentText} style={styles.coverSpinner} />
            ) : null}
          </TouchableOpacity>
          <View style={styles.actions}>
            <AdminButton label="Finish Setup" variant="accent" size="lg" fullWidth onPress={handleFinish} loading={saving} />
          </View>
        </>
      ) : null}
    </ScrollView>
  );

  if (isDesktop) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={dismissOnboardingWizard}>
        <View style={[styles.overlayRoot, { backgroundColor: c.scrim }]}>
          <View
            accessibilityViewIsModal
            style={[styles.sheet, { backgroundColor: c.sheet, borderColor: c.edge }]}
          >
            {header}
            {content}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={dismissOnboardingWizard}>
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
  actions: { marginTop: 24, gap: 6 },
  secondaryAction: { alignSelf: 'center', minHeight: 44 },
  fill: { width: '100%', height: '100%' },
  logoPicker: { alignSelf: 'center', alignItems: 'center', gap: 8, marginTop: 20 },
  logoFrame: {
    width: 108,
    height: 108,
    borderRadius: adminRadius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: FAIRWAY,
  },
  logoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pickerHint: { ...adminFont.bodySemiBold, fontSize: 13 },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  coverPicker: {
    width: '100%',
    height: 160,
    borderRadius: adminRadius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 20,
  },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  coverSpinner: { position: 'absolute', top: 14, right: 14 },
});
