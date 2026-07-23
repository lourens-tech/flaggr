import React, { useMemo } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { fontFamily, fontSize, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

// Shown exactly once — right after a staff account completes its forced
// first-login password change (see AdminContext.changePassword /
// staffWelcomePending) — before landing on the normal Vouchers/Profile tabs.
export function AdminStaffWelcomeScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { admin, course, dismissStaffWelcome } = useAdmin();

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Welcome, {admin.firstName}</Text>
        </View>
      </SafeAreaView>

      <View style={styles.content}>
        <Ionicons name="qr-code-outline" size={48} color={colors.clubGreen} style={styles.icon} />
        <Text style={styles.title}>You're all set up</Text>
        <Text style={styles.subtitle}>
          You have access to {course.name}'s Vouchers tab, so you can validate members' reward vouchers at the club.
        </Text>

        <View style={styles.stepsCard}>
          <View style={styles.stepRow}>
            <Ionicons name="scan-outline" size={18} color={colors.clubGreen} />
            <Text style={styles.stepText}>Scan the QR code a member shows you, or enter their voucher code manually.</Text>
          </View>
          <View style={styles.stepRow}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.clubGreen} />
            <Text style={styles.stepText}>Confirm the reward, and it's validated — the code can't be reused.</Text>
          </View>
        </View>

        <View style={{ height: spacing.lg }} />
        <PillButton label="Get Started" onPress={dismissStaffWelcome} />
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  header: { paddingHorizontal: screenPadding, paddingVertical: spacing.md },
  // fontFamily.heading (not headingDisplay) — this title is dynamic and
  // contains a comma, and headingDisplay's demo font swaps punctuation for
  // a watermark glyph (see theme/typography.ts).
  headerTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.white },
  content: { flex: 1, padding: screenPadding, paddingTop: spacing.xl },
  icon: { alignSelf: 'center', marginBottom: spacing.md },
  title: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.textPrimary, textAlign: 'center' },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  stepsCard: {
    backgroundColor: colors.mintBg,
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  stepText: { flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textPrimary, lineHeight: 16 },
});
}
