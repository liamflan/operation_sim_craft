import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, useWindowDimensions, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useActivePlan } from '../../data/ActivePlanContext';
import { TOKENS } from '../../theme/tokens';

/**
 * OnboardingVerification (Pass 30 - Header Spacing Refinement)
 * 
 * PASS 30 IMPROVEMENTS:
 * 1. BALANCED SPACING: Achieving even gaps between subtitle -> dots and dots -> separator.
 * 2. SLIMMER BAND: Compacted the sticky band further for a tighter, premium rhythm.
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

  const handleBack = () => {
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      
      <ScrollView 
        contentContainerStyle={{ 
          paddingBottom: insets.bottom + 60 
        }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[3]} // Branding(0), Title(1), Subtitle(2), Progress(3) sticky
      >
        {/* 1. SCROLLABLE BRAND ROW */}
        <View style={styles.brandingRow}>
          {(!isLoading && !isSuccess) ? (
            <TouchableOpacity onPress={handleBack} style={styles.backBtnInline}>
              <Ionicons name="arrow-back" size={22} color={TOKENS.colors.text.light.emphasis} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
          
          <View style={styles.brandWordmarkRow}>
            <FontAwesome5 name="leaf" size={12} color={TOKENS.colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.brandText}>Provision</Text>
          </View>
          
          <View style={{ width: 40 }} />
        </View>

        {/* 2. SCROLLABLE TITLE */}
        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>
            {isSuccess ? 'Plan Created' : 'Generating Plan'}
          </Text>
        </View>

        {/* 3. SCROLLABLE SUBTITLE */}
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitleText}>
            {isSuccess 
              ? 'Your first plan is ready to review.' 
              : 'Shaping your custom meal plan...'}
          </Text>
        </View>

        {/* 4. BALANCED STICKY PROGRESS BAND (PASS 30) */}
        <View style={styles.stickyProgressBand}>
            <View style={styles.progressRow}>
                <View style={styles.dotInactive} />
                <View style={styles.dotInactive} />
                <View style={styles.dotInactive} />
                <View style={styles.dotInactive} />
                <View style={[styles.dotActive, isSuccess && { backgroundColor: TOKENS.colors.primary }]} />
            </View>
        </View>

        {/* 5. MAIN CONTENT AREA */}
        <View style={styles.content}>
            {/* Status Illustration / Spinner */}
            <View style={[styles.statusCircle, isSuccess && styles.statusCircleSuccess]}>
            {isSuccess ? (
                <MaterialIcons name="check" size={48} color="white" />
            ) : isError ? (
                <MaterialIcons name="error-outline" size={48} color="#ef4444" />
            ) : (
                <ActivityIndicator size="large" color={TOKENS.colors.primary} />
            )}
            </View>

            <Text style={styles.contentTitle}>
            {isSuccess ? 'All set' : isError ? 'Something went wrong' : 'Crafting flavors'}
            </Text>

            <Text style={styles.contentSubtitle}>
            {isSuccess 
                ? 'We have tailored a custom meal plan based on your tastes and targets.' 
                : isError 
                ? "We couldn't generate a plan with these constraints. Please try again or adjust your targets." 
                : loadingMessages[loadingStage]}
            </Text>

            {isError && (
            <TouchableOpacity onPress={handleRetry} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry Generation</Text>
            </TouchableOpacity>
            )}

            {/* Locked CTA wording: View My Plan */}
            {isSuccess && (
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={handleFinish}
                    style={styles.ctaButton}
                >
                    <Text style={styles.ctaText}>View My Plan</Text>
                    <MaterialIcons name="arrow-forward" size={18} color="white" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
            )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TOKENS.colors.background.light },
  brandingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 12 },
  backBtnInline: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: 12 },
  brandWordmarkRow: { flexDirection: 'row', alignItems: 'center' },
  brandText: { fontSize: 12, fontWeight: '900', color: TOKENS.colors.text.light.emphasis, textTransform: 'uppercase', letterSpacing: 1.5 },
  titleContainer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 6 },
  titleText: { fontSize: 26, color: TOKENS.colors.text.light.emphasis, fontWeight: 'bold', letterSpacing: -0.5, textAlign: 'center' },
  subtitleContainer: { paddingHorizontal: 40, paddingBottom: 10 },
  subtitleText: { fontSize: 15, color: TOKENS.colors.text.light.muted, textAlign: 'center', fontWeight: '500', lineHeight: 22 },
  stickyProgressBand: { 
    backgroundColor: TOKENS.colors.background.light, 
    paddingTop: 10, 
    paddingBottom: 10, 
    alignItems: 'center', 
    justifyContent: 'center', 
    zIndex: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(0,0,0,0.02)' 
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  dotInactive: { height: 6, width: 6, borderRadius: 3, backgroundColor: 'rgba(203, 213, 225, 0.4)' },
  dotActive: { height: 6, width: 32, borderRadius: 3, backgroundColor: 'rgba(140, 161, 143, 0.7)' },
  content: { flex: 1, paddingHorizontal: 32, paddingTop: 32 },
  statusCircle: { alignSelf: 'center', width: 100, height: 100, borderRadius: 50, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', marginBottom: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 5 },
  statusCircleSuccess: { backgroundColor: TOKENS.colors.primary, shadowColor: TOKENS.colors.primary, shadowOpacity: 0.3 },
  contentTitle: { fontSize: 28, color: TOKENS.colors.text.light.emphasis, marginBottom: 12, textAlign: 'center', fontWeight: 'bold', letterSpacing: -0.5 },
  contentSubtitle: { fontSize: 16, color: TOKENS.colors.text.light.muted, textAlign: 'center', paddingHorizontal: 20, fontWeight: '500', lineHeight: 24 },
  retryBtn: { alignSelf: 'center', marginTop: 32, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: '#f1f5f9' },
  retryText: { fontWeight: 'bold', color: TOKENS.colors.text.light.emphasis },
  ctaButton: { height: 64, borderRadius: 18, backgroundColor: TOKENS.colors.primary, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 40, shadowColor: TOKENS.colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  ctaText: { fontSize: 16, color: 'white', fontWeight: 'bold', letterSpacing: 0.5, textTransform: 'uppercase' }
});
