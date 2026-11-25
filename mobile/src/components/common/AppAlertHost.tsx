import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBento } from '../../context/ThemeContext';
import { bentoDuration, bentoEasing, prefersReducedMotion, useNativeDriver } from '../../theme/motion';
import { activeAdminAlertHost, dismissAlert, subscribeAlert, type AlertButtonConfig, type AlertConfig } from '../../utils/alertStore';

// Mounted once near the app root. Replaces react-native-web's no-op Alert.alert
// and the browser's native window.alert/confirm (both off-brand, and the
// latter shows the page's URL in the dialog chrome) with an in-app modal
// that matches the rest of the UI everywhere the app runs.
//
// Bento alert (boards Dlg*): a centred 296 pt card that scales in from 1.1
// with a slight overshoot over a dimmed, lightly blurred backdrop. Buttons
// run edge to edge under hairlines: two side by side, otherwise stacked.
// Every showAlert() call keeps its title, message, buttons and handlers.

const webBlur = { backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' } as unknown as ViewStyle;

export function AppAlertHost() {
  const { t } = useBento();
  const { width } = useWindowDimensions();
  const [config, setConfig] = useState<AlertConfig>({ visible: false, title: '', message: undefined, buttons: [] });
  const [mounted, setMounted] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => subscribeAlert(setConfig), []);

  useEffect(() => {
    const reduced = prefersReducedMotion();
    if (config.visible) {
      setMounted(true);
      fade.setValue(0);
      pop.setValue(reduced ? 1 : 0);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: reduced ? 200 : 350, useNativeDriver }),
        reduced ? Animated.delay(0) : Animated.timing(pop, { toValue: 1, duration: bentoDuration.alert, easing: bentoEasing.overshoot, useNativeDriver }),
      ]).start();
      return;
    }
    if (!mounted) return;
    Animated.timing(fade, { toValue: 0, duration: 160, useNativeDriver }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.visible, config.title, config.message]);

  const handlePress = (button: AlertButtonConfig) => {
    dismissAlert();
    button.onPress?.();
  };

  // An admin console is showing its own alert host (AdminAlertHost).
  if (activeAdminAlertHost() !== null) return null;

  // Two buttons sit side by side with the action first and Cancel last, as
  // on the boards; one, or three or more, stack.
  const twoUp = config.buttons.length === 2;
  const buttons = twoUp ? [...config.buttons].sort((a, b) => Number(a.style === 'cancel') - Number(b.style === 'cancel')) : config.buttons;
  // Centred in the space between the side safe areas (the iPhone Duo's vertical strip is one).
  const insets = useSafeAreaInsets();
  const cardWidth = Math.min(296, width - insets.left - insets.right - 48);

  // The Modal mounts only while an alert is showing, so on the web its portal
  // is added last and draws above any sheet that is already open.
  if (!mounted && !config.visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismissAlert} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim, opacity: fade }, Platform.OS === 'web' ? webBlur : null]} />
      <View style={[styles.center, { paddingLeft: insets.left, paddingRight: insets.right }]} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={{
            width: cardWidth,
            borderRadius: 26,
            overflow: 'hidden',
            backgroundColor: t.tile,
            boxShadow: `0 30px 60px -20px rgba(0,0,0,0.45), 0 0 0 1px ${t.ring}`,
            opacity: fade,
            transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1.1, 1] }) }],
          }}
        >
          <View style={{ paddingTop: 22, paddingHorizontal: 20, paddingBottom: 18, alignItems: 'center' }}>
            <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: '600', color: t.ink, textAlign: 'center' }}>
              {config.title}
            </Text>
            {config.message ? (
              <Text style={{ fontSize: 14, lineHeight: 20, color: t.muted, textAlign: 'center', marginTop: 6 }}>{config.message}</Text>
            ) : null}
          </View>

          <View style={{ flexDirection: twoUp ? 'row' : 'column' }}>
            {buttons.map((button, i) => {
              const isCancel = button.style === 'cancel';
              const isDestructive = button.style === 'destructive';
              return (
                <Pressable
                  key={`${i}-${button.text}`}
                  accessibilityRole="button"
                  onPress={() => handlePress(button)}
                  style={({ pressed }) => ({
                    flex: twoUp ? 1 : undefined,
                    minHeight: 50,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderTopWidth: 1,
                    borderTopColor: t.hair,
                    borderLeftWidth: twoUp && i === 1 ? 1 : 0,
                    borderLeftColor: t.hair,
                    backgroundColor: pressed ? t.seg : 'transparent',
                  })}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: isCancel ? '500' : '600',
                      color: isDestructive ? t.danger : isCancel ? t.ink : t.accent,
                      textAlign: 'center',
                    }}
                  >
                    {button.text ?? 'OK'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
