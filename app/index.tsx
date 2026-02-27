import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';
import { LoadingSpinner } from '../src/components/ui/LoadingSpinner';

export default function RootIndex() {
  const { session, isInitialized } = useAuthStore();

  if (!isInitialized) {
    return <LoadingSpinner fullScreen />;
  }

  if (session) {
    return <Redirect href="/(tabs)/workouts" />;
  }

  return <Redirect href="/(auth)/login" />;
}
