import React, { useState, useMemo } from 'react';
import { ScrollView, StatusBar, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { useApp } from '../../context/AppContext';
import { ApiError } from '../../api/client';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'SupportTicketCreate'>;

export function SupportTicketCreateScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { createSupportTicket } = useApp();
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
      navigation.replace('SupportTicketChat', { ticketId });
    } catch (err) {
      const errMessage = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t send your ticket', errMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="New Ticket" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
});
}
