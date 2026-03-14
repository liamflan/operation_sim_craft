import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { useDebug } from '../data/DebugContext';

/**
 * NavigationObserver
 * Safely tracks the current route from within a valid Expo Router context.
 * This should be rendered inside a routed component or a sub-layout.
 */
export default function NavigationObserver() {
  const { updateDebugData } = useDebug();
  const pathname = usePathname();

  useEffect(() => {
    updateDebugData({ 
      currentRoute: pathname,
      plannerLogicFiredThisView: false
    });
  }, [pathname, updateDebugData]);

  return null;
}
