import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useFocusEffect, type CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { api, type Course } from '../../api/client';
import { AvatarPermissionError, pickAndResizeAvatar } from '../../utils/pickAvatar';
import { showAlert } from '../../utils/alert';
import { friendlyError } from '../../utils/errors';
import type { ThemePreference } from '../../context/ThemeContext';
import { useBento, useTheme } from '../../context/ThemeContext';
import { bentoBrand, bentoType } from '../../theme/bento';
import {
  Appear,
  BentoAvatar,
  BentoButton,
  BentoField,
  BentoIcon,
  BentoRow,
  BentoRowGroup,
  BentoScreen,
  BentoSheet,
  BentoTile,
  CountUp,
  Eyebrow,
  GlassIconButton,
  LoadError,
  SegmentedControl,
} from '../../components/bento';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Profile'>,
  NativeStackScreenProps<RootStackParamList>
>;

const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString(undefined, opts);
const DMY: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };

// Club monogram on the Choose Golf Club rows (G-E-ClubList): the first letters of the first two words.
const monogram = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

export function MemberProfileScreen({ navigation }: Props) {
  const { t } = useBento();
  const { preference } = useTheme();
  const { user, points, streak, stats, logout, updateAvatar, changeHomeClub, updateThemePreference, changePassword, deleteAccount, exportMyData } = useApp();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  // My Feedback row's red dot: a Flagrr team reply the member hasn't opened yet (approved
  // mockup, 25 Nov 2026). Rechecked each time Profile comes into view; a failed check just
  // shows no dot (the My Feedback screen itself says when it can't load).
  const [feedbackUnread, setFeedbackUnread] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      api
        .myFeedback()
        .then((rows) => {
          if (!cancelled) setFeedbackUnread(rows.some((r) => r.hasUnread));
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, []),
  );
  const [clubQuery, setClubQuery] = useState('');
  const [changingClub, setChangingClub] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Which Bento sheet is open: the club picker, Change password, or Delete account.
  const [sheet, setSheet] = useState<'club' | 'password' | 'delete' | null>(null);

  const shownCourses = useMemo(() => {
    const q = clubQuery.trim().toLowerCase();
    return q ? courses.filter((c) => c.name.toLowerCase().includes(q)) : courses;
  }, [courses, clubQuery]);

  const closeClubPicker = () => {
    setSheet(null);
    setClubQuery('');
  };

  const loadCourses = async () => {
    setLoadingCourses(true);
    setCoursesError(null);
    try {
      setCourses(await api.courses());
    } catch (err) {
      // Owner decision (25 Nov 2026): a failed load shows a message with Try again
      // (it used to leave an empty box).
      setCourses([]);
      setCoursesError(friendlyError(err));
    } finally {
      setLoadingCourses(false);
    }
  };

  const openClubPicker = () => {
    setSheet('club');
    void loadCourses();
  };

  const handleSelectClub = (course: Course) => {
    closeClubPicker();
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
              showAlert('Couldn’t change club', friendlyError(err));
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
        showAlert('Couldn’t update profile picture', friendlyError(err));
      }
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleThemeChange = async (next: ThemePreference) => {
    setSavingTheme(true);
    try {
      await updateThemePreference(next);
    } catch (err) {
      showAlert('Couldn’t update appearance', friendlyError(err));
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
      showAlert('Couldn’t change password', friendlyError(err));
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
      showAlert('Couldn’t export your data', friendlyError(err));
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
      // Brand words (owner decision 24 Nov 2026): "Flagrr Cash", not "points" (G-E-DeleteConfirm).
      'This permanently removes your profile, Flagrr Cash, receipts, vouchers, and message history. This can’t be undone.',
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
              showAlert('Couldn’t delete account', friendlyError(err));
              setDeletingAccount(false);
            }
          },
        },
      ],
    );
  };

  const birthday = user.dateOfBirth ? fmtDate(user.dateOfBirth, DMY) : '—';
  const memberSince = fmtDate(user.memberSince, DMY);

  return (
    <BentoScreen tabBar scrollTitle="Profile">
      {/* Who you are: photo (tap to change), name, club and tier, Edit Profile (G-E-ProfileTop) */}
      <Appear>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Pressable onPress={handleChangeAvatar} disabled={uploadingAvatar} accessibilityRole="button" accessibilityLabel="Change profile photo" style={{ width: 68, height: 68 }}>
            <BentoAvatar size={68} />
            <View
              style={{
                position: 'absolute',
                right: -3,
                bottom: -3,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: t.accent,
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 0 0 3px ${t.ground}`,
              }}
            >
              {uploadingAvatar ? <ActivityIndicator size="small" color={t.accentInk} /> : <BentoIcon name="camera" size={15} color={t.accentInk} strokeWidth={2} />}
            </View>
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text accessibilityRole="header" style={[bentoType.h1, { fontSize: 24, lineHeight: 25, color: t.ink }]}>
              {user.firstName} {user.lastName}
            </Text>
            <Text style={{ fontSize: 14, color: t.muted, marginTop: 3 }}>
              {user.homeClub ? `${user.homeClub} · ` : ''}
              <Text style={{ color: t.accent, fontWeight: '600' }}>{user.tier}</Text>
            </Text>
          </View>
          <GlassIconButton icon="profile" accessibilityLabel="Edit Profile" onPress={() => navigation.navigate('EditProfile')} />
        </View>
      </Appear>

      <View style={{ height: 6 }} />

      {/* Three stats on fairway green */}
      <Appear>
        <BentoTile tone="hero" padding={0} innerStyle={{ paddingVertical: 16, paddingHorizontal: 18 }}>
          <View style={{ flexDirection: 'row' }}>
            {[
              { v: points.balance, l: 'Flagrr Cash' },
              { v: streak.weeks, l: 'Week Streak' },
              { v: stats.roundsPlayed9 + stats.roundsPlayed18, l: 'Rounds Played' },
            ].map((x, i) => (
              <View
                key={x.l}
                style={{
                  flex: 1,
                  minWidth: 0,
                  paddingTop: 2,
                  paddingBottom: 4,
                  paddingLeft: i ? 16 : 0,
                  borderLeftWidth: i ? 1 : 0,
                  borderLeftColor: 'rgba(255,255,255,0.14)',
                }}
              >
                <CountUp value={x.v} style={[bentoType.number, { fontFamily: 'Fraunces_600SemiBold', fontSize: 22, lineHeight: 24, color: t.onHero }]} />
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', marginTop: 3 }}>{x.l}</Text>
              </View>
            ))}
          </View>
        </BentoTile>
      </Appear>

      {/* Refer a Friend */}
      <Appear>
        <BentoTile tone="hero" padding={18} onPress={() => navigation.navigate('Referral')} accessibilityLabel="Refer a Friend">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={[bentoType.eyebrow, { color: bentoBrand.lime }]}>Refer a Friend</Text>
              <Text style={[bentoType.h1, { fontSize: 22, lineHeight: 23, color: t.onHero, marginTop: 6 }]}>Bring your four-ball</Text>
            </View>
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: bentoBrand.lime, alignItems: 'center', justifyContent: 'center' }}>
              <BentoIcon name="arrowUpRight" size={18} color={bentoBrand.fairway} strokeWidth={2} />
            </View>
          </View>
        </BentoTile>
      </Appear>

      <Section label="Activity">
        <BentoRowGroup>
          <BentoRow icon="activity" label="Reward Activity" onPress={() => navigation.navigate('Activity')} />
          <BentoRow icon="receipt" label="Receipt History" onPress={() => navigation.navigate('ReceiptHistory')} />
        </BentoRowGroup>
      </Section>

      <Section label="Details">
        <BentoRowGroup>
          <DetailRow label="Name" value={`${user.firstName} ${user.lastName}`} onPress={() => navigation.navigate('EditProfile')} />
          <DetailRow label="Phone" value={user.phone ?? '—'} dim={!user.phone} onPress={() => navigation.navigate('EditProfile')} />
          <DetailRow label="Email" value={user.email} onPress={() => navigation.navigate('EditProfile')} />
          <DetailRow label="Birthday" value={birthday} dim={!user.dateOfBirth} onPress={() => navigation.navigate('EditProfile')} />
          {changingClub ? (
            <DetailRow label="Club" value="Updating…" dim busy />
          ) : (
            <DetailRow label="Club" value={user.homeClub} accent onPress={openClubPicker} />
          )}
          <DetailRow label="Member Since" value={memberSince} dim />
        </BentoRowGroup>
      </Section>

      <Section label="Support">
        <BentoRowGroup>
          <BentoRow icon="questionCircle" label="Help Center" onPress={() => navigation.navigate('HelpCenter')} />
          <BentoRow icon="golfFlag" label="Contact Your Club" onPress={() => navigation.navigate('Contact')} />
          <BentoRow icon="bellRound" label="My Enquiries" onPress={() => navigation.navigate('MyEnquiries')} />
          <BentoRow icon="check" label="Give Feedback" onPress={() => navigation.navigate('GiveFeedback')} />
          <BentoRow
            icon="chatBubble"
            label="My Feedback"
            accessibilityLabel={feedbackUnread ? 'My Feedback, unread reply' : 'My Feedback'}
            trailing={feedbackUnread ? <View accessibilityRole="image" accessibilityLabel="Unread reply" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.danger }} /> : null}
            onPress={() => navigation.navigate('MyFeedback')}
          />
        </BentoRowGroup>
      </Section>

      <Section label="Settings">
        <BentoTile>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <BentoIcon name="moon" size={20} color={t.accent} strokeWidth={1.8} />
            </View>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: t.ink }}>Appearance</Text>
          </View>
          {/* Locked (no spinner) while the choice saves. */}
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
        </BentoTile>
      </Section>
      <Appear>
        <BentoRowGroup>
          <BentoRow icon="bellRound" label="Notification Preferences" onPress={() => navigation.navigate('NotificationPreferences')} />
          <BentoRow icon="lock" label="Security" sublabel="Change your password" onPress={() => setSheet('password')} />
        </BentoRowGroup>
      </Appear>

      <Section label="Account">
        <BentoRowGroup>
          <BentoRow
            icon="arrowUpRight"
            label="Export My Data"
            onPress={handleExportData}
            disabled={exportingData}
            chevron={!exportingData}
            trailing={exportingData ? <ActivityIndicator size="small" color={t.accent} /> : undefined}
          />
          <BentoRow icon="docText" label="Terms and Privacy" onPress={() => navigation.navigate('TermsPrivacy')} />
        </BentoRowGroup>
      </Section>

      <View style={{ height: 4 }} />
      {/* Signs out at once, no confirmation (G-E-ProfileLower note). */}
      <Appear>
        <BentoButton label="Log Out" variant="secondary" onPress={logout} />
        <Pressable
          onPress={() => setSheet('delete')}
          accessibilityRole="button"
          accessibilityLabel="Delete Account"
          style={({ pressed }) => ({ minHeight: 44, padding: 12, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1, marginTop: 12 })}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: t.danger }}>Delete Account</Text>
        </Pressable>
      </Appear>

      {/* Change your password (G-E-PasswordSheet) */}
      <BentoSheet visible={sheet === 'password'} title="Change your password" subtitle="Security" onClose={() => setSheet(null)}>
        <View>
          <PasswordField label="Current Password" accessibilityLabel="Current password" value={currentPassword} onChangeText={setCurrentPassword} />
          <View style={{ height: 12 }} />
          <PasswordField
            label="New Password"
            accessibilityLabel="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            helper="At least 8 characters. Use your new password next time you log in."
          />
          <View style={{ height: 16 }} />
          <BentoButton label="Update Password" nub onPress={handleChangePassword} loading={changingPassword} />
        </View>
      </BentoSheet>

      {/* Delete your account? (G-E-DeleteSheet) */}
      <BentoSheet visible={sheet === 'delete'} title="Delete your account?" onClose={() => setSheet(null)}>
        <View>
          <Text style={{ fontSize: 14, lineHeight: 20, color: t.muted, marginBottom: 14 }}>
            {/* Brand words (owner decision 24 Nov 2026): "Flagrr Cash", not "points" (G-E-DeleteSheet). */}
            Deleting your account permanently removes your profile, Flagrr Cash, receipts, and reward history. This can’t be undone. Enter your current password to confirm.
          </Text>
          <PasswordField label="Current Password" accessibilityLabel="Current password" value={deletePassword} onChangeText={setDeletePassword} />
          <View style={{ height: 16 }} />
          <Pressable
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
            accessibilityRole="button"
            accessibilityLabel="Delete Account"
            accessibilityState={{ disabled: deletingAccount, busy: deletingAccount }}
            style={({ pressed }) => ({
              minHeight: 52,
              borderRadius: 999,
              boxShadow: `inset 0 0 0 1.5px ${t.danger}`,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 20,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            {deletingAccount ? <ActivityIndicator color={t.danger} /> : <Text style={[bentoType.button, { color: t.danger }]}>Delete Account</Text>}
          </Pressable>
          <Pressable
            onPress={() => setSheet(null)}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={({ pressed }) => ({ minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink }}>Cancel</Text>
          </Pressable>
        </View>
      </BentoSheet>

      {/* Choose Golf Club (G-E-ClubList / ClubLoading / ClubEmpty) */}
      <BentoSheet visible={sheet === 'club'} title="Choose Golf Club" onClose={closeClubPicker}>
        <View>
          {/* Approved small addition (24 Nov 2026): search in Choose Golf Club. */}
          <BentoField value={clubQuery} onChangeText={setClubQuery} placeholder="Search clubs" accessibilityLabel="Search clubs" rightIcon="search" autoCorrect={false} autoCapitalize="none" />
          {loadingCourses ? (
            <View style={{ alignItems: 'center', paddingVertical: 34 }}>
              <ActivityIndicator size="large" color={t.accent} />
            </View>
          ) : coursesError ? (
            <LoadError title="Couldn’t load clubs" body={coursesError} onRetry={() => void loadCourses()} style={{ marginTop: 12 }} />
          ) : (
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Golf clubs"
              // A 1 pt border, not the board's outer ring: the sheet's scroll view would clip a ring.
              style={{ marginTop: 12, minHeight: courses.length ? undefined : 64, borderRadius: 20, borderWidth: 1, borderColor: t.hair, paddingHorizontal: 15 }}
            >
              {shownCourses.map((c, i) => {
                const on = c.id === user.courseId;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => handleSelectClub(c)}
                    accessibilityRole="radio"
                    accessibilityLabel={c.name}
                    accessibilityState={{ checked: on, selected: on }}
                    aria-checked={on}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      minHeight: 56,
                      paddingVertical: 12,
                      borderTopWidth: i ? 1 : 0,
                      borderTopColor: t.hair,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    {c.isPlaceholder ? (
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.seg, alignItems: 'center', justifyContent: 'center' }}>
                        <BentoIcon name="questionCircle" size={20} color={t.muted} strokeWidth={1.8} />
                      </View>
                    ) : (
                      <View aria-hidden style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: bentoBrand.fairway, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: bentoBrand.lime }}>{monogram(c.name)}</Text>
                      </View>
                    )}
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: t.ink }}>{c.name}</Text>
                    <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? t.accent : t.hair, alignItems: 'center', justifyContent: 'center' }}>
                      {on ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.accent }} /> : null}
                    </View>
                  </Pressable>
                );
              })}
              {courses.length > 0 && shownCourses.length === 0 ? (
                <Text style={[bentoType.body, { color: t.muted, textAlign: 'center', paddingVertical: 18 }]}>Nothing matches that search.</Text>
              ) : null}
            </View>
          )}
        </View>
      </BentoSheet>
    </BentoScreen>
  );
}

// An eyebrow ("ACTIVITY") over its tile (G-E-ProfileTop: 13 pt, 0.12 em, 8 pt above).
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Appear>
      <Eyebrow style={{ fontSize: 13, letterSpacing: 0.12 * 13, marginTop: 8, marginBottom: 12 }}>{label}</Eyebrow>
      {children}
    </Appear>
  );
}

// Details row (G-E-ProfileTop): muted label, value on the right, chevron when it opens something.
function DetailRow({
  label,
  value,
  onPress,
  dim,
  accent,
  busy,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  dim?: boolean;
  accent?: boolean;
  busy?: boolean;
}) {
  const { t } = useBento();
  const row = (
    <BentoRow
      label={label}
      labelStyle={{ color: t.muted }}
      onPress={onPress}
      accessibilityLabel={onPress ? `${label}: ${value}` : undefined}
      chevron={Boolean(onPress)}
      trailing={
        <>
          <Text
            numberOfLines={2}
            style={{ flexShrink: 1, maxWidth: '68%', textAlign: 'right', fontSize: 15, fontWeight: accent ? '500' : '400', color: accent ? t.accent : dim ? t.muted : t.ink }}
          >
            {value}
          </Text>
          {busy ? <ActivityIndicator size="small" color={t.accent} /> : null}
          {onPress ? null : <View style={{ width: 18 }} />}
        </>
      }
    />
  );
  // Rows that open nothing still carry "<label>: <value>" for screen readers.
  if (onPress) return row;
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`}>
      {row}
    </View>
  );
}

// Labelled password field with the eye toggle (G-E-PasswordSheet, G-E-DeleteSheet).
function PasswordField({
  label,
  accessibilityLabel,
  value,
  onChangeText,
  helper,
}: {
  label: string;
  accessibilityLabel: string;
  value: string;
  onChangeText: (v: string) => void;
  helper?: string;
}) {
  const [hidden, setHidden] = useState(true);
  return (
    <BentoField
      label={label}
      accessibilityLabel={accessibilityLabel}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={hidden}
      autoCapitalize="none"
      autoCorrect={false}
      helper={helper}
      rightIcon={hidden ? 'eyeClosed' : 'eyeOpen'}
      rightIconLabel={hidden ? 'Show password' : 'Hide password'}
      onRightIconPress={() => setHidden((h) => !h)}
    />
  );
}
