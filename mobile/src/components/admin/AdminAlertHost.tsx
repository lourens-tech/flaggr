import React, { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useAdminTheme } from '../../context/ThemeContext';
import { adminFont, adminRadius } from '../../theme/admin';
import { PopIn, PressableScale } from '../motion';
import {
  activeAdminAlertHost,
  dismissAlert,
  registerAdminAlertHost,
  subscribeAlert,
  type AlertButtonConfig,
  type AlertConfig,
} from '../../utils/alertStore';

// showAlert() inside the admin consoles: the same alerts and buttons as
// AppAlertHost, drawn as an admin sheet (opaque card, system font, accent for
// the default action, red for destructive, a neutral fill for Cancel).
export function AdminAlertHost() {
  const { c } = useAdminTheme();
  const [config, setConfig] = useState<AlertConfig>({ visible: false, title: '', message: undefined, buttons: [] });
  const host = useRef<{ id: number; unregister: () => void } | null>(null);

  useEffect(() => {
    host.current = registerAdminAlertHost();
    const unsubscribe = subscribeAlert(setConfig);
    return () => {
      unsubscribe();
      host.current?.unregister();
    };
  }, []);

  if (!host.current || activeAdminAlertHost() !== host.current.id) return null;
  // Mount the Modal only while an alert shows: on the web a Modal's layer is
  // created when it mounts, so one that stayed mounted would sit underneath
  // any sheet opened later (password, fraud reason, gift) and its alerts
  // would be hidden behind that sheet.
  if (!config.visible) return null;

  const press = (button: AlertButtonConfig) => {
    dismissAlert();
    button.onPress?.();
  };
  const row = config.buttons.length === 2;

  return (
    <Modal visible={config.visible} transparent animationType="fade" onRequestClose={dismissAlert}>
      <View style={[styles.backdrop, { backgroundColor: c.scrim }]}>
        <PopIn style={[styles.card, { backgroundColor: c.surface, borderColor: c.edge }]} from={0.92}>
          <Text accessibilityRole="header" style={[styles.title, { color: c.ink }]}>{config.title}</Text>
          {config.message ? <Text style={[styles.message, { color: c.ink2 }]}>{config.message}</Text> : null}
          <View style={row ? styles.buttonRow : styles.buttonColumn}>
            {config.buttons.map((button, i) => {
              const cancel = button.style === 'cancel';
              const destructive = button.style === 'destructive';
              const bg = cancel ? c.fill : destructive ? c.badge : c.accent;
              const fg = cancel ? c.ink : destructive ? '#FFFFFF' : c.onAccent;
              return (
                <PressableScale
                  key={i}
                  accessibilityRole="button"
                  onPress={() => press(button)}
                  style={[styles.button, row && styles.buttonInRow, { backgroundColor: bg }]}
                >
                  <Text style={[styles.buttonText, { color: fg }]} numberOfLines={1}>{button.text ?? 'OK'}</Text>
                </PressableScale>
              );
            })}
          </View>
        </PopIn>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, borderRadius: adminRadius.lg, borderWidth: StyleSheet.hairlineWidth, padding: 24 },
  title: { ...adminFont.bodyBold, fontSize: 18, textAlign: 'center' },
  message: { ...adminFont.body, fontSize: 14.5, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 22 },
  buttonColumn: { gap: 10, marginTop: 22 },
  // No flex in the column: a flex: 1 button there collapses on iOS/Android.
  button: { height: 46, borderRadius: adminRadius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonInRow: { flex: 1 },
  buttonText: { ...adminFont.bodySemiBold, fontSize: 15.5 },
});
