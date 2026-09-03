import React, { useCallback, useState, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { SelectField } from '../../components/common/SelectField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { SuperAdminBroadcastTarget } from '../../data/adminTypes';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminBroadcastCompose'>;

const ALL_CLUBS_VALUE = 'all';

const TARGET_OPTIONS = [
  { label: 'All Members', value: 'all' },
  { label: 'Bronze Tier', value: 'Bronze' },
  { label: 'Silver Tier', value: 'Silver' },
  { label: 'Gold Tier', value: 'Gold' },
  { label: 'Platinum Tier', value: 'Platinum' },
  { label: 'Course Admins', value: 'course_admins' },
];

export function SuperAdminBroadcastComposeScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDesktop = useIsDesktopNav();
  const { superAdminCourses, loadSuperAdminCourses, sendSuperAdminBroadcast } = useAdmin();
  const [title, setTitle] = useState(route.params?.title ?? '');
  const [body, setBody] = useState(route.params?.body ?? '');
  const [target, setTarget] = useState<string | null>(route.params?.target ?? null);
  const [courseId, setCourseId] = useState<string>(ALL_CLUBS_VALUE);
  const [sending, setSending] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadSuperAdminCourses().catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const clubOptions = useMemo(
    () => [{ label: 'All Clubs', value: ALL_CLUBS_VALUE }, ...superAdminCourses.map((c) => ({ label: c.name, value: c.id }))],
    [superAdminCourses],
  );

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      showAlert('Missing info', 'A title and message are both required.');
      return;
    }
    if (!target) {
      showAlert('Missing info', 'Choose who this notification goes to.');
      return;
    }
    setSending(true);
    try {
      await sendSuperAdminBroadcast({
        title: title.trim(),
        body: body.trim(),
        target: target as SuperAdminBroadcastTarget,
        courseId: courseId === ALL_CLUBS_VALUE ? null : courseId,
      });
      navigation.goBack();
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t send', message);
    } finally {
      setSending(false);
    }
  };

  const form = (
    <>
      <TextField placeholder="Title" variant="onLight" value={title} onChangeText={setTitle} />
      <View style={{ height: spacing.md }} />
      <TextField placeholder="Message" variant="onLight" value={body} onChangeText={setBody} multiline />
      <View style={{ height: spacing.md }} />
      <SelectField placeholder="Send to" variant="onLight" options={TARGET_OPTIONS} value={target} onChange={setTarget} />
      <View style={{ height: spacing.md }} />
      <SelectField placeholder="Club" variant="onLight" options={clubOptions} value={courseId} onChange={setCourseId} />
      <Text style={styles.helpText}>
        Choose a specific club to scope this notification to just that club's members (or its course admin) instead
        of every club platform-wide. Course Admins sends an in-app notification (and a push, where enabled) to the
        course_admin account(s) instead of members.
      </Text>

      <View style={{ height: spacing.lg }} />
      <PillButton label="Send Notification" icon="send" onPress={handleSend} loading={sending} />
    </>
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminPush" breadcrumb="New Notification" showRail={false}>
        <Text style={styles.dPageTitle}>New Notification</Text>
        <DesktopPanel title=" " style={{ maxWidth: 480 }}>
          {form}
        </DesktopPanel>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="New Notification" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <View style={styles.content}>{form}</View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  content: { padding: screenPadding },
  helpText: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 6, marginLeft: 4 },
  dPageTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.textPrimary },
});
}
