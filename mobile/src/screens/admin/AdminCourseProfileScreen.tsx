import React, { useState, useMemo } from 'react';
import { ActivityIndicator, Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList, AdminTabParamList } from '../../navigation/types';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { pickAndResizeAvatar, pickAndResizeCoverImage, AvatarPermissionError } from '../../utils/pickAvatar';
import { showAlert } from '../../utils/alert';
import { ThemeToggleRow } from '../../components/common/ThemeToggleRow';
import type { ThemePreference } from '../../context/ThemeContext';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SUBSCRIPTION_LABELS: Record<string, string> = {
  trialing: 'Trial',
  active: 'Active',
  past_due: 'Payment Failed',
};

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabParamList, 'AdminCourseProfile'>,
  NativeStackScreenProps<AdminStackParamList>
>;

export function AdminCourseProfileScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    admin,
    course,
    updateCourseProfile,
    updateCourseLogo,
    updateCourseCover,
    updateThemePreference,
    reopenOnboardingWizard,
    changePassword,
    logout,
  } = useAdmin();

  const [name, setName] = useState(course.name);
  const [contactEmail, setContactEmail] = useState(course.contactEmail ?? '');
  const [contactPhone, setContactPhone] = useState(course.contactPhone ?? '');
  const [address, setAddress] = useState(course.address ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

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

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      showAlert('Missing info', 'Course name is required.');
      return;
    }
    if (contactEmail.trim() && !EMAIL_PATTERN.test(contactEmail.trim())) {
      showAlert('Invalid email', 'Enter a valid contact email address.');
      return;
    }
    setSavingProfile(true);
    try {
      await updateCourseProfile({
        name: name.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        address: address.trim(),
      });
      showAlert('Saved', 'Your course profile has been updated.');
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t save', message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleThemeChange = async (preference: ThemePreference) => {
    setSavingTheme(true);
    try {
      await updateThemePreference(preference);
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t update appearance', message);
    } finally {
      setSavingTheme(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || newPassword.length < 8) {
      showAlert('Missing info', 'Enter your current password and a new password (min. 8 characters).');
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      showAlert('Password changed', 'Use your new password next time you log in.');
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t change password', message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = () => {
    showAlert('Log out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Course Profile</Text>
          <Text style={styles.headerSubtitle}>{admin.firstName} {admin.lastName}</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {course.subscriptionStatus === 'past_due' ? (
          <View style={styles.billingWarningBanner}>
            <Ionicons name="warning-outline" size={18} color={colors.warning} />
            <Text style={styles.billingWarningText}>
              Your last payment failed. Update your billing details or contact Flagrr support to avoid losing access.
            </Text>
          </View>
        ) : null}

        {course.onboardingCompletedAt === null ? (
          <TouchableOpacity style={styles.onboardingBanner} onPress={reopenOnboardingWizard} activeOpacity={0.85}>
            <Ionicons name="rocket-outline" size={18} color={colors.darkGreen} />
            <Text style={styles.onboardingBannerText}>Finish setting up your course</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.darkGreen} />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.logoPicker} onPress={handlePickLogo} disabled={uploadingLogo}>
          {course.logoUrl ? (
            <Image source={{ uri: course.logoUrl }} style={styles.logoImage} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Ionicons name="business-outline" size={24} color={colors.clubGreen} />
            </View>
          )}
          <Text style={styles.logoHint}>Tap to change logo</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Reports Cover Photo</Text>
        <TouchableOpacity style={styles.coverPicker} onPress={handlePickCover} disabled={uploadingCover}>
          {course.coverImageUrl ? (
            <Image source={{ uri: course.coverImageUrl }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="image-outline" size={22} color={colors.clubGreen} />
              <Text style={styles.coverHint}>Tap to add a cover photo</Text>
            </View>
          )}
          {uploadingCover ? (
            <View style={styles.coverOverlay}>
              <ActivityIndicator color={colors.white} />
            </View>
          ) : null}
        </TouchableOpacity>
        <Text style={styles.helpText}>Shown at the top of your Reports dashboard.</Text>

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
        <TextField placeholder="Contact Phone" variant="onLight" keyboardType="phone-pad" value={contactPhone} onChangeText={setContactPhone} />
        <View style={{ height: spacing.md }} />
        <TextField placeholder="Address" variant="onLight" value={address} onChangeText={setAddress} />
        <View style={{ height: spacing.md }} />
        <View style={styles.disabledField}>
          <TextField
            placeholder="Flagrr Cash per Rand"
            variant="onLight"
            editable={false}
            value={String(course.fbPerRand)}
          />
        </View>
        <Text style={styles.helpText}>
          Your Flagrr Cash denomination can only be changed by the Flagrr team. Contact support if you'd like to request a change.
        </Text>
        <View style={{ height: spacing.sm }} />
        <PillButton
          label="Contact Support"
          icon="headset-outline"
          variant="outline"
          onPress={() => navigation.navigate('AdminSupportTickets')}
        />

        <View style={{ height: spacing.md }} />
        <PillButton label="Save Course Profile" onPress={handleSaveProfile} loading={savingProfile} />

        <Text style={styles.sectionTitle}>Staff</Text>
        <Text style={styles.helpText}>
          Add staff accounts for your team — they can log in to validate members' reward vouchers.
        </Text>
        <View style={{ height: spacing.sm }} />
        <PillButton label="Manage Staff" icon="people-outline" variant="outline" onPress={() => navigation.navigate('AdminStaffList')} />

        <Text style={styles.sectionTitle}>Club Admins</Text>
        <Text style={styles.helpText}>
          See who else administers your club, or add one more admin (up to 2 in total).
        </Text>
        <View style={{ height: spacing.sm }} />
        <PillButton
          label="Club Admins"
          icon="person-add-outline"
          variant="outline"
          onPress={() => navigation.navigate('AdminClubAdmins')}
        />

        <Text style={styles.sectionTitle}>Member List</Text>
        <Text style={styles.helpText}>
          Upload your club's membership list so new signups can be confirmed as actual members. Members who don't
          match stay capped at Bronze tier until verified.
        </Text>
        <View style={{ height: spacing.sm }} />
        <PillButton
          label="Manage Member List"
          icon="cloud-upload-outline"
          variant="outline"
          onPress={() => navigation.navigate('AdminMemberList')}
        />

        <Text style={styles.sectionTitle}>Fraud Review</Text>
        <Text style={styles.helpText}>
          Review receipts flagged for your club, confirm genuine fraud (reverses the Flagrr Cash awarded), or clear
          false positives.
        </Text>
        <View style={{ height: spacing.sm }} />
        <PillButton
          label="Flagged Receipts"
          icon="flag-outline"
          variant="outline"
          onPress={() => navigation.navigate('AdminFraudOversight')}
        />

        <Text style={styles.sectionTitle}>Billing</Text>
        <View style={styles.disabledField}>
          <TextField
            placeholder="Subscription Status"
            variant="onLight"
            editable={false}
            value={SUBSCRIPTION_LABELS[course.subscriptionStatus ?? 'active'] ?? 'Active'}
          />
        </View>
        <Text style={styles.helpText}>
          {course.subscriptionStatus === 'past_due'
            ? 'Your last payment failed. Contact Flagrr support to update your billing details before your subscription is cancelled.'
            : 'Managed by the Flagrr team. Contact support with any billing questions.'}
        </Text>
        <View style={{ height: spacing.sm }} />
        <PillButton
          label="Contact Support"
          icon="headset-outline"
          variant="outline"
          onPress={() => navigation.navigate('AdminSupportTickets')}
        />

        <Text style={styles.sectionTitle}>Appearance</Text>
        <ThemeToggleRow onChange={handleThemeChange} disabled={savingTheme} />

        <Text style={styles.sectionTitle}>Change Password</Text>
        <TextField placeholder="Current Password" variant="onLight" isPassword value={currentPassword} onChangeText={setCurrentPassword} />
        <View style={{ height: spacing.md }} />
        <TextField placeholder="New Password" variant="onLight" isPassword value={newPassword} onChangeText={setNewPassword} />
        <View style={{ height: spacing.md }} />
        <PillButton label="Update Password" variant="outline" onPress={handleChangePassword} loading={changingPassword} />

        <Text style={styles.sectionTitle}>Legal</Text>
        <PillButton
          label="Terms & Privacy"
          icon="shield-checkmark-outline"
          variant="outline"
          onPress={() => navigation.navigate('TermsPrivacy')}
        />

        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={18} color={colors.negative} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  header: { paddingHorizontal: screenPadding, paddingVertical: spacing.md },
  headerTitle: { fontFamily: fontFamily.headingDisplay, fontSize: fontSize.title, color: colors.white },
  headerSubtitle: { fontFamily: fontFamily.body, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  content: { padding: screenPadding, paddingBottom: spacing.xl * 2 },
  onboardingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.mintBg,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    marginBottom: spacing.lg,
  },
  onboardingBannerText: { flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.darkGreen },
  billingWarningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    marginBottom: spacing.lg,
  },
  billingWarningText: { flex: 1, fontFamily: fontFamily.bodyMedium, fontSize: fontSize.tiny, color: colors.warning },
  logoPicker: { alignSelf: 'center', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.lg },
  logoImage: { width: 88, height: 88, borderRadius: radius.md },
  logoPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    backgroundColor: colors.imagePlaceholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoHint: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.clubGreen },
  coverPicker: {
    width: '100%',
    height: 120,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.imagePlaceholder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  coverHint: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.clubGreen },
  coverOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpText: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 6, marginLeft: 4 },
  disabledField: { opacity: 0.5 },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.cardTitle,
    color: colors.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
  },
  logoutText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.negative },
});
}
