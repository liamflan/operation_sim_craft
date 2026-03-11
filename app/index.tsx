import { Redirect } from 'expo-router';
import { useState, useEffect } from 'react';
import { StorageService } from '../data/storage';

export default function Index() {
  const [hasPlan, setHasPlan] = useState<boolean | null>(null);

  useEffect(() => {
    const checkState = async () => {
      const STORAGE_KEY = 'provision_active_workspace_v1';
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

  if (hasPlan === null) {
    return null; // Await storage resolution before redirecting
  }

  // If a plan exists, go straight to dashboard. Otherwise, calibrate.
  return <Redirect href={hasPlan ? "/(tabs)" : "/calibration"} />;
}
