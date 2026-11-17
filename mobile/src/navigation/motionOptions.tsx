import React from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { ScreenFade } from '../components/motion';
import { useThemeColors } from '../context/ThemeContext';

// Shared screen-transition settings for every stack (see theme/motion.ts).
//
// iOS keeps its native push, with swipe-back from anywhere on the screen
// rather than only the left edge. Android gets the same iOS-style slide
// instead of its default fade-up, so the app moves the same on both.
export const stackScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  animation: Platform.OS === 'android' ? 'ios_from_right' : 'default',
  fullScreenGestureEnabled: true,
};

// Screens that are a task rather than a step deeper (the receipt camera)
// rise from the bottom; result screens fade up into place.
export const slideUpOptions: NativeStackNavigationOptions = { animation: 'slide_from_bottom' };
export const fadeUpOptions: NativeStackNavigationOptions = { animation: 'fade_from_bottom' };

// Routes that draw their own edge-to-edge backdrop and inset their own
// content: the admin consoles (AdminScope's screen layout), the admin sign-in
// screens, the Auth stack as a whole, and the photo landing page.
const FULL_BLEED_ROUTES = new Set([
  'AdminMain',
  'SuperAdminMain',
  'AdminForceChangePassword',
  'AdminStaffWelcome',
  'Auth',
  'Landing',
  'AdminLogin',
  'AdminForgotPassword',
]);

// Native-stack doesn't animate on web, so screens there fade in instead.
// Desktop admin screens skip this: their DesktopShell fades only the content
// area so the sidebar doesn't flicker (see components/admin/desktop).
//
// The web page draws under the notch (viewport-fit=cover, added in
// scripts/copy-static-assets.sh), so other screens are inset from the sides
// here, on their own background colour, for phones held in landscape.
function WebScreenLayout({ route, children }: { route: { name: string }; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  if (FULL_BLEED_ROUTES.has(route.name)) return <ScreenFade>{children}</ScreenFade>;
  return (
    <View style={{ flex: 1, paddingLeft: insets.left, paddingRight: insets.right, backgroundColor: colors.background }}>
      <ScreenFade>{children}</ScreenFade>
    </View>
  );
}

export const webScreenLayout = Platform.OS === 'web' ? WebScreenLayout : undefined;
