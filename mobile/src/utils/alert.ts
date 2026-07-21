import { presentAlert } from './alertStore';

export interface AlertButton {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

// Routes through the app's own branded modal (AppAlertHost) on every
// platform, rather than react-native-web's no-op Alert.alert or the
// browser's native window.alert/confirm (which shows the page's own URL in
// the dialog chrome and doesn't match the app's look at all).
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  presentAlert(title, message, buttons);
}
