import React from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { TOKENS } from '../../theme/tokens';

/**
 * OnboardingWelcome
 * Page 1 of the new mobile onboarding flow (Stitch fidelity).
 * Final Cleanup: Minimalist brand-led refinement with optimized spacing and legibility.
 */
export default function OnboardingWelcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const handleGetStarted = () => {
    console.log('Routing to Onboarding Page 2: /o/dietary');
    router.push('/o/dietary' as any); 
  };

  // Adaptive Sizing variables
  const isShortScreen = height < 700;

  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: TOKENS.colors.background.light,
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      justifyContent: 'flex-start'
    }}>
      
      {/* 1. Brand Hero Area - Tightened Spacing */}
      <View style={{ 
        alignItems: 'center', 
        marginTop: isShortScreen ? 32 : 64, // Reduced from 40/80
        marginBottom: isShortScreen ? 24 : 40  // Reduced from 30/50
      }}>
        <View 
          style={{ 
            width: isShortScreen ? 48 : 64, 
            height: isShortScreen ? 48 : 64, 
            borderRadius: 16,
            backgroundColor: 'rgba(140, 161, 143, 0.15)', // Increased opacity for better contrast
            marginBottom: 12 // Reduced from 16
          }}
          className="items-center justify-center"
        >
          <FontAwesome5 
            name="leaf" 
            size={isShortScreen ? 24 : 32} 
            color={TOKENS.colors.primary} 
          />
        </View>
        <Text 
          style={{ 
            fontFamily: TOKENS.typography.fontFamily,
            fontSize: TOKENS.typography.size.brand,
            letterSpacing: 0.35 * TOKENS.typography.size.brand,
            color: TOKENS.colors.text.light.emphasis
          }}
          className="font-extrabold uppercase"
        >
          Provision
        </Text>
      </View>

      {/* 2. Headline - Natural Wrap & Constrained Width */}
      <View style={{ 
        alignItems: 'center', 
        paddingHorizontal: 32, // More constrained for better wrapping
        marginBottom: isShortScreen ? 20 : 40 
      }}>
        <Text 
          style={{ 
            fontFamily: TOKENS.typography.fontFamily,
            fontSize: isShortScreen ? 26 : 32,
            lineHeight: isShortScreen ? 32 : 40,
            color: TOKENS.colors.text.light.emphasis,
            textAlign: 'center'
          }}
          className="font-bold"
        >
          Taste-led planning for your modern routine.
        </Text>
      </View>

      {/* 3. Benefit Pills - Improved Contrast */}
      <View style={{ 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        justifyContent: 'center', 
        gap: 8, 
        paddingHorizontal: 24, 
        marginBottom: 20 
      }}>
        {[
          { label: 'Personalized Taste', id: 1 },
          { label: 'Goal-Driven', id: 2 },
          { label: 'Intelligent Routine', id: 3 }
        ].map(benefit => (
          <View 
            key={benefit.id}
            style={{ 
              height: TOKENS.spacing.chipHeight - 6,
              borderColor: 'rgba(140, 161, 143, 0.35)', // Increased contrast
              backgroundColor: 'rgba(140, 161, 143, 0.08)', // Slightly more present
              paddingHorizontal: 20
            }}
            className="border rounded-full items-center justify-center"
          >
            <Text 
              style={{ 
                fontSize: TOKENS.typography.size.chip - 2,
                color: TOKENS.colors.primary,
                letterSpacing: 1.0
              }}
              className="font-semibold uppercase"
            >
              {benefit.label}
            </Text>
          </View>
        ))}
      </View>

      {/* 4. Footer - Pushed to bottom */}
      <View style={{ 
        marginTop: 'auto', 
        paddingHorizontal: 32, 
        paddingBottom: isShortScreen ? 20 : 30, 
        alignItems: 'center' 
      }}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleGetStarted}
          style={{ 
            height: TOKENS.spacing.ctaHeight - 4, 
            borderRadius: 20,
            backgroundColor: TOKENS.colors.primary,
            width: '100%'
          }}
          className="flex-row items-center justify-center shadow-lg shadow-primary/30"
        >
          <Text 
            style={{ fontSize: TOKENS.typography.size.cta - 1 }}
            className="text-white font-bold tracking-widest uppercase"
          >
            Get Started
          </Text>
          <FontAwesome5 name="arrow-right" size={14} color="white" style={{ marginLeft: 12 }} />
        </TouchableOpacity>

        {/* 5. Legal Text */}
        <TouchableOpacity className="mt-6">
          <Text 
            style={{ 
              fontSize: TOKENS.typography.size.legal,
              color: TOKENS.colors.text.light.muted
            }}
            className="text-center tracking-wide"
          >
            By continuing, you agree to our{"\n"}
            <Text className="underline text-slate-900">Terms of Service</Text> and <Text className="underline text-slate-900">Privacy Policy</Text>.
          </Text>
        </TouchableOpacity>
      </View>
      
    </View>
  );
}
