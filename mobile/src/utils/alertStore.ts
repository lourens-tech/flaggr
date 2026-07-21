export interface AlertButtonConfig {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface AlertConfig {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButtonConfig[];
}

const EMPTY: AlertConfig = { visible: false, title: '', message: undefined, buttons: [] };

let state: AlertConfig = EMPTY;
let listeners: Array<(s: AlertConfig) => void> = [];

function emit() {
  listeners.forEach((l) => l(state));
}

// A tiny module-level pub-sub rather than context, since showAlert() is
// called imperatively from plain functions (API error handlers, etc.) that
// aren't necessarily inside a component with hook access.
export function presentAlert(title: string, message?: string, buttons?: AlertButtonConfig[]) {
  state = {
    visible: true,
    title,
    message,
    buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }],
  };
  emit();
}

export function dismissAlert() {
  state = { ...state, visible: false };
  emit();
}

export function subscribeAlert(listener: (s: AlertConfig) => void): () => void {
  listeners.push(listener);
  listener(state);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}
