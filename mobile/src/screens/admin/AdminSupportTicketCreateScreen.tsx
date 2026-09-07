import React, { useState, useMemo } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { DesktopPanel } from '../../components/admin/desktop/DesktopPanel';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminSupportTicketCreate'>;

export function AdminSupportTicketCreateScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDesktop = useIsDesktopNav();
  const { createSupportTicket } = useAdmin();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    <>
      <TextField placeholder="Subject" variant="onLight" value={subject} onChangeText={setSubject} />
      <View style={{ height: spacing.md }} />
      <TextInput
        placeholder="Describe what's going on…"
        placeholderTextColor={colors.textSecondary}
        value={message}
        onChangeText={setMessage}
        multiline
        style={styles.messageInput}
      />
      <View style={{ height: spacing.lg }} />
      <PillButton label="Send Ticket" onPress={handleSubmit} loading={submitting} />
    </>
  );

  if (isDesktop) {
    return (
      <AdminDesktopFrame activeKey="" breadcrumb="New Ticket" showRail={false}>
        <Text style={styles.dPageTitle}>New Support Ticket</Text>
        <DesktopPanel title=" " style={{ maxWidth: 480 }}>
          {form}
        </DesktopPanel>
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="New Ticket" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {form}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  content: { padding: screenPadding, paddingBottom: spacing.xl * 2 },
  messageInput: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 140,
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  dPageTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.textPrimary },
});
}
