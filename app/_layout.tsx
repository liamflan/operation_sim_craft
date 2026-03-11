import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View, Platform, useWindowDimensions } from 'react-native';

import { useColorScheme as useNavColorScheme } from '@/hooks/use-color-scheme';
import { ThemeProvider, useTheme } from '../components/ThemeContext';
import { WeeklyRoutineProvider } from '../data/WeeklyRoutineContext';
import { PantryProvider } from '../data/PantryContext';
import { ActivePlanProvider } from '../data/ActivePlanContext';
import { DebugProvider } from '../data/DebugContext';
import { ToastProvider } from '../components/ToastContext';
import DebugOverlay from '../components/DebugOverlay';
import UnsupportedMobileWeb from '../components/UnsupportedMobileWeb';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootApp() {
  const colorScheme = useNavColorScheme();
  const { isDarkMode } = useTheme();

  return (
    <NavThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <View className={`flex-1 ${isDarkMode ? 'dark' : ''} bg-appBg dark:bg-darkappBg`}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="calibration" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="recipe/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <DebugOverlay />
      </View>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    GoogleSansFlex: require('../assets/fonts/Google_Sans_Flex/GoogleSansFlex-VariableFont_GRAD,ROND,opsz,slnt,wdth,wght.ttf'),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  // --- M2 Mobile Web Gate ---
  // Desktop Web = Supported
  // Native iOS/Android = Supported
  // Mobile/Tablet Web = Unsupported
  const { width } = useWindowDimensions();
  const [bypassGate, setBypassGate] = useState(false);

  const isWeb = Platform.OS === 'web';
  const isMobileOrTabletUa = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|Tablet/i.test(navigator.userAgent);
  const isNarrowTouch = width < 1024 && typeof window !== 'undefined' && typeof navigator !== 'undefined' && ('ontouchstart' in window || navigator?.maxTouchPoints > 0);
  
  const isUnsupportedWeb = isWeb && (isMobileOrTabletUa || isNarrowTouch);

  if (isUnsupportedWeb && !bypassGate) {
    return (
      <ThemeProvider>
        <UnsupportedMobileWeb 
          onBypass={() => setBypassGate(true)}
          config={{
            expoGoInstructions: "Scan the QR code from the Expo CLI using Expo Go.",
            // These would be populated from environment variables in a real production build
            // previewBuildUrl: "https://expo.dev/...",
          }}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <WeeklyRoutineProvider>
        <PantryProvider>
          <DebugProvider>
            <ToastProvider>
              <ActivePlanProvider>
                <RootApp />
              </ActivePlanProvider>
            </ToastProvider>
          </DebugProvider>
        </PantryProvider>
      </WeeklyRoutineProvider>
    </ThemeProvider>
  );
}
