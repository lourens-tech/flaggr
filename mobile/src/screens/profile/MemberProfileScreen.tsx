import React, { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { api, ApiError, type Course } from '../../api/client';
import { AvatarPermissionError, pickAndResizeAvatar } from '../../utils/pickAvatar';
import { showAlert } from '../../utils/alert';
import { ThemeToggleRow } from '../../components/common/ThemeToggleRow';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import type { ThemePreference } from '../../context/ThemeContext';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Profile'>,
  NativeStackScreenProps<RootStackParamList>
>;

function ProfileField({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <TouchableOpacity style={styles.fieldRow} onPress={onPress} disabled={!onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{value}</Text>
      </View>
      {onPress ? <Ionicons name="pencil" size={16} color={colors.clubGreen} /> : null}
    </TouchableOpacity>
  );
}

function LinkRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <TouchableOpacity style={styles.linkRow} onPress={onPress}>
      <Ionicons name={icon} size={18} color={colors.clubGreen} />
      <Text style={styles.linkLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

export function MemberProfileScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, unreadNotificationCount, logout, updateAvatar, changeHomeClub, updateThemePreference, changePassword } =
    useApp();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [clubPickerOpen, setClubPickerOpen] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [changingClub, setChangingClub] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const openClubPicker = async () => {
    setClubPickerOpen(true);
    setLoadingCourses(true);
    try {
      setCourses(await api.courses());
    } catch {
      setCourses([]);
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleSelectClub = (course: Course) => {
    setClubPickerOpen(false);
    if (course.id === user.courseId) return;
    showAlert(
      'Change home club?',
      `Switch your home club to ${course.name}? Your rewards and any ads shown in the app will update to match.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            setChangingClub(true);
            try {
              await changeHomeClub(course.id);
            } catch (err) {
              const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
              showAlert('Couldn’t change club', message);
            } finally {
              setChangingClub(false);
            }
          },
        },
      ],
    );
  };

  const handleChangeAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const imageBase64 = await pickAndResizeAvatar();
      if (imageBase64) await updateAvatar(imageBase64);
    } catch (err) {
      if (err instanceof AvatarPermissionError) {
        showAlert('Permission needed', err.message);
      } else {
        const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
        showAlert('Couldn’t update profile picture', message);
      }
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleThemeChange = async (preference: ThemePreference) => {
    setSavingTheme(true);
    try {
      await updateThemePreference(preference);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
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
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t change password', message);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Profile</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Notifications')}
              accessibilityLabel="Notifications"
              accessibilityRole="button"
            >
              <Ionicons name="notifications" size={20} color={colors.white} />
              {unreadNotificationCount > 0 ? <View style={styles.badge} /> : null}
            </TouchableOpacity>
            <View style={styles.avatarSmall}>
              {user.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatarSmallImage} />
              ) : (
                <Ionicons name="person" size={18} color={colors.darkGreen} />
              )}
            </View>
          </View>
        </View>
        <Text style={styles.welcome}>Hello, {user.firstName} 👋</Text>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <TouchableOpacity
            style={styles.avatarLarge}
            onPress={handleChangeAvatar}
            disabled={uploadingAvatar}
            activeOpacity={0.8}
          >
            <View style={styles.avatarLargeClip}>
              {user.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatarLargeImage} />
              ) : (
                <Ionicons name="person" size={48} color={colors.clubGreen} />
              )}
              {uploadingAvatar ? (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator color={colors.white} />
                </View>
              ) : null}
            </View>
            {!uploadingAvatar ? (
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={14} color={colors.white} />
              </View>
            ) : null}
          </TouchableOpacity>
          <LinearGradient
            colors={[colors.goldGradientStart, colors.goldGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.tierBadge}
          >
            <Text style={styles.tierBadgeText}>{user.tier} Member</Text>
            <MaterialCommunityIcons name="crown" size={12} color={colors.white} />
          </LinearGradient>
          <Text style={styles.name}>
            {user.firstName} {user.lastName}
          </Text>
          <Text style={styles.club}>{user.homeClub}</Text>

          <View style={styles.fieldsWrapper}>
            <ProfileField
              label="Name"
              value={`${user.firstName} ${user.lastName}`}
              onPress={() => navigation.navigate('EditProfile')}
            />
            <ProfileField label="Phone" value={user.phone ?? '—'} onPress={() => navigation.navigate('EditProfile')} />
            <ProfileField label="Email" value={user.email} onPress={() => navigation.navigate('EditProfile')} />
            <ProfileField
              label="Birthday"
              value={
                user.dateOfBirth
                  ? new Date(user.dateOfBirth).toLocaleDateString(undefined, {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })
                  : '—'
              }
              onPress={() => navigation.navigate('EditProfile')}
            />
            <ProfileField
              label="Club"
              value={changingClub ? 'Updating…' : user.homeClub}
              onPress={changingClub ? undefined : openClubPicker}
            />
            <ProfileField
              label="Member Since"
              value={new Date(user.memberSince).toLocaleDateString(undefined, {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Support</Text>
        <View style={styles.linksCard}>
          <LinkRow icon="help-circle-outline" label="Help Center" onPress={() => navigation.navigate('HelpCenter')} />
          <LinkRow icon="headset-outline" label="Contact Support" onPress={() => navigation.navigate('SupportTickets')} />
          <LinkRow icon="chatbubbles-outline" label="My Enquiries" onPress={() => navigation.navigate('MyEnquiries')} />
        </View>

        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={[styles.linksCard, { padding: spacing.sm }]}>
          <ThemeToggleRow onChange={handleThemeChange} disabled={savingTheme} />
        </View>

        <Text style={styles.sectionLabel}>Security</Text>
        <View style={[styles.linksCard, { padding: spacing.md }]}>
          <TextField
            placeholder="Current Password"
            variant="onLight"
            isPassword
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
          <View style={{ height: spacing.md }} />
          <TextField placeholder="New Password" variant="onLight" isPassword value={newPassword} onChangeText={setNewPassword} />
          <View style={{ height: spacing.md }} />
          <PillButton label="Update Password" variant="outline" onPress={handleChangePassword} loading={changingPassword} />
        </View>

        <Text style={styles.sectionLabel}>Legal</Text>
        <View style={styles.linksCard}>
          <LinkRow
            icon="shield-checkmark-outline"
            label="Terms & Privacy"
            onPress={() => navigation.navigate('TermsPrivacy')}
          />
        </View>

        <TouchableOpacity style={styles.logoutRow} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color={colors.negative} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>

      <Modal visible={clubPickerOpen} transparent animationType="fade" onRequestClose={() => setClubPickerOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setClubPickerOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Choose Golf Club</Text>
            {loadingCourses ? (
              <ActivityIndicator color={colors.clubGreen} style={{ marginVertical: spacing.lg }} />
            ) : (
              <FlatList
                data={courses}
                keyExtractor={(c) => c.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.clubOptionRow} onPress={() => handleSelectClub(item)}>
                    <Text style={styles.clubOptionText}>{item.name}</Text>
                    {item.id === user.courseId ? (
                      <Ionicons name="checkmark" size={18} color={colors.clubGreen} />
                    ) : null}
                  </TouchableOpacity>
                )}
              />
            )}
          </Pressable>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clubGreen },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  header: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
  },
  headerTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.white },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: { position: 'absolute', top: -2, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime },
  avatarSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarSmallImage: { width: '100%', height: '100%' },
  welcome: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.cardTitle,
    color: colors.white,
    paddingHorizontal: screenPadding,
    paddingVertical: spacing.md,
  },
  content: { backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingTop: spacing.xl },
  profileCard: { alignItems: 'center', paddingHorizontal: screenPadding },
  avatarLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: colors.lime,
  },
  avatarLargeClip: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
    backgroundColor: colors.mintBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarLargeImage: { width: '100%', height: '100%' },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.clubGreen,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginTop: -12,
  },
  tierBadgeText: { fontFamily: fontFamily.heading, fontSize: 11, color: colors.white, textTransform: 'uppercase' },
  name: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.textPrimary, marginTop: spacing.sm },
  club: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 2 },
  fieldsWrapper: { width: '100%', marginTop: spacing.lg, gap: spacing.sm },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mintBgAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  fieldLabel: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  fieldValue: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.small, color: colors.textPrimary, marginTop: 2 },
  sectionLabel: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.cardTitle,
    color: colors.textPrimary,
    paddingHorizontal: screenPadding,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  linksCard: { marginHorizontal: screenPadding, backgroundColor: colors.mintBgAlt, borderRadius: radius.md },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 6,
  },
  linkLabel: { flex: 1, fontFamily: fontFamily.bodyMedium, fontSize: fontSize.small, color: colors.textPrimary },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  logoutText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.small, color: colors.negative },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '60%',
  },
  sheetTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  clubOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  clubOptionText: { fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.textPrimary },
});
}
