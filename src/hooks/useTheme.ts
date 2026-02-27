import { useColorScheme } from 'react-native';
import { Colors, Theme } from '../constants';
import { useAuthStore } from '../stores/authStore';

export function useTheme(): Theme {
  const systemScheme = useColorScheme();
  const profile = useAuthStore(s => s.profile);

  const preference = profile?.theme ?? 'dark';

  if (preference === 'light') return Colors.light;
  if (preference === 'dark') return Colors.dark;
  // system
  return systemScheme === 'light' ? Colors.light : Colors.dark;
}
