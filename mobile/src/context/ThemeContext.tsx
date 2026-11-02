import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, type ThemeColors } from '../theme';
import { adminDark, adminLegacyDark, adminLegacyLight, adminLight, type AdminColors } from '../theme/admin';
import { AdminAlertHost } from '../components/admin/AdminAlertHost';

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

// ── Admin consoles ──────────────────────────────────────────────────────────
// The admin, staff, super-admin and support-agent stacks render inside
// AdminThemeScope: it re-provides ThemeContext with the admin palette's
// neutrals (so every existing useThemeColors() call picks them up) and adds
// the full admin palette for restyled components via useAdminTheme().

interface AdminThemeValue {
  scheme: 'light' | 'dark';
  c: AdminColors;
  // iOS "Reduce Transparency" or the browser's prefers-reduced-transparency:
  // glass turns into solid fills and the ambient photo is dropped.
  reduceTransparency: boolean;
}

const AdminThemeContext = createContext<AdminThemeValue | undefined>(undefined);

function useReduceTransparency(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
      const mq = window.matchMedia('(prefers-reduced-transparency: reduce)');
      setReduced(mq.matches);
      const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
      mq.addEventListener?.('change', onChange);
      return () => mq.removeEventListener?.('change', onChange);
    }
    let alive = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((v) => {
        if (alive) setReduced(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

// `alerts={false}` leaves out the admin alert host, for a screen that only
// borrows the look and stays mounted under member screens (the opening
// screen): while an admin host is mounted, every alert is drawn admin-style.
export function AdminThemeScope({ children, alerts = true }: { children: React.ReactNode; alerts?: boolean }) {
  const parent = useTheme();
  const reduceTransparency = useReduceTransparency();
  const dark = parent.scheme === 'dark';

  const themeValue = useMemo<ThemeContextValue>(
    () => ({ ...parent, colors: dark ? adminLegacyDark : adminLegacyLight }),
    [parent, dark],
  );
  const adminValue = useMemo<AdminThemeValue>(
    () => ({ scheme: parent.scheme, c: dark ? adminDark : adminLight, reduceTransparency }),
    [parent.scheme, dark, reduceTransparency],
  );

  return (
    <ThemeContext.Provider value={themeValue}>
      <AdminThemeContext.Provider value={adminValue}>
        {children}
        {alerts ? <AdminAlertHost /> : null}
      </AdminThemeContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useAdminTheme(): AdminThemeValue {
  const ctx = useContext(AdminThemeContext);
  if (!ctx) throw new Error('useAdminTheme must be used within AdminThemeScope');
  return ctx;
}

// For components shared with the member app (PillButton, TextField…): null
// outside the admin consoles, so member screens keep their own look.
export function useOptionalAdminTheme(): AdminThemeValue | null {
  return useContext(AdminThemeContext) ?? null;
}
