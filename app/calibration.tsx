import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, TextInput, ActivityIndicator, useWindowDimensions } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useActivePlan } from '../data/ActivePlanContext';
import { DietaryBaseline, CuisineId, CUISINE_PROFILES } from '../data/planner/plannerTypes';

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
    <View className="flex-1 w-full items-center justify-center">
      <View className="w-full max-w-[580px] items-center text-center px-6">
        <View className="items-center mb-8">
          <View className="w-14 h-14 rounded-[20px] bg-primary/10 dark:bg-primary/20 items-center justify-center mb-6 shadow-sm border border-primary/10">
            <FontAwesome5 name="leaf" size={20} color="#9DCD8B" />
          </View>
          
          <Text className="text-[34px] md:text-[44px] font-bold tracking-tight text-textMain dark:text-darktextMain leading-none mb-3">
            Provision
          </Text>

          <Text className="text-[18px] md:text-[21px] font-medium text-textSec dark:text-darktextSec leading-snug max-w-[400px] text-center">
            Modern taste-led planning that fits your lifestyle.
          </Text>
        </View>

        {/* Feature Pills - Subtle but Legible Supporting Elements */}
        <View className="flex-row flex-wrap justify-center gap-x-8 gap-y-3 mt-2 opacity-[0.55]">
          {[
            { icon: 'utensils', label: 'Taste-led' },
            { icon: 'dna', label: 'Diet-smart' },
            { icon: 'calendar-check', label: 'Routine-friendly' },
          ].map(pill => (
            <View key={pill.label} className="flex-row items-center gap-2.5">
              <FontAwesome5 name={pill.icon as any} size={10} color="#8C9A90" />
              <Text className="text-[11px] font-bold text-textMain dark:text-darktextMain uppercase tracking-[0.2em]">{pill.label}</Text>
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
      <View className="flex-1 w-full items-center justify-center">
        <View className="w-full max-w-[800px]">
          <View className="mb-8 items-center md:items-start">
            <Text className="text-[32px] md:text-[40px] font-bold tracking-tight text-textMain dark:text-darktextMain mb-2">
              How do you eat?
            </Text>
            <Text className="text-[15px] md:text-[17px] font-medium text-textSec dark:text-darktextSec leading-relaxed max-w-[500px]">
              Your dietary baseline ensures everything we plan for you stays compliant.
            </Text>
          </View>

          <View className="flex-row flex-wrap justify-between gap-y-4">
            {dietOptions.map(option => {
              const isActive = diet === option.label;
              return (
                <TouchableOpacity
                  key={option.label}
                  onPress={() => setDietLocal(option.label)}
                  activeOpacity={0.8}
                  className={`p-6 md:p-7 rounded-[28px] w-full md:w-[48.8%] border transition-all ${
                    isActive
                      ? 'bg-primary/[0.03] dark:bg-primary/10 border-primary/40 shadow-sm scale-[0.99]'
                      : 'bg-surface dark:bg-darksurface border-black/[0.04] dark:border-white/5 hover:border-black/10 dark:hover:border-white/10'
                  }`}
                >
                  <View className="flex-row justify-between items-center mb-4">
                    <View className={`w-12 h-12 rounded-[16px] items-center justify-center ${isActive ? 'bg-primary/20 dark:bg-primary/30' : 'bg-black/[0.04] dark:bg-white/[0.04]'}`}>
                      <FontAwesome5 name={option.icon as any} size={18} color={isActive ? '#9DCD8B' : '#8C9A90'} />
                    </View>
                    {isActive
                      ? <View className="bg-primary/40 rounded-full w-4 h-4 items-center justify-center shadow-sm"><FontAwesome5 name="check" size={7} color="white" /></View>
                      : <View className="w-6 h-6 rounded-full border-2 border-black/[0.08] dark:border-white/10" />
                    }
                  </View>
                  <Text className="text-[20px] md:text-[22px] font-bold tracking-tight mb-1.5 text-textMain dark:text-darktextMain">
                    {option.label}
                  </Text>
                  <Text className="font-medium text-[14px] leading-relaxed text-textSec dark:text-darktextSec">
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

    // Responsive column count based on width - Favouring readability over strict 5-column symmetry
    let numCols = 1;
    if (width >= 1600) numCols = 5;
    else if (width >= 1024) numCols = 4; // 4 columns is standard desktop default for better breathing room
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
      <View className="flex-1 w-full flex-col justify-center py-2">
        <View className="w-full max-w-[1160px] mx-auto">
          {/* Header Section */}
          <View className="mb-6 items-center md:items-start px-2">
            <View className="flex-row items-end gap-x-3 mb-1.5">
              <Text className="text-[30px] md:text-[38px] tracking-tight font-bold text-textMain dark:text-darktextMain">
                Explore your tastes
              </Text>
              <View className="mb-2 md:mb-3 flex-row items-center bg-primary/10 dark:bg-primary/20 rounded-full px-2.5 py-0.5 border border-primary/20">
                <Text className="font-bold text-[11px] text-primary dark:text-[#85B674]">
                  {cuisineCount} SELECTED
                </Text>
              </View>
            </View>
            <Text className="text-[14px] md:text-[16px] font-medium text-textSec dark:text-darktextSec leading-relaxed">
              Pick at least 1 cuisine you'd love to see this week.
            </Text>
          </View>

          {/* Grid Layout - Row-based Flex (Reliable Breakpoint Handling) */}
          <View className="gap-y-4 md:gap-y-5 px-2">
            {rows.map((row, rowIdx) => (
              <View key={`row-${rowIdx}`} className="flex-row gap-4 md:gap-5">
                {row.map(cuisine => {
                  const isActive = selectedCuisines.includes(cuisine.id);
                  const cardIcon = CUISINE_CARD_ICONS[cuisine.id as CuisineId] || 'utensils';
                  
                  return (
                    <View key={cuisine.id} className="flex-1">
                      <TouchableOpacity
                        onPress={() => toggleCuisine(cuisine.id)}
                        activeOpacity={0.8}
                        className={`p-5 md:p-6 rounded-[32px] border transition-all flex-col justify-between h-[155px] lg:h-[145px] ${
                          isActive
                            ? 'bg-primary/[0.03] dark:bg-primary/[0.05] border-primary/40 shadow-sm scale-[0.98]'
                            : 'bg-surface dark:bg-darksurface border-black/[0.05] dark:border-white/5 hover:border-black/10'
                        }`}
                      >
                        <View className="flex-row justify-between items-start">
                          <View className={`w-10 h-10 rounded-xl items-center justify-center ${isActive ? 'bg-primary/20 dark:bg-primary/30' : 'bg-black/[0.04] dark:bg-white/[0.04]'}`}>
                            <FontAwesome5 name={cardIcon as any} size={16} color={isActive ? '#9DCD8B' : '#8C9A90'} />
                          </View>
                          {isActive && (
                            <View className="bg-primary/40 dark:bg-primary/50 rounded-full w-4 h-4 items-center justify-center shadow-sm">
                              <FontAwesome5 name="check" size={7} color="white" />
                            </View>
                          )}
                        </View>
                        
                        <View>
                          <Text 
                            numberOfLines={1}
                            className="text-[17px] md:text-[18px] font-bold tracking-tight mb-0.5 text-textMain dark:text-darktextMain"
                          >
                            {cuisine.label}
                          </Text>
                          <Text 
                            numberOfLines={2}
                            className="font-medium text-[12.5px] leading-snug text-textSec dark:text-darktextSec"
                          >
                            {cuisine.description}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                })}
                {/* Visual filler to keep flex rows aligned if row is not full */}
                {row.length < numCols && Array.from({ length: numCols - row.length }).map((_, i) => (
                  <View key={`filler-${i}`} className="flex-1" />
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderStep4 = () => (
    <View className="flex-1 w-full items-center justify-center">
      <View className="w-full max-w-[640px]">
        <View className="mb-8 items-center md:items-start">
          <Text className="text-[32px] md:text-[40px] font-bold tracking-tight text-textMain dark:text-darktextMain mb-2">
            Set your targets
          </Text>
          <Text className="text-[15px] md:text-[17px] font-medium text-textSec dark:text-darktextSec leading-relaxed">
            These become your default planning guardrails. You can adjust them any time.
          </Text>
        </View>

        <View className="gap-y-6">
          <View>
            <Text className="text-[11px] font-bold uppercase tracking-[0.15em] text-textSec dark:text-darktextSec mb-3">
              Weekly food budget
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {BUDGET_PRESETS.map(b => {
                const isActive = budget === b;
                return (
                  <TouchableOpacity
                    key={b}
                    onPress={() => setBudget(b)}
                    className={`px-5 py-3 rounded-2xl border transition-all ${
                      isActive
                        ? 'bg-primary/[0.08] dark:bg-primary/20 border-primary/40 scale-[0.98]'
                        : 'bg-surface dark:bg-darksurface border-black/[0.06] dark:border-white/[0.06]'
                    }`}
                  >
                    <Text className={`font-bold text-[15px] ${isActive ? 'text-textMain dark:text-[#85B674]' : 'text-textMain dark:text-darktextMain'}`}>
                      £{b}{b === 70 ? '+' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View>
            <Text className="text-[11px] font-bold uppercase tracking-[0.15em] text-textSec dark:text-darktextSec mb-3">
              Daily calorie target
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {CALORIE_PRESETS.map(c => {
                const isActive = calorieTarget === c.value;
                return (
                  <TouchableOpacity
                    key={c.value}
                    onPress={() => setCalorieTarget(c.value)}
                    className={`flex-1 min-w-[100px] px-4 py-3.5 rounded-2xl border items-center transition-all ${
                      isActive
                        ? 'bg-primary/[0.08] dark:bg-primary/20 border-primary/40 scale-[0.98]'
                        : 'bg-surface dark:bg-darksurface border-black/[0.06] dark:border-white/[0.06]'
                    }`}
                  >
                    <Text className={`font-bold text-[14px] ${isActive ? 'text-textMain dark:text-[#85B674]' : 'text-textMain dark:text-darktextMain'}`}>
                      {c.label}
                    </Text>
                    <Text className={`text-[11px] mt-0.5 ${isActive ? 'text-textSec dark:text-[#85B674]/70' : 'text-textSec dark:text-darktextSec'}`}>
                      {c.value.toLocaleString()} kcal
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View>
            <Text className="text-[11px] font-bold uppercase tracking-[0.15em] text-textSec dark:text-darktextSec mb-3">
              Daily protein goal
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {PROTEIN_PRESETS.map(p => {
                const isActive = proteinTarget === p.value;
                return (
                  <TouchableOpacity
                    key={p.value}
                    onPress={() => setProteinTarget(p.value)}
                    className={`flex-1 min-w-[100px] px-4 py-3.5 rounded-2xl border items-center transition-all ${
                      isActive
                        ? 'bg-primary/[0.08] dark:bg-primary/20 border-primary/40 scale-[0.98]'
                        : 'bg-surface dark:bg-darksurface border-black/[0.06] dark:border-white/[0.06]'
                    }`}
                  >
                    <Text className={`font-bold text-[14px] ${isActive ? 'text-textMain dark:text-[#85B674]' : 'text-textMain dark:text-darktextMain'}`}>
                      {p.label}
                    </Text>
                    <Text className={`text-[11px] mt-0.5 ${isActive ? 'text-textSec dark:text-[#85B674]/70' : 'text-textSec dark:text-darktextSec'}`}>
                      {p.sub}/day
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View>
            <Text className="text-[11px] font-bold uppercase tracking-[0.15em] text-textSec dark:text-darktextSec mb-1">
              Anything you'd rather avoid?
            </Text>
            <Text className="text-[12px] text-textSec/70 dark:text-darktextSec/70 mb-3">
              We'll use these to filter ingredients across all cuisines.
            </Text>
            <TextInput
              value={exclusionsRaw}
              onChangeText={setExclusionsRaw}
              placeholder="e.g. mushrooms, blue cheese, chilli"
              placeholderTextColor="#9CA8A1"
              className="w-full bg-surface dark:bg-darksurface border border-black/[0.06] dark:border-white/[0.06] rounded-2xl px-5 py-4 text-[15px] text-textMain dark:text-darktextMain font-medium"
            />
          </View>
        </View>
      </View>
    </View>
  );

  const renderStep5 = () => {
    const normalizedExclusions = normalizeExclusions(exclusionsRaw);
    return (
      <View className="flex-1 w-full items-center justify-center">
        <View className="w-full max-w-[560px]">
          <View className="items-center mb-10">
            <View className="relative mb-5 items-center justify-center">
              <View
                style={{ width: isSetupComplete ? 96 : 80, height: isSetupComplete ? 96 : 80 }}
                className={`rounded-full items-center justify-center relative transition-all duration-700 ${
                  isSetupComplete
                    ? 'bg-primary shadow-[0_4px_12px_rgba(157,205,139,0.25)] dark:shadow-none'
                    : 'bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/10'
                }`}
              >
                {isSetupComplete ? (
                  <FontAwesome5 name="check" size={32} color="white" />
                ) : (
                  <>
                    <ActivityIndicator size="large" color="#9DCD8B" />
                    <View className="absolute w-8 h-8 bg-surface dark:bg-[#2A332E] rounded-full items-center justify-center shadow-sm border border-black/[0.04] dark:border-white/10">
                      <FontAwesome5 name="leaf" size={14} color="#9DCD8B" />
                    </View>
                  </>
                )}
              </View>
            </View>

            <Text className="text-[28px] md:text-[34px] font-bold text-textMain dark:text-darktextMain tracking-tight mb-4 text-center">
              {isSetupComplete ? 'Your plan is ready.' : 'Shaping your week...'}
            </Text>
            <View className="min-h-[32px] justify-center mb-0 px-5 bg-black/[0.03] dark:bg-white/[0.04] rounded-full border border-black/[0.04] dark:border-white/5 mx-auto">
              <Text className={`font-semibold text-[13px] text-center transition-colors duration-300 ${isSetupComplete ? 'text-primary dark:text-[#85B674]' : 'text-textMain/70 dark:text-darktextMain/70'}`}>
                {loadingMessages[Math.min(loadingStage, loadingMessages.length - 1)]}
              </Text>
            </View>
          </View>

          <View className="w-full bg-surface dark:bg-darksurface rounded-[32px] p-7 md:p-8 shadow-[0_2px_16px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/[0.04] dark:border-white/5 overflow-hidden relative">
            <View className="absolute -top-10 -right-10 w-40 h-40 bg-sageTint/40 dark:bg-darksageTint/20 rounded-full" style={{ filter: 'blur(40px)' } as any} />

            <View className="flex-row items-center mb-6 border-b border-black/[0.04] dark:border-white/5 pb-5">
              <View className="w-10 h-10 rounded-[14px] bg-primary/10 dark:bg-primary/20 items-center justify-center mr-4">
                <FontAwesome5 name="fingerprint" size={16} color="#9DCD8B" />
              </View>
              <View>
                <Text className="text-[11px] font-bold text-textSec/60 dark:text-darktextSec/60 uppercase tracking-[0.15em] mb-0.5">Provision DNA</Text>
                <Text className="text-textMain dark:text-darktextMain font-bold text-[18px] tracking-tight">Your Taste Profile</Text>
              </View>
            </View>

            <View className="flex-row flex-wrap">
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
    <View className="md:w-1/4 md:min-w-[260px] md:max-w-[300px] md:border-r md:border-softBorder dark:md:border-white/5 bg-surface dark:bg-darksurface pt-6 md:pt-12 pb-8 md:pb-12 px-6 md:px-8 flex-col justify-between z-10 shadow-sm md:shadow-none">
      <View>
        <Text className="text-textMain dark:text-darktextMain text-[24px] md:text-[28px] font-bold tracking-tight mb-0.5">Provision</Text>
        <Text className="text-primary dark:text-[#85B674] text-[10px] font-bold uppercase tracking-[0.15em]">Taste-Led Planning</Text>

        <View className="hidden md:flex mt-12 pl-1 pr-4 relative">
          {STEP_LABELS.map((s, idx) => {
            const isActive = step === s.number;
            const isCompleted = step > s.number;
            return (
              <View key={s.number}>
                <View className="flex-row items-center relative z-10">
                  <View className={`w-[28px] h-[28px] rounded-full flex items-center justify-center mr-3.5 transition-colors duration-300 ${
                    isActive ? 'bg-primary dark:bg-[#85B674] shadow-[0_2px_8px_rgba(157,205,139,0.25)]' :
                    isCompleted ? 'bg-sageTint dark:bg-darksageTint' :
                    'bg-appBg dark:bg-darkgrey border border-softBorder dark:border-white/5'
                  }`}>
                    {isCompleted
                      ? <FontAwesome5 name="check" size={10} color="#9DCD8B" />
                      : <Text className={`text-[11px] font-bold ${isActive ? 'text-white' : 'text-textSec/60 dark:text-darktextSec/60'}`}>{s.number}</Text>
                    }
                  </View>
                  <Text className={`text-[14px] font-bold tracking-tight transition-colors duration-300 ${
                    isActive ? 'text-textMain dark:text-darktextMain' :
                    isCompleted ? 'text-textMain/70 dark:text-darktextMain/70' :
                    'text-textSec/40 dark:text-darktextSec/40'
                  }`}>
                    {s.label}
                  </Text>
                </View>
                {idx < STEP_LABELS.length - 1 && (
                  <View className="ml-[13px] w-[2px] h-[22px] my-0.5 bg-black/[0.04] dark:bg-white/[0.04] relative z-0">
                    <View className="absolute top-0 left-0 w-full bg-primary transition-all duration-500" style={{ height: step > s.number ? '100%' : '0%' } as any} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      <TouchableOpacity
        onPress={handleDebugSkip}
        className="hidden md:flex flex-row items-center opacity-40 hover:opacity-90 transition-opacity self-start py-2"
      >
        <FontAwesome5 name="fast-forward" size={10} color="#8C9A90" style={{ marginRight: 6 }} />
        <Text className="text-[10px] font-bold text-textSec dark:text-[#6E7C74] uppercase tracking-widest">Dev Skip</Text>
      </TouchableOpacity>
    </View>
  );

  const ctaDisabled = !canProceed();

  const renderCTA = () => (
    <View
      className="px-6 py-4 md:px-10 md:py-5 border-t border-black/[0.05] dark:border-white/5 bg-surface/95 dark:bg-darksurface/95 absolute bottom-0 w-full left-0 z-50 shadow-[0_-2px_16px_rgba(0,0,0,0.02)]"
      style={{ backdropFilter: 'blur(12px)' } as any}
    >
      <View className="mx-auto w-full max-w-[980px] flex-row items-center justify-between">
        <TouchableOpacity
          onPress={handleBack}
          className={`flex-row items-center gap-2 py-2.5 px-6 rounded-full transition-all border border-black/[0.06] dark:border-white/[0.06] ${step > 1 && step < 5 ? 'opacity-100 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]' : 'opacity-0 pointer-events-none'}`}
        >
          <FontAwesome5 name="arrow-left" size={10} color="#8C9A90" />
          <Text className="text-[14px] font-bold text-textMain dark:text-darktextMain ml-1">Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleNext}
          disabled={ctaDisabled}
          className={`rounded-full py-3 px-10 md:py-3.5 md:px-12 items-center justify-center transition-all flex-row ml-auto ${
            ctaDisabled
              ? 'bg-black/[0.04] dark:bg-white/[0.05]'
              : 'bg-primary hover:bg-primary-hover active:scale-[0.98] shadow-[0_4px_12px_rgba(157,205,139,0.25)]'
          }`}
        >
          <Text className={`text-[15px] font-bold tracking-tight ${ctaDisabled ? 'text-textSec/50 dark:text-darktextSec/50' : 'text-white'}`}>
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
    <SafeAreaView className="flex-1 bg-appBg dark:bg-darkappBg">
      <View className="flex-1 md:flex-row">
        {renderSidebar()}
        <View className="flex-1 relative bg-appBg dark:bg-darkappBg overflow-hidden md:min-h-0">
          {/* Mobile Progress Bar */}
          <View className="flex-row gap-1 md:hidden px-6 pt-5 pb-2 bg-surface dark:bg-darksurface z-20 shadow-sm border-b border-black/[0.04] dark:border-white/5">
            {[1, 2, 3, 4, 5].map(i => (
              <View key={i} className={`flex-1 h-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-black/[0.04] dark:bg-white/[0.05]'}`} />
            ))}
          </View>

          <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
            <View className="flex-1 w-full items-center justify-center px-4 md:px-8 pb-24 md:pb-28">
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
    <View className={`w-1/2 ${top ? 'mt-4' : ''} ${bordered ? 'pl-4 border-l border-black/[0.03] dark:border-white/5' : ''}`}>
      <Text className="text-textSec dark:text-darktextSec text-[10px] font-bold uppercase tracking-widest mb-1">{label}</Text>
      <Text className="text-textMain dark:text-darktextMain font-bold text-[16px] leading-snug">{value}</Text>
    </View>
  );
}
