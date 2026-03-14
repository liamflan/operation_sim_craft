import { Stack } from 'expo-router';

/**
 * OnboardingLayout
 * Configures the onboarding stack with stable, instant transitions.
 * Fix: Replaced 'slide_from_right' with 'none' to ensure immediate screen swaps 
 * without any visible transition animation or flicker.
 */
export default function OnboardingLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          // Set to 'none' for instant navigation, avoiding all interpolation/flicker
          animation: 'none',
        }}
      />
    </>
  );
}
