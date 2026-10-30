import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from 'react-native';
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
import { AdminButton, Banner, Eyebrow, Muted, Tile } from '../../components/admin/ui';
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
  const [passwordOpen, setPasswordOpen] = useState(false);

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
      setPasswordOpen(false);
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
  const initial = (course.name || 'C').trim().charAt(0).toUpperCase();

  const banners = pastDue || course.onboardingCompletedAt === null ? (
    <View style={styles.banners}>
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
    </View>
  ) : null;

  const logoSize = isDesktop ? 108 : 84;
  // How far the logo rises over the cover; the title starts just below it.
  const overlap = Math.round(logoSize * 0.54);

  // Cover photo with the club logo overlapping its lower edge, then the
  // club's name as the page title.
  const hero = (
    <View>
      <View
        style={[
          styles.cover,
          {
            height: isDesktop ? 230 : 170,
            borderRadius: isDesktop ? adminRadius.lg : adminRadius.md,
            backgroundColor: c.surface2,
            borderColor: c.edge,
          },
        ]}
      >
        {course.coverImageUrl ? (
          <Image source={{ uri: course.coverImageUrl }} style={styles.fill} resizeMode="cover" />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="image-outline" size={24} color={c.icon} />
            <Muted>No cover photo yet</Muted>
          </View>
        )}
        <View style={styles.coverShade} pointerEvents="none" />
        <TouchableOpacity
          style={styles.coverButton}
          onPress={handlePickCover}
          disabled={uploadingCover}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Change cover photo"
        >
          <Ionicons name="camera-outline" size={15} color="#FFFFFF" />
          <Text style={styles.coverButtonText}>Change cover photo…</Text>
        </TouchableOpacity>
        {uploadingCover ? (
          <View style={[styles.overlay, { backgroundColor: PHOTO_SCRIM }]}>
            <ActivityIndicator color="#FFFFFF" />
            <Text style={styles.uploadText}>Uploading cover photo…</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.idRow, { marginTop: -overlap, paddingLeft: isDesktop ? 28 : 16 }]}>
        <TouchableOpacity
          onPress={handlePickLogo}
          disabled={uploadingLogo}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Change logo"
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
              <Text style={[styles.logoInitial, { fontSize: isDesktop ? 48 : 38 }]}>{initial}</Text>
            </View>
          )}
          {uploadingLogo ? (
            <View style={[styles.overlay, { backgroundColor: PHOTO_SCRIM }]}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : null}
        </TouchableOpacity>
        <View style={[styles.idText, { marginTop: overlap + 12 }]}>
          {/* Phones already say "Club Settings" in the header above. */}
          {isDesktop ? <Eyebrow>Club settings</Eyebrow> : null}
          <Text
            accessibilityRole="header"
            style={[styles.clubName, { color: c.ink, fontSize: isDesktop ? 34 : 26, lineHeight: isDesktop ? 38 : 30 }]}
            numberOfLines={2}
          >
            {course.name}
          </Text>
        </View>
        {isDesktop ? (
          <AdminButton label="Change logo…" variant="glass" onPress={handlePickLogo} loading={uploadingLogo} style={{ marginTop: overlap + 14 }} />
        ) : null}
      </View>
      {isDesktop ? null : (
        <AdminButton label="Change logo…" variant="glass" onPress={handlePickLogo} loading={uploadingLogo} style={styles.changeLogoPhone} />
      )}
    </View>
  );

  const saveButton = (
    <AdminButton
      label="Save changes"
      variant="accent"
      onPress={handleSaveProfile}
      loading={savingProfile}
      size={isDesktop ? 'md' : 'lg'}
      fullWidth={!isDesktop}
    />
  );

  const detailsGroup = (
    <View>
      <Eyebrow style={styles.groupLabel}>Details</Eyebrow>
      <Tile padded={false} style={styles.listTile}>
        <FieldRow first label="Club name" value={name} onChangeText={setName} placeholder="Course Name" />
        <FieldRow
          label="Contact email"
          value={contactEmail}
          onChangeText={setContactEmail}
          placeholder="Contact Email"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <FieldRow label="Contact phone" value={contactPhone} onChangeText={setContactPhone} placeholder="Contact Phone" keyboardType="phone-pad" />
        <FieldRow label="Address" value={address} onChangeText={setAddress} placeholder="Address" />
      </Tile>
      {isDesktop ? null : <View style={styles.groupGap}>{saveButton}</View>}
    </View>
  );

  // Earn rate: read only, set by the Flagrr team.
  const earningGroup = (
    <View>
      <Eyebrow style={styles.groupLabel}>Earning</Eyebrow>
      <Tile padded={false} style={styles.listTile}>
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

  const appearanceGroup = (
    <View>
      <Eyebrow style={styles.groupLabel}>Appearance</Eyebrow>
      <Tile>
        <ThemeToggleRow onChange={handleThemeChange} disabled={savingTheme} />
      </Tile>
    </View>
  );

  // The Flagrr plan card: Fairway ground, like the brand's own surfaces.
  const subscriptionGroup = (
    <View>
      <Eyebrow style={styles.groupLabel}>Subscription</Eyebrow>
      <View style={styles.plan}>
        <View style={styles.planHead}>
          <Text style={styles.planEyebrow}>Flagrr subscription</Text>
          <View style={[styles.planPill, { backgroundColor: pastDue ? '#FF8A80' : LIME }]}>
            <Text style={styles.planPillText}>{SUBSCRIPTION_LABELS[course.subscriptionStatus ?? 'active'] ?? 'Active'}</Text>
          </View>
        </View>
        <Text style={styles.planTitle}>Managed by Flagrr</Text>
        <Text style={styles.planBody}>
          {pastDue
            ? 'Your last payment failed. Contact Flagrr support to update your billing details before your subscription is cancelled.'
            : 'Billing questions go to the Flagrr team.'}
        </Text>
        <TouchableOpacity
          style={styles.planButton}
          onPress={() => navigation.navigate('AdminSupportTickets')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Contact Support"
        >
          <Ionicons name="headset-outline" size={16} color="#FFFFFF" />
          <Text style={styles.planButtonText}>Contact Support</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const accountGroup = (
    <View>
      <Eyebrow style={styles.groupLabel}>Your account</Eyebrow>
      <Tile padded={false} style={styles.listTile}>
        <View style={styles.accountRow}>
          <View style={styles.accountAvatar}>
            <Text style={styles.accountInitials}>
              {`${admin.firstName.charAt(0)}${admin.lastName.charAt(0)}`.toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.accountName, { color: c.ink }]} numberOfLines={1}>
              {admin.firstName} {admin.lastName}
            </Text>
            <Text style={[styles.accountEmail, { color: c.ink2 }]} numberOfLines={1}>{admin.email}</Text>
          </View>
        </View>
        <SettingsRow icon="key-outline" label="Change password…" onPress={() => setPasswordOpen(true)} />
        <SettingsRow icon="shield-checkmark-outline" label="Terms and Privacy" onPress={() => navigation.navigate('TermsPrivacy')} />
        <SettingsRow danger icon="log-out-outline" label="Log out…" onPress={handleLogout} />
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

  const passwordSheet = (
    <Modal visible={passwordOpen} transparent animationType="fade" onRequestClose={() => setPasswordOpen(false)}>
      <View style={styles.sheetWrap}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={() => setPasswordOpen(false)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: c.sheet, borderColor: c.edge }]} accessibilityViewIsModal>
          <Text style={[styles.sheetTitle, { color: c.ink }]} accessibilityRole="header">Change password</Text>
          <Muted style={styles.sheetLede}>You'll stay signed in on this device.</Muted>
          <View style={{ gap: 12 }}>
            <TextField placeholder="Current Password" variant="onLight" isPassword value={currentPassword} onChangeText={setCurrentPassword} />
            <TextField placeholder="New Password" variant="onLight" isPassword value={newPassword} onChangeText={setNewPassword} />
          </View>
          <Text style={[styles.sheetHint, { color: c.ink3 }]}>At least 8 characters.</Text>
          <View style={styles.sheetButtons}>
            <AdminButton label="Cancel" variant="glass" onPress={() => setPasswordOpen(false)} style={{ flex: 1 }} />
            <AdminButton label="Update password" variant="accent" onPress={handleChangePassword} loading={changingPassword} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminCourseProfile" breadcrumb="Club Settings" showRail={false} headerRight={saveButton}>
        {hero}
        {banners}
        <View style={styles.dCols}>
          <View style={styles.dCol}>
            {detailsGroup}
            {earningGroup}
            {appearanceGroup}
          </View>
          <View style={styles.dCol}>
            {subscriptionGroup}
            {accountGroup}
          </View>
        </View>
        {passwordSheet}
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="Club Settings" subtitle={`${admin.firstName} ${admin.lastName}`} showBack={false} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {hero}
        {banners}
        {detailsGroup}
        {earningGroup}
        {subscriptionGroup}
        {clubAdminsGroup}
        {appearanceGroup}
        {accountGroup}
      </ScrollView>
      {passwordSheet}
    </View>
  );
}

// One editable row of the Details list: label on the left, the value typed
// straight into the row (iOS Settings style).
function FieldRow({
  label,
  first,
  ...input
}: {
  label: string;
  first?: boolean;
} & Pick<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'keyboardType' | 'autoCapitalize'>) {
  const { c } = useAdminTheme();
  const isDesktop = useIsDesktopNav();
  return (
    <View style={[styles.fieldRow, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge }]}>
      <Text style={[styles.fieldLabel, { color: c.ink2, width: isDesktop ? 140 : 112 }]}>{label}</Text>
      <TextInput
        {...input}
        accessibilityLabel={label}
        placeholderTextColor={c.ink3}
        style={[styles.fieldInput, { color: c.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48, gap: 20 },
  fill: { width: '100%', height: '100%' },
  cover: { width: '100%', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  // A light-to-dark wash so the button and the logo ring read on any photo.
  coverShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(6,14,10,0.18)' },
  coverButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    borderRadius: adminRadius.pill,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(10,20,15,0.6)',
  },
  coverButtonText: { ...adminFont.bodySemiBold, fontSize: 14, color: '#FFFFFF' },
  uploadText: { ...adminFont.bodySemiBold, fontSize: 14, color: '#FFFFFF', marginTop: 10 },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  idRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' },
  logo: { overflow: 'hidden', borderWidth: 5 },
  logoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoInitial: { ...adminFont.title, color: LIME },
  idText: { flex: 1, minWidth: 180, gap: 6 },
  clubName: { ...adminFont.title, letterSpacing: -0.6 },
  changeLogoPhone: { alignSelf: 'flex-start', marginTop: 14, marginLeft: 16 },
  groupLabel: { marginLeft: 16, marginBottom: 8 },
  groupGap: { marginTop: 12 },
  listTile: { overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16 },
  listRowLabel: { flex: 1, ...adminFont.bodyMedium, fontSize: 15 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16 },
  fieldLabel: { ...adminFont.body, fontSize: 15 },
  fieldInput: { flex: 1, minWidth: 0, ...adminFont.body, fontSize: 15, paddingVertical: 14 },
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 52, paddingHorizontal: 16 },
  rowLabel: { ...adminFont.body, fontSize: 15 },
  rowValue: { ...adminFont.bodyBold, ...tabularNums, fontSize: 20 },
  foot: { ...adminFont.body, fontSize: 12.5, lineHeight: 18, marginTop: 8, marginHorizontal: 16 },
  plan: { backgroundColor: FAIRWAY, borderRadius: adminRadius.md, padding: 18 },
  planHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  planEyebrow: { ...adminFont.bodyBold, fontSize: 11.5, letterSpacing: 1.1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' },
  planPill: { borderRadius: adminRadius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  planPillText: { ...adminFont.bodyBold, fontSize: 12, color: FAIRWAY },
  planTitle: { ...adminFont.title, fontSize: 24, lineHeight: 26, color: '#FFFFFF', marginTop: 10 },
  planBody: { ...adminFont.body, fontSize: 13.5, lineHeight: 19, color: 'rgba(255,255,255,0.85)', marginTop: 8 },
  planButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    minHeight: 40,
    marginTop: 14,
    paddingHorizontal: 16,
    borderRadius: adminRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  planButtonText: { ...adminFont.bodySemiBold, fontSize: 14, color: '#FFFFFF' },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 16, paddingVertical: 10 },
  accountAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: FAIRWAY, alignItems: 'center', justifyContent: 'center' },
  accountInitials: { ...adminFont.bodyBold, fontSize: 12, color: LIME },
  accountName: { ...adminFont.bodySemiBold, fontSize: 15 },
  accountEmail: { ...adminFont.body, fontSize: 13, marginTop: 1 },
  sheetWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  sheet: { width: '100%', maxWidth: 440, borderRadius: adminRadius.lg, borderWidth: StyleSheet.hairlineWidth, padding: 24 },
  sheetTitle: { ...adminFont.title, fontSize: 26, lineHeight: 30 },
  sheetLede: { marginTop: 6, marginBottom: 18 },
  sheetHint: { ...adminFont.body, fontSize: 12.5, marginTop: 8, marginLeft: 4 },
  sheetButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },
  banners: { gap: 12, marginTop: 18 },
  dCols: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start', marginTop: 20 },
  dCol: { flex: 1, minWidth: 380, gap: 20 },
});
