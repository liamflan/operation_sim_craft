import { Redirect } from 'expo-router';
import { Platform } from 'react-native';

export default function Index() {
  // Check for existing plan in localStorage if on web
  const STORAGE_KEY = 'provision_active_workspace_v1';
  let hasPlan = false;
  
  if (Platform.OS === 'web') {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.status === 'ready' || parsed.output) {
          hasPlan = true;
        }
      }
    } catch (e) {
      console.error('Failed to check plan state', e);
    }
  }

  // If a plan exists, go straight to dashboard. Otherwise, calibrate.
  return <Redirect href={hasPlan ? "/(tabs)" : "/calibration"} />;
}
