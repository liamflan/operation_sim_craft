import { useRouter } from 'expo-router';
import { View, Text, TouchableOpacity } from 'react-native';

export default function OnboardingPreviewIndex() {
  const router = useRouter();

  // RADICAL ISOLATION: Manual trigger instead of useEffect redirect
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 10 }}>Onboarding Entry</Text>
      <Text style={{ textAlign: 'center', color: '#666', marginBottom: 40 }}>
        Isolation Mode: Automatic redirect disabled to prevent context race conditions.
      </Text>
      
      <TouchableOpacity 
        onPress={() => router.replace('/o/welcome')}
        style={{ 
          backgroundColor: '#9DCD8B', 
          padding: 20, 
          borderRadius: 16, 
          width: '100%', 
          alignItems: 'center' 
        }}
      >
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>Start Onboarding</Text>
      </TouchableOpacity>
    </View>
  );
}
