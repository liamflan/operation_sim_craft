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
 * OnboardingTargets (Pass 30 - Header Spacing Refinement)
 * 
 * PASS 30 IMPROVEMENTS:
 * 1. BALANCED SPACING: Achieving even gaps between subtitle -> dots and dots -> separator.
 * 2. SLIMMER BAND: Compacted the sticky band further for a tighter, premium rhythm.
 */
export default function OnboardingTargets() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { 
    workspace, 
    updateFullOnboardingPayload,
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

  const ALL_SUGGESTIONS = [
    'Mushrooms', 'Cilantro', 'Olives', 'Shellfish', 
    'Peanuts', 'Dairy', 'Spicy foods'
  ];

  // ─── STATE ──────────────────────────────────────────────────────────────────
  const [budget, setBudget] = useState('£40');
  const [activity, setActivity] = useState('moderate');
  const [protein, setProtein] = useState(140); 
  
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  
  const [sliderWidth, setSliderWidth] = useState(0);
  const [isSliderDragging, setIsSliderDragging] = useState(false);
  const [exclusionsY, setExclusionsY] = useState(0);

  // ─── REFS ───────────────────────────────────────────────────────────────────
  const scrollRef = useRef<ScrollView>(null);
  const isInputFocused = useRef(false);
  const trackPageX = useRef(0);

  // ─── EFFECTS ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const p = workspace.input?.payload;
    if (p) {
      if (p.budgetWeekly) setBudget(`£${p.budgetWeekly}${p.budgetWeekly === 70 ? '+' : ''}`);
      if (p.caloriePreset) setActivity(p.caloriePreset);
      if (p.targetProtein) setProtein(p.targetProtein);
      if (p.excludedIngredientTags) {
        setExclusions(p.excludedIngredientTags.map(s => s.charAt(0).toUpperCase() + s.slice(1)));
      }
    }

    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      if (isInputFocused.current) {
        const desiredTopOffset = 20; 
        const targetScrollY = Math.max(0, exclusionsY - desiredTopOffset);
        scrollRef.current?.scrollTo({ y: targetScrollY, animated: true });
      }
    });

    return () => showSubscription.remove();
  }, [exclusionsY]);

  // ─── HANDLERS ───────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    const currentKcal = ACTIVITIES.find(a => a.id === activity)?.kcal || '2,400';
    const numericBudget = parseInt(budget.replace('£', '').replace('+', ''));
    const cleanTags = exclusions.map(s => s.toLowerCase().trim()).filter(s => s.length > 0);

    const kcalValue = parseInt(currentKcal.replace(',', ''));
    
    await updateFullOnboardingPayload({
      budgetWeekly: numericBudget,
      targetCalories: kcalValue,
      caloriePreset: activity,
      targetProtein: protein,
      excludedIngredientTags: cleanTags
    });

    router.push('/o/verification' as any);
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/o' as any);
  };

  // ─── EXCLUSIONS LOGIC ──────────────────────────────────────────────────────
  const addExclusion = (term: string) => {
    const normalized = term.trim();
    if (!normalized) return;

    const terms = normalized.includes(',') 
      ? normalized.split(',').map(t => t.trim()).filter(Boolean)
      : [normalized];

    setExclusions(prev => {
      let next = [...prev];
      terms.forEach(t => {
        const displayTerm = t.charAt(0).toUpperCase() + t.slice(1);
        if (!next.some(existing => existing.toLowerCase() === t.toLowerCase())) {
          next.push(displayTerm);
        }
      });
      return next;
    });
    setInputValue('');
  };

  const removeExclusion = (index: number) => {
    setExclusions(prev => prev.filter((_, i) => i !== index));
  };

  const filteredSuggestions = ALL_SUGGESTIONS.filter(
    s => !exclusions.some(item => item.toLowerCase() === s.toLowerCase())
  );

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

  const currentRatio = (protein - PROTEIN_MIN) / (PROTEIN_MAX - PROTEIN_MIN);
  const thumbLeft = currentRatio * (sliderWidth - THUMB_SIZE);
  const fillWidth = thumbLeft + THUMB_RADIUS;

  const isActiveLow = protein < 115;
  const isActiveStandard = protein >= 115 && protein <= 185;
  const isActivePerformance = protein > 185;

  // ─── RENDER ────────────────────────────────────────────────────────────────
  const cardWidth = (width - 48 - 12) / 2;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'android' ? 'height' : 'padding'}
      style={{ flex: 1, backgroundColor: TOKENS.colors.background.light }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <View style={{ flex: 1, paddingTop: insets.top }}>
        
        <ScrollView 
          ref={scrollRef}
          scrollEnabled={!isSliderDragging}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[3]} // Branding(0), Title(1), Subtitle(2), Progress(3) sticky
          contentContainerStyle={{ 
            paddingBottom: insets.bottom + 80 
          }}
        >
          {/* 1. SCROLLABLE BRAND ROW */}
          <View style={styles.brandingRow}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtnInline}>
              <Ionicons name="arrow-back" size={22} color={TOKENS.colors.text.light.emphasis} />
            </TouchableOpacity>
            
            <View style={styles.brandWordmarkRow}>
              <FontAwesome5 name="leaf" size={12} color={TOKENS.colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.brandText}>Provision</Text>
            </View>
            
            <View style={{ width: 40 }} />
          </View>

          {/* 2. SCROLLABLE TITLE */}
          <View style={styles.titleContainer}>
            <Text style={styles.titleText}>Set your targets</Text>
          </View>

          {/* 3. SCROLLABLE SUBTITLE */}
          <View style={styles.subtitleContainer}>
            <Text style={styles.subtitleText}>Adjust your daily goals to match your metabolic needs.</Text>
          </View>

          {/* 4. BALANCED STICKY PROGRESS BAND (PASS 30) */}
          <View style={styles.stickyProgressBand}>
              <View style={styles.progressRow}>
                  {[0, 0, 0, 1, 0].map((active, i) => (
                    <View key={i} style={[styles.progressDotIndicator, active ? styles.progressDotActive : styles.progressDotInactive]} />
                  ))}
              </View>
          </View>

          {/* 5. MAIN CONTENT */}
          <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
            <View style={{ gap: 54 }}>
              
              {/* 1. Food Budget */}
              <View>
                <Text style={styles.sectionTitle}>Weekly Food Budget</Text>
                <View style={styles.budgetChipRow}>
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

              {/* 3. Daily Protein Target */}
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
                  onResponderRelease={() => setIsSliderDragging(false)}
                  onResponderTerminate={() => setIsSliderDragging(false)}
                >
                  <View style={[styles.sliderTrackBg, { top: 21 }]} />
                  <View style={[styles.sliderTrackActive, { width: fillWidth, top: 21 }]} />
                  <View style={[styles.sliderThumb, { left: thumbLeft, top: 10 }]} />
                </View>
                
                <View style={styles.markerRow}>
                  <View style={[styles.markerItem, { left: 0 }]}>
                      <View style={[styles.markerTick, isActiveLow && styles.markerTickActive]} />
                      <Text style={[styles.markerLabel, isActiveLow && styles.markerTextActive]}>Low</Text>
                      <Text style={[styles.markerSub, isActiveLow && styles.markerSubActive]}>80g</Text>
                  </View>
                  <View style={[styles.markerItem, { left: (sliderWidth / 2) - 40 }]}>
                      <View style={[styles.markerTick, isActiveStandard && styles.markerTickActive]} />
                      <Text style={[styles.markerLabel, isActiveStandard && styles.markerTextActive]}>Standard</Text>
                      <Text style={[styles.markerSub, isActiveStandard && styles.markerSubActive]}>150g</Text>
                  </View>
                  <View style={[styles.markerItem, { right: 0 }]}>
                      <View style={[styles.markerTick, isActivePerformance && styles.markerTickActive]} />
                      <Text style={[styles.markerLabel, isActivePerformance && styles.markerTextActive, { textAlign: 'right' }]}>Performance</Text>
                      <Text style={[styles.markerSub, isActivePerformance && styles.markerSubActive, { textAlign: 'right' }]}>220g</Text>
                  </View>
                </View>
              </View>

              {/* 4. Exclusions */}
              <View onLayout={(e) => setExclusionsY(e.nativeEvent.layout.y)}>
                <Text style={styles.sectionTitle}>Anything to avoid?</Text>
                
                <View style={styles.inputRow}>
                  <TextInput
                    placeholder="Add an exclusion..."
                    placeholderTextColor="rgba(148, 163, 184, 0.4)"
                    style={styles.compactInput}
                    value={inputValue}
                    onChangeText={setInputValue}
                    onSubmitEditing={() => addExclusion(inputValue)}
                    onFocus={() => { isInputFocused.current = true; }}
                    onBlur={() => { isInputFocused.current = false; }}
                  />
                  <TouchableOpacity 
                    onPress={() => addExclusion(inputValue)} 
                    style={styles.addButton}
                  >
                    <Ionicons name="add" size={24} color="white" />
                  </TouchableOpacity>
                </View>

                {exclusions.length > 0 && (
                  <View style={styles.selectedChipsContainer}>
                    {exclusions.map((item, idx) => (
                      <View key={`${item}-${idx}`} style={styles.selectionChip}>
                        <Text style={styles.selectionChipText}>{item}</Text>
                        <TouchableOpacity onPress={() => removeExclusion(idx)} style={styles.removeChip}>
                          <Ionicons name="close-circle" size={18} color={TOKENS.colors.primary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {filteredSuggestions.length > 0 && (
                  <>
                    <View style={styles.suggestionsTitleRow}>
                      <MaterialIcons name="auto-fix-high" size={14} color="rgba(148, 163, 184, 0.6)" />
                      <Text style={styles.suggestionsTitle}>Suggestions</Text>
                    </View>
                    <View style={styles.suggestionsWrappingRow}>
                      {filteredSuggestions.map(s => (
                        <TouchableOpacity 
                          key={s} 
                          onPress={() => addExclusion(s)} 
                          style={styles.suggestChip}
                        >
                          <Text style={styles.suggestChipText}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                <Text style={styles.reassuranceCopy}>
                  You can change these anytime later in your profile.
                </Text>
                
                <Text style={styles.exclusionHint}>
                  We'll ensure these are swapped out of your plan automatically.
                </Text>
              </View>

              {/* Locked CTA wording: Generate Plan */}
              <TouchableOpacity onPress={handleGenerate} activeOpacity={0.9} style={styles.ctaButton}>
                <Text style={styles.ctaText}>Generate Plan</Text>
                <MaterialIcons name="arrow-forward" size={18} color="white" style={{ marginLeft: 6 }} />
              </TouchableOpacity>

            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  brandingRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 24, 
    paddingVertical: 12 
  },
  backBtnInline: { 
    width: 40, 
    height: 40, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#f8fafc', 
    borderRadius: 12 
  },
  brandWordmarkRow: { flexDirection: 'row', alignItems: 'center' },
  brandText: { 
    fontSize: 12, 
    fontWeight: '900', 
    color: TOKENS.colors.text.light.emphasis, 
    textTransform: 'uppercase', 
    letterSpacing: 1.5 
  },
  titleContainer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 6 },
  titleText: { 
    fontSize: 28, 
    color: TOKENS.colors.text.light.emphasis, 
    fontWeight: 'bold', 
    letterSpacing: -0.5, 
    textAlign: 'center' 
  },
  subtitleContainer: { paddingHorizontal: 40, paddingBottom: 10 },
  subtitleText: { 
    fontSize: 14, 
    lineHeight: 20, 
    color: TOKENS.colors.text.light.muted, 
    textAlign: 'center', 
    fontWeight: '500' 
  },
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
  progressRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 12 
  },
  progressDotIndicator: { height: 6, borderRadius: 3 },
  progressDotActive: { width: 32, backgroundColor: 'rgba(140, 161, 143, 0.7)' },
  progressDotInactive: { width: 6, backgroundColor: 'rgba(203, 213, 225, 0.4)' },
  sectionTitle: { fontSize: 10, fontWeight: '900', color: 'rgba(148, 163, 184, 0.6)', letterSpacing: 2, marginBottom: 16, textTransform: 'uppercase' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  budgetChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
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
  sliderThumb: { 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    backgroundColor: 'white', 
    borderWidth: 4, 
    borderColor: TOKENS.colors.primary, 
    position: 'absolute', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 3 
  },
  markerRow: { height: 40, marginTop: 10, position: 'relative' },
  markerItem: { alignItems: 'center', width: 80, position: 'absolute' },
  markerTick: { width: 1, height: 5, backgroundColor: 'rgba(148, 163, 184, 0.3)', marginBottom: 6 },
  markerLabel: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', color: 'rgba(148, 163, 184, 0.4)', letterSpacing: 1 },
  markerSub: { fontSize: 9, fontWeight: '700', color: 'rgba(148, 163, 184, 0.25)' },
  markerTickActive: { backgroundColor: TOKENS.colors.primary },
  markerTextActive: { color: TOKENS.colors.primary, fontWeight: '950' },
  markerSubActive: { color: TOKENS.colors.primary, opacity: 0.6 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  compactInput: { 
    flex: 1, 
    height: 50, 
    backgroundColor: 'white', 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#f1f5f9', 
    paddingHorizontal: 16, 
    fontSize: 14, 
    color: TOKENS.colors.text.light.emphasis, 
    fontWeight: '500' 
  },
  addButton: { 
    width: 50, 
    height: 50, 
    backgroundColor: TOKENS.colors.primary, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  selectedChipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  selectionChip: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f6f9f7', 
    borderRadius: 12, 
    paddingLeft: 12, 
    paddingRight: 6, 
    paddingVertical: 8, 
    borderWidth: 1, 
    borderColor: 'rgba(140, 161, 143, 0.2)' 
  },
  selectionChipText: { fontSize: 13, fontWeight: '600', color: TOKENS.colors.text.light.emphasis, marginRight: 4 },
  removeChip: { padding: 2 },
  suggestionsTitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 12, gap: 6 },
  suggestionsTitle: { 
    fontSize: 10, 
    fontWeight: '900', 
    color: 'rgba(148, 163, 184, 0.6)', 
    letterSpacing: 1, 
    textTransform: 'uppercase' 
  },
  suggestionsWrappingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestChip: { 
    paddingHorizontal: 14, 
    paddingVertical: 8, 
    borderRadius: 100, 
    borderStyle: 'dashed', 
    borderWidth: 1, 
    borderColor: 'rgba(148, 163, 184, 0.3)', 
    backgroundColor: 'transparent' 
  },
  suggestChipText: { fontSize: 11, fontWeight: 'bold', color: TOKENS.colors.text.light.muted },
  reassuranceCopy: { fontSize: 11, color: TOKENS.colors.primary, marginTop: 16, fontWeight: '700', opacity: 0.6 },
  exclusionHint: { fontSize: 11, color: 'rgba(148, 163, 184, 0.6)', marginTop: 8, fontWeight: '500' },
  ctaButton: { 
    height: 62, 
    borderRadius: 20, 
    backgroundColor: TOKENS.colors.primary, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 32 
  },
  ctaText: { fontSize: 16, color: 'white', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }
});
