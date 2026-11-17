import { Platform, useWindowDimensions } from 'react-native';

const DESKTOP_BREAKPOINT = 900;

// Course-admin/super-admin tools are used almost exclusively at a desk — a
// side panel reads better there than a bottom tab bar. Native apps and
// narrow/mobile browser windows keep the bottom bar.
export function useIsDesktopNav(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
}
