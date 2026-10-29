import React, { useCallback, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { TextField } from '../../components/common/TextField';
import { SelectField } from '../../components/common/SelectField';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { AdminButton, PageTitle, Tile } from '../../components/admin/ui';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { SuperAdminBroadcastTarget } from '../../data/adminTypes';
import { adminFont, type AdminColors } from '../../theme/admin';

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
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
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

  const handleSend = () => {
    if (!title.trim() || !body.trim()) {
      showAlert('Missing info', 'A title and message are both required.');
      return;
    }
    if (!target) {
      showAlert('Missing info', 'Choose who this notification goes to.');
      return;
    }
    // This goes to every member (or course admin) it targets, so confirm the
    // audience first.
    const targetName = TARGET_OPTIONS.find((o) => o.value === target)?.label ?? target;
    const clubName = clubOptions.find((o) => o.value === courseId)?.label ?? 'All Clubs';
    showAlert(`Send to ${targetName} — ${clubName}?`, 'This goes out straight away.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: () => doSend(target) },
    ]);
  };

  const doSend = async (target: string) => {
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
      <View style={styles.gap} />
      <TextField placeholder="Message" variant="onLight" value={body} onChangeText={setBody} multiline />
      <View style={styles.gap} />
      <SelectField placeholder="Send to" variant="onLight" options={TARGET_OPTIONS} value={target} onChange={setTarget} />
      <View style={styles.gap} />
      <SelectField placeholder="Club" variant="onLight" options={clubOptions} value={courseId} onChange={setCourseId} />
      <Text style={styles.helpText}>
        Choose a specific club to scope this notification to just that club's members (or its course admin) instead
        of every club platform-wide. Course Admins sends an in-app notification (and a push, where enabled) to the
        course_admin account(s) instead of members.
      </Text>

      <View style={styles.actions}>
        <AdminButton label="Send Notification" icon="send" variant="accent" size="lg" onPress={handleSend} loading={sending} />
      </View>
    </>
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminPush" breadcrumb="New Notification" showRail={false}>
        <PageTitle>New Notification</PageTitle>
        <Tile style={styles.dCard}>{form}</Tile>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="New Notification" />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Tile>{form}</Tile>
      </ScrollView>
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 16, paddingBottom: 32 },
  gap: { height: 14 },
  helpText: { ...adminFont.body, fontSize: 12.5, lineHeight: 18, color: c.ink2, marginTop: 8, marginLeft: 4 },
  actions: { marginTop: 22, alignItems: 'flex-start' },
  dCard: { marginTop: 18, maxWidth: 560, padding: 22 },
});
}
