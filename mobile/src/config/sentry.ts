import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';

// Crash reporting for the iOS and Android store builds only. The web export
// (admin consoles on Vercel) is deliberately left out, and nothing is sent
// until EXPO_PUBLIC_SENTRY_DSN is set in the EAS environment for the build.
export const SENTRY_ENABLED = Platform.OS !== 'web' && !!process.env.EXPO_PUBLIC_SENTRY_DSN;

if (SENTRY_ENABLED) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    enabled: !__DEV__,
    environment: process.env.EXPO_PUBLIC_STORE_BUILD === '1' ? 'production' : 'development',
    // Members hand over receipts, names and emails: never attach user data
    // (IP address, request bodies, etc.) automatically.
    sendDefaultPii: false,
    tracesSampleRate: 0.2,
  });

  // Tag every event with the over-the-air update it came from so a bad update
  // can be told apart from the build it runs on.
  const scope = Sentry.getGlobalScope();
  scope.setTag('expo-update-id', Updates.updateId ?? 'embedded');
  scope.setTag('expo-is-embedded-update', String(Updates.isEmbeddedLaunch));
}

// Wrap the root component so touches and render errors are captured; a no-op
// pass-through when Sentry is off.
export function withSentry<T extends React.ComponentType<any>>(Component: T): T {
  return SENTRY_ENABLED ? (Sentry.wrap(Component) as T) : Component;
}
