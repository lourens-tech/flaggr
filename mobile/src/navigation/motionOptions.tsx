import React from 'react';
import { Platform } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { ScreenFade } from '../components/motion';

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

// Native-stack doesn't animate on web, so screens there fade in instead.
// Desktop admin screens skip this: their DesktopShell fades only the content
// area so the sidebar doesn't flicker (see components/admin/desktop).
export const webScreenLayout =
  Platform.OS === 'web'
    ? ({ children }: { children: React.ReactNode }) => <ScreenFade>{children}</ScreenFade>
    : undefined;
