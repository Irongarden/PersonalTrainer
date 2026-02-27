import { Alert, Platform } from 'react-native';

/** Simple alert – works on both native and web */
export function alertDialog(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

/** Confirm dialog (Cancel / Confirm) – works on both native and web */
export function confirmDialog(
  title: string,
  message: string,
  onConfirm: () => void,
  options?: {
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
  }
) {
  if (Platform.OS === 'web') {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    if (confirmed) onConfirm();
    else options?.onCancel?.();
  } else {
    Alert.alert(title, message, [
      { text: options?.cancelText ?? 'Cancel', style: 'cancel', onPress: options?.onCancel },
      {
        text: options?.confirmText ?? 'OK',
        style: options?.destructive ? 'destructive' : 'default',
        onPress: onConfirm,
      },
    ]);
  }
}

/**
 * Prompt dialog – uses window.prompt on web/Android,
 * Alert.prompt on iOS (which is the only platform that supports it natively).
 */
export function promptDialog(
  title: string,
  message: string,
  onSubmit: (value: string) => void,
  defaultValue = ''
) {
  if (Platform.OS === 'ios') {
    Alert.prompt(title, message, (value) => {
      if (value?.trim()) onSubmit(value.trim());
    }, 'plain-text', defaultValue);
  } else {
    // web + Android: browser prompt
    const value = window.prompt(`${title}\n${message}`, defaultValue);
    if (value !== null && value.trim()) onSubmit(value.trim());
  }
}
