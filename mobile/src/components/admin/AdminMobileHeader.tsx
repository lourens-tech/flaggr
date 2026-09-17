import React, { useMemo } from 'react';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fontFamily, fontSize, spacing } from '../../theme';
import { useTheme, type ThemeColors } from '../../context/ThemeContext';
import { useAdmin } from '../../context/AdminContext';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  // Tab-root screens (Dashboard, etc.) aren't reached by pushing a stack
  // screen, so there's nothing to go "back" to — hide the chevron there and
  // put a bell/avatar or similar in `right` instead.
  showBack?: boolean;
  right?: React.ReactNode;
}

// Course-admin's phone counterpart to AdminDesktopFrame's topbar + page
// title — a small "{club} / {screen}" breadcrumb above a large heading, on
// a plain bordered surface, instead of the app's usual solid-color
// ScreenHeader bar. Gives course-admin's mobile screens the same visual
// language as desktop (see DesktopShell's topbar/crumb + each screen's
// dPageTitle styles) — member-facing and onboarding screens keep the
// original ScreenHeader untouched.
export function AdminMobileHeader({ title, subtitle, onBack, showBack = true, right }: Props) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation();
  const { course } = useAdmin();

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <View style={styles.topRow}>
        {showBack ? (
          <TouchableOpacity
            onPress={onBack ?? (() => navigation.goBack())}
            hitSlop={12}
            style={styles.backButton}
            accessibilityLabel="Back"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.crumb} numberOfLines={1}>
          {course.name || 'Course Admin'} <Text style={styles.crumbActive}>/ {title}</Text>
        </Text>
        <View style={{ flex: 1 }} />
        {right}
      </View>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  backButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.xs },
  crumb: { fontFamily: fontFamily.body, fontSize: 11.5, color: colors.textMuted, flexShrink: 1 },
  crumbActive: { fontFamily: fontFamily.bodySemiBold, color: colors.textPrimary },
  title: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.textPrimary, marginTop: 6 },
  subtitle: { fontFamily: fontFamily.body, fontSize: fontSize.small, color: colors.textSecondary, marginTop: 3 },
});
}
