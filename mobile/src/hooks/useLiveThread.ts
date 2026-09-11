import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';

// Every chat/enquiry/support-ticket thread otherwise only updates when the
// screen (re)gains focus — there's no websocket/SSE available on this
// Vercel-serverless backend to push new messages in. While the thread stays
// open, this refetches immediately on any push notification received (a
// reply already triggers one server-side) and on a light interval as a
// fallback for whenever push is delayed, denied, or the app is on web
// (where push isn't registered at all).
const POLL_INTERVAL_MS = 12000;

export function useLiveThread(load: () => void | Promise<void>) {
  useFocusEffect(
    useCallback(() => {
      load();
      const interval = setInterval(() => {
        load();
      }, POLL_INTERVAL_MS);
      const sub = Notifications.addNotificationReceivedListener(() => {
        load();
      });
      return () => {
        clearInterval(interval);
        sub.remove();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );
}
