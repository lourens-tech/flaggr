import React, { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList, AdminTabParamList } from '../../navigation/types';
import { TextField } from '../../components/common/TextField';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { AdminApiError } from '../../api/adminClient';
import { pickAndResizeAvatar, pickAndResizeCoverImage, AvatarPermissionError } from '../../utils/pickAvatar';
import { showAlert } from '../../utils/alert';
import { ThemeToggleRow } from '../../components/common/ThemeToggleRow';
import type { ThemePreference } from '../../context/ThemeContext';
import { useAdminTheme } from '../../context/ThemeContext';
import { adminFont, adminRadius, tabularNums } from '../../theme/admin';
import { AdminButton, Banner, Eyebrow, Muted, PageTitle, StatusPill, Tile } from '../../components/admin/ui';
import { useHover, hoverTransition } from '../../hooks/useHover';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SUBSCRIPTION_LABELS: Record<string, string> = {
  trialing: 'Trial',
  active: 'Active',
  past_due: 'Payment Failed',
};

// Brand constants for the club crest placeholder (Fairway ground, lime mark).
const FAIRWAY = '#1F4234';
const LIME = '#CDDE5C';
// Dark wash over a photo or crest while it uploads, so the white spinner reads.
const PHOTO_SCRIM = 'rgba(6,14,10,0.6)';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabParamList, 'AdminCourseProfile'>,
  NativeStackScreenProps<AdminStackParamList>
>;

// One tappable row of a grouped settings list: icon, label, chevron.
function SettingsRow({
  icon,
  label,
  onPress,
  danger,
  first,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  first?: boolean;
}) {
  const { c } = useAdminTheme();
  const [hovered, hoverHandlers] = useHover();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.listRow,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },
        hoverTransition,
        hovered && { backgroundColor: c.fill2 },
      ]}
      {...hoverHandlers}
    >
      <Ionicons name={icon} size={18} color={danger ? c.neg : c.icon} />
      <Text style={[styles.listRowLabel, { color: danger ? c.neg : c.ink }]} numberOfLines={1}>
        {label}
      </Text>
      {danger ? null : <Ionicons name="chevron-forward" size={16} color={c.ink3} />}
    </TouchableOpacity>
  );
}

export function AdminCourseProfileScreen({ navigation }: Props) {
  const { c } = useAdminTheme();
  const isDesktop = useIsDesktopNav();
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

  const pastDue = course.subscriptionStatus === 'past_due';

  const banners = (
    <>
      {pastDue ? (
        <Banner
          tone="neg"
          title="Your last payment failed."
          body="Update your billing details or contact Flagrr support to avoid losing access."
        />
      ) : null}

      {course.onboardingCompletedAt === null ? (
        <TouchableOpacity
          onPress={reopenOnboardingWizard}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Finish setting up your course"
        >
          <Banner tone="pos" title="Finish setting up your course" action={<Ionicons name="chevron-forward" size={18} color={c.ink3} />} />
        </TouchableOpacity>
      ) : null}
    </>
  );

  const logoSize = isDesktop ? 104 : 84;

  // Cover photo with the club logo overlapping its lower edge.
  const hero = (
    <View>
      <TouchableOpacity
        style={[
          styles.cover,
          {
            height: isDesktop ? 220 : 150,
            borderRadius: isDesktop ? adminRadius.lg : adminRadius.md,
            backgroundColor: c.surface2,
            borderColor: c.edge,
          },
        ]}
        onPress={handlePickCover}
        disabled={uploadingCover}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel="Reports Cover Photo"
      >
        {course.coverImageUrl ? (
          <Image source={{ uri: course.coverImageUrl }} style={styles.fill} resizeMode="cover" />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="image-outline" size={24} color={c.icon} />
            <Text style={[styles.hint, { color: c.accentText }]}>Tap to add a cover photo</Text>
          </View>
        )}
        <View style={styles.coverChip}>
          <Ionicons name="camera-outline" size={14} color="#FFFFFF" />
          <Text style={styles.coverChipText}>Reports Cover Photo</Text>
        </View>
        {uploadingCover ? (
          <View style={[styles.overlay, { backgroundColor: PHOTO_SCRIM }]}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : null}
      </TouchableOpacity>

      <View style={[styles.idRow, { marginTop: -Math.round(logoSize / 2), paddingLeft: isDesktop ? 24 : 16 }]}>
        <TouchableOpacity
          onPress={handlePickLogo}
          disabled={uploadingLogo}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Tap to change logo"
          style={[
            styles.logo,
            {
              width: logoSize,
              height: logoSize,
              borderRadius: isDesktop ? adminRadius.lg : adminRadius.md,
              borderColor: c.base,
              backgroundColor: FAIRWAY,
            },
          ]}
        >
          {course.logoUrl ? (
            <Image source={{ uri: course.logoUrl }} style={styles.fill} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Ionicons name="business-outline" size={28} color={LIME} />
            </View>
          )}
          {uploadingLogo ? (
            <View style={[styles.overlay, { backgroundColor: PHOTO_SCRIM }]}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : null}
        </TouchableOpacity>
        <View style={styles.idText}>
          <Text style={[styles.clubName, { color: c.ink }]} numberOfLines={2}>
            {course.name}
          </Text>
          <TouchableOpacity onPress={handlePickLogo} disabled={uploadingLogo} accessibilityRole="button" hitSlop={8}>
            <Text style={[styles.hint, { color: c.accentText }]}>Tap to change logo</Text>
          </TouchableOpacity>
        </View>
      </View>
      {isDesktop ? null : <Text style={[styles.foot, { color: c.ink2 }]}>Shown at the top of your Reports dashboard.</Text>}
    </View>
  );

  const detailsGroup = (
    <View>
      <Eyebrow style={styles.groupLabel}>Course Details</Eyebrow>
      <Tile style={styles.formTile}>
        <TextField placeholder="Course Name" variant="onLight" value={name} onChangeText={setName} />
        <TextField
          placeholder="Contact Email"
          variant="onLight"
          autoCapitalize="none"
          keyboardType="email-address"
          value={contactEmail}
          onChangeText={setContactEmail}
        />
        <TextField placeholder="Contact Phone" variant="onLight" keyboardType="phone-pad" value={contactPhone} onChangeText={setContactPhone} />
        <TextField placeholder="Address" variant="onLight" value={address} onChangeText={setAddress} />
        <AdminButton label="Save Course Profile" variant="accent" size="lg" fullWidth onPress={handleSaveProfile} loading={savingProfile} />
      </Tile>

      {/* Earn rate: read only, set by the Flagrr team. */}
      <Tile padded={false} style={styles.groupGap}>
        <View style={styles.valueRow}>
          <Text style={[styles.rowLabel, { color: c.ink2 }]}>Flagrr Cash per Rand</Text>
          <Text style={[styles.rowValue, { color: c.ink }]}>{String(course.fbPerRand)}</Text>
        </View>
      </Tile>
      <Text style={[styles.foot, { color: c.ink2 }]}>
        Your Flagrr Cash denomination can only be changed by the Flagrr team. Contact support if you'd like to request a change.
      </Text>
    </View>
  );

  const billingGroup = (
    <View>
      <Eyebrow style={styles.groupLabel}>Billing</Eyebrow>
      <Tile style={styles.formTile}>
        <View style={styles.inlineRow}>
          <Text style={[styles.rowLabel, { color: c.ink2 }]}>Subscription Status</Text>
          <StatusPill
            label={SUBSCRIPTION_LABELS[course.subscriptionStatus ?? 'active'] ?? 'Active'}
            tone={pastDue ? 'neg' : 'pos'}
          />
        </View>
        <Muted>
          {course.subscriptionStatus === 'past_due'
            ? 'Your last payment failed. Contact Flagrr support to update your billing details before your subscription is cancelled.'
            : 'Managed by the Flagrr team. Contact support with any billing questions.'}
        </Muted>
        <AdminButton
          label="Contact Support"
          icon="headset-outline"
          variant="glass"
          onPress={() => navigation.navigate('AdminSupportTickets')}
          style={{ alignSelf: 'flex-start' }}
        />
      </Tile>
    </View>
  );

  // Phones only: the desktop Staff and Admins page links here, but the phone
  // Staff screen and More tab don't, so keep a way in.
  const clubAdminsGroup = (
    <View>
      <Eyebrow style={styles.groupLabel}>Club Admins</Eyebrow>
      <Tile padded={false} style={styles.listTile}>
        <SettingsRow first icon="person-add-outline" label="Club Admins" onPress={() => navigation.navigate('AdminClubAdmins')} />
      </Tile>
      <Text style={[styles.foot, { color: c.ink2 }]}>
        See who else administers your club, or add one more admin (up to 2 in total).
      </Text>
    </View>
  );

  const appearanceGroup = (
    <View>
      <Eyebrow style={styles.groupLabel}>Appearance</Eyebrow>
      <Tile>
        <ThemeToggleRow onChange={handleThemeChange} disabled={savingTheme} />
      </Tile>
    </View>
  );

  const passwordGroup = (
    <View>
      <Eyebrow style={styles.groupLabel}>Change Password</Eyebrow>
      <Tile style={styles.formTile}>
        <TextField placeholder="Current Password" variant="onLight" isPassword value={currentPassword} onChangeText={setCurrentPassword} />
        <TextField placeholder="New Password" variant="onLight" isPassword value={newPassword} onChangeText={setNewPassword} />
        <AdminButton
          label="Update Password"
          variant="glass"
          onPress={handleChangePassword}
          loading={changingPassword}
          style={{ alignSelf: 'flex-start' }}
        />
      </Tile>
    </View>
  );

  const legalGroup = (
    <View>
      <Eyebrow style={styles.groupLabel}>Legal</Eyebrow>
      <Tile padded={false} style={styles.listTile}>
        <SettingsRow first icon="shield-checkmark-outline" label="Terms and Privacy" onPress={() => navigation.navigate('TermsPrivacy')} />
        <SettingsRow danger icon="log-out-outline" label="Log Out" onPress={handleLogout} />
      </Tile>
    </View>
  );

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminCourseProfile" breadcrumb="Club Settings" showRail={false}>
        <PageTitle>Course Profile</PageTitle>
        {banners}
        {hero}
        <View style={styles.dCols}>
          <View style={styles.dCol}>
            {detailsGroup}
            {appearanceGroup}
          </View>
          <View style={styles.dCol}>
            {billingGroup}
            {passwordGroup}
            {legalGroup}
          </View>
        </View>
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="Club Settings" subtitle={`${admin.firstName} ${admin.lastName}`} showBack={false} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {banners}
        {hero}
        {detailsGroup}
        {billingGroup}
        {clubAdminsGroup}
        {appearanceGroup}
        {passwordGroup}
        {legalGroup}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48, gap: 16 },
  fill: { width: '100%', height: '100%' },
  cover: { width: '100%', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  coverChip: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: adminRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    // A dark wash so the white label reads on any photo.
    backgroundColor: PHOTO_SCRIM,
  },
  coverChipText: { ...adminFont.bodySemiBold, fontSize: 12.5, color: '#FFFFFF' },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  idRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  logo: { overflow: 'hidden', borderWidth: 4 },
  logoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  idText: { flex: 1, minWidth: 0, gap: 4, paddingBottom: 4 },
  clubName: { ...adminFont.bodyBold, fontSize: 20 },
  hint: { ...adminFont.bodySemiBold, fontSize: 13 },
  groupLabel: { marginLeft: 16, marginBottom: 8 },
  groupGap: { marginTop: 12 },
  formTile: { gap: 12 },
  listTile: { overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16 },
  listRowLabel: { flex: 1, ...adminFont.bodyMedium, fontSize: 15 },
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 52, paddingHorizontal: 16 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowLabel: { ...adminFont.body, fontSize: 15 },
  rowValue: { ...adminFont.bodyBold, ...tabularNums, fontSize: 20 },
  foot: { ...adminFont.body, fontSize: 12.5, lineHeight: 18, marginTop: 8, marginHorizontal: 16 },
  dCols: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' },
  dCol: { flex: 1, minWidth: 360, gap: 20 },
});
