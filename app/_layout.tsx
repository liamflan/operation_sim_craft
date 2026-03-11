import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';

import { useColorScheme as useNavColorScheme } from '@/hooks/use-color-scheme';
import { ThemeProvider, useTheme } from '../components/ThemeContext';
import { WeeklyRoutineProvider } from '../data/WeeklyRoutineContext';
import { PantryProvider } from '../data/PantryContext';
import { ActivePlanProvider } from '../data/ActivePlanContext';
import { DebugProvider } from '../data/DebugContext';
import { ToastProvider } from '../components/ToastContext';
import DebugOverlay from '../components/DebugOverlay';

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
