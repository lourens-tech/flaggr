import React, { useEffect, useState, useMemo } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fontFamily, fontSize, radius, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import { dismissAlert, subscribeAlert, type AlertButtonConfig, type AlertConfig } from '../../utils/alertStore';

// Mounted once near the app root. Replaces react-native-web's no-op Alert.alert
// and the browser's native window.alert/confirm (both off-brand, and the
// latter shows the page's URL in the dialog chrome) with an in-app modal
// that matches the rest of the UI everywhere the app runs.
export function AppAlertHost() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [config, setConfig] = useState<AlertConfig>({ visible: false, title: '', message: undefined, buttons: [] });

  useEffect(() => subscribeAlert(setConfig), []);

  const handlePress = (button: AlertButtonConfig) => {
    dismissAlert();
    button.onPress?.();
  };

  return (
    <Modal visible={config.visible} transparent animationType="fade" onRequestClose={dismissAlert}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{config.title}</Text>
          {config.message ? <Text style={styles.message}>{config.message}</Text> : null}

          <View style={config.buttons.length > 1 ? styles.buttonRow : styles.buttonColumn}>
            {config.buttons.map((button, i) => {
              const isCancel = button.style === 'cancel';
              const isDestructive = button.style === 'destructive';
              return (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.8}
                  onPress={() => handlePress(button)}
                  style={[
                    styles.button,
                    isCancel && styles.buttonOutline,
                    isDestructive && styles.buttonDestructive,
                    !isCancel && !isDestructive && styles.buttonPrimary,
                  ]}
                >
                  <Text style={[styles.buttonText, isCancel ? styles.buttonTextOutline : styles.buttonTextSolid]}>
                    {button.text ?? 'OK'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,31,25,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.title,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  buttonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, width: '100%' },
  buttonColumn: { marginTop: spacing.lg, width: '100%' },
  button: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  buttonPrimary: { backgroundColor: colors.darkGreen },
  buttonDestructive: { backgroundColor: colors.negative },
  buttonOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.darkGreen },
  buttonText: {
    fontFamily: fontFamily.headingDisplay,
    fontSize: fontSize.button,
    textTransform: 'capitalize',
  },
  buttonTextSolid: { color: colors.white },
  buttonTextOutline: { color: colors.textPrimary },
});
}
