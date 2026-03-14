import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { StorageService } from '../data/storage';
import { TOKENS } from '../theme/tokens';

/**
 * Entry Index (Harden Phase 2)
 * 
 * FIX: Removed className/NativeWind to ensure no navigation-context race 
 * occurs via the interop layer on cold boot.
 */
export default function Index() {
  const router = useRouter();
  const [hasPlan, setHasPlan] = useState<boolean | null>(null);
  const { width } = useWindowDimensions();

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

  return (
    <View style={{ 
      flex: 1, 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: TOKENS.colors.background.light, 
      padding: 40 
    }}>
      <Text style={{ 
        fontSize: 34, 
        fontWeight: 'bold', 
        marginBottom: 8, 
        color: TOKENS.colors.text.light.emphasis,
        letterSpacing: -1
      }}>
        Provision
      </Text>
      <Text style={{ 
        color: TOKENS.colors.text.light.muted, 
        marginBottom: 40, 
        textAlign: 'center',
        fontSize: 15,
        fontWeight: '500'
      }}>
        Select entry point (Dev Force)
      </Text>
      
      <TouchableOpacity 
        onPress={() => router.replace('/o/welcome')}
        activeOpacity={0.8}
        style={{ 
          backgroundColor: TOKENS.colors.primary, 
          padding: 24, 
          borderRadius: 28, 
          width: '100%', 
          maxWidth: 400,
          marginBottom: 16, 
          alignItems: 'center', 
          shadowColor: TOKENS.colors.primary, 
          shadowOffset: { width: 0, height: 10 }, 
          shadowOpacity: 0.15, 
          shadowRadius: 20, 
          elevation: 5 
        }}
      >
        <Text style={{ 
          color: 'white', 
          fontWeight: '800', 
          fontSize: 18,
          letterSpacing: 0.5,
          textTransform: 'uppercase'
        }}>
          Preview New Onboarding
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        onPress={() => {
          if (hasPlan === null) return;
          router.replace(hasPlan ? "/(tabs)" : "/calibration");
        }}
        disabled={hasPlan === null}
        activeOpacity={0.8}
        style={{ 
          backgroundColor: '#f1f5f9', 
          padding: 24, 
          borderRadius: 28, 
          width: '100%', 
          maxWidth: 400,
          alignItems: 'center',
          opacity: hasPlan === null ? 0.5 : 1
        }}
      >
        <Text style={{ 
          color: '#475569', 
          fontWeight: 'bold', 
          fontSize: 16,
          letterSpacing: 0.3
        }}>
          {hasPlan === null ? "Loading Plan State..." : (hasPlan ? "Open Dashboard" : "Start Old Onboarding")}
        </Text>
      </TouchableOpacity>

      <Text style={{ 
        marginTop: 40, 
        fontSize: 11, 
        color: '#cbd5e1', 
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1
      }}>
        Route: app/index.tsx
      </Text>
    </View>
  );
}
