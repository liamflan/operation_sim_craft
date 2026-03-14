import { Redirect } from 'expo-router';

export default function OnboardingPreviewIndex() {
  // Redirect to the first onboarding page
  return <Redirect href="/o/welcome" />;
}
