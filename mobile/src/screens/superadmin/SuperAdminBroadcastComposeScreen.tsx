import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { SelectField } from '../../components/common/SelectField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { SuperAdminBroadcastTarget } from '../../data/adminTypes';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminBroadcastCompose'>;

const TARGET_OPTIONS = [
  { label: 'All Members (every club)', value: 'all' },
  { label: 'Bronze Tier (every club)', value: 'Bronze' },
  { label: 'Silver Tier (every club)', value: 'Silver' },
  { label: 'Gold Tier (every club)', value: 'Gold' },
  { label: 'Platinum Tier (every club)', value: 'Platinum' },
  { label: 'Course Admins', value: 'course_admins' },
];

export function SuperAdminBroadcastComposeScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { sendSuperAdminBroadcast } = useAdmin();
  const [title, setTitle] = useState(route.params?.title ?? '');
  const [body, setBody] = useState(route.params?.body ?? '');
  const [target, setTarget] = useState<string | null>(route.params?.target ?? null);
  const [sending, setSending] = useState(false);

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
      await sendSuperAdminBroadcast({ title: title.trim(), body: body.trim(), target: target as SuperAdminBroadcastTarget });
      navigation.goBack();
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t send', message);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="New Notification" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <View style={styles.content}>
        <TextField placeholder="Title" variant="onLight" value={title} onChangeText={setTitle} />
        <View style={{ height: spacing.md }} />
        <TextField placeholder="Message" variant="onLight" value={body} onChangeText={setBody} multiline />
        <View style={{ height: spacing.md }} />
        <SelectField placeholder="Send to" variant="onLight" options={TARGET_OPTIONS} value={target} onChange={setTarget} />
        <Text style={styles.helpText}>
          Member and tier targets reach every club platform-wide. Course Admins sends an in-app notification (and a
          push, where enabled) to every course_admin account instead of members.
        </Text>

        <View style={{ height: spacing.lg }} />
        <PillButton label="Send Notification" icon="send" onPress={handleSend} loading={sending} />
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  content: { padding: screenPadding },
  helpText: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 6, marginLeft: 4 },
});
}
