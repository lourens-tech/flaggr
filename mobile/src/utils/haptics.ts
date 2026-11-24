import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Light taps of feedback on the moments the Bento brief names: switching tabs
// and segments, pressing a primary action or Scan, and finishing something
// (a receipt submitted, a reward redeemed, a round saved). Phones only; the
// web build has no haptics. Failures are ignored: feedback is never worth an
// error.
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptic = {
  /** A tab, segment, toggle or stepper changed. */
  selection() {
    if (enabled) Haptics.selectionAsync().catch(() => {});
  },
  /** A primary button was pressed. */
  light() {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  /** The Scan button (the app's main action). */
  medium() {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  /** Something finished well. */
  success() {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
};
