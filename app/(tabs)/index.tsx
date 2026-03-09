import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, TextInput, TouchableOpacity, LayoutAnimation, Platform, StatusBar } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import RecipeCard from '../../components/RecipeCard';
import ImportRecipeModal from '../../components/ImportRecipeModal';
import { generateWeeklyPlan, calculateDailyMacros } from '../../data/engine';
import { MOCK_RECIPES } from '../../data/seed';

// Mock User for MVP
const mockUser = {
  id: "u1",
  name: "Liam",
  targetMacros: { calories: 2400, protein: 160, carbs: 250, fats: 80 },
  budgetWeekly: 50,
  dietaryPreference: "Omnivore" as const,
  allergies: [],
};

const weeklyPlan = generateWeeklyPlan(mockUser);

export default function DashboardScreen() {
  const router = useRouter();
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [swappedMeals, setSwappedMeals] = useState<Record<number, Record<string, string>>>({}); 
  const [importModalVisible, setImportModalVisible] = useState(false);

  const activeDayPlan = weeklyPlan[currentDayIndex];
  
  // Helper to fetch the actual active meal ID for the current day
  const getActiveMealId = (type: 'breakfast' | 'lunch' | 'dinner') => {
    return (swappedMeals[currentDayIndex] && swappedMeals[currentDayIndex][type]) || activeDayPlan[type];
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
      [currentDayIndex]: { 
        ...(prev[currentDayIndex] || {}), 
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
        {/* Top row: label + date range + nav arrows all in one tight line */}
        <View testID="week-selector-header" className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <FontAwesome5 name="calendar-week" size={11} color="#6DBE75" />
            <Text className="text-avocado font-bold text-xs uppercase tracking-[0.12em]">This Week</Text>
            <Text className="text-gray-400 text-xs font-medium">Mar 9 – 15</Text>
          </View>
          {/* Arrows sit right next to the label, not floating far right */}
          <View className="flex-row items-center gap-1">
            <TouchableOpacity
              testID="week-selector-prev-btn"
              className="w-7 h-7 rounded-lg bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/5 items-center justify-center hover:bg-black/5 transition-colors"
              onPress={() => {}}
            >
              <FontAwesome5 name="chevron-left" size={9} color="#9CA3AF" />
            </TouchableOpacity>
            <TouchableOpacity
              testID="week-selector-next-btn"
              className="w-7 h-7 rounded-lg bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/5 items-center justify-center hover:bg-black/5 transition-colors"
              onPress={() => {}}
            >
              <FontAwesome5 name="chevron-right" size={9} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Day pills — compact, minimum gap */}
        <View testID="week-selector-pills" className="flex-row gap-0.5">
          {weeklyPlan.map((day, idx) => {
            const isSelected = currentDayIndex === idx;
            const isToday = todayIndex === idx;
            return (
              <TouchableOpacity
                key={idx}
                testID={`week-selector-day-${days[idx].toLowerCase()}`}
                onPress={() => setCurrentDayIndex(idx)}
                className={`flex-1 items-center justify-center py-1.5 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-avocado/20 border-avocado/60 dark:bg-avocado/25 dark:border-avocado/60'
                    : 'bg-white/40 dark:bg-white/5 border-black/[0.04] dark:border-white/5 hover:bg-black/[0.03]'
                }`}
              >
                <Text className={`font-bold text-[9px] uppercase tracking-wide ${
                  isSelected ? 'text-avocado' : 'text-gray-400'
                }`}>
                  {days[idx]}
                </Text>
                <Text className={`font-extrabold text-sm leading-tight ${
                  isSelected ? 'text-avocado' : 'text-charcoal dark:text-white'
                }`}>
                  {idx + 9}
                </Text>
                {isToday && (
                  <View className={`w-1 h-1 rounded-full ${isSelected ? 'bg-avocado' : 'bg-avocado/40'}`} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected day heading — tight, inline, clean */}
        <View testID="week-selector-active-day" className="flex-row items-center justify-between mt-2 mb-3">
          <View>
            <Text testID="dashboard-current-date-heading" className="text-charcoal dark:text-darkcharcoal text-lg font-extrabold tracking-tight leading-tight">
              {fullDays[currentDayIndex]}
              <Text className="text-gray-400 font-medium text-sm"> · March {currentDayIndex + 9}</Text>
            </Text>
            <Text className="text-gray-400 text-[10px] font-medium">3 meals planned</Text>
          </View>
          <View className="flex-row items-center gap-3">
            <View testID="week-selector-mini-cal" className="flex-row items-center">
              <FontAwesome5 name="fire" size={10} color="#FF6B5A" />
              <Text className="text-gray-500 text-xs font-bold ml-1">{Math.round(activeMacros.calories)} kcal</Text>
            </View>
            <View testID="week-selector-mini-protein" className="flex-row items-center">
              <FontAwesome5 name="dumbbell" size={10} color="#4F7FFF" />
              <Text className="text-gray-500 text-xs font-bold ml-1">{Math.round(activeMacros.protein)}g P</Text>
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
      className="flex-1 bg-cream dark:bg-darkcream"
      style={Platform.OS === 'web'
        ? { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'visible' } as any
        : { flex: 1 }
      }
    >
      {/* Single page scroll — no nested scroll contexts */}
      <ScrollView
        testID="dashboard-scroll"
        className="flex-1"
        showsVerticalScrollIndicator={false}
        // Critical: no overflow override on the scroll container itself on web
        // — let the browser handle overflow so sticky children work correctly
        style={Platform.OS === 'web' ? { overflowY: 'auto', overflowX: 'visible' } as any : undefined}
      >
        <View
          testID="dashboard-layout"
          className="px-4 pb-32 mx-auto w-full md:max-w-7xl md:px-10"
          style={Platform.OS === 'web'
            // IMPORTANT: parent must NOT have overflow:hidden or transforms, or sticky breaks.
            // Removed pt-6/10 to avoid scroll-dependent spacing drift.
            ? { display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 40, overflow: 'visible', paddingTop: 24 } as any
            : { paddingTop: 24 }
          }
        >
          {/* ─── LEFT COLUMN ─── visually locked sticky rail ─── */}
          <View
            testID="dashboard-left-column"
            style={Platform.OS === 'web'
              ? {
                  width: 300,
                  flexShrink: 0,
                  position: 'sticky',
                  top: 24, // Matches parent paddingTop for stable initial load
                  alignSelf: 'flex-start',
                  willChange: 'unset',
                  transform: 'none',
                  zIndex: 20,
                } as any
              : undefined
            }
          >
            {/* Header */}
            <View className="flex-row justify-between items-end mb-4 pb-3 border-b border-black/5 dark:border-white/5">
              <View>
                <Text className="text-gray-500 text-xs font-bold uppercase tracking-widest">Welcome back,</Text>
                <Text className="text-charcoal dark:text-darkcharcoal text-xl font-extrabold tracking-tight mt-0.5">{mockUser.name}</Text>
              </View>
            </View>

            {/* Daily Progress Card — single source of truth: activeMacros */}
            <View testID="dashboard-daily-progress-card" className="bg-white/60 dark:bg-darkgrey/60 rounded-2xl p-4 mb-3 shadow-sm">
              <View className="flex-row justify-between items-baseline mb-3">
                <Text testID="dashboard-active-day-title" className="text-charcoal dark:text-darkcharcoal text-sm font-bold tracking-tight">Active Day</Text>
                <Text className="text-gray-400 text-[10px] font-medium">{activeDayPlan.date}</Text>
              </View>

              {/* ── Calories ── */}
              <View className="mb-3">
                <View className="flex-row justify-between items-baseline mb-1.5">
                  <Text testID="dashboard-calories-label" className="text-charcoal dark:text-gray-300 font-bold text-xs">
                    Calories{' '}
                    <Text testID="dashboard-calories-current" className="text-charcoal dark:text-darkcharcoal font-extrabold">
                      {Math.round(activeMacros.calories)}
                    </Text>
                    <Text className="text-gray-400 font-normal"> / {mockUser.targetMacros.calories}</Text>
                  </Text>
                  <Text testID="dashboard-calories-remaining" className="text-avocado text-[10px] font-bold">
                    {Math.max(0, mockUser.targetMacros.calories - Math.round(activeMacros.calories))} left
                  </Text>
                </View>
                <View className="h-1.5 w-full bg-gray-200 dark:bg-black/40 rounded-full overflow-hidden">
                  <View
                    testID="dashboard-calories-progress-bar"
                    className="h-full bg-avocado rounded-full"
                    style={{ width: `${Math.min(100, Math.round((activeMacros.calories / mockUser.targetMacros.calories) * 100))}%` as any }}
                  />
                </View>
              </View>

              {/* ── Protein ── separator line for rhythm */}
              <View className="border-t border-black/[0.04] dark:border-white/[0.04] pt-3">
                <View className="flex-row justify-between items-baseline mb-1.5">
                  <Text testID="dashboard-protein-label" className="text-charcoal dark:text-gray-300 font-bold text-xs">
                    Protein{' '}
                    <Text testID="dashboard-protein-current" className="text-charcoal dark:text-darkcharcoal font-extrabold">
                      {Math.round(activeMacros.protein)}g
                    </Text>
                    <Text className="text-gray-400 font-normal"> / {mockUser.targetMacros.protein}g</Text>
                  </Text>
                  <Text testID="dashboard-protein-remaining" className="text-blueberry text-[10px] font-bold">
                    {Math.max(0, mockUser.targetMacros.protein - Math.round(activeMacros.protein))}g left
                  </Text>
                </View>
                <View className="h-1.5 w-full bg-gray-200 dark:bg-black/40 rounded-full overflow-hidden">
                  <View
                    testID="dashboard-protein-progress-bar"
                    className="h-full bg-blueberry rounded-full"
                    style={{ width: `${Math.min(100, Math.round((activeMacros.protein / mockUser.targetMacros.protein) * 100))}%` as any }}
                  />
                </View>
              </View>
            </View>

            {/* Weekly Budget Card — trimmed */}
            <View testID="dashboard-weekly-budget-card" className="bg-white/60 dark:bg-darkgrey/60 rounded-2xl p-4 mb-3 shadow-sm">
              <Text className="text-charcoal dark:text-darkcharcoal text-sm font-bold tracking-tight">Weekly Budget</Text>
              <Text className="text-avocado font-bold text-xs mt-0.5 mb-3">On track for the week</Text>
              <View className="flex-row justify-between items-end border-t border-black/5 dark:border-white/5 pt-3">
                <Text className="text-charcoal dark:text-darkcharcoal text-2xl font-extrabold">£34<Text className="text-sm font-medium text-gray-400"> / £{mockUser.budgetWeekly}</Text></Text>
                <Text className="text-gray-400 font-bold text-xs">£{mockUser.budgetWeekly - 34} left</Text>
              </View>
            </View>

            {/* Next Action — compact, slightly less dominant green */}
            <TouchableOpacity
              testID="dashboard-next-action-card"
              onPress={() => router.push('/explore')}
              className="bg-avocado/90 rounded-2xl p-4 mb-3 shadow-sm active:opacity-80 hover:opacity-90 transition-opacity"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1 mr-3">
                  <Text className="text-white/70 text-[9px] font-bold uppercase tracking-widest mb-0.5">Next Action</Text>
                  <Text className="text-white text-sm font-bold leading-tight">12 ingredients needed this week</Text>
                </View>
                <View className="bg-white/20 px-3 py-1.5 rounded-full flex-row items-center border border-white/30">
                  <Text className="text-white font-bold text-xs mr-1.5">Shop</Text>
                  <FontAwesome5 name="arrow-right" size={9} color="white" />
                </View>
              </View>
            </TouchableOpacity>

            {/* Taste Profile — trimmed padding */}
            <View testID="dashboard-taste-profile-card" className="bg-white/60 dark:bg-darkgrey/60 rounded-2xl p-4 shadow-sm">
              <View className="flex-row justify-between items-center mb-2">
                <View>
                  <Text className="text-charcoal dark:text-darkcharcoal text-sm font-bold tracking-tight">Taste Profile</Text>
                  <Text className="text-gray-400 text-xs font-medium">Shaping next week's plan</Text>
                </View>
                <TouchableOpacity testID="dashboard-view-taste-profile-btn" onPress={() => router.push('/taste-profile')}>
                  <Text className="text-avocado font-bold text-xs">View full</Text>
                </TouchableOpacity>
              </View>
              <View className="flex-row flex-wrap gap-1 mb-3 mt-1.5">
                {tasteProfileTags.map(tag => (
                  <View key={tag} className="bg-gray-100 dark:bg-black/20 px-2 py-1 rounded-full border border-black/5 dark:border-white/5">
                    <Text className="text-charcoal dark:text-gray-300 text-[10px] font-bold">{tag}</Text>
                  </View>
                ))}
              </View>
              <Text className="text-gray-400 text-[10px] font-medium mb-3">Based on {tasteProfileTags.length + 1} imported recipes</Text>
              {/* Import Recipe — clean secondary CTA, single icon, no double-plus */}
              <TouchableOpacity
                testID="dashboard-add-recipe-btn"
                onPress={handleAddRecipeClick}
                className="py-2.5 rounded-xl flex-row items-center justify-center border border-avocado/40 bg-avocado/8 hover:bg-avocado/15 transition-colors"
              >
                <FontAwesome5 name="file-import" size={10} color="#6DBE75" />
                <Text className="text-avocado font-bold text-xs ml-1.5">Import recipe</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ─── RIGHT COLUMN ─── week selector sticky at top, meals below ─── */}
          <View
            testID="dashboard-right-column"
            style={Platform.OS === 'web' ? { flex: 1, minWidth: 0 } as any : undefined}
            className="mt-6 md:mt-0"
          >
            {/* Sticky week planner header — locked offset matches rail */}
            <View
              testID="dashboard-week-selector-sticky"
              style={Platform.OS === 'web'
                ? { 
                    position: 'sticky', 
                    top: 24, // Locked at same offset as left rail
                    zIndex: 30, 
                    backgroundColor: 'var(--color-cream, #FAF8F4)', 
                    paddingBottom: 2 
                  } as any
                : undefined
              }
              className="bg-cream dark:bg-darkcream pb-0"
            >
              <WeekSelector />
              {/* Faint rule that content slides under */}
              <View className="h-px bg-black/[0.04] dark:bg-white/[0.05] mb-6" />
            </View>

            {/* Meal Feed */}
            <View testID="dashboard-meal-feed">
              <Text className="text-gray-400 text-xs mb-3 uppercase tracking-wider font-bold">Breakfast</Text>
              {getRecipe(getActiveMealId('breakfast')) && (
                <RecipeCard
                  recipe={getRecipe(getActiveMealId('breakfast'))!}
                  onSwipe={() => handleSwap('breakfast')}
                />
              )}
              <Text className="text-gray-400 text-xs mb-3 mt-4 uppercase tracking-wider font-bold">Lunch</Text>
              {getRecipe(getActiveMealId('lunch')) && (
                <RecipeCard
                  recipe={getRecipe(getActiveMealId('lunch'))!}
                  onSwipe={() => handleSwap('lunch')}
                />
              )}
              <Text className="text-gray-400 text-xs mb-3 mt-4 uppercase tracking-wider font-bold">Dinner</Text>
              {getRecipe(getActiveMealId('dinner')) && (
                <RecipeCard
                  recipe={getRecipe(getActiveMealId('dinner'))!}
                  onSwipe={() => handleSwap('dinner')}
                />
              )}
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
