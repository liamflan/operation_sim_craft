import { Redirect, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StorageService } from '../data/storage';
import NavigationObserver from '../components/NavigationObserver';

export default function Index() {
  const router = useRouter();
  const [hasPlan, setHasPlan] = useState<boolean | null>(null);

  useEffect(() => {
    const checkState = async () => {
      const STORAGE_KEY = 'provision_active_workspace_v1_cuisines';
      try {
        const saved = await StorageService.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.status === 'ready' || parsed.output) {
            setHasPlan(true);
            return;
          }
        }
      } catch (e) {
        console.error('Failed to check plan state', e);
      }
      setHasPlan(false);
    };
    checkState();
  }, []);

  // --- Unavoidable Developer Entry (For Debugging) ---
  return (
    <>
    <NavigationObserver />
    <View className="flex-1 items-center justify-center bg-white dark:bg-black p-10">
      <Text className="text-3xl font-bold mb-2 text-slate-900 dark:text-slate-100">Provision</Text>
      <Text className="text-slate-500 mb-10 text-center">Select entry point (Dev Force)</Text>
      
      <TouchableOpacity 
        onPress={() => router.replace('/o/welcome')}
        className="bg-primary p-6 rounded-3xl w-full mb-4 items-center shadow-xl active:opacity-80"
      >
        <Text className="text-white font-extrabold text-xl">Preview New Onboarding</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        onPress={() => {
          if (hasPlan === null) return;
          router.replace(hasPlan ? "/(tabs)" : "/calibration");
        }}
        disabled={hasPlan === null}
        className="bg-slate-100 dark:bg-slate-800 p-6 rounded-3xl w-full items-center active:opacity-80"
      >
        <Text className="text-slate-600 dark:text-slate-400 font-bold text-lg">
          {hasPlan === null ? "Loading Plan State..." : (hasPlan ? "Open Dashboard" : "Start Old Onboarding")}
        </Text>
      </TouchableOpacity>

      <Text className="mt-8 text-xs text-slate-300">Route: app/index.tsx</Text>
    </View>
    </>
  );
}
