import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  useWindowDimensions, 
  ScrollView, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform, 
  StyleSheet,
  Keyboard
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { TOKENS } from '../../theme/tokens';
import { useActivePlan } from '../../data/ActivePlanContext';

/**
 * OnboardingTargets (Visual Polish & Android Hardening - Rev 18)
 * Page 4 of the mobile onboarding flow.
 * 
 * CORE STABILITY ARCHITECTURE:
 * 1. SLIDER POLISH: Vertical centering (top offsets) for 6px track and 28px thumb.
 * 2. ANDROID HARDENING: behavior="height" for KeyboardAvoidingView + refined scroll.
 * 3. SMOOTHNESS: pageX-based origin math prevents coordinate jitter.
 */
export default function OnboardingTargets() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { 
    workspace, 
    updateBudget, 
    updateCalories, 
    updateProtein, 
    updateExclusions 
  } = useActivePlan();

  // ─── CONSTANTS ─────────────────────────────────────────────────────────────
  const PROTEIN_MIN = 80;
  const PROTEIN_MAX = 220;
  const THUMB_SIZE = 28;
  const THUMB_RADIUS = THUMB_SIZE / 2;

  const BUDGETS = ['£30', '£40', '£50', '£60', '£70+'];
  const ACTIVITIES = [
    { id: 'light', name: 'Light', icon: 'leaf', kcal: '1,800' },
    { id: 'moderate', name: 'Moderate', icon: 'walking', kcal: '2,400' },
    { id: 'active', name: 'Active', icon: 'running', kcal: '2,800' },
    { id: 'high', name: 'High', icon: 'fire-alt', kcal: '3,200' }
  ];

  // ─── STATE ──────────────────────────────────────────────────────────────────
  const [budget, setBudget] = useState('£40');
  const [activity, setActivity] = useState('moderate');
  const [protein, setProtein] = useState(140); 
  const [exclusions, setExclusions] = useState('');
  
  const [sliderWidth, setSliderWidth] = useState(0);
  const [isSliderDragging, setIsSliderDragging] = useState(false);
  
  // Deterministic positioning
  const [exclusionsY, setExclusionsY] = useState(0);

  // ─── REFS ───────────────────────────────────────────────────────────────────
  const scrollRef = useRef<ScrollView>(null);
  const isExclusionsFocused = useRef(false);
  const trackPageX = useRef(0);

  // ─── EFFECTS ───────────────────────────────────────────────────────────────
  useEffect(() => {
    
    // 1. Hydrate state
    const p = workspace.input?.payload;
    if (p) {
      if (p.budgetWeekly) setBudget(`£${p.budgetWeekly}${p.budgetWeekly === 70 ? '+' : ''}`);
      if (p.caloriePreset) setActivity(p.caloriePreset);
      if (p.targetProtein) setProtein(p.targetProtein);
      if (p.excludedIngredientTags) setExclusions(p.excludedIngredientTags.join(', '));
    }

    // 2. Absolute Keyboard Scroll Stickiness (Pass 18 refined offset)
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      if (isExclusionsFocused.current) {
        // Pin the field specifically near the top of the viewport
        const desiredTopOffset = 20; 
        const targetScrollY = Math.max(0, exclusionsY - desiredTopOffset);
        scrollRef.current?.scrollTo({ y: targetScrollY, animated: true });
      }
    });

    return () => {
      showSubscription.remove();
    };
  }, [exclusionsY]);

  // ─── HANDLERS ───────────────────────────────────────────────────────────────
  const handleNext = () => {
    const currentKcal = ACTIVITIES.find(a => a.id === activity)?.kcal || '2,400';
    const numericBudget = parseInt(budget.replace('£', '').replace('+', ''));
    const exclusionList = exclusions.split(',').map(s => s.trim()).filter(s => s.length > 0);

    updateBudget(numericBudget);
    updateCalories(parseInt(currentKcal.replace(',', '')), activity);
    updateProtein(protein);
    updateExclusions(exclusionList);

    router.push('/o/verification' as any);
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/o' as any);
  };

  // ─── SLIDER MATH ────────────────────────────────────────────────────────────
  const handleSliderUpdate = (pageX: number) => {
    if (sliderWidth <= 0 || trackPageX.current === 0) return;
    const relativeX = pageX - trackPageX.current;
    const centerX = Math.max(THUMB_RADIUS, Math.min(sliderWidth - THUMB_RADIUS, relativeX));
    const travelArea = sliderWidth - THUMB_SIZE;
    const ratio = (centerX - THUMB_RADIUS) / travelArea;
    const newVal = Math.round(PROTEIN_MIN + ratio * (PROTEIN_MAX - PROTEIN_MIN));
    setProtein(newVal);
  };

  // Derived visuals
  const currentRatio = (protein - PROTEIN_MIN) / (PROTEIN_MAX - PROTEIN_MIN);
  const thumbLeft = currentRatio * (sliderWidth - THUMB_SIZE);
  const fillWidth = thumbLeft + THUMB_RADIUS;

  // ─── RENDER ────────────────────────────────────────────────────────────────
  const cardWidth = (width - 48 - 12) / 2;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'android' ? 'height' : 'padding'}
      style={{ flex: 1, backgroundColor: TOKENS.colors.background.light }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <View style={{ flex: 1, paddingTop: insets.top }}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={TOKENS.colors.text.light.emphasis} />
          </TouchableOpacity>
          <View style={styles.brand}>
            <FontAwesome5 name="leaf" size={14} color={TOKENS.colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.brandText}>Provision</Text>
          </View>
        </View>

        <ScrollView 
          ref={scrollRef}
          scrollEnabled={!isSliderDragging}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ 
            paddingHorizontal: 24, 
            paddingTop: 16, 
            paddingBottom: insets.bottom + 140 
          }}
        >

          {/* Progress Indicators */}
          <View style={styles.progressContainer}>
            {[0, 0, 0, 1, 0].map((active, i) => (
              <View key={i} style={[styles.progressDot, active ? styles.progressDotActive : styles.progressDotInactive]} />
            ))}
          </View>

          {/* Title Area */}
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Set your targets</Text>
            <Text style={styles.subtitle}>
              Adjust your daily goals to match your metabolic needs.
            </Text>
          </View>

          <View style={{ gap: 54 }}>
            
            {/* 1. Food Budget */}
            <View>
              <Text style={styles.sectionTitle}>Weekly Food Budget</Text>
              <View style={styles.chipRow}>
                {BUDGETS.map(val => {
                  const isSelected = budget === val;
                  return (
                    <TouchableOpacity
                      key={val}
                      onPress={() => setBudget(val)}
                      activeOpacity={0.8}
                      style={[styles.chip, isSelected && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, isSelected && { color: 'white' }]}>{val}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 2. Activity Level */}
            <View>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Activity Level</Text>
                <Text style={styles.valueLabel}>{ACTIVITIES.find(a => a.id === activity)?.kcal} kcal</Text>
              </View>
              <View style={styles.activityGrid}>
                {ACTIVITIES.map(opt => {
                  const isSelected = activity === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => setActivity(opt.id)}
                      activeOpacity={0.8}
                      style={[styles.activityCard, { width: cardWidth }, isSelected ? styles.activityCardActive : styles.activityCardInactive]}
                    >
                      <FontAwesome5 name={opt.icon} size={20} color={isSelected ? TOKENS.colors.primary : 'rgba(148, 163, 184, 0.3)'} />
                      <Text style={[styles.activityText, { color: isSelected ? TOKENS.colors.primary : TOKENS.colors.text.light.muted }]}>{opt.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 3. Daily Protein Target (Geometric Polish) */}
            <View>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Daily Protein Target</Text>
                <View style={styles.valuePill}>
                  <Text style={styles.valueLabel}>{protein}g</Text>
                </View>
              </View>

              <View 
                style={styles.sliderTrackContainer}
                onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
                onStartShouldSetResponderCapture={() => true}
                onMoveShouldSetResponderCapture={() => true}
                onResponderTerminationRequest={() => false}
                onResponderGrant={(evt) => {
                  trackPageX.current = evt.nativeEvent.pageX - evt.nativeEvent.locationX;
                  setIsSliderDragging(true);
                  handleSliderUpdate(evt.nativeEvent.pageX);
                }}
                onResponderMove={(evt) => {
                  handleSliderUpdate(evt.nativeEvent.pageX);
                }}
                onResponderRelease={() => {
                  setIsSliderDragging(false);
                }}
                onResponderTerminate={() => {
                  setIsSliderDragging(false);
                }}
              >
                {/* Track Graphics - Explicit vertical centering via TOP offsets */}
                <View style={[styles.sliderTrackBg, { top: 21 }]} />
                <View style={[styles.sliderTrackActive, { width: fillWidth, top: 21 }]} />
                <View style={[styles.sliderThumb, { left: thumbLeft, top: 10 }]} />
              </View>
              
              <View style={[styles.markerRow, { height: 40 }]}>
                {/* Low @ 80g -> Thumb Center at THUMB_RADIUS */}
                <View style={[styles.markerItem, { position: 'absolute', left: THUMB_RADIUS - 40 }]}>
                  <View style={styles.markerTick} />
                  <Text style={styles.markerLabel}>Low</Text>
                  <Text style={styles.markerSub}>80g</Text>
                </View>

                {/* Standard @ 150g -> Thumb Center at width/2 */}
                <View style={[styles.markerItem, { position: 'absolute', left: (sliderWidth / 2) - 40 }]}>
                  <View style={styles.markerTick} />
                  <Text style={styles.markerLabel}>Standard</Text>
                  <Text style={styles.markerSub}>150g</Text>
                </View>

                {/* Performance @ 220g -> Thumb Center at width - THUMB_RADIUS */}
                <View style={[styles.markerItem, { position: 'absolute', right: THUMB_RADIUS - 40 }]}>
                  <View style={styles.markerTick} />
                  <Text style={styles.markerLabel}>Performance</Text>
                  <Text style={styles.markerSub}>220g</Text>
                </View>
              </View>
            </View>

            {/* 4. Exclusions (Android Hardened Reveal) */}
            <View onLayout={(e) => setExclusionsY(e.nativeEvent.layout.y)}>
              <Text style={styles.sectionTitle}>Anything to avoid?</Text>
              <View style={styles.exclusionBox}>
                <TextInput
                  placeholder="E.g. Cilantro, Mushrooms, Spicy foods..."
                  placeholderTextColor="rgba(148, 163, 184, 0.4)"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top" 
                  style={styles.exclusionInput}
                  value={exclusions}
                  onChangeText={setExclusions}
                  onFocus={() => { isExclusionsFocused.current = true; }}
                  onBlur={() => { isExclusionsFocused.current = false; }}
                  blurOnSubmit={false}
                />
              </View>
              <Text style={styles.exclusionHint}>
                We'll ensure these are swapped out of your plan automatically.
              </Text>
            </View>

            {/* Native Scroll Continue Button */}
            <TouchableOpacity onPress={handleNext} activeOpacity={0.9} style={styles.ctaButton}>
              <Text style={styles.ctaText}>Continue</Text>
              <MaterialIcons name="arrow-forward" size={18} color="white" style={{ marginLeft: 6 }} />
            </TouchableOpacity>

          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  backBtn: { position: 'absolute', left: 20, padding: 8 },
  brand: { flexDirection: 'row', alignItems: 'center' },
  brandText: { letterSpacing: 4, color: TOKENS.colors.text.light.emphasis, fontWeight: '800', textTransform: 'uppercase', fontSize: 13, fontFamily: TOKENS.typography.fontFamily },
  progressContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 24, gap: 12 },
  progressDot: { height: 6, borderRadius: 3 },
  progressDotActive: { width: 32, backgroundColor: 'rgba(140, 161, 143, 0.7)' },
  progressDotInactive: { width: 6, backgroundColor: 'rgba(203, 213, 225, 0.4)' },
  titleBlock: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 28, color: TOKENS.colors.text.light.emphasis, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: TOKENS.colors.text.light.muted, textAlign: 'center', fontWeight: '500', paddingHorizontal: 20, lineHeight: 20 },
  sectionTitle: { fontSize: 10, fontWeight: '900', color: 'rgba(148, 163, 184, 0.6)', letterSpacing: 2, marginBottom: 16, textTransform: 'uppercase' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: '#f1f5f9', backgroundColor: 'white' },
  chipActive: { backgroundColor: TOKENS.colors.primary, borderColor: TOKENS.colors.primary },
  chipText: { fontSize: 12, fontWeight: 'bold', color: TOKENS.colors.text.light.muted },
  valueLabel: { fontSize: 13, fontWeight: 'bold', color: TOKENS.colors.primary },
  valuePill: { backgroundColor: '#eff3f0', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 100 },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  activityCard: { paddingVertical: 22, borderRadius: 24, alignItems: 'center', justifyContent: 'center', gap: 12, borderWidth: 1 },
  activityCardActive: { backgroundColor: '#f6f9f7', borderColor: 'rgba(140, 161, 143, 0.4)', borderWidth: 2 },
  activityCardInactive: { backgroundColor: 'white', borderColor: '#f1f5f9' },
  activityText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' },
  sliderTrackContainer: { height: 48, justifyContent: 'center', width: '100%', position: 'relative' },
  sliderTrackBg: { height: 6, borderRadius: 3, backgroundColor: 'rgba(203, 213, 225, 0.25)', width: '100%', position: 'absolute' },
  sliderTrackActive: { height: 6, borderRadius: 3, backgroundColor: TOKENS.colors.primary, position: 'absolute', left: 0 },
  sliderThumb: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'white', borderWidth: 4, borderColor: TOKENS.colors.primary, position: 'absolute', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  markerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  markerItem: { alignItems: 'center', width: 80 },
  markerTick: { width: 1, height: 5, backgroundColor: 'rgba(148, 163, 184, 0.3)', marginBottom: 6 },
  markerLabel: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', color: 'rgba(148, 163, 184, 0.4)', letterSpacing: 1 },
  markerSub: { fontSize: 9, fontWeight: '700', color: 'rgba(148, 163, 184, 0.25)' },
  exclusionBox: { backgroundColor: 'white', borderRadius: 24, borderWidth: 1, borderColor: '#f1f5f9', padding: 20, minHeight: 150 },
  exclusionInput: { fontSize: 16, color: TOKENS.colors.text.light.emphasis, fontWeight: '500', lineHeight: 24 },
  exclusionHint: { fontSize: 11, color: 'rgba(148, 163, 184, 0.6)', marginTop: 12, fontWeight: '500' },
  ctaButton: { height: 62, borderRadius: 20, backgroundColor: TOKENS.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 32 },
  ctaText: { fontSize: 16, color: 'white', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }
});
