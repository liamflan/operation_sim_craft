import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View, Platform, useWindowDimensions, ActivityIndicator } from 'react-native';

import { useColorScheme as useNavColorScheme } from '@/hooks/use-color-scheme';
import { ThemeProvider, useTheme } from '../components/ThemeContext';
import { WeeklyRoutineProvider } from '../data/WeeklyRoutineContext';
import { PantryProvider } from '../data/PantryContext';
import { ActivePlanProvider } from '../data/ActivePlanContext';
import { DebugProvider } from '../data/DebugContext';
import { ToastProvider } from '../components/ToastContext';
import DebugOverlay from '../components/DebugOverlay';
import UnsupportedMobileWeb from '../components/UnsupportedMobileWeb';
import { RecipeProvider } from '../data/RecipeContext';
import { StorageService } from '../data/storage';

const TEMP_HARD_RESET_ON_LAUNCH = true;

SplashScreen.preventAutoHideAsync();

function RootApp() {
  const colorScheme = useNavColorScheme();
  const { isDarkMode } = useTheme();

  return (
    <NavThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <View 
        style={{ 
          flex: 1, 
          backgroundColor: isDarkMode ? '#000000' : '#ffffff' 
        }}
      >
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="o" options={{ headerShown: false }} />
          <Stack.Screen name="calibration" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="recipe/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
        </Stack>
        {/* DISABLING DEBUG OVERLAY FOR NATIVE ISOLATION */}
        {Platform.OS === 'web' && <DebugOverlay />}
      </View>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  const { width } = useWindowDimensions();
  const [bypassGate, setBypassGate] = useState(false);

  const [loaded, error] = useFonts({
    GoogleSansFlex: require('../assets/fonts/Google_Sans_Flex/GoogleSansFlex-VariableFont_GRAD,ROND,opsz,slnt,wdth,wght.ttf'),
  });

  const [wiped, setWiped] = useState(!TEMP_HARD_RESET_ON_LAUNCH);

  useEffect(() => {
    if (TEMP_HARD_RESET_ON_LAUNCH) {
      StorageService.clearAllAppState().then(() => setWiped(true));
    }
  }, []);

  useEffect(() => {
    if (wiped && (loaded || error)) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error, wiped]);

  if (!wiped || (!loaded && !error)) {
    return null;
  }

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
          }}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <WeeklyRoutineProvider>
        <PantryProvider>
          <RecipeProvider>
            <DebugProvider>
              <ToastProvider>
                <ActivePlanProvider>
                  <RootApp />
                </ActivePlanProvider>
              </ToastProvider>
            </DebugProvider>
          </RecipeProvider>
        </PantryProvider>
      </WeeklyRoutineProvider>
    </ThemeProvider>
  );
}
