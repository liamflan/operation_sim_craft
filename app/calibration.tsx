import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  SafeAreaView, 
  ScrollView, 
  TextInput, 
  ActivityIndicator, 
  useWindowDimensions,
  StyleSheet,
  Platform
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useActivePlan } from '../data/ActivePlanContext';
import { DietaryBaseline, CuisineId, CUISINE_PROFILES } from '../data/planner/plannerTypes';
import { TOKENS } from '../theme/tokens';

// ─── Types ───────────────────────────────────────────────────────────────────

type CaloriePreset = 1600 | 2000 | 2400 | 2800;
type ProteinPreset = 100 | 130 | 160 | 200;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalize raw exclusions string into a clean string[] for profile storage. */
function normalizeExclusions(raw: string): string[] {
  return raw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 0);
}

// ─── Step Labels (sidebar) ────────────────────────────────────────────────────

const STEP_LABELS = [
  { number: 1, label: 'Welcome' },
  { number: 2, label: 'Dietary Baseline' },
  { number: 3, label: 'Calibration' },
  { number: 4, label: 'Goals & Constraints' },
  { number: 5, label: 'Plan Setup' },
];

// ─── Presets ──────────────────────────────────────────────────────────────────

const BUDGET_PRESETS = [30, 40, 50, 60, 70];

const CALORIE_PRESETS: { label: string; value: CaloriePreset }[] = [
  { label: 'Light', value: 1600 },
  { label: 'Moderate', value: 2000 },
  { label: 'Active', value: 2400 },
  { label: 'High', value: 2800 },
];

const PROTEIN_PRESETS: { label: string; value: ProteinPreset; sub: string }[] = [
  { label: 'Standard', value: 100, sub: '~100g' },
  { label: 'Elevated', value: 130, sub: '~130g' },
  { label: 'High', value: 160, sub: '~160g' },
  { label: 'Performance', value: 200, sub: '200g+' },
];

const CUISINE_CARD_ICONS: Record<CuisineId, string> = {
  italian: 'pizza-slice',
  french: 'cheese',
  mexican: 'pepper-hot',
  japanese: 'fish',
  chinese: 'utensils',
  indian: 'fire-alt',
  mediterranean: 'leaf',
  middle_eastern: 'bread-slice',
  korean: 'fire',
  south_east_asian: 'lemon'
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * CalibrationScreen (Hardened Phase 2)
 * 
 * FIX: Replaced all className/NativeWind usage with pure React Native styles
 * to ensure maximum stability on native builds and avoid navigation-context crashes.
 */
export default function CalibrationScreen() {
  const router = useRouter();
  const { 
    regenerateWorkspace, 
    workspace, 
    updateUserDiet, 
    updateCuisinePreferences, 
    updateExclusions 
  } = useActivePlan();
  const { width } = useWindowDimensions();

  const [step, setStep] = useState(1);

  // Step 2
  const [diet, setDietLocal] = useState<DietaryBaseline | null>(null);

  // Step 3
  const [selectedCuisines, setSelectedCuisines] = useState<CuisineId[]>([]);

  // Step 4
  const [budget, setBudget] = useState<number>(50);
  const [calorieTarget, setCalorieTarget] = useState<CaloriePreset>(2000);
  const [proteinTarget, setProteinTarget] = useState<ProteinPreset>(160);
  const [exclusionsRaw, setExclusionsRaw] = useState<string>('');

  // Step 5
  const [loadingStage, setLoadingStage] = useState(0);

  const hasTriggeredGeneration = React.useRef(false);

  const loadingMessages = [
    'Mapping your taste preferences...',
    'Matching flavours to your goals and budget...',
    'Optimising protein and variety...',
    'Shaping your routine-friendly week...',
    'Your first plan is ready',
  ];
  const isSetupComplete = loadingStage >= loadingMessages.length - 1 && (workspace.status === 'ready' || workspace.status === 'idle');

  // ─── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (step === 5 && !hasTriggeredGeneration.current) {
      hasTriggeredGeneration.current = true;
      const finalDiet = diet || 'Omnivore';
      
      const exclusions = normalizeExclusions(exclusionsRaw);
      
      regenerateWorkspace({
        preferredCuisineIds: selectedCuisines,
        diet: finalDiet,
        budgetWeekly: budget,
        targetCalories: calorieTarget,
        targetProtein: proteinTarget,
        excludedIngredientTags: exclusions,
      });
    }
  }, [step]);

  useEffect(() => {
    if (step === 5 && !isSetupComplete) {
      const timer = setTimeout(() => setLoadingStage(prev => prev + 1), 1500);
      return () => clearTimeout(timer);
    }
  }, [step, loadingStage, isSetupComplete]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const toggleCuisine = (id: CuisineId) =>
    setSelectedCuisines(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );

  const canProceed = () => {
    if (step === 2) return !!diet;
    if (step === 3) return selectedCuisines.length >= 1;
    if (step === 5) return isSetupComplete;
    return true;
  };

  const handleNext = () => {
    if (!canProceed()) return;
    if (step < 5) setStep(step + 1);
    else router.replace('/(tabs)');
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleDebugSkip = () => {
    const skipCuisines: CuisineId[] = ['italian', 'mexican', 'japanese'];
    const skipDiet = 'Omnivore';
    
    regenerateWorkspace({
      preferredCuisineIds: skipCuisines,
      diet: skipDiet,
      budgetWeekly: 55,
      targetCalories: 2200,
      targetProtein: 160,
      excludedIngredientTags: [],
    });

    router.replace('/(tabs)');
  };

  // ─── Step Renderers ────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <View style={styles.stepContainerCenter}>
      <View style={styles.welcomeContent}>
        <View style={{ itemsCenter: 'center', marginBottom: 32 } as any}>
          <View style={styles.welcomeIcon}>
            <FontAwesome5 name="leaf" size={20} color={TOKENS.colors.primary} />
          </View>
          
          <Text style={styles.welcomeTitle}>
            Provision
          </Text>

          <Text style={styles.welcomeSubtitle}>
            Modern taste-led planning that fits your lifestyle.
          </Text>
        </View>

        {/* Feature Pills */}
        <View style={styles.featurePillsContainer}>
          {[
            { icon: 'utensils', label: 'Taste-led' },
            { icon: 'dna', label: 'Diet-smart' },
            { icon: 'calendar-check', label: 'Routine-friendly' },
          ].map(pill => (
            <View key={pill.label} style={styles.featurePill}>
              <FontAwesome5 name={pill.icon as any} size={10} color="#8C9A90" />
              <Text style={styles.featurePillLabel}>{pill.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  const renderStep2 = () => {
    const dietOptions: { label: DietaryBaseline; icon: string; description: string }[] = [
      { label: 'Omnivore', icon: 'drumstick-bite', description: 'Includes meat, fish, dairy, and eggs' },
      { label: 'Pescatarian', icon: 'fish', description: 'No meat, but fish is in' },
      { label: 'Vegetarian', icon: 'carrot', description: 'No meat or fish' },
      { label: 'Vegan', icon: 'leaf', description: 'No animal products' },
    ];
    return (
      <View style={styles.stepContainerCenter}>
        <View style={{ width: '100%', maxWidth: 800 }}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>
              How do you eat?
            </Text>
            <Text style={styles.stepSubtitle}>
              Your dietary baseline ensures everything we plan for you stays compliant.
            </Text>
          </View>

          <View style={styles.cardGrid}>
            {dietOptions.map(option => {
              const isActive = diet === option.label;
              return (
                <TouchableOpacity
                  key={option.label}
                  onPress={() => setDietLocal(option.label)}
                  activeOpacity={0.8}
                  style={[
                    styles.dietCard,
                    { width: width > 768 ? '48.5%' : '100%' },
                    isActive && styles.cardActive
                  ]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={[styles.cardIconBox, isActive && styles.cardIconBoxActive]}>
                      <FontAwesome5 name={option.icon as any} size={18} color={isActive ? TOKENS.colors.primary : '#8C9A90'} />
                    </View>
                    {isActive
                      ? <View style={styles.checkPill}><FontAwesome5 name="check" size={7} color="white" /></View>
                      : <View style={styles.uncheckCircle} />
                    }
                  </View>
                  <Text style={styles.cardTitle}>
                    {option.label}
                  </Text>
                  <Text style={styles.cardDescription}>
                    {option.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const renderStep3 = () => {
    const cuisineOptions = Object.values(CUISINE_PROFILES);
    const cuisineCount = selectedCuisines.length;

    // Responsive column count
    let numCols = 1;
    if (width >= 1024) numCols = 4;
    else if (width >= 640) numCols = 2;

    const chunkArray = (arr: any[], size: number) => {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    };

    const rows = chunkArray(cuisineOptions, numCols);

    return (
      <View style={styles.stepContainerCenter}>
        <View style={{ width: '100%', maxWidth: 1160 }}>
          {/* Header Section */}
          <View style={[styles.stepHeader, { alignItems: width > 768 ? 'flex-start' : 'center' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 6 }}>
              <Text style={styles.stepTitle}>
                Explore your tastes
              </Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {cuisineCount} SELECTED
                </Text>
              </View>
            </View>
            <Text style={styles.stepSubtitle}>
              Pick at least 1 cuisine you'd love to see this week.
            </Text>
          </View>

          {/* Grid Layout */}
          <View style={{ gap: 16 }}>
            {rows.map((row, rowIdx) => (
              <View key={`row-${rowIdx}`} style={{ flexDirection: 'row', gap: 16 }}>
                {row.map(cuisine => {
                  const isActive = selectedCuisines.includes(cuisine.id);
                  const cardIcon = CUISINE_CARD_ICONS[cuisine.id as CuisineId] || 'utensils';
                  
                  return (
                    <View key={cuisine.id} style={{ flex: 1 }}>
                      <TouchableOpacity
                        onPress={() => toggleCuisine(cuisine.id)}
                        activeOpacity={0.8}
                        style={[
                          styles.cuisineCard,
                          isActive && styles.cardActive,
                          { height: 155 }
                        ]}
                      >
                        <View style={styles.cardTopRow}>
                          <View style={[styles.cardIconBox, isActive && styles.cardIconBoxActive]}>
                            <FontAwesome5 name={cardIcon as any} size={16} color={isActive ? TOKENS.colors.primary : '#8C9A90'} />
                          </View>
                          {isActive && (
                            <View style={styles.checkPill}>
                              <FontAwesome5 name="check" size={7} color="white" />
                            </View>
                          )}
                        </View>
                        
                        <View>
                          <Text numberOfLines={1} style={styles.smallCardTitle}>
                            {cuisine.label}
                          </Text>
                          <Text numberOfLines={2} style={styles.smallCardDescription}>
                            {cuisine.description}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                })}
                {row.length < numCols && Array.from({ length: numCols - row.length }).map((_, i) => (
                  <View key={`filler-${i}`} style={{ flex: 1 }} />
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderStep4 = () => (
    <View style={styles.stepContainerCenter}>
      <View style={{ width: '100%', maxWidth: 640 }}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>
            Set your targets
          </Text>
          <Text style={styles.stepSubtitle}>
            These become your default planning guardrails. You can adjust them any time.
          </Text>
        </View>

        <View style={{ gap: 24 }}>
          {/* Budget */}
          <View>
            <Text style={styles.inputLabel}>Weekly food budget</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {BUDGET_PRESETS.map(b => {
                const isActive = budget === b;
                return (
                  <TouchableOpacity
                    key={b}
                    onPress={() => setBudget(b)}
                    style={[
                      styles.presetChip,
                      isActive && styles.presetChipActive
                    ]}
                  >
                    <Text style={[styles.presetChipText, isActive && styles.presetChipTextActive]}>
                      £{b}{b === 70 ? '+' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Calories */}
          <View>
            <Text style={styles.inputLabel}>Daily calorie target</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CALORIE_PRESETS.map(c => {
                const isActive = calorieTarget === c.value;
                return (
                  <TouchableOpacity
                    key={c.value}
                    onPress={() => setCalorieTarget(c.value)}
                    style={[
                      styles.presetCard,
                      isActive && styles.presetCardActive
                    ]}
                  >
                    <Text style={[styles.presetCardLabel, isActive && styles.presetCardLabelActive]}>
                      {c.label}
                    </Text>
                    <Text style={[styles.presetCardValue, isActive && styles.presetCardValueActive]}>
                      {c.value.toLocaleString()} kcal
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Protein */}
          <View>
            <Text style={styles.inputLabel}>Daily protein goal</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PROTEIN_PRESETS.map(p => {
                const isActive = proteinTarget === p.value;
                return (
                  <TouchableOpacity
                    key={p.value}
                    onPress={() => setProteinTarget(p.value)}
                    style={[
                      styles.presetCard,
                      isActive && styles.presetCardActive
                    ]}
                  >
                    <Text style={[styles.presetCardLabel, isActive && styles.presetCardLabelActive]}>
                      {p.label}
                    </Text>
                    <Text style={[styles.presetCardValue, isActive && styles.presetCardValueActive]}>
                      {p.sub}/day
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Exclusions */}
          <View>
            <Text style={styles.inputLabel}>Anything you'd rather avoid?</Text>
            <Text style={styles.inputSubtext}>
              We'll use these to filter ingredients across all cuisines.
            </Text>
            <TextInput
              value={exclusionsRaw}
              onChangeText={setExclusionsRaw}
              placeholder="e.g. mushrooms, blue cheese, chilli"
              placeholderTextColor="#9CA8A1"
              style={styles.textInput}
            />
          </View>
        </View>
      </View>
    </View>
  );

  const renderStep5 = () => {
    const normalizedExclusions = normalizeExclusions(exclusionsRaw);
    return (
      <View style={styles.stepContainerCenter}>
        <View style={{ width: '100%', maxWidth: 560 }}>
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <View style={styles.progressCircleContainer}>
              <View style={[
                styles.progressCircle,
                isSetupComplete ? styles.progressCircleComplete : styles.progressCircleLoading
              ]}>
                {isSetupComplete ? (
                  <FontAwesome5 name="check" size={32} color="white" />
                ) : (
                  <>
                    <ActivityIndicator size="large" color={TOKENS.colors.primary} />
                    <View style={styles.progressCircleOverlay}>
                      <FontAwesome5 name="leaf" size={14} color={TOKENS.colors.primary} />
                    </View>
                  </>
                )}
              </View>
            </View>

            <Text style={styles.loadingTitle}>
              {isSetupComplete ? 'Your plan is ready.' : 'Shaping your week...'}
            </Text>
            <View style={styles.loadingMessagePill}>
              <Text style={[
                styles.loadingMessageText,
                isSetupComplete && { color: TOKENS.colors.primary }
              ]}>
                {loadingMessages[Math.min(loadingStage, loadingMessages.length - 1)]}
              </Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryIconBox}>
                <FontAwesome5 name="fingerprint" size={16} color={TOKENS.colors.primary} />
              </View>
              <View>
                <Text style={styles.summaryBadge}>Provision DNA</Text>
                <Text style={styles.summaryTitleText}>Your Taste Profile</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <SummaryCell label="Cuisine Mix" value={`${selectedCuisines.length} Types`} />
              <SummaryCell label="Baseline" value={diet || 'Omnivore'} bordered />
              <SummaryCell label="Weekly Budget" value={`£${budget}`} top />
              <SummaryCell label="Calorie Target" value={`${calorieTarget.toLocaleString()} kcal`} bordered top />
              <SummaryCell label="Protein Goal" value={`${proteinTarget}g/day`} top />
              {normalizedExclusions.length > 0 && (
                <SummaryCell label="Exclusions" value={normalizedExclusions.join(', ')} bordered top />
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <View>
        <Text style={styles.sidebarBrand}>Provision</Text>
        <Text style={styles.sidebarTagline}>Taste-Led Planning</Text>

        <View style={styles.stepperContainer}>
          {STEP_LABELS.map((s, idx) => {
            const isActive = step === s.number;
            const isCompleted = step > s.number;
            return (
              <View key={s.number}>
                <View style={{ flexDirection: 'row', alignItems: 'center', zIndex: 10 }}>
                  <View style={[
                    styles.stepCircle,
                    isActive && styles.stepCircleActive,
                    isCompleted && styles.stepCircleCompleted
                  ]}>
                    {isCompleted
                      ? <FontAwesome5 name="check" size={10} color={TOKENS.colors.primary} />
                      : <Text style={[styles.stepNumber, isActive && { color: 'white' }]}>{s.number}</Text>
                    }
                  </View>
                  <Text style={[
                    styles.stepLabelText,
                    isActive && styles.stepLabelTextActive,
                    isCompleted && styles.stepLabelTextCompleted
                  ]}>
                    {s.label}
                  </Text>
                </View>
                {idx < STEP_LABELS.length - 1 && (
                  <View style={styles.stepConnector}>
                    <View style={[styles.stepConnectorFill, { height: step > s.number ? '100%' : '0%' }]} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      <TouchableOpacity
        onPress={handleDebugSkip}
        activeOpacity={0.7}
        style={styles.debugSkip}
      >
        <FontAwesome5 name="fast-forward" size={10} color="#8C9A90" style={{ marginRight: 6 }} />
        <Text style={styles.debugSkipText}>Dev Skip</Text>
      </TouchableOpacity>
    </View>
  );

  const ctaDisabled = !canProceed();

  const renderCTA = () => (
    <View style={styles.ctaFooter}>
      <View style={styles.ctaContent}>
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.7}
          style={[
            styles.backButton,
            !(step > 1 && step < 5) && { opacity: 0 }
          ]}
          disabled={!(step > 1 && step < 5)}
        >
          <FontAwesome5 name="arrow-left" size={10} color="#8C9A90" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleNext}
          disabled={ctaDisabled}
          activeOpacity={0.8}
          style={[
            styles.nextButton,
            ctaDisabled ? styles.nextButtonDisabled : styles.nextButtonActive
          ]}
        >
          <Text style={[styles.nextButtonText, ctaDisabled && styles.nextButtonTextDisabled]}>
            {step === 1 ? 'Get started' : step === 5 ? 'See My Plan' : step === 4 ? 'Build My Plan' : 'Continue'}
          </Text>
          {step < 5 && !ctaDisabled && (
            <FontAwesome5 name="arrow-right" size={11} color="white" style={{ marginLeft: 8, marginTop: 1 }} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: TOKENS.colors.background.light }}>
      <View style={{ flex: 1, flexDirection: width > 768 ? 'row' : 'column' }}>
        {width > 768 && renderSidebar()}
        <View style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* Mobile Progress Bar (Top) */}
          {width <= 768 && (
            <View style={styles.mobileProgressBar}>
              {[1, 2, 3, 4, 5].map(i => (
                <View key={i} style={[styles.mobileProgressBit, i <= step ? { backgroundColor: TOKENS.colors.primary } : { backgroundColor: 'rgba(0,0,0,0.04)' }]} />
              ))}
            </View>
          )}

          <ScrollView 
            style={{ flex: 1 }} 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={{ flexGrow: 1 }}
          >
            <View style={[styles.mainScrollContent, { paddingBottom: 120 }]}>
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
              {step === 4 && renderStep4()}
              {step === 5 && renderStep5()}
            </View>
          </ScrollView>

          {renderCTA()}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── UI Components ──────────────────────────────────────────────────────────

function SummaryCell({ label, value, bordered, top }: { label: string; value: string; bordered?: boolean; top?: boolean }) {
  return (
    <View style={[styles.summaryCell, top && { marginTop: 16 }, bordered && styles.summaryCellBordered]}>
      <Text style={styles.summaryCellLabel}>{label}</Text>
      <Text style={styles.summaryCellValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  stepContainerCenter: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  welcomeContent: {
    width: '100%',
    maxWidth: 580,
    alignItems: 'center',
    paddingHorizontal: 24
  },
  welcomeIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: 'rgba(157, 205, 139, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(157, 205, 139, 0.1)'
  },
  welcomeTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    letterSpacing: -1,
    color: TOKENS.colors.text.light.emphasis,
    marginBottom: 12,
    textAlign: 'center'
  },
  welcomeSubtitle: {
    fontSize: 18,
    fontWeight: '500',
    color: TOKENS.colors.text.light.muted,
    lineHeight: 24,
    maxWidth: 400,
    textAlign: 'center'
  },
  featurePillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 32,
    marginTop: 8,
    opacity: 0.55
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  featurePillLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: TOKENS.colors.text.light.emphasis,
    textTransform: 'uppercase',
    letterSpacing: 2
  },
  stepHeader: {
    marginBottom: 32,
    paddingHorizontal: 8
  },
  stepTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: -0.5,
    color: TOKENS.colors.text.light.emphasis,
    marginBottom: 8
  },
  stepSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: TOKENS.colors.text.light.muted,
    lineHeight: 22,
    maxWidth: 500
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16
  },
  dietCard: {
    padding: 24,
    borderRadius: 28,
    borderWidth: 1,
    backgroundColor: 'white',
    borderColor: 'rgba(0, 0, 0, 0.04)'
  },
  cardActive: {
    backgroundColor: 'rgba(157, 205, 139, 0.03)',
    borderColor: 'rgba(157, 205, 139, 0.4)',
    transform: [{ scale: 0.99 }]
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  cardIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.04)'
  },
  cardIconBoxActive: {
    backgroundColor: 'rgba(157, 205, 139, 0.2)'
  },
  checkPill: {
    backgroundColor: 'rgba(157, 205, 139, 0.4)',
    borderRadius: 10,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  uncheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.08)'
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: -0.2,
    marginBottom: 6,
    color: TOKENS.colors.text.light.emphasis
  },
  cardDescription: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: TOKENS.colors.text.light.muted
  },
  badge: {
    backgroundColor: 'rgba(157, 205, 139, 0.1)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(157, 205, 139, 0.2)',
    marginBottom: 12
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: TOKENS.colors.primary
  },
  cuisineCard: {
    padding: 20,
    borderRadius: 32,
    borderWidth: 1,
    backgroundColor: 'white',
    borderColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'space-between'
  },
  smallCardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: -0.2,
    marginBottom: 2,
    color: TOKENS.colors.text.light.emphasis
  },
  smallCardDescription: {
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 18,
    color: TOKENS.colors.text.light.muted
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: TOKENS.colors.text.light.muted,
    marginBottom: 12
  },
  inputSubtext: {
    fontSize: 12,
    color: 'rgba(148, 163, 184, 0.7)',
    marginBottom: 12
  },
  presetChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'white',
    borderColor: 'rgba(0, 0, 0, 0.06)'
  },
  presetChipActive: {
    backgroundColor: 'rgba(157, 205, 139, 0.08)',
    borderColor: 'rgba(157, 205, 139, 0.4)'
  },
  presetChipText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: TOKENS.colors.text.light.emphasis
  },
  presetChipTextActive: {
    color: TOKENS.colors.primary
  },
  presetCard: {
    flex: 1,
    minWidth: 100,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'white',
    borderColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center'
  },
  presetCardActive: {
    backgroundColor: 'rgba(157, 205, 139, 0.08)',
    borderColor: 'rgba(157, 205, 139, 0.4)'
  },
  presetCardLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TOKENS.colors.text.light.emphasis
  },
  presetCardLabelActive: {
    color: TOKENS.colors.primary
  },
  presetCardValue: {
    fontSize: 11,
    marginTop: 2,
    color: TOKENS.colors.text.light.muted
  },
  presetCardValueActive: {
    color: 'rgba(157, 205, 139, 0.7)'
  },
  textInput: {
    width: '100%',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 15,
    fontWeight: '500',
    color: TOKENS.colors.text.light.emphasis
  },
  progressCircleContainer: {
    position: 'relative',
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  progressCircle: {
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  progressCircleLoading: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)'
  },
  progressCircleComplete: {
    width: 96,
    height: 96,
    backgroundColor: TOKENS.colors.primary,
    shadowColor: TOKENS.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12
  },
  progressCircleOverlay: {
    position: 'absolute',
    width: 32,
    height: 32,
    backgroundColor: 'white',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)'
  },
  loadingTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: -0.5,
    color: TOKENS.colors.text.light.emphasis,
    marginBottom: 16,
    textAlign: 'center'
  },
  loadingMessagePill: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)'
  },
  loadingMessageText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    color: 'rgba(0, 0, 0, 0.7)'
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 32,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    position: 'relative',
    overflow: 'hidden'
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.04)',
    paddingBottom: 20
  },
  summaryIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(157, 205, 139, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  summaryBadge: {
    fontSize: 11,
    fontWeight: '900',
    color: 'rgba(148, 163, 184, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 2
  },
  summaryTitleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TOKENS.colors.text.light.emphasis,
    letterSpacing: -0.2
  },
  summaryCell: {
    width: '50%'
  },
  summaryCellBordered: {
    paddingLeft: 16,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(0, 0, 0, 0.03)'
  },
  summaryCellLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: TOKENS.colors.text.light.muted,
    marginBottom: 4
  },
  summaryCellValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TOKENS.colors.text.light.emphasis,
    lineHeight: 20
  },
  sidebar: {
    width: 280,
    borderRightWidth: 1,
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    backgroundColor: 'white',
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 32,
    justifyContent: 'space-between'
  },
  sidebarBrand: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: -1,
    color: TOKENS.colors.text.light.emphasis,
    marginBottom: 2
  },
  sidebarTagline: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: TOKENS.colors.primary
  },
  stepperContainer: {
    marginTop: 48,
    paddingLeft: 4
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)'
  },
  stepCircleActive: {
    backgroundColor: TOKENS.colors.primary,
    borderColor: TOKENS.colors.primary,
    shadowColor: TOKENS.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3
  },
  stepCircleCompleted: {
    backgroundColor: 'rgba(157, 205, 139, 0.1)',
    borderColor: 'transparent'
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: 'bold',
    color: 'rgba(148, 163, 184, 0.6)'
  },
  stepLabelText: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: -0.2,
    color: 'rgba(148, 163, 184, 0.4)'
  },
  stepLabelTextActive: {
    color: TOKENS.colors.text.light.emphasis
  },
  stepLabelTextCompleted: {
    color: 'rgba(0, 0, 0, 0.7)'
  },
  stepConnector: {
    marginLeft: 13,
    width: 2,
    height: 22,
    marginVertical: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    position: 'relative'
  },
  stepConnectorFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    backgroundColor: TOKENS.colors.primary
  },
  debugSkip: {
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.4
  },
  debugSkipText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: TOKENS.colors.text.light.muted
  },
  ctaFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    zIndex: 50
  },
  ctaContent: {
    maxWidth: 980,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'center'
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)'
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TOKENS.colors.text.light.emphasis,
    marginLeft: 8
  },
  nextButton: {
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row'
  },
  nextButtonActive: {
    backgroundColor: TOKENS.colors.primary,
    shadowColor: TOKENS.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4
  },
  nextButtonDisabled: {
    backgroundColor: 'rgba(0,0,0,0.04)'
  },
  nextButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: -0.2,
    color: 'white'
  },
  nextButtonTextDisabled: {
    color: 'rgba(148, 163, 184, 0.5)'
  },
  mobileProgressBar: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
    backgroundColor: 'white',
    zIndex: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)'
  },
  mobileProgressBit: {
    flex: 1,
    height: 4,
    borderRadius: 2
  },
  mainScrollContent: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 32
  }
});
