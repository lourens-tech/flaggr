import React, { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { useAdminTheme } from '../../context/ThemeContext';
import { adminFont, adminRadius } from '../../theme/admin';
import { AdminButton, PageTitle, Tile } from '../../components/admin/ui';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminSupportTicketCreate'>;

// The browser's own focus outline is replaced by the field's accent ring.
const webNoOutline = { outlineStyle: 'none' } as unknown as { outlineWidth: number };

export function AdminSupportTicketCreateScreen({ navigation }: Props) {
  const { c } = useAdminTheme();
  const isDesktop = useIsDesktopNav();
  const { createSupportTicket } = useAdmin();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [messageFocused, setMessageFocused] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      showAlert('Missing info', 'Add a subject and a message before sending.');
      return;
    }
    setSubmitting(true);
    try {
      const ticketId = await createSupportTicket(subject.trim(), message.trim());
      navigation.replace('AdminSupportTicketChat', { ticketId });
    } catch (err) {
      const errMessage = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t send your ticket', errMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const form = (
    <Tile style={[styles.formTile, isDesktop && { borderRadius: adminRadius.lg, padding: 22 }]}>
      <TextField placeholder="Subject" variant="onLight" value={subject} onChangeText={setSubject} />
      <TextInput
        placeholder="Describe what's going on…"
        placeholderTextColor={c.ink3}
        value={message}
        onChangeText={setMessage}
        multiline
        onFocus={() => setMessageFocused(true)}
        onBlur={() => setMessageFocused(false)}
        style={[
          styles.messageInput,
          { backgroundColor: c.fill, borderColor: messageFocused ? c.focus : c.edge, color: c.ink },
          messageFocused && { borderWidth: 1.5 },
          webNoOutline,
        ]}
      />
      <AdminButton label="Send Ticket" variant="accent" size="lg" fullWidth onPress={handleSubmit} loading={submitting} />
    </Tile>
  );

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="AdminSupportTickets" breadcrumb="New Ticket" showRail={false}>
        <PageTitle>New Support Ticket</PageTitle>
        <View style={styles.dColumn}>{form}</View>
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="New Ticket" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {form}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48 },
  formTile: { gap: 14 },
  messageInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: adminRadius.sm,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 160,
    ...adminFont.body,
    fontSize: 15.5,
    textAlignVertical: 'top',
  },
  dColumn: { maxWidth: 560, width: '100%' },
});
