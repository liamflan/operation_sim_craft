import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useActivePlan } from '../../data/ActivePlanContext';
import { TOKENS } from '../../theme/tokens';

/**
 * OnboardingVerification
 * Final Page 5 of the onboarding flow.
 * Triggers meal plan generation based on collected preferences and targets.
 */
export default function OnboardingVerification() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { workspace, regenerateWorkspace } = useActivePlan();

  const [loadingStage, setLoadingStage] = useState(0);
  const generationTriggered = useRef(false);

  const loadingMessages = [
    'Mapping your taste preferences...',
    'Matching flavors to your goals and budget...',
    'Optimizing protein and variety...',
    'Shaping your routine-friendly week...',
    'Your first plan is ready',
  ];

  const isSuccess = workspace.status === 'ready' && loadingStage >= loadingMessages.length - 1;
  const isError = workspace.status === 'error';
  const isLoading = workspace.status === 'generating' || (workspace.status === 'ready' && !isSuccess);

  useEffect(() => {
    if (!generationTriggered.current) {
      generationTriggered.current = true;
      
      const payload = workspace.input?.payload;
      if (payload) {
        regenerateWorkspace(payload);
      }
    }
  }, []);

  useEffect(() => {
    if (workspace.status === 'generating' || (workspace.status === 'ready' && loadingStage < loadingMessages.length - 1)) {
      const timer = setTimeout(() => {
        setLoadingStage(prev => Math.min(prev + 1, loadingMessages.length - 1));
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [workspace.status, loadingStage]);

  const handleFinish = () => {
    router.replace('/(tabs)');
  };

  const handleRetry = () => {
    generationTriggered.current = false;
    setLoadingStage(0);
    const payload = workspace.input?.payload;
    if (payload) {
      regenerateWorkspace(payload);
    }
  };

  const isShortScreen = height < 700;

  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: TOKENS.colors.background.light,
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
    }}>
      
      {/* 1. STICKY TOP FRAMING */}
      <View style={{ backgroundColor: TOKENS.colors.background.light }}>
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'center',
          paddingHorizontal: 20,
          height: 64,
          position: 'relative'
        }}>
          {!isLoading && !isSuccess && (
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={{ position: 'absolute', left: 20, zIndex: 10 }}
              className="p-2"
            >
              <Ionicons name="arrow-back" size={24} color={TOKENS.colors.text.light.emphasis} />
            </TouchableOpacity>
          )}
          
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <FontAwesome5 name="leaf" size={14} color={TOKENS.colors.primary} style={{ marginRight: 8 }} />
            <Text style={{ 
              fontFamily: TOKENS.typography.fontFamily,
              fontSize: 14,
              letterSpacing: 4,
              color: TOKENS.colors.text.light.emphasis
            }} className="font-extrabold uppercase">
              Provision
            </Text>
          </View>
        </View>

        {/* Progress (Step 5 of 5) */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'center',
          paddingVertical: 12,
          gap: 12 
        }}>
          <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: 'rgba(203, 213, 225, 0.4)' }} />
          <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: 'rgba(203, 213, 225, 0.4)' }} />
          <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: 'rgba(203, 213, 225, 0.4)' }} />
          <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: 'rgba(203, 213, 225, 0.4)' }} />
          <View style={{ height: 6, width: 32, borderRadius: 3, backgroundColor: isSuccess ? TOKENS.colors.primary : 'rgba(140, 161, 143, 0.7)' }} />
        </View>
      </View>

      {/* 2. MAIN CONTENT AREA */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        
        {/* Status Illustration / Spinner */}
        <View style={{ 
          width: 100, 
          height: 100, 
          borderRadius: 50, 
          backgroundColor: isSuccess ? TOKENS.colors.primary : '#f8fafc',
          alignItems: 'center', 
          justifyContent: 'center',
          marginBottom: 32,
          shadowColor: isSuccess ? TOKENS.colors.primary : '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isSuccess ? 0.3 : 0.05,
          shadowRadius: 12,
          elevation: 5
        }}>
          {isSuccess ? (
            <MaterialIcons name="check" size={48} color="white" />
          ) : isError ? (
            <MaterialIcons name="error-outline" size={48} color="#ef4444" />
          ) : (
            <ActivityIndicator size="large" color={TOKENS.colors.primary} />
          )}
        </View>

        <Text style={{ 
          fontFamily: TOKENS.typography.fontFamily,
          fontSize: 28,
          lineHeight: 34,
          color: TOKENS.colors.text.light.emphasis,
          marginBottom: 12,
          textAlign: 'center'
        }} className="font-bold tracking-tight">
          {isSuccess ? 'Your plan is ready' : isError ? 'Something went wrong' : 'Shaping your week'}
        </Text>

        <Text style={{ 
          fontSize: 16,
          lineHeight: 24,
          color: TOKENS.colors.text.light.muted,
          textAlign: 'center',
          paddingHorizontal: 20
        }} className="font-medium">
          {isSuccess 
            ? 'We have tailored a custom meal plan based on your tastes and targets.' 
            : isError 
            ? 'We couldn\'t generate a plan with these constraints. Please try again or adjust your targets.' 
            : loadingMessages[loadingStage]}
        </Text>

        {isError && (
          <TouchableOpacity 
            onPress={handleRetry}
            style={{ 
              marginTop: 32,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: '#f1f5f9'
            }}
          >
            <Text style={{ fontWeight: 'bold', color: TOKENS.colors.text.light.emphasis }}>Retry Generation</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 3. STICKY FOOTER CTA (Success only) */}
      {isSuccess && (
        <View style={{ 
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 32,
          paddingBottom: Math.max(insets.bottom, 32),
          paddingTop: 24,
          backgroundColor: TOKENS.colors.background.light
        }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleFinish}
            style={{ 
              height: 60, 
              borderRadius: 18,
              backgroundColor: TOKENS.colors.primary,
              width: '100%',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            className="shadow-md shadow-primary/20"
          >
            <Text 
              style={{ fontSize: 16, color: 'white' }}
              className="font-bold tracking-wide uppercase"
            >
              See My Plan
            </Text>
            <MaterialIcons name="arrow-forward" size={18} color="white" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      )}
      
    </View>
  );
}
