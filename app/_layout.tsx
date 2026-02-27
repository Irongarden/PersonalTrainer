import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../src/stores/authStore';
import { LoadingSpinner } from '../src/components/ui/LoadingSpinner';
import { supabase } from '../src/lib/supabase';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Handle deep-link tokens from magic-link / email confirmation emails
async function handleAuthUrl(url: string) {
  if (!url) return;
  // Supabase sends tokens in the URL fragment (#access_token=...)
  const fragment = url.split('#')[1] ?? url.split('?')[1] ?? '';
  const params: Record<string, string> = {};
  fragment.split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k && v) params[k] = decodeURIComponent(v);
  });
  if (params.access_token && params.refresh_token) {
    await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
  } else if (params.code) {
    await supabase.auth.exchangeCodeForSession(params.code);
  }
}

export default function RootLayout() {
  const { initialize, isInitialized } = useAuthStore();

  useEffect(() => {
    initialize();
    // Handle cold-start deep link
    Linking.getInitialURL().then(url => { if (url) handleAuthUrl(url); });
    // Handle deep link while app is open
    const sub = Linking.addEventListener('url', ({ url }) => handleAuthUrl(url));
    return () => sub.remove();
  }, []);

  if (!isInitialized) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen
              name="workout/session"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
                gestureEnabled: false,
              }}
            />
          </Stack>
          <StatusBar style="light" />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
