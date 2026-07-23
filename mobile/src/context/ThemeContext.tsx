import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, type ThemeColors } from '../theme';

export type { ThemeColors };

export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_PREFERENCE_KEY = 'flagrr_theme_preference';

interface ThemeContextValue {
  preference: ThemePreference;
  scheme: 'light' | 'dark';
  colors: ThemeColors;
  setPreference: (pref: ThemePreference) => Promise<void>;
  /** Called by AppContext/AdminContext once an account's saved preference is
   * known (on cold-boot restore, login, or me refresh) so a fresh device
   * with no local choice yet adopts the account's preference. Never
   * overrides a preference this device has already set for itself. */
  hydrateFromAccount: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const hasLocalOverride = useRef(false);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(THEME_PREFERENCE_KEY).catch(() => null);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        hasLocalOverride.current = true;
        setPreferenceState(stored);
      }
    })();
  }, []);

  const setPreference = async (pref: ThemePreference) => {
    hasLocalOverride.current = true;
    setPreferenceState(pref);
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, pref);
  };

  const hydrateFromAccount = (pref: ThemePreference) => {
    if (hasLocalOverride.current) return;
    hasLocalOverride.current = true;
    setPreferenceState(pref);
    AsyncStorage.setItem(THEME_PREFERENCE_KEY, pref).catch(() => {});
  };

  const scheme: 'light' | 'dark' = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const colors = scheme === 'dark' ? darkColors : lightColors;

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, scheme, colors, setPreference, hydrateFromAccount }),
    [preference, scheme, colors],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export function useThemeColors(): ThemeColors {
  return useTheme().colors;
}
