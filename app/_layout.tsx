import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useColors } from '@/src/hooks/useColors';
import { useAuthStore } from '@/src/store/authStore';
import ForceUpdate from '@/src/components/ForceUpdate';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutNav />
    </QueryClientProvider>
  );
}

function RootLayoutNav() {
  const colors = useColors();
  const [hydrated, setHydrated] = useState(false);
  const session = useAuthStore((s) => s.session);
  const isGuest = useAuthStore((s) => s.isGuest);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  if (!hydrated) return null;

  const authed = session !== null || isGuest;

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text, fontWeight: '600' },
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        {authed && (
          <>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="anime/[id]" options={{ headerShown: true, title: 'Anime Details' }} />
            <Stack.Screen name="anime/[id]/watch" options={{ headerShown: true, title: 'Episodes' }} />
            <Stack.Screen name="anime/[id]/watch/[episodeId]" options={{ headerShown: true, title: 'Player' }} />
          </>
        )}
      </Stack>
      <ForceUpdate />
    </>
  );
}
