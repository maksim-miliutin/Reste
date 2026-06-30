import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useColors } from '@/theme';

/**
 * Fonts are loaded here, and it is not cosmetic.
 *
 * All typography in theme.ts is declared with Inter_* names. Until those files
 * are registered every fontFamily misses and the system silently substitutes
 * its own: the app looks wrong and says nothing about it. The splash is held
 * until ready, otherwise the first frame renders in the system font and
 * reflows in front of the user.
 */
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colors = useColors();
  const scheme = useColorScheme();
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    // A loading failure must not trap the user on the splash forever:
    // the system font is worse than intended, better than a blank screen.
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      />
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </SafeAreaProvider>
  );
}
