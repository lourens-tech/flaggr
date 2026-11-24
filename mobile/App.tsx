import 'react-native-gesture-handler';
import React, { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { fontsToLoad } from './src/theme';
import { ThemeProvider } from './src/context/ThemeContext';
import { AppProvider } from './src/context/AppContext';
import { AdminProvider } from './src/context/AdminContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AppAlertHost } from './src/components/common/AppAlertHost';
import { ToastHost } from './src/components/bento/Toast';
import { navigationRef } from './src/navigation/navigationRef';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useFonts(fontsToLoad);

  const onLayoutReady = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    onLayoutReady();
  }, [onLayoutReady]);

  // Tapping a push notification (once real ones exist — see
  // src/utils/pushNotifications.ts) opens the in-app Notifications screen.
  // No-op on web, where push isn't wired up.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('Notifications');
      }
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  // Dev-only Bento component gallery on the web build: add `?bento` (or
  // `?bento=dark` / `?bento=light`) to the URL. Never shipped behaviour:
  // __DEV__ is false in every exported build.
  if (__DEV__ && Platform.OS === 'web' && typeof window !== 'undefined') {
    const bento = new URLSearchParams(window.location.search).get('bento');
    if (bento !== null) {
      const { BentoGallery } = require('./src/dev/BentoGallery') as typeof import('./src/dev/BentoGallery');
      return (
        <SafeAreaProvider>
          <ThemeProvider forceScheme={bento === 'dark' ? 'dark' : bento === 'light' ? 'light' : undefined}>
            <BentoGallery />
            <AppAlertHost />
            <ToastHost />
          </ThemeProvider>
        </SafeAreaProvider>
      );
    }
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppProvider>
            <AdminProvider>
              <NavigationContainer ref={navigationRef}>
                <RootNavigator />
              </NavigationContainer>
              <AppAlertHost />
              <ToastHost />
            </AdminProvider>
          </AppProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
