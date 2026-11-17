import React from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
//
// The backdrop runs edge to edge, under the notch and home indicator; the
// content is inset from them. Phones in portrait have no side insets, and
// their header and tab bar already handle top and bottom, so only the sides
// are padded there; the desktop shell has neither, so it gets all four.
//
// React Navigation calls screenLayout as a plain function inside the
// navigator's own render, once per screen in the stack, so it must not call
// hooks itself (the count would change as screens are pushed and popped).
// It returns an element; the hooks live in AdminScreenLayout.
export function adminScreenLayout(isDesktop: boolean) {
  return ({ children }: { children: React.ReactNode }) => <AdminScreenLayout isDesktop={isDesktop}>{children}</AdminScreenLayout>;
}

function AdminScreenLayout({ isDesktop, children }: { isDesktop: boolean; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const fade = Platform.OS === 'web' && !isDesktop;
  const content = fade ? <ScreenFade>{children}</ScreenFade> : children;
  return (
    <AdminSessionBackdrop>
      <View
        style={{
          flex: 1,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingTop: isDesktop ? insets.top : 0,
          paddingBottom: isDesktop ? insets.bottom : 0,
        }}
      >
        {content}
      </View>
    </AdminSessionBackdrop>
  );
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
