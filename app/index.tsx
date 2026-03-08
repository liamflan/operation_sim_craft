import { Redirect } from 'expo-router';

export default function Index() {
  // For the MVP, we assume the user is new and always route them to onboarding first.
  // In a real app, this would check AsyncStorage or a auth context to see if they are returning.
  return <Redirect href="/onboarding" />;
}
