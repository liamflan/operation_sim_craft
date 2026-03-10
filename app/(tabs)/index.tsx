import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, SafeAreaView, TextInput, TouchableOpacity, LayoutAnimation, Platform, StatusBar, Animated } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import RecipeCard from '../../components/RecipeCard';
import ImportRecipeModal from '../../components/ImportRecipeModal';
import { calculateDailyMacros } from '../../data/engine';
import { MOCK_RECIPES } from '../../data/seed';
import { useWeeklyRoutine } from '../../data/WeeklyRoutineContext';
import { DAYS, slotLabel, isPlanned } from '../../data/weeklyRoutine';

// Mock User for MVP
const mockUser = {
  id: "u1",
  name: "Liam",
  targetMacros: { calories: 2400, protein: 160, carbs: 250, fats: 80 },
  budgetWeekly: 50,
  dietaryPreference: "Omnivore" as const,
  allergies: [],
};

// Static seed plan — recipe assignments to display while Gemini plan loads.
// These are overridden by swappedMeals on user interaction.
const weeklyPlan = [
  { date: 'Mon', breakfast: 'r3', lunch: 'r5', dinner: 'r1' },
  { date: 'Tue', breakfast: 'r7', lunch: 'r6', dinner: 'r4' },
  { date: 'Wed', breakfast: 'r3', lunch: 'r1', dinner: 'r2' },
  { date: 'Thu', breakfast: 'r7', lunch: 'r4', dinner: 'r6' },
  { date: 'Fri', breakfast: 'r3', lunch: 'r5', dinner: 'r1' },
  { date: 'Sat', breakfast: 'r7', lunch: 'r8', dinner: 'r2' },
  { date: 'Sun', breakfast: 'r3', lunch: 'r6', dinner: 'r4' },
];

export default function DashboardScreen() {
  const router = useRouter();
  const { routine } = useWeeklyRoutine();
  // currentDayIndex = what the pill selector shows (updates instantly)
  // displayedDayIndex = what the meal feed actually renders (only updates after fade-out)
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [displayedDayIndex, setDisplayedDayIndex] = useState(0);
  const [swappedMeals, setSwappedMeals] = useState<Record<number, Record<string, string>>>({});
  const [importModalVisible, setImportModalVisible] = useState(false);

  // Meal feed fade animation — decoupled so content only swaps after fade-out completes
  const mealFadeAnim = useRef(new Animated.Value(1)).current;
  const pendingDayIndex = useRef(0);

  const switchDay = (idx: number) => {
    if (idx === displayedDayIndex) return; // no-op if same day
    pendingDayIndex.current = idx;
    setCurrentDayIndex(idx);
    // Fade out the current content
    Animated.timing(mealFadeAnim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      // Swap the rendered content only after fade-out is done
      setDisplayedDayIndex(pendingDayIndex.current);
      // Then fade back in
      Animated.timing(mealFadeAnim, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }).start();
    });
  };

  // Day abbrev -> routine key map — use displayedDayIndex for meal feed content
  const currentDayKey = DAYS[displayedDayIndex];

  const activeDayPlan = weeklyPlan[displayedDayIndex];
  
  // Helper to fetch the actual active meal ID for the displayed day
  const getActiveMealId = (type: 'breakfast' | 'lunch' | 'dinner') => {
    return (swappedMeals[displayedDayIndex] && swappedMeals[displayedDayIndex][type]) || activeDayPlan[type];
  };

  // Helper to find recipe object
  const getRecipe = (id?: string) => MOCK_RECIPES.find(r => r.id === id);

  // Re-calculate macros based on ACTIVE meals
  const activePlan = {
    ...activeDayPlan,
    breakfast: getActiveMealId('breakfast'),
    lunch: getActiveMealId('lunch'),
    dinner: getActiveMealId('dinner'),
  };
  const activeMacros = calculateDailyMacros(activePlan, MOCK_RECIPES);

  const handleSwap = (type: 'breakfast' | 'lunch' | 'dinner') => {
    const currentId = getActiveMealId(type);
    const alternatives = MOCK_RECIPES.filter(r => r.id !== currentId);
    const newRecipe = alternatives[Math.floor(Math.random() * Math.min(alternatives.length, 5))];
    
    setSwappedMeals(prev => ({ 
      ...prev, 
      [displayedDayIndex]: { 
        ...(prev[displayedDayIndex] || {}), 
        [type]: newRecipe.id 
      } 
    }));
  };

  const [tasteProfileTags, setTasteProfileTags] = useState(['High-protein', 'Spicy', 'Quick meals']);

  // Open the Import Recipe modal
  const handleAddRecipeClick = () => setImportModalVisible(true);
  const handleImportSave = (data: any) => {
    // In production: persist to taste profile / trigger planner refresh
    console.log('Recipe imported:', data);
    
    // Mock UI feedback: add a new tag if it's a "Learning" save
    if (data.userFeedback !== 'saved_only') {
      const newTag = 'Salmon'; // From the mock recipe
      if (!tasteProfileTags.includes(newTag)) {
        if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setTasteProfileTags(prev => [newTag, ...prev]);
      }
    }
  };

  // Premium week planner header
  const WeekSelector = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const fullDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const todayIndex = 0; // MVP: Today = Monday

    return (
      <View testID="week-selector-container">
        {/* Day pills — Row of 7 rounded day capsules/cards */}
        <View testID="week-selector-pills" className="flex-row gap-1.5 mb-5">
          {weeklyPlan.map((day, idx) => {
            const isSelected = currentDayIndex === idx;
            const isToday = todayIndex === idx;
            return (
              <TouchableOpacity
                key={idx}
                testID={`week-selector-day-${days[idx].toLowerCase()}`}
                onPress={() => switchDay(idx)}
                className={`flex-1 items-center justify-center py-2.5 rounded-[12px] transition-all duration-300 border ${
                  isSelected
                    ? 'bg-primary/10 dark:bg-darksageTint border-primary/20 dark:border-primary/20 shadow-[0_2px_8px_rgba(157,205,139,0.15)] dark:shadow-none'
                    : 'bg-[#FBFCF8] dark:bg-darksurface border-black/[0.04] dark:border-darksoftBorder hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                }`}
              >
                <Text className={`font-semibold text-[10px] uppercase tracking-widest mb-1 ${
                  isSelected ? 'text-[#24332D] dark:text-darktextMain' : 'text-textSec dark:text-darktextSec opacity-70'
                }`}>
                  {days[idx]}
                </Text>
                <Text className={`font-medium text-[16px] leading-none ${
                  isSelected ? 'text-[#24332D] dark:text-darktextMain' : 'text-textMain dark:text-darktextMain'
                }`}>
                  {idx + 9}
                </Text>
                {isToday && (
                  <View className={`w-1 h-1 rounded-full mt-1.5 ${isSelected ? 'bg-primary' : 'bg-primary/40'}`} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected day heading — uses displayedDayIndex so text also only updates after the fade */}
        <View testID="week-selector-active-day" className="flex-row items-center justify-between pb-2">
          <View>
            <Text testID="dashboard-current-date-heading" className="text-textMain dark:text-darktextMain text-[28px] font-medium tracking-tight mb-1">
              {fullDays[currentDayIndex]}
            </Text>
            <Text className="text-textMain dark:text-darktextMain text-[20px] font-medium tracking-tight mr-4">{days[currentDayIndex]} (3 meals planned)</Text>
          </View>
          {/* Day Summary Chips */}
          <View className="flex-row gap-2">
            <View className="bg-surface dark:bg-darksurface px-2.5 py-1 rounded-[6px] border border-black/[0.03] dark:border-darksoftBorder">
              <Text className="text-textMain dark:text-darktextMain font-medium text-[11px]"><Text className="text-peach dark:text-[#C48F5D]">●</Text> {Math.round(activeMacros.calories)} kcal</Text>
            </View>
            <View className="bg-surface dark:bg-darksurface px-2.5 py-1 rounded-[6px] border border-black/[0.03] dark:border-darksoftBorder">
              <Text className="text-textMain dark:text-darktextMain font-medium text-[11px]"><Text className="text-lime dark:text-[#A9B86D]">●</Text> {Math.round(activeMacros.protein)}g pro</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    // Use plain View instead of SafeAreaView to avoid any platform transform
    // that would break CSS position:sticky on child elements.
    // SafeAreaView on web adds transforms/padding via JS which creates new stacking contexts.
    <View
      testID="dashboard-screen"
      className="flex-1 bg-appBg dark:bg-darkappBg"
      style={Platform.OS === 'web'
        ? { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' } as any
        : { flex: 1 }
      }
    >
      <ScrollView
        testID="dashboard-scroll"
        className="flex-1"
        showsVerticalScrollIndicator={false}
        style={Platform.OS === 'web' ? { height: '100%' } as any : undefined}
      >
        <View
          testID="dashboard-layout"
          className="px-4 md:px-8 lg:px-12 pb-32 pt-6 w-full max-w-[1400px] mx-auto flex-col md:flex-row gap-8 lg:gap-14"
          style={Platform.OS === 'web'
            ? { display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 48, paddingTop: 24 } as any
            : { paddingTop: 20 }
          }
        >
          {/* ─── MAIN CENTRAL CONTENT (Meals Feed & Header) ─── */}
          <View
            testID="dashboard-main-column"
            className="flex-1 min-w-0"
          >
            {/* Header Area (Compact & Composed) */}
            <View className="flex-row justify-between items-end mb-4 pt-1">
              <View>
                <Text className="text-textSec text-[11px] font-medium tracking-[0.15em] mb-1 opacity-80 uppercase">Morning,</Text>
                <Text className="text-textMain dark:text-darktextMain text-[32px] font-medium tracking-tight leading-none">{mockUser.name}</Text>
              </View>
              
              {/* Top-right aligned week strip label */}
              <View className="flex-row items-center gap-2 bg-surface dark:bg-darksurface px-4 py-2 rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-none border border-black/[0.02] dark:border-darksoftBorder">
                <FontAwesome5 name="calendar-day" size={10} color="#9DCD8B" />
                <Text className="text-textMain dark:text-darktextMain font-medium text-[11px] uppercase tracking-widest ml-1">This Week</Text>
                <View className="w-[1px] h-3 bg-softBorder dark:bg-darksoftBorder mx-1" />
                <Text className="text-textSec dark:text-darktextSec text-[11px] font-medium">Mar 9 – 15</Text>
              </View>
            </View>

            {/* Week planner component */}
            <View
              testID="dashboard-week-selector"
              className="mb-6"
            >
              <WeekSelector />
            </View>

            {/* Meal Feed — routine-aware */}
            <Animated.View testID="dashboard-meal-feed" className="mt-2" style={{ opacity: mealFadeAnim }}>

              {/* Breakfast */}
              {isPlanned(routine[currentDayKey].breakfast)
                ? getRecipe(getActiveMealId('breakfast')) && (
                    <View className="mb-6">
                      <RecipeCard
                        recipe={getRecipe(getActiveMealId('breakfast'))!}
                        slotLabel="Breakfast"
                        day={['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][displayedDayIndex]}
                        slot="Breakfast"
                        onSwipe={() => handleSwap('breakfast')}
                      />
                    </View>
                  )
                : (
                  <View className="bg-surface dark:bg-darksurface rounded-[32px] px-6 py-6 mb-8 shadow-sm dark:shadow-none border border-black/[0.02] dark:border-darksoftBorder flex-row items-center gap-4">
                    <View className="w-12 h-12 rounded-full bg-sageTint dark:bg-darksageTint items-center justify-center flex-shrink-0">
                      <FontAwesome5 name="coffee" size={16} color="#9DCD8B" />
                    </View>
                    <View>
                      <Text className="text-textMain dark:text-darktextMain text-[18px] font-semibold tracking-tight">{slotLabel('breakfast', routine[currentDayKey].breakfast)}</Text>
                      <Text className="text-textSec dark:text-darktextSec text-[12px] mt-1 opacity-80">Not scheduled for fuel list processing</Text>
                    </View>
                  </View>
                )
              }

              {/* Lunch */}
              {isPlanned(routine[currentDayKey].lunch)
                ? getRecipe(getActiveMealId('lunch')) && (
                    <View className="mb-6">
                      <RecipeCard
                        recipe={getRecipe(getActiveMealId('lunch'))!}
                        slotLabel="Lunch"
                        day={['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][displayedDayIndex]}
                        slot="Lunch"
                        onSwipe={() => handleSwap('lunch')}
                      />
                    </View>
                  )
                : (
                  <View className="bg-surface dark:bg-darksurface rounded-[32px] px-6 py-6 mb-8 shadow-sm dark:shadow-none border border-black/[0.02] dark:border-darksoftBorder flex-row items-center gap-4">
                    <View className="w-12 h-12 rounded-full bg-sageTint dark:bg-darksageTint items-center justify-center flex-shrink-0">
                      <FontAwesome5 name="utensils" size={16} color="#9DCD8B" />
                    </View>
                    <View>
                      <Text className="text-textMain dark:text-darktextMain text-[18px] font-semibold tracking-tight">{slotLabel('lunch', routine[currentDayKey].lunch)}</Text>
                      <Text className="text-textSec dark:text-darktextSec text-[12px] mt-1 opacity-80">Not scheduled for fuel list processing</Text>
                    </View>
                  </View>
                )
              }

              {/* Dinner */}
              {isPlanned(routine[currentDayKey].dinner)
                ? getRecipe(getActiveMealId('dinner')) && (
                    <View className="mb-6">
                      <RecipeCard
                        recipe={getRecipe(getActiveMealId('dinner'))!}
                        slotLabel="Dinner"
                        day={['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][displayedDayIndex]}
                        slot="Dinner"
                        onSwipe={() => handleSwap('dinner')}
                      />
                    </View>
                  )
                : (
                  <View className="bg-surface dark:bg-darksurface rounded-[32px] px-6 py-6 mb-8 shadow-sm dark:shadow-none border border-black/[0.02] dark:border-darksoftBorder flex-row items-center gap-4">
                    <View className="w-12 h-12 rounded-full bg-sageTint dark:bg-darksageTint items-center justify-center flex-shrink-0">
                      <FontAwesome5 name="moon" size={16} color="#9DCD8B" />
                    </View>
                    <View>
                      <Text className="text-textMain dark:text-darktextMain text-[18px] font-semibold tracking-tight">{slotLabel('dinner', routine[currentDayKey].dinner)}</Text>
                      <Text className="text-textSec dark:text-darktextSec text-[12px] mt-1 opacity-80">Not scheduled for fuel list processing</Text>
                    </View>
                  </View>
                )
              }

            </Animated.View>
          </View>

          {/* ─── SUPPORTING WIDGET COLUMN (Right side now) ─── */}
          <View
            testID="dashboard-support-column"
            style={Platform.OS === 'web'
              ? {
                  width: 320,
                  flexShrink: 0,
                  marginTop: 104, // Push down to visually match the active day heading baseline
                } as any
              : { marginTop: 40 }
            }
          >

            {/* Daily Progress Card — Active Plan */}
            <View testID="dashboard-daily-progress-card" className="bg-surface dark:bg-darksurface rounded-3xl p-5 mb-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] dark:shadow-none border border-black/[0.03] dark:border-darksoftBorder">
              {(() => {
                const dayRoutine = routine[currentDayKey];
                const plannedToday = (['breakfast','lunch','dinner'] as const).filter(
                  meal => isPlanned(dayRoutine[meal])
                ).length;
                return (
                  <>
                    <View className="flex-row justify-between items-start mb-6">
                      <Text className="text-textMain dark:text-darktextMain text-[18px] font-medium tracking-tight">Active Plan</Text>
                      <Text className="text-textSec dark:text-darktextSec text-[11px] font-medium opacity-80">{plannedToday > 0 ? 'Full day planned' : 'Not fully planned'}</Text>
                    </View>
                    
                    <View className="gap-6">
                      {/* Calories */}
                      <View>
                        <View className="flex-row justify-between items-baseline mb-2">
                          <Text className="text-textSec dark:text-darktextSec text-[12px] font-medium">Calories</Text>
                          <Text className="text-textMain dark:text-darktextMain text-[12px] font-semibold tracking-tight">{Math.round(activeMacros.calories)} <Text className="text-textSec font-normal opacity-70">/ {mockUser.targetMacros.calories}</Text></Text>
                        </View>
                        <View className="h-1.5 bg-black/[0.04] dark:bg-white/[0.04] rounded-full overflow-hidden">
                          <View className="h-full bg-peach dark:bg-[#C48F5D] rounded-full" style={{ width: `${Math.min((activeMacros.calories / mockUser.targetMacros.calories) * 100, 100)}%` }} />
                        </View>
                      </View>
                      
                      {/* Protein */}
                      <View>
                        <View className="flex-row justify-between items-baseline mb-2">
                          <Text className="text-textSec dark:text-darktextSec text-[12px] font-medium">Protein</Text>
                          <Text className="text-textMain dark:text-darktextMain text-[12px] font-semibold tracking-tight">{Math.round(activeMacros.protein)}g <Text className="text-textSec font-normal opacity-70">/ {mockUser.targetMacros.protein}g</Text></Text>
                        </View>
                        <View className="h-1.5 bg-black/[0.04] dark:bg-white/[0.04] rounded-full overflow-hidden">
                          <View className="h-full bg-lime dark:bg-[#A9B86D] rounded-full" style={{ width: `${Math.min((activeMacros.protein / mockUser.targetMacros.protein) * 100, 100)}%` }} />
                        </View>
                      </View>
                    </View>
                  </>
                );
              })()}
            </View>

            {/* Weekly Budget Card — Airy */}
            <View testID="dashboard-weekly-budget-card" className="bg-surface dark:bg-darksurface rounded-3xl p-5 mb-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] dark:shadow-none border border-black/[0.03] dark:border-darksoftBorder">
              <View className="flex-row justify-between items-start mb-6">
                <Text className="text-textMain dark:text-darktextMain text-[18px] font-medium tracking-tight">Grocery Budget</Text>
                <Text className="text-textSec dark:text-[#A3B0A7] text-[10px] font-medium uppercase tracking-widest bg-sageTint/50 dark:bg-darksageTint px-2 py-1 rounded">On Track</Text>
              </View>
              <View className="flex-row items-baseline">
                <Text className="text-textMain dark:text-darktextMain text-[28px] font-medium tracking-tight leading-none">£34</Text>
                <Text className="text-[14px] font-medium text-textSec dark:text-darktextSec opacity-60 ml-1.5">/ £{mockUser.budgetWeekly}</Text>
              </View>
            </View>

            {/* Next Action — Sage Card */}
            <TouchableOpacity
              testID="dashboard-next-action-card"
              onPress={() => router.push('/shop')}
              className="bg-sageTint dark:bg-darksageTint rounded-3xl p-5 mb-4 shadow-sm border border-transparent dark:border-darksoftBorder active:opacity-90 hover:opacity-95 transition-all flex-row items-center cursor-pointer"
            >
              <View className="flex-1 mr-4">
                <Text className="text-primary dark:text-[#85B674] text-[10px] font-bold uppercase tracking-widest mb-1.5">Weekly Prep</Text>
                <Text className="text-textMain dark:text-darktextMain text-[18px] font-medium tracking-tight">12 ingredients needed</Text>
              </View>
              <View className="w-10 h-10 rounded-full bg-white dark:bg-white/10 items-center justify-center shadow-sm">
                <FontAwesome5 name="arrow-right" size={14} color="#9DCD8B" />
              </View>
            </TouchableOpacity>

            {/* Taste Profile — Small refined card */}
            <View testID="dashboard-taste-profile-card" className="bg-surface dark:bg-darksurface rounded-3xl p-5 border border-black/[0.03] dark:border-darksoftBorder shadow-[0_2px_12px_rgba(0,0,0,0.02)] dark:shadow-none">
              <View className="flex-row justify-between items-center mb-5">
                <Text className="text-textMain dark:text-darktextMain text-[18px] font-medium tracking-tight">Taste Profile</Text>
                <TouchableOpacity testID="dashboard-view-taste-profile-btn" onPress={() => router.push('/taste-profile')}>
                  <Text className="text-textSec dark:text-darktextSec text-[12px] font-medium mb-1">Edit</Text>
                </TouchableOpacity>
              </View>
              
              <View className="flex-row flex-wrap gap-2 mb-6">
                {tasteProfileTags.map(tag => (
                  <View key={tag} className="bg-appBg dark:bg-white/5 border border-black/[0.04] dark:border-white/5 px-2.5 py-1.5 rounded-full">
                    <Text className="text-textMain dark:text-darktextMain text-[11px] font-medium opacity-80">{tag}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity 
                testID="dashboard-add-recipe-btn"
                onPress={handleAddRecipeClick}
                className="py-3 rounded-full flex-row items-center justify-center border border-softBorder/80 bg-surface hover:bg-black/[0.02] transition-colors"
               >
                 <Text className="text-textSec font-medium text-[13px]">Import Recipe Link</Text>
               </TouchableOpacity>
             </View>
          </View>
        </View>
      </ScrollView>

      {/* Import Recipe Modal */}
      <ImportRecipeModal
        visible={importModalVisible}
        onClose={() => setImportModalVisible(false)}
        onSave={handleImportSave}
      />
    </View>
  );
}
