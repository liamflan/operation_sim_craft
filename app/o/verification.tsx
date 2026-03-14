import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, useWindowDimensions, ScrollView, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5, Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useActivePlan } from '../../data/ActivePlanContext';
import { TOKENS } from '../../theme/tokens';

/**
 * OnboardingVerification (Pass 31 - Generation Screen Overhaul)
 */

const GENERATION_PHASES = [
  { title: 'Mapping your preferences', message: 'Analyzing your favorite cuisines and flavor patterns...' },
  { title: 'Balancing your budget', message: 'Optimizing ingredient costs for your weekly target...' },
  { title: 'Matching nutrition targets', message: 'Ensuring your macros align with your calorie goals...' },
  { title: 'Building your week', message: 'Assembling a balanced, variety-packed rotation...' },
  { title: 'Finalizing your plan', message: 'Preparing your first shopping list and instructions...' }
];

export default function OnboardingVerification() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { workspace, regenerateWorkspace } = useActivePlan();

  const [loadingStage, setLoadingStage] = useState(0);
  const generationTriggered = useRef(false);

  const isSuccess = workspace.status === 'ready' && loadingStage >= GENERATION_PHASES.length - 1;
  const isError = workspace.status === 'error';
  const isLoading = workspace.status === 'generating' || (workspace.status === 'ready' && !isSuccess);

  // Payload extraction for summary - HARDENED BOUNDARY
  const payload = workspace.input?.payload;
  const preferredCuisines = payload?.preferredCuisineIds ?? [];
  const diet = payload?.diet ?? 'Omnivore';
  const calories = payload?.targetCalories ?? 2000;
  const budget = payload?.budgetWeekly ?? 50.00;
  const exclusions = payload?.excludedIngredientTags ?? [];

  useEffect(() => {
    if (!generationTriggered.current) {
      generationTriggered.current = true;
      if (payload) {
        regenerateWorkspace(payload);
      }
    }
  }, []);

  useEffect(() => {
    if (workspace.status === 'generating' || (workspace.status === 'ready' && loadingStage < GENERATION_PHASES.length - 1)) {
      const timer = setTimeout(() => {
        setLoadingStage(prev => Math.min(prev + 1, GENERATION_PHASES.length - 1));
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [workspace.status, loadingStage]);

  const handleFinish = () => {
    router.replace('/(tabs)');
  };

  const handleRetry = () => {
    generationTriggered.current = false;
    setLoadingStage(0);
    if (payload) {
      regenerateWorkspace(payload);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const currentPhase = GENERATION_PHASES[loadingStage];
  const progressPercent = isSuccess ? 100 : ((loadingStage + 1) / GENERATION_PHASES.length) * 85;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView 
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. BRAND ROW */}
        <View style={styles.brandingRow}>
          {(!isLoading && !isSuccess) ? (
            <TouchableOpacity onPress={handleBack} style={styles.backBtnInline}>
              <Ionicons name="arrow-back" size={20} color={TOKENS.colors.text.light.emphasis} />
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

        {/* 2. PROGRESS DOTS */}
        <View style={styles.dotsContainer}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dotLong} />
        </View>

        {/* 3. MAIN HEADING */}
        <View style={styles.header}>
          <Text style={styles.title}>Shaping your week</Text>
          <Text style={styles.subtitle}>
            Combining your tastes, budget, and goals into your first weekly plan.
          </Text>
        </View>

        <View style={styles.mainContent}>
          {/* 4. GENERATION STATUS CARD */}
          <View style={[styles.statusCard, isError && styles.statusCardError]}>
            <View style={styles.statusContent}>
              <View style={styles.statusRow}>
                {isError ? (
                  <MaterialIcons name="error-outline" size={22} color="#ef4444" />
                ) : isSuccess ? (
                  <MaterialIcons name="check-circle" size={22} color={TOKENS.colors.primary} />
                ) : (
                  <MaterialCommunityIcons name="auto-fix" size={22} color={TOKENS.colors.primary} />
                )}
                <Text style={styles.statusTitle}>
                  {isError ? 'Generation failed' : isSuccess ? 'Your plan is ready' : currentPhase.title}
                </Text>
              </View>

              <View style={styles.progressBarContainer}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { width: `${progressPercent}%` },
                    isError && { backgroundColor: '#ef4444' }
                  ]} 
                />
              </View>

              <Text style={styles.statusMessage}>
                {isError ? workspace.error : isSuccess ? 'Tailoring complete. Launching your journey.' : currentPhase.message}
              </Text>
            </View>
          </View>

          {/* 5. PREFERENCES SUMMARY */}
          {!isError && (
            <View style={styles.summarySection}>
              <View style={styles.summaryHeader}>
                <MaterialCommunityIcons name="silverware-variant" size={20} color={TOKENS.colors.primary} />
                <Text style={styles.summaryTitle}>Your preferences</Text>
              </View>

              <View style={styles.summaryGrid}>
                {/* Cuisines */}
                {preferredCuisines.length > 0 && (
                  <View style={styles.summaryItem}>
                    <Text style={styles.itemLabel}>Favorite Cuisines</Text>
                    <View style={styles.chipRow}>
                      {preferredCuisines.slice(0, 3).map(id => (
                        <View key={id} style={styles.chip}>
                          <Text style={styles.chipText}>{id.replace(/_/g, ' ')}</Text>
                        </View>
                      ))}
                      {preferredCuisines.length > 3 && (
                        <View style={styles.chip}>
                          <Text style={styles.chipText}>+{preferredCuisines.length - 3}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Diet & Calories */}
                <View style={styles.pairRow}>
                  <View style={styles.halfItem}>
                    <View style={styles.itemHeader}>
                      <MaterialCommunityIcons name="leaf" size={14} color={TOKENS.colors.primary} />
                      <Text style={styles.itemLabel}>Diet</Text>
                    </View>
                    <Text style={styles.itemValue}>{diet}</Text>
                  </View>
                  <View style={styles.halfItem}>
                    <View style={styles.itemHeader}>
                      <MaterialCommunityIcons name="lightning-bolt" size={14} color={TOKENS.colors.primary} />
                      <Text style={styles.itemLabel}>Target</Text>
                    </View>
                    <Text style={styles.itemValue}>{calories.toLocaleString()} kcal</Text>
                  </View>
                </View>

                {/* Budget */}
                <View style={styles.fullItem}>
                  <View style={styles.budgetRow}>
                    <View>
                      <View style={styles.itemHeader}>
                        <MaterialIcons name="payments" size={14} color={TOKENS.colors.primary} />
                        <Text style={styles.itemLabel}>Weekly Budget</Text>
                      </View>
                      <Text style={styles.itemValue}>
                        {budget >= 70 ? '£70+' : `£${budget.toFixed(2)}`}
                      </Text>
                    </View>
                    <View style={styles.budgetIcons}>
                      {[1, 2, 3].map(i => {
                        const activeCount = budget >= 70 ? 3 : (budget >= 50 ? 2 : 1);
                        return (
                          <Text 
                            key={i} 
                            style={[styles.currencyIcon, i > activeCount && { opacity: 0.2 }]}
                          >
                            £
                          </Text>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* Exclusions */}
                {exclusions.length > 0 && (
                  <View style={styles.fullItem}>
                    <View style={styles.itemHeader}>
                      <MaterialIcons name="block" size={14} color="#f87171" />
                      <Text style={styles.itemLabel}>Exclusions</Text>
                    </View>
                    <View style={styles.chipRow}>
                      {exclusions.slice(0, 5).map(ex => (
                        <View key={ex} style={[styles.chip, { backgroundColor: '#fef2f2', borderColor: '#fee2e2' }]}>
                          <Text style={[styles.chipText, { color: '#991b1b' }]}>{ex}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* 6. DECORATIVE ELEMENT */}
          {!isError && (
            <View style={styles.visualContainer}>
              <Image 
                source={{ uri: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=800' }}
                style={styles.visualImage}
              />
              <View style={styles.visualOverlay}>
                <Text style={styles.visualText}>Ready to start your journey?</Text>
              </View>
            </View>
          )}

          {/* 7. ERROR STATE RETRY */}
          {isError && (
            <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry Generation</Text>
              <MaterialIcons name="refresh" size={20} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* 8. FOOTER ACTION */}
      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={isSuccess ? handleFinish : undefined}
          disabled={!isSuccess}
          style={[styles.ctaButton, (!isSuccess && !isError) && styles.ctaDisabled]}
        >
          <Text style={styles.ctaText}>
            {isError ? 'Review Settings' : isSuccess ? 'View My Plan' : 'Creating your plan...'}
          </Text>
          {isSuccess && <MaterialIcons name="arrow-forward" size={18} color="white" style={{ marginLeft: 6 }} />}
          {!isSuccess && !isError && <ActivityIndicator size="small" color="white" style={{ marginLeft: 8 }} />}
        </TouchableOpacity>
        
        <Text style={styles.reassurance}>You can refine these settings later</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fcfcfc' },
  brandingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  backBtnInline: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f4f0', borderRadius: 10 },
  brandWordmarkRow: { flexDirection: 'row', alignItems: 'center' },
  brandText: { fontSize: 13, fontWeight: '900', color: TOKENS.colors.text.light.emphasis, textTransform: 'uppercase', letterSpacing: 2 },
  dotsContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: TOKENS.colors.primary, opacity: 0.4 },
  dotLong: { width: 32, height: 8, borderRadius: 4, backgroundColor: TOKENS.colors.primary },
  header: { paddingHorizontal: 24, paddingVertical: 20, alignItems: 'center' },
  title: { fontSize: 32, fontWeight: '900', color: TOKENS.colors.text.light.emphasis, textAlign: 'center', letterSpacing: -1 },
  subtitle: { fontSize: 15, color: TOKENS.colors.text.light.muted, textAlign: 'center', marginTop: 8, lineHeight: 22, paddingHorizontal: 20 },
  mainContent: { paddingHorizontal: 20 },
  statusCard: { backgroundColor: 'rgba(140, 161, 143, 0.05)', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(140, 161, 143, 0.1)' },
  statusCardError: { backgroundColor: '#fef2f2', borderColor: '#fee2e2' },
  statusContent: { gap: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusTitle: { fontSize: 16, fontWeight: '700', color: TOKENS.colors.text.light.emphasis },
  progressBarContainer: { height: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: TOKENS.colors.primary, borderRadius: 3 },
  statusMessage: { fontSize: 13, color: TOKENS.colors.text.light.muted, fontStyle: 'italic', lineHeight: 18 },
  summarySection: { marginTop: 32 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  summaryTitle: { fontSize: 18, fontWeight: '800', color: TOKENS.colors.text.light.emphasis },
  summaryGrid: { gap: 12 },
  summaryItem: { backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f0f0f0' },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  itemLabel: { fontSize: 10, fontWeight: '800', color: TOKENS.colors.text.light.muted, textTransform: 'uppercase', letterSpacing: 1 },
  itemValue: { fontSize: 16, fontWeight: '700', color: TOKENS.colors.text.light.emphasis },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { backgroundColor: '#f1f5f1', borderWidth: 1, borderColor: '#e0eae0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 10, fontWeight: '800', color: TOKENS.colors.primary, textTransform: 'uppercase' },
  pairRow: { flexDirection: 'row', gap: 12 },
  halfItem: { flex: 1, backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f0f0f0' },
  fullItem: { backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f0f0f0' },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetIcons: { flexDirection: 'row', gap: 2 },
  currencyIcon: { fontSize: 14, fontWeight: 'bold', color: TOKENS.colors.primary },
  visualContainer: { marginTop: 32, height: 120, borderRadius: 24, overflow: 'hidden', position: 'relative' },
  visualImage: { width: '100%', height: '100%', opacity: 0.6 },
  visualOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(140, 161, 143, 0.4)', justifyContent: 'flex-end', padding: 16 },
  visualText: { color: 'white', fontWeight: '700', fontSize: 15 },
  retryButton: { backgroundColor: '#ef4444', height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24 },
  retryButtonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  footer: { padding: 20, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  ctaButton: { height: 60, borderRadius: 18, backgroundColor: TOKENS.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: TOKENS.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  ctaDisabled: { backgroundColor: '#cbd5e1', shadowOpacity: 0 },
  ctaText: { color: 'white', fontSize: 16, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  reassurance: { textAlign: 'center', fontSize: 10, fontWeight: '700', color: '#94a3b8', marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 }
});
