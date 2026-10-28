import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import { fontFamily, fontSize, spacing } from '../../theme';

// A bottom sheet over the whole screen, used for the scorecard, the bag and
// the round details during a round. One open at a time; tapping outside or
// the system back gesture closes it.
export function GolfSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <View style={styles.subtitle}>{typeof subtitle === 'string' ? <Text style={styles.subtitleText}>{subtitle}</Text> : subtitle}</View> : null}
          <ScrollView style={styles.body} contentContainerStyle={{ gap: spacing.sm + 2 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scrim: { flex: 1, backgroundColor: 'rgba(10,20,15,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 18,
      paddingTop: 10,
      maxHeight: '88%',
      width: '100%',
      maxWidth: 560,
      alignSelf: 'center',
    },
    grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.sm },
    title: { fontFamily: fontFamily.heading, fontSize: 20, color: colors.textPrimary },
    subtitle: { marginTop: 4 },
    subtitleText: { fontFamily: fontFamily.body, fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 },
    body: { marginTop: spacing.sm + 2, flexGrow: 0 },
    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm + 4, flexWrap: 'wrap' },
  });
}

export const sheetText = (colors: ThemeColors) =>
  StyleSheet.create({
    body: { fontFamily: fontFamily.body, fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 },
    strong: { fontFamily: fontFamily.bodySemiBold, color: colors.textPrimary },
    small: { fontFamily: fontFamily.body, fontSize: fontSize.small - 0.5, color: colors.textMuted },
  });
