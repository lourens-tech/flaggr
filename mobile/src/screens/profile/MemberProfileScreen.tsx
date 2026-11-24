import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { api, ApiError, type Course } from '../../api/client';
import { AvatarPermissionError, pickAndResizeAvatar } from '../../utils/pickAvatar';
import { showAlert } from '../../utils/alert';
import type { ThemePreference } from '../../context/ThemeContext';
import { useBento, useTheme } from '../../context/ThemeContext';
import { bentoBrand, bentoType } from '../../theme/bento';
import { TextField } from '../../components/common/TextField';
import { Appear, BentoButton, BentoIcon, BentoScreen, BentoSheet, BentoTile, CountUp, Eyebrow, SegmentedControl, type BentoIconName } from '../../components/bento';
import { BentoAvatar } from '../../components/bento/BentoAvatar';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Profile'>,
  NativeStackScreenProps<RootStackParamList>
>;

const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString(undefined, opts);

export function MemberProfileScreen({ navigation }: Props) {
  const { t } = useBento();
  const { preference } = useTheme();
  const {
    user,
    points,
    streak,
    stats,
    unreadNotificationCount,
    logout,
    updateAvatar,
    changeHomeClub,
    updateThemePreference,
    changePassword,
    deleteAccount,
    exportMyData,
  } = useApp();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [changingClub, setChangingClub] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Which Bento sheet is open: the club picker, Change password, or Delete
  // account. (The club picker was a modal; password and delete were inline.)
  const [sheet, setSheet] = useState<'club' | 'password' | 'delete' | null>(null);
  const setClubPickerOpen = (open: boolean) => setSheet(open ? 'club' : null);
  const clubPickerOpen = sheet === 'club';

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
      setSheet(null);
      showAlert('Password changed', 'Use your new password next time you log in.');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t change password', message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleExportData = async () => {
    setExportingData(true);
    try {
      const downloaded = await exportMyData();
      if (!downloaded) {
        showAlert('Not available here', 'Data export isn’t available on this device.');
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t export your data', message);
    } finally {
      setExportingData(false);
    }
  };

  const handleDeleteAccount = () => {
    if (!deletePassword) {
      showAlert('Missing info', 'Enter your current password to confirm.');
      return;
    }
    showAlert(
      'Delete your account?',
      'This permanently removes your profile, points, receipts, vouchers, and message history. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            try {
              await deleteAccount(deletePassword);
            } catch (err) {
              const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
              showAlert('Couldn’t delete account', message);
              setDeletingAccount(false);
            }
          },
        },
      ],
    );
  };

  return (
    <BentoScreen tabBar>
      {/* Who you are: photo (tap to change), name, club and tier, three stats */}
      <Appear>
        <View style={{ alignItems: 'center', paddingTop: 8 }}>
          <Pressable onPress={handleChangeAvatar} disabled={uploadingAvatar} accessibilityRole="button" accessibilityLabel="Change profile photo">
            <BentoAvatar size={88} />
            <View style={{ position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 3px ${t.ground}` }}>
              {uploadingAvatar ? <ActivityIndicator size="small" color={t.accentInk} /> : <BentoIcon name="camera" size={15} color={t.accentInk} strokeWidth={1.9} />}
            </View>
          </Pressable>
          <Text accessibilityRole="header" style={[bentoType.h1, { fontSize: 28, lineHeight: 31, color: t.ink, marginTop: 12, textAlign: 'center' }]}>
            {user.firstName} {user.lastName}
          </Text>
          <Text style={{ fontSize: 14, color: t.muted, marginTop: 4, textAlign: 'center' }}>
            {user.homeClub ? `${user.homeClub} · ` : ''}
            <Text style={{ color: t.accent, fontWeight: '600' }}>{user.tier}</Text>
          </Text>
        </View>
      </Appear>

      <Appear>
        <BentoTile>
          <View style={{ flexDirection: 'row' }}>
            {[
              { v: points.balance, l: 'Flagrr Cash' },
              { v: streak.weeks, l: 'Week Streak' },
              { v: stats.roundsPlayed9 + stats.roundsPlayed18, l: 'Rounds Played' },
            ].map((x, i) => (
              <View key={x.l} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? 1 : 0, borderLeftColor: t.hair, paddingHorizontal: 4 }}>
                <CountUp value={x.v} style={[bentoType.number, { fontSize: 24, color: t.ink }]} />
                <Text style={{ fontSize: 12, color: t.muted, marginTop: 2, textAlign: 'center' }}>{x.l}</Text>
              </View>
            ))}
          </View>
        </BentoTile>
      </Appear>

      {/* Refer a Friend */}
      <Appear>
        <BentoTile tone="hero" onPress={() => navigation.navigate('Referral')} accessibilityLabel="Refer a Friend">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[bentoType.eyebrow, { color: bentoBrand.lime }]}>Refer a Friend</Text>
              <Text style={[bentoType.number, { fontSize: 22, lineHeight: 26, color: '#FFFFFF', marginTop: 6 }]}>Bring your four-ball</Text>
            </View>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: bentoBrand.lime, alignItems: 'center', justifyContent: 'center' }}>
              <BentoIcon name="arrowUpRight" size={17} color={bentoBrand.fairway} strokeWidth={2} />
            </View>
          </View>
        </BentoTile>
      </Appear>

      <Section label="Activity">
        <Row icon="activity" label="Reward Activity" onPress={() => navigation.navigate('Activity')} />
        <Row icon="receipt" label="Receipt History" onPress={() => navigation.navigate('ReceiptHistory')} divider />
      </Section>

      <Section label="Details">
        <Field label="Name" value={`${user.firstName} ${user.lastName}`} onPress={() => navigation.navigate('EditProfile')} />
        <Field label="Phone" value={user.phone ?? '—'} onPress={() => navigation.navigate('EditProfile')} divider />
        <Field label="Email" value={user.email} onPress={() => navigation.navigate('EditProfile')} divider />
        <Field
          label="Birthday"
          value={user.dateOfBirth ? fmtDate(user.dateOfBirth, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
          onPress={() => navigation.navigate('EditProfile')}
          divider
        />
        <Field label="Club" value={changingClub ? 'Updating…' : user.homeClub} onPress={changingClub ? undefined : openClubPicker} divider />
        <Field label="Member Since" value={fmtDate(user.memberSince, { day: '2-digit', month: '2-digit', year: 'numeric' })} divider />
      </Section>

      <Section label="Support">
        <Row icon="info" label="Help Center" onPress={() => navigation.navigate('HelpCenter')} />
        <Row icon="golfFlag" label="Contact Your Club" onPress={() => navigation.navigate('Contact')} divider />
        <Row icon="bell" label="My Enquiries" onPress={() => navigation.navigate('MyEnquiries')} divider />
        <Row icon="check" label="Give Feedback" onPress={() => navigation.navigate('GiveFeedback')} divider />
      </Section>

      <Section label="Settings">
        <View style={{ paddingVertical: 13, gap: 10 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }}>Appearance</Text>
          <View pointerEvents={savingTheme ? 'none' : 'auto'}>
            <SegmentedControl
              fill
              value={preference}
              onChange={(v) => handleThemeChange(v as ThemePreference)}
              accessibilityLabel="Theme"
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
            />
          </View>
        </View>
        <Row icon="bell" label="Notification Preferences" onPress={() => navigation.navigate('NotificationPreferences')} divider />
        <Row icon="info" label="Security" sub="Change your password" onPress={() => setSheet('password')} divider />
      </Section>

      <Section label="Account">
        <Row icon="arrowUpRight" label="Export My Data" onPress={handleExportData} busy={exportingData} />
        <Row icon="info" label="Terms and Privacy" onPress={() => navigation.navigate('TermsPrivacy')} divider />
        <Row icon="back" label="Log Out" onPress={logout} divider plain />
        <Row icon="close" label="Delete Account" onPress={() => setSheet('delete')} divider danger />
      </Section>

      <BentoSheet visible={sheet === 'password'} title="Change your password" subtitle="Security" onClose={() => setSheet(null)}>
        <TextField placeholder="Current Password" variant="onLight" isPassword value={currentPassword} onChangeText={setCurrentPassword} accessibilityLabel="Current password" />
        <TextField placeholder="New Password" variant="onLight" isPassword value={newPassword} onChangeText={setNewPassword} accessibilityLabel="New password" />
        <Text style={{ fontSize: 13, color: t.muted }}>At least 8 characters. Use your new password next time you log in.</Text>
        <BentoButton label="Update Password" onPress={handleChangePassword} loading={changingPassword} style={{ marginTop: 6 }} />
      </BentoSheet>

      <BentoSheet visible={sheet === 'delete'} title="Delete your account?" onClose={() => setSheet(null)}>
        <Text style={[bentoType.body, { color: t.muted }]}>
          Deleting your account permanently removes your profile, points, receipts, and reward history. This can’t be undone. Enter your current password to confirm.
        </Text>
        <TextField placeholder="Current Password" variant="onLight" isPassword value={deletePassword} onChangeText={setDeletePassword} accessibilityLabel="Current password" />
        <Pressable
          onPress={handleDeleteAccount}
          disabled={deletingAccount}
          accessibilityRole="button"
          style={{ minHeight: 52, borderRadius: 999, borderWidth: 1, borderColor: t.danger, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}
        >
          {deletingAccount ? <ActivityIndicator color={t.danger} /> : <Text style={{ fontSize: 16, fontWeight: '600', color: t.danger }}>Delete Account</Text>}
        </Pressable>
        <Pressable onPress={() => setSheet(null)} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: t.muted }}>Cancel</Text>
        </Pressable>
      </BentoSheet>

      <BentoSheet visible={clubPickerOpen} title="Choose Golf Club" onClose={() => setClubPickerOpen(false)}>
        {loadingCourses ? (
          <ActivityIndicator color={t.accent} style={{ marginVertical: 24 }} />
        ) : (
          <View style={{ borderRadius: 20, boxShadow: `0 0 0 1px ${t.hair}`, paddingHorizontal: 16 }}>
            {courses.map((c, i) => (
              <Pressable
                key={c.id}
                onPress={() => handleSelectClub(c)}
                accessibilityRole="radio"
                accessibilityState={{ checked: c.id === user.courseId }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, borderTopWidth: i ? 1 : 0, borderTopColor: t.hair }}
              >
                <Text style={{ flex: 1, fontSize: 16, color: t.ink }}>{c.name}</Text>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.id === user.courseId ? t.accent : t.hair, alignItems: 'center', justifyContent: 'center' }}>
                  {c.id === user.courseId ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.accent }} /> : null}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </BentoSheet>
    </BentoScreen>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Appear>
      <Eyebrow style={{ marginTop: 8, marginBottom: 8, marginLeft: 4 }}>{label}</Eyebrow>
      <BentoTile padding={0}>
        <View style={{ paddingHorizontal: 16 }}>{children}</View>
      </BentoTile>
    </Appear>
  );
}

function Row({
  icon,
  label,
  sub,
  onPress,
  divider,
  danger,
  plain,
  busy,
}: {
  icon: BentoIconName;
  label: string;
  sub?: string;
  onPress: () => void;
  divider?: boolean;
  danger?: boolean;
  plain?: boolean;
  busy?: boolean;
}) {
  const { t } = useBento();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: divider ? 1 : 0, borderTopColor: t.hair, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: danger ? 'rgba(200,50,42,0.10)' : t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <BentoIcon name={icon} size={19} color={danger ? t.danger : t.accent} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: danger ? t.danger : t.ink }}>{label}</Text>
        {sub ? <Text style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      {busy ? <ActivityIndicator color={t.accent} /> : danger || plain ? null : <BentoIcon name="chevronRight" size={16} color={t.muted} />}
    </Pressable>
  );
}

function Field({ label, value, onPress, divider }: { label: string; value: string; onPress?: () => void; divider?: boolean }) {
  const { t } = useBento();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label}: ${value}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderTopWidth: divider ? 1 : 0, borderTopColor: t.hair }}
    >
      <Text style={{ width: 110, fontSize: 15, color: t.muted }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: t.ink, textAlign: 'right' }} numberOfLines={2}>
        {value}
      </Text>
      {onPress ? <BentoIcon name="chevronRight" size={16} color={t.muted} /> : <View style={{ width: 16 }} />}
    </Pressable>
  );
}
