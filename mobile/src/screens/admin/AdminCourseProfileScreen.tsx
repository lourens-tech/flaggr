import React, { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { pickAndResizeAvatar, pickAndResizeCoverImage, AvatarPermissionError } from '../../utils/pickAvatar';
import { showAlert } from '../../utils/alert';
import { colors, fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AdminCourseProfileScreen() {
  const { admin, course, updateCourseProfile, updateCourseLogo, updateCourseCover, changePassword, logout } = useAdmin();

  const [name, setName] = useState(course.name);
  const [contactEmail, setContactEmail] = useState(course.contactEmail ?? '');
  const [contactPhone, setContactPhone] = useState(course.contactPhone ?? '');
  const [address, setAddress] = useState(course.address ?? '');
  const [fbPerRand, setFbPerRand] = useState(String(course.fbPerRand));
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

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
    const rate = Number(fbPerRand);
    if (!Number.isFinite(rate) || rate <= 0) {
      showAlert('Invalid rate', 'Flagrr Cash per Rand must be a positive number.');
      return;
    }
    setSavingProfile(true);
    try {
      await updateCourseProfile({
        name: name.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        address: address.trim(),
        fbPerRand: rate,
      });
      showAlert('Saved', 'Your course profile has been updated.');
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t save', message);
    } finally {
      setSavingProfile(false);
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
        <TextField
          placeholder="Flagrr Cash per Rand"
          variant="onLight"
          keyboardType="decimal-pad"
          value={fbPerRand}
          onChangeText={setFbPerRand}
        />
        <Text style={styles.helpText}>
          Used to auto-price Rand-denominated reward options. Changing this repricess existing reward options too.
        </Text>

        <View style={{ height: spacing.md }} />
        <PillButton label="Save Course Profile" onPress={handleSaveProfile} loading={savingProfile} />

        <Text style={styles.sectionTitle}>Change Password</Text>
        <TextField placeholder="Current Password" variant="onLight" isPassword value={currentPassword} onChangeText={setCurrentPassword} />
        <View style={{ height: spacing.md }} />
        <TextField placeholder="New Password" variant="onLight" isPassword value={newPassword} onChangeText={setNewPassword} />
        <View style={{ height: spacing.md }} />
        <PillButton label="Update Password" variant="outline" onPress={handleChangePassword} loading={changingPassword} />

        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={18} color={colors.negative} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  header: { paddingHorizontal: screenPadding, paddingVertical: spacing.md },
  headerTitle: { fontFamily: fontFamily.headingDisplay, fontSize: fontSize.title, color: colors.white },
  headerSubtitle: { fontFamily: fontFamily.body, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  content: { padding: screenPadding, paddingBottom: spacing.xl * 2 },
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
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.cardTitle,
    color: colors.darkGreen,
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
