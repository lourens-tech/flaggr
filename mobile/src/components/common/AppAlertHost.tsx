import React, { useEffect, useState, useMemo } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { fontFamily, fontSize, radius, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import { PopIn, PressableScale } from '../motion';
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
        {/* Springs up from 92% as the backdrop fades, like an iOS alert. */}
        <PopIn style={styles.card} from={0.92}>
          <Text style={styles.title}>{config.title}</Text>
          {config.message ? <Text style={styles.message}>{config.message}</Text> : null}

          {/* Two buttons side by side; one, or three or more, stacked. */}
          <View style={config.buttons.length === 2 ? styles.buttonRow : styles.buttonColumn}>
            {config.buttons.map((button, i) => {
              const isCancel = button.style === 'cancel';
              const isDestructive = button.style === 'destructive';
              return (
                <PressableScale
                  key={i}
                  accessibilityRole="button"
                  onPress={() => handlePress(button)}
                  style={[
                    styles.button,
                    config.buttons.length === 2 && styles.buttonInRow,
                    isCancel && styles.buttonOutline,
                    isDestructive && styles.buttonDestructive,
                    !isCancel && !isDestructive && styles.buttonPrimary,
                  ]}
                >
                  <Text style={[styles.buttonText, isCancel ? styles.buttonTextOutline : styles.buttonTextSolid]}>
                    {button.text ?? 'OK'}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </PopIn>
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
  buttonColumn: { marginTop: spacing.lg, width: '100%', gap: spacing.sm },
  // No flex here: in the one-button column a flex: 1 button has no height to
  // fill and collapses to nothing on iOS and Android (the web still drew it).
  button: {
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  buttonInRow: { flex: 1 },
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
