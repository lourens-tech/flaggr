import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Pushes the app already confirms on screen while it is open. Owner decision
// (25 Nov 2026): after a redeem the member sees the "Reward redeemed" toast, so
// the push banner is hidden while the app is open (it still arrives when the
// app is closed, and the in-app Notifications list still has it). The title
// check covers a server that doesn't send `data.kind` yet.
export function isShownInApp(content: { title?: string | null; data?: Record<string, unknown> | null }): boolean {
  return content.data?.kind === 'rewardRedeemed' || content.title === 'Reward redeemed';
}

// Called only while the app is open. `shouldShowAlert` is left out on purpose:
// it is deprecated and on iOS it shows a banner on its own.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const show = !isShownInApp(notification.request.content);
    return { shouldPlaySound: show, shouldSetBadge: false, shouldShowBanner: show, shouldShowList: show };
  },
});

export interface RegisteredPushToken {
  token: string;
  platform: 'ios' | 'android';
}

// Resolves to null (a silent no-op) whenever push isn't actually available
// yet: on web, when no EAS project is configured, when the member declines
// the permission prompt, or on any unexpected native error. Registering
// for push is a nice-to-have on top of the in-app notification the backend
// already writes — it must never block app startup or throw.
export async function registerForPushNotificationsAsync(): Promise<RegisteredPushToken | null> {
  if (Platform.OS === 'web') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null; // no EAS project set up yet — nothing to register with

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' };
  } catch {
    return null;
  }
}
