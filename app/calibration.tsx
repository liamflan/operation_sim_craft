import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { FULL_RECIPE_LIST } from '../data/planner/recipeRegistry';
import { useActivePlan } from '../data/ActivePlanContext';
import { DietaryBaseline } from '../data/planner/plannerTypes';
import { isRecipeAllowedForBaselineDiet } from '../data/planner/dietRules';

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
  { number: 3, label: 'Taste Profile' },
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

// ─── Component ───────────────────────────────────────────────────────────────

export default function CalibrationScreen() {
  const router = useRouter();
  const { 
    regenerateWorkspace, 
    workspace, 
    updateUserDiet, 
    updateProtein, 
    updateVibes, 
    updateExclusions, 
    updateBudget, 
    updateCalories 
  } = useActivePlan();

  const [step, setStep] = useState(1);

  // Step 2
  const [diet, setDietLocal] = useState<DietaryBaseline | null>(null);

  // Step 3
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);

  // Step 4
  const [budget, setBudget] = useState<number>(50);
  const [calorieTarget, setCalorieTarget] = useState<CaloriePreset>(2000);
  const [proteinTarget, setProteinTarget] = useState<ProteinPreset>(160);
  const [exclusionsRaw, setExclusionsRaw] = useState<string>('');

  // Step 5
  const [loadingStage, setLoadingStage] = useState(0);

  // Guard: fire regenerateWorkspace exactly once per calibration session when user reaches step 5.
  // We deliberately do NOT gate on workspace.status === 'idle' because a returning user will
  // have status = 'ready' from hydration — that old guard caused workspace.input to stay null,
  // preventing budget/diet from propagating to the dashboard.
  const hasTriggeredGeneration = React.useRef(false);

  const loadingMessages = [
    'Learning your taste profile...',
    'Matching meals to your goals and budget...',
    'Balancing protein and spend...',
    'Shaping your weekly plan...',
    'Your first plan is ready',
  ];
  const isSetupComplete = loadingStage >= loadingMessages.length - 1 && workspace.status === 'ready';

  // ─── Effects ───────────────────────────────────────────────────────────────

  // Trigger generation when entering step 5 — always fires, once per session
  useEffect(() => {
    if (step === 5 && !hasTriggeredGeneration.current) {
      hasTriggeredGeneration.current = true;
      const finalDiet = diet || 'Omnivore';
      updateUserDiet(finalDiet);
      regenerateWorkspace({
        selectedVibes,
        diet: finalDiet,
        budgetWeekly: budget,
        targetCalories: calorieTarget,
        targetProtein: proteinTarget,
        profileExclusions: normalizeExclusions(exclusionsRaw),
      });
    }
  }, [step]);

  // Animate loading messages on step 5
  useEffect(() => {
    if (step === 5 && !isSetupComplete) {
      const timer = setTimeout(() => setLoadingStage(prev => prev + 1), 1500);
      return () => clearTimeout(timer);
    }
  }, [step, loadingStage, isSetupComplete]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const toggleVibe = (id: string) =>
    setSelectedVibes(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );

  const canProceed = () => {
    if (step === 2) return !!diet;
    if (step === 3) return selectedVibes.length >= 1;
    if (step === 5) return isSetupComplete;
    return true; // steps 1 and 4 always allow proceed
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
    const skipVibes = [FULL_RECIPE_LIST[0].id, FULL_RECIPE_LIST[1].id, FULL_RECIPE_LIST[2].id];
    setSelectedVibes(skipVibes);
    const skipDiet = 'Omnivore';
    setDietLocal(skipDiet);

    // Propagate baseline state to context
    updateUserDiet(skipDiet);
    updateVibes(skipVibes);
    updateBudget(55);
    updateCalories(2200);
    updateProtein(160);
    updateExclusions([]);

    router.replace('/(tabs)');
  };

  // ─── Step Renderers ────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <View className="flex-1 w-full items-center justify-center">
      <View className="w-full max-w-[560px] items-center text-center px-2">

        {/* Wordmark */}
        <View className="mb-8 items-center">
          <View className="w-14 h-14 rounded-[18px] bg-primary/10 dark:bg-primary/20 items-center justify-center mb-5 shadow-sm">
            <FontAwesome5 name="leaf" size={22} color="#9DCD8B" />
          </View>
          <Text className="text-[42px] md:text-[52px] font-bold tracking-tight text-textMain dark:text-darktextMain leading-none mb-2">
            Provision
          </Text>
          <Text className="text-[18px] md:text-[20px] font-medium text-textSec dark:text-darktextSec leading-snug max-w-[360px] text-center">
            Taste-led meal planning that actually fits your week.
          </Text>
        </View>

        {/* Benefit pills */}
        <View className="flex-row flex-wrap justify-center gap-2 mb-10">
          {[
            { icon: 'piggy-bank', label: 'Budget-aware' },
            { icon: 'dna', label: 'Diet-smart' },
            { icon: 'random', label: 'Varied' },
          ].map(pill => (
            <View
              key={pill.label}
              className="flex-row items-center gap-2 px-4 py-2.5 bg-surface dark:bg-darksurface rounded-full border border-black/[0.05] dark:border-white/[0.06] shadow-sm"
            >
              <FontAwesome5 name={pill.icon as any} size={11} color="#9DCD8B" />
              <Text className="text-[13px] font-semibold text-textMain dark:text-darktextMain">{pill.label}</Text>
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
        <View className="w-full max-w-[860px]">
          <View className="mb-8 md:mb-10 items-center md:items-start">
            <Text className="text-[32px] md:text-[44px] font-bold tracking-tight text-textMain dark:text-darktextMain mb-2 md:mb-3">
              How do you eat?
            </Text>
            <Text className="text-[15px] md:text-[17px] font-medium text-textSec dark:text-darktextSec leading-relaxed max-w-[500px]">
              We use this as the baseline rule for everything we plan for you.
            </Text>
          </View>

          <View className="flex-row flex-wrap justify-between gap-y-4 md:gap-y-5">
            {dietOptions.map(option => {
              const isActive = diet === option.label;
              return (
                <TouchableOpacity
                  key={option.label}
                  testID={`calibration-diet-card-${option.label.toLowerCase()}`}
                  onPress={() => {
                    const newDiet = option.label;
                    setDietLocal(newDiet);
                    updateUserDiet(newDiet);
                    // Prune incompatible selected vibes immediately
                    setSelectedVibes(prev =>
                      prev.filter(vibeId => {
                        const recipe = FULL_RECIPE_LIST.find(r => r.id === vibeId);
                        return recipe ? isRecipeAllowedForBaselineDiet(recipe, newDiet) : false;
                      })
                    );
                  }}
                  activeOpacity={0.8}
                  className={`p-6 md:p-7 rounded-[28px] w-full md:w-[48.5%] border transition-all ${
                    isActive
                      ? 'bg-primary/5 dark:bg-primary/10 border-primary shadow-sm scale-[0.99]'
                      : 'bg-surface dark:bg-darksurface border-black/[0.04] dark:border-white/5 hover:border-black/10 dark:hover:border-white/10 hover:shadow-sm active:scale-[0.99]'
                  }`}
                >
                  <View className="flex-row justify-between items-center mb-4">
                    <View className={`w-12 h-12 rounded-[16px] items-center justify-center ${isActive ? 'bg-primary/10 dark:bg-primary/20' : 'bg-black/[0.04] dark:bg-white/[0.04]'}`}>
                      <FontAwesome5 name={option.icon as any} size={18} color={isActive ? '#9DCD8B' : '#8C9A90'} />
                    </View>
                    {isActive
                      ? <View className="bg-primary rounded-full w-6 h-6 items-center justify-center shadow-sm"><FontAwesome5 name="check" size={10} color="white" /></View>
                      : <View className="w-6 h-6 rounded-full border-2 border-black/[0.08] dark:border-white/10" />
                    }
                  </View>
                  <Text className={`text-[20px] md:text-[22px] font-bold tracking-tight mb-1.5 ${isActive ? 'text-primary dark:text-[#85B674]' : 'text-textMain dark:text-darktextMain'}`}>
                    {option.label}
                  </Text>
                  <Text className={`font-medium text-[14px] leading-relaxed ${isActive ? 'text-textMain/80 dark:text-darktextMain/80' : 'text-textSec dark:text-darktextSec'}`}>
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
    const filteredRecipes = FULL_RECIPE_LIST.filter(
      r => r.libraryVisible && r.plannerUsable && isRecipeAllowedForBaselineDiet(r, workspace.userDiet)
    ).slice(0, 15);

    const vibeCount = selectedVibes.length;

    return (
      <View className="flex-1 w-full items-center justify-center relative">
        <View className="w-full max-w-[940px]">
          <View className="mb-6 md:mb-8 items-center md:items-start">
            <Text className="text-[32px] md:text-[44px] tracking-tight font-bold text-textMain dark:text-darktextMain mb-2 md:mb-3">
              What sounds good this week?
            </Text>
            <Text className="text-[15px] md:text-[17px] font-medium text-textSec dark:text-darktextSec mb-5 leading-relaxed max-w-[500px]">
              Pick a few meals you'd actually eat. We use this as a taste anchor. Just 1 is enough.
            </Text>

            {/* Selection counter pill */}
            <View className="flex-row items-center bg-black/[0.03] dark:bg-white/[0.03] rounded-full p-1 border border-black/[0.04] dark:border-white/5 pr-4">
              <View className={`px-4 py-2 rounded-full ${vibeCount >= 1 ? 'bg-primary shadow-sm' : 'bg-surface dark:bg-darksurface shadow-sm'}`}>
                <Text className={`font-bold text-[13px] tracking-wide ${vibeCount >= 1 ? 'text-white' : 'text-textSec dark:text-darktextSec'}`}>
                  {vibeCount} selected
                </Text>
              </View>
              <Text className="text-[13px] font-semibold text-textSec/80 dark:text-darktextSec/80 ml-4">
                {vibeCount === 0 ? 'Pick at least 1 to continue' : vibeCount >= 5 ? 'Great variety!' : 'Looking good.'}
              </Text>
            </View>
          </View>

          <View className="flex-row flex-wrap justify-between gap-y-4 md:gap-y-6">
            {filteredRecipes.map(recipe => {
              const isSelected = selectedVibes.includes(recipe.id);
              return (
                <TouchableOpacity
                  key={recipe.id}
                  testID={`calibration-vibe-card-${recipe.id}`}
                  onPress={() => toggleVibe(recipe.id)}
                  activeOpacity={0.8}
                  className={`w-[48.5%] md:w-[31.5%] h-52 md:h-[190px] lg:h-[240px] rounded-[24px] overflow-hidden relative transition-all bg-surface dark:bg-darksurface border border-black/[0.04] dark:border-white/5 ${
                    isSelected ? 'scale-[0.98] ring-4 ring-primary ring-offset-2 ring-offset-appBg dark:ring-offset-darkappBg shadow-md' : 'hover:shadow-md hover:scale-[0.99] active:scale-[0.98]'
                  }`}
                >
                  {/* Fallback background */}
                  <View className="absolute inset-0 bg-sageTint dark:bg-[#2A332E]">
                    <View className="absolute inset-0 opacity-40">
                      <LinearGradient colors={['transparent', 'rgba(157,205,139,0.3)']} className="absolute inset-0" />
                    </View>
                    <View className="absolute inset-0 items-center justify-center">
                      <View className="w-12 h-12 rounded-[14px] bg-white/40 dark:bg-black/20 items-center justify-center border border-white/50 dark:border-white/10 shadow-sm">
                        <FontAwesome5 name="utensils" size={18} color="#9DCD8B" />
                      </View>
                    </View>
                  </View>

                  {recipe.imageUrl && (
                    <Image source={recipe.imageUrl} style={{ width: '100%', height: '100%', position: 'absolute' }} contentFit="cover" transition={500} />
                  )}

                  <View className={`absolute inset-0 justify-center items-center transition-colors duration-300 ${isSelected ? 'bg-primary/20 dark:bg-primary/30' : 'bg-black/10'}`}>
                    {isSelected && (
                      <View className="absolute top-4 right-4 bg-primary dark:bg-primary shadow-lg rounded-full w-8 h-8 items-center justify-center">
                        <FontAwesome5 name="check" size={12} color="white" />
                      </View>
                    )}
                  </View>

                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']} locations={[0, 0.5, 1]} className="absolute bottom-0 w-full h-[65%] justify-end p-5 rounded-b-[24px]">
                    <Text className="text-white font-bold text-[17px] md:text-[19px] leading-snug tracking-tight">{recipe.title}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const renderStep4 = () => (
    <View className="flex-1 w-full items-center justify-center">
      <View className="w-full max-w-[640px]">
        <View className="mb-8 md:mb-10 items-center md:items-start">
          <Text className="text-[32px] md:text-[44px] font-bold tracking-tight text-textMain dark:text-darktextMain mb-2 md:mb-3">
            Set your targets
          </Text>
          <Text className="text-[15px] md:text-[17px] font-medium text-textSec dark:text-darktextSec leading-relaxed">
            These become your default planning guardrails. You can adjust them any time.
          </Text>
        </View>

        <View className="gap-y-7">

          {/* Budget */}
          <View>
            <Text className="text-[11px] font-bold uppercase tracking-[0.15em] text-textSec dark:text-darktextSec mb-3">
              Weekly food budget
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {BUDGET_PRESETS.map(b => (
                <TouchableOpacity
                  key={b}
                  testID={`calibration-budget-preset-${b}`}
                  onPress={() => setBudget(b)}
                  className={`px-5 py-3 rounded-2xl border transition-all ${
                    budget === b
                      ? 'bg-primary/10 dark:bg-primary/20 border-primary'
                      : 'bg-surface dark:bg-darksurface border-black/[0.06] dark:border-white/[0.06] hover:border-black/15'
                  }`}
                >
                  <Text className={`font-bold text-[15px] ${budget === b ? 'text-primary dark:text-[#85B674]' : 'text-textMain dark:text-darktextMain'}`}>
                    £{b}{b === 70 ? '+' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Calorie target */}
          <View>
            <Text className="text-[11px] font-bold uppercase tracking-[0.15em] text-textSec dark:text-darktextSec mb-3">
              Daily calorie target
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {CALORIE_PRESETS.map(c => (
                <TouchableOpacity
                  key={c.value}
                  testID={`calibration-calorie-preset-${c.value}`}
                  onPress={() => setCalorieTarget(c.value)}
                  className={`flex-1 min-w-[100px] px-4 py-3.5 rounded-2xl border items-center transition-all ${
                    calorieTarget === c.value
                      ? 'bg-primary/10 dark:bg-primary/20 border-primary'
                      : 'bg-surface dark:bg-darksurface border-black/[0.06] dark:border-white/[0.06] hover:border-black/15'
                  }`}
                >
                  <Text className={`font-bold text-[14px] ${calorieTarget === c.value ? 'text-primary dark:text-[#85B674]' : 'text-textMain dark:text-darktextMain'}`}>
                    {c.label}
                  </Text>
                  <Text className={`text-[11px] mt-0.5 ${calorieTarget === c.value ? 'text-primary/70 dark:text-[#85B674]/70' : 'text-textSec dark:text-darktextSec'}`}>
                    {c.value.toLocaleString()} kcal
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Protein target */}
          <View>
            <Text className="text-[11px] font-bold uppercase tracking-[0.15em] text-textSec dark:text-darktextSec mb-3">
              Daily protein goal
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {PROTEIN_PRESETS.map(p => (
                <TouchableOpacity
                  key={p.value}
                  testID={`calibration-protein-preset-${p.value}`}
                  onPress={() => setProteinTarget(p.value)}
                  className={`flex-1 min-w-[100px] px-4 py-3.5 rounded-2xl border items-center transition-all ${
                    proteinTarget === p.value
                      ? 'bg-primary/10 dark:bg-primary/20 border-primary'
                      : 'bg-surface dark:bg-darksurface border-black/[0.06] dark:border-white/[0.06] hover:border-black/15'
                  }`}
                >
                  <Text className={`font-bold text-[14px] ${proteinTarget === p.value ? 'text-primary dark:text-[#85B674]' : 'text-textMain dark:text-darktextMain'}`}>
                    {p.label}
                  </Text>
                  <Text className={`text-[11px] mt-0.5 ${proteinTarget === p.value ? 'text-primary/70 dark:text-[#85B674]/70' : 'text-textSec dark:text-darktextSec'}`}>
                    {p.sub}/day
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Exclusions */}
          <View>
            <Text className="text-[11px] font-bold uppercase tracking-[0.15em] text-textSec dark:text-darktextSec mb-1">
              Anything you'd rather avoid?
            </Text>
            <Text className="text-[12px] text-textSec/70 dark:text-darktextSec/70 mb-3">
              Optional for now - we'll save this to your profile and you can update it later.
            </Text>
            <TextInput
              testID="calibration-exclusions-input"
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
        <View className="w-full max-w-[600px]">
          {/* Loading Animation */}
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

          {/* Profile Summary Card */}
          <View className="w-full bg-surface dark:bg-darksurface rounded-[32px] p-7 md:p-8 shadow-[0_2px_16px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/[0.04] dark:border-white/5 overflow-hidden relative">
            <View className="absolute -top-10 -right-10 w-40 h-40 bg-sageTint/40 dark:bg-darksageTint/20 rounded-full" style={{ filter: 'blur(40px)' } as any} />

            <View className="flex-row items-center mb-6 border-b border-black/[0.04] dark:border-white/5 pb-5">
              <View className="w-10 h-10 rounded-[14px] bg-primary/10 dark:bg-primary/20 items-center justify-center mr-4">
                <FontAwesome5 name="fingerprint" size={16} color="#9DCD8B" />
              </View>
              <View>
                <Text className="text-[11px] font-bold text-textSec/60 dark:text-darktextSec/60 uppercase tracking-[0.15em] mb-0.5">Provision DNA</Text>
                <Text className="text-textMain dark:text-darktextMain font-bold text-[18px] tracking-tight">Your New Profile</Text>
              </View>
            </View>

            <View className="flex-row flex-wrap">
              <SummaryCell label="Taste Anchors" value={`${selectedVibes.length} Picks`} />
              <SummaryCell label="Baseline" value={diet || 'Omnivore'} bordered />
              <SummaryCell label="Weekly Budget" value={`£${budget}`} top />
              <SummaryCell label="Calorie Target" value={`${calorieTarget.toLocaleString()} kcal`} bordered top />
              <SummaryCell label="Protein Goal" value={`${proteinTarget}g/day`} top />
              {normalizedExclusions.length > 0 && (
                <SummaryCell label="Profile Notes" value={normalizedExclusions.join(', ')} bordered top />
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  // ─── Sidebar Progress ─────────────────────────────────────────────────────

  const renderSidebar = () => (
    <View className="md:w-1/3 md:min-w-[300px] md:max-w-[360px] md:border-r md:border-softBorder dark:md:border-white/5 bg-surface dark:bg-darksurface pt-6 md:pt-16 pb-8 md:pb-12 px-6 md:px-10 flex-col justify-between z-10 shadow-[0_4px_24px_rgba(0,0,0,0.02)] md:shadow-none">
      <View>
        <Text className="text-textMain dark:text-darktextMain text-[26px] md:text-[32px] font-bold tracking-tight mb-0.5">Provision</Text>
        <Text className="text-primary dark:text-[#85B674] text-[11px] font-bold uppercase tracking-[0.15em]">Taste-Led Planning</Text>

        {/* Step indicators */}
        <View className="hidden md:flex mt-14 pl-1 pr-4 relative">
          {STEP_LABELS.map((s, idx) => {
            const isActive = step === s.number;
            const isCompleted = step > s.number;
            return (
              <View key={s.number}>
                <View className="flex-row items-center relative z-10">
                  <View className={`w-[34px] h-[34px] rounded-full flex items-center justify-center mr-4 transition-colors duration-300 ${
                    isActive ? 'bg-primary dark:bg-[#85B674] shadow-[0_2px_12px_rgba(157,205,139,0.3)]' :
                    isCompleted ? 'bg-sageTint dark:bg-darksageTint' :
                    'bg-appBg dark:bg-darkgrey border border-softBorder dark:border-white/5'
                  }`}>
                    {isCompleted
                      ? <FontAwesome5 name="check" size={11} color="#9DCD8B" />
                      : <Text className={`text-[12px] font-bold ${isActive ? 'text-white' : 'text-textSec/60 dark:text-darktextSec/60'}`}>{s.number}</Text>
                    }
                  </View>
                  <Text className={`text-[15px] font-bold tracking-tight transition-colors duration-300 ${
                    isActive ? 'text-textMain dark:text-darktextMain' :
                    isCompleted ? 'text-textMain/70 dark:text-darktextMain/70' :
                    'text-textSec/40 dark:text-darktextSec/40'
                  }`}>
                    {s.label}
                  </Text>
                </View>
                {idx < STEP_LABELS.length - 1 && (
                  <View className="ml-[16px] w-[2px] h-[28px] my-1 bg-black/[0.04] dark:bg-white/[0.04] relative z-0">
                    <View className="absolute top-0 left-0 w-full bg-primary transition-all duration-500" style={{ height: step > s.number ? '100%' : '0%' } as any} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Dev skip */}
      <TouchableOpacity
        testID="calibration-skip-debug-btn"
        onPress={handleDebugSkip}
        className="hidden md:flex flex-row items-center opacity-40 hover:opacity-90 transition-opacity self-start py-2"
      >
        <FontAwesome5 name="fast-forward" size={10} color="#8C9A90" style={{ marginRight: 6 }} />
        <Text className="text-[11px] font-bold text-textSec dark:text-[#6E7C74] uppercase tracking-widest">Dev Skip</Text>
      </TouchableOpacity>
    </View>
  );

  // ─── CTA bar ─────────────────────────────────────────────────────────────

  const ctaDisabled = !canProceed();

  const renderCTA = () => (
    <View
      className="px-6 py-5 md:px-12 md:py-6 border-t border-black/[0.05] dark:border-white/5 bg-surface/95 dark:bg-darksurface/95 absolute bottom-0 w-full left-0 z-50 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]"
      style={{ backdropFilter: 'blur(12px)' } as any}
    >
      <View className="mx-auto w-full max-w-[940px] flex-row items-center justify-between">

        {/* Back button (steps 2–4) */}
        <TouchableOpacity
          onPress={handleBack}
          className={`flex-row items-center gap-2 py-3 px-5 rounded-full transition-all ${step > 1 && step < 5 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <FontAwesome5 name="arrow-left" size={11} color="#8C9A90" />
          <Text className="text-[13px] font-semibold text-textSec dark:text-darktextSec">Back</Text>
        </TouchableOpacity>

        {/* Skip taste (step 3 only) */}
        {step === 3 && selectedVibes.length === 0 && (
          <TouchableOpacity
            onPress={() => setStep(4)}
            className="py-3 px-5 rounded-full opacity-60 hover:opacity-100 transition-all"
          >
            <Text className="text-[13px] font-semibold text-textSec dark:text-darktextSec">Skip for now</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          testID={step === 1 ? 'calibration-welcome-cta' : 'calibration-continue-btn'}
          onPress={handleNext}
          disabled={ctaDisabled}
          className={`rounded-full py-4 px-12 md:py-4 md:px-14 items-center justify-center transition-all flex-row ml-auto ${
            ctaDisabled
              ? 'bg-black/[0.04] dark:bg-white/[0.05]'
              : 'bg-primary hover:bg-primary-hover active:scale-[0.98] shadow-[0_4px_16px_rgba(157,205,139,0.3)]'
          }`}
        >
          <Text className={`text-[16px] font-bold tracking-tight ${ctaDisabled ? 'text-textSec/50 dark:text-darktextSec/50' : 'text-white'}`}>
            {step === 1 ? 'Get started' : step === 5 ? 'See My Plan' : step === 4 ? 'Build My Plan' : 'Continue'}
          </Text>
          {step < 5 && step !== 5 && !ctaDisabled && (
            <FontAwesome5 name="arrow-right" size={12} color="white" style={{ marginLeft: 10, marginTop: 1 }} />
          )}
        </TouchableOpacity>

        {/* Mobile dev skip */}
        <TouchableOpacity
          testID="calibration-skip-debug-btn-mob"
          onPress={handleDebugSkip}
          className="md:hidden p-3 opacity-40 absolute right-6"
        >
          <FontAwesome5 name="fast-forward" size={14} color="#8C9A90" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── Root Layout ──────────────────────────────────────────────────────────

  return (
    <SafeAreaView testID="calibration-screen" className="flex-1 bg-appBg dark:bg-darkappBg">
      <View className="flex-1 md:flex-row">

        {renderSidebar()}

        {/* Right content area */}
        <View className="flex-1 relative bg-appBg dark:bg-darkappBg overflow-hidden md:min-h-0">

          {/* Mobile top progress bar */}
          <View className="flex-row gap-1.5 md:hidden px-6 pt-5 pb-3 bg-surface dark:bg-darksurface z-20 shadow-sm border-b border-black/[0.04] dark:border-white/5">
            {[1, 2, 3, 4, 5].map(i => (
              <View key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-black/[0.04] dark:bg-white/[0.05]'}`} />
            ))}
          </View>

          <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
            <View className="flex-1 w-full items-center justify-center px-5 md:px-10 pt-6 md:pt-12 pb-32 md:pb-40 min-h-full">
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

// ─── Summary Cell Helper ───────────────────────────────────────────────────

function SummaryCell({ label, value, bordered, top }: { label: string; value: string; bordered?: boolean; top?: boolean }) {
  return (
    <View className={`w-1/2 ${top ? 'mt-5' : ''} ${bordered ? 'pl-4 border-l border-black/[0.04] dark:border-white/5' : ''}`}>
      <Text className="text-textSec dark:text-darktextSec text-[11px] font-bold uppercase tracking-widest mb-1.5">{label}</Text>
      <Text className="text-textMain dark:text-darktextMain font-bold text-[17px] leading-snug">{value}</Text>
    </View>
  );
}
