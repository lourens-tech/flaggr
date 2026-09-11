import React, { useMemo, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PillButton } from '../../components/common/PillButton';
import { useApp } from '../../context/AppContext';
import { ApiError } from '../../api/client';
import type { FeedbackCategory } from '../../api/client';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'GiveFeedback'>;

const CATEGORIES: Array<{ value: FeedbackCategory; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: 'bug', label: 'Bug Found', icon: 'bug-outline' },
  { value: 'general_feedback', label: 'General Feedback', icon: 'chatbox-ellipses-outline' },
  { value: 'improvement', label: 'Improvement Idea', icon: 'bulb-outline' },
];

// Goes straight to the Flagrr team (as an email + a Support Centre ticket),
// not the member's own club — see ContactScreen for the club-routed enquiry
// flow this is deliberately separate from.
export function GiveFeedbackScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { sendFeedback } = useApp();
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!category) {
      showAlert('Choose a category', 'Let us know what kind of feedback this is before sending.');
      return;
    }
    if (!message.trim()) {
      showAlert('Add a message', 'Tell us more before sending your feedback.');
      return;
    }
    setSubmitting(true);
    try {
      await sendFeedback({ category, message: message.trim() });
      showAlert('Thanks for the feedback!', 'The Flagrr team has received it.', [
        { text: 'Back', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      const errMessage = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t send feedback', errMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Give Feedback" onBack={() => navigation.goBack()} />
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>Help Us Improve Flagrr</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>What kind of feedback is this?</Text>
        <View style={styles.categoryList}>
          {CATEGORIES.map((c) => {
            const active = category === c.value;
            return (
              <TouchableOpacity
                key={c.value}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => setCategory(c.value)}
                activeOpacity={0.8}
              >
                <Ionicons name={c.icon} size={16} color={active ? colors.white : colors.clubGreen} />
                <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: spacing.lg }} />
        <Text style={styles.sectionLabel}>Your message</Text>
        <TextInput
          placeholder="What's on your mind?"
          placeholderTextColor={colors.textSecondary}
          value={message}
          onChangeText={setMessage}
          multiline
          style={styles.messageInput}
        />

        <View style={{ height: spacing.xl }} />
        <PillButton label="Send Feedback" onPress={handleSubmit} loading={submitting} />

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.darkGreen },
  heroContent: { paddingHorizontal: screenPadding, paddingBottom: spacing.xl, paddingTop: spacing.md },
  heroTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.white },
  content: { padding: screenPadding },
  sectionLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.small, color: colors.textPrimary, marginBottom: spacing.sm },
  categoryList: { gap: spacing.sm },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  categoryChipActive: { backgroundColor: colors.clubGreen, borderColor: colors.clubGreen },
  categoryChipText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  categoryChipTextActive: { color: colors.white },
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
