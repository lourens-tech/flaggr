import React from 'react';
import { Platform } from 'react-native';
import { AdminThemeScope } from '../../context/ThemeContext';
import { AdminSessionBackdrop } from './ui';
import { ScreenFade } from '../motion';

// Wraps a screen that's mounted outside the admin navigators (sign-in,
// first-login password change, staff welcome) in the admin theme.
export function withAdminScope<P extends object>(Screen: React.ComponentType<P>) {
  function Scoped(props: P) {
    return (
      <AdminThemeScope>
        <Screen {...props} />
      </AdminThemeScope>
    );
  }
  Scoped.displayName = `withAdminScope(${Screen.displayName ?? Screen.name ?? 'Screen'})`;
  return Scoped;
}

// screenLayout for the admin stacks: every screen sits on the window colour
// and the blurred cover photo. On desktop the DesktopShell fades only its
// content area, so the sidebar doesn't flicker; phones on web get the same
// whole-screen fade the member app uses (native-stack doesn't animate there).
export function adminScreenLayout(isDesktop: boolean) {
  const fade = Platform.OS === 'web' && !isDesktop;
  return function AdminScreenLayout({ children }: { children: React.ReactNode }) {
    return <AdminSessionBackdrop>{fade ? <ScreenFade>{children}</ScreenFade> : children}</AdminSessionBackdrop>;
  };
}

// Stack and tab scenes stay see-through so the backdrop shows behind them.
export const transparentScene = { backgroundColor: 'transparent' } as const;

// Bottom tabs keep unfocused tabs mounted and only push them behind (zIndex -1).
// Admin scenes are see-through, so a tab left behind would show through the
// focused one: hide every tab but the navigator's current route. Compared by
// route key, not isFocused(), so tabs under a pushed stack screen stay intact.
export function tabSceneStyle({
  route,
  navigation,
}: {
  route: { key: string };
  navigation: { getState: () => { index: number; routes: Array<{ key: string }> } };
}) {
  const state = navigation.getState();
  return state.routes[state.index]?.key === route.key ? transparentScene : hiddenScene;
}

const hiddenScene = { backgroundColor: 'transparent', display: 'none' } as const;
