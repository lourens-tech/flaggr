import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { TextField } from '../../components/common/TextField';
import { SelectField } from '../../components/common/SelectField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { PageTitle, Tile } from '../../components/admin/ui';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import type { BroadcastTarget } from '../../data/adminTypes';
import { adminFont } from '../../theme/admin';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminBroadcastCompose'>;

const TARGET_OPTIONS = [
  { label: 'All Members', value: 'all' },
  { label: 'Bronze Tier', value: 'Bronze' },
  { label: 'Silver Tier', value: 'Silver' },
  { label: 'Gold Tier', value: 'Gold' },
  { label: 'Platinum Tier', value: 'Platinum' },
];

export function AdminBroadcastComposeScreen({ navigation, route }: Props) {
  const { c } = useAdminTheme();
  const isDesktop = useIsDesktopNav();
  const { sendBroadcast } = useAdmin();
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
    // Confirm before anything goes out: a broadcast reaches members' phones
    // immediately and can't be recalled.
    const audienceLabel = TARGET_OPTIONS.find((o) => o.value === target)?.label ?? target;
    showAlert(`Send to ${audienceLabel}?`, "This goes out to members' phones straight away.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        onPress: async () => {
          setSending(true);
          try {
            await sendBroadcast({ title: title.trim(), body: body.trim(), target: target as BroadcastTarget });
            navigation.goBack();
          } catch (err) {
            const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
            showAlert('Couldn’t send', message);
          } finally {
            setSending(false);
          }
        },
      },
    ]);
  };

  const form = (
    <View style={styles.form}>
      <Tile style={styles.fields}>
        <TextField placeholder="Title" variant="onLight" value={title} onChangeText={setTitle} />
        <TextField placeholder="Message" variant="onLight" value={body} onChangeText={setBody} multiline />
        <View>
          <SelectField placeholder="Send to" variant="onLight" options={TARGET_OPTIONS} value={target} onChange={setTarget} />
          <Text style={[styles.helpText, { color: c.ink2 }]}>
            Sends an in-app notification (and a push, where enabled) to every matching member right away.
          </Text>
        </View>
      </Tile>

      <PillButton label="Send Notification" icon="send" onPress={handleSend} loading={sending} />
    </View>
  );

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminPush" breadcrumb="New Notification" showRail={false}>
        <PageTitle>New Notification</PageTitle>
        {form}
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="New Notification" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {form}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 48 },
  form: { width: '100%', maxWidth: 540, gap: 16 },
  fields: { gap: 12 },
  helpText: { ...adminFont.body, fontSize: 12.5, lineHeight: 18, marginTop: 8, marginHorizontal: 4 },
});
