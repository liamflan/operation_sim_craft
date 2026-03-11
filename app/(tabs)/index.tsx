import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, SafeAreaView, TextInput, TouchableOpacity, LayoutAnimation, Platform, StatusBar, Animated, ActivityIndicator } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import RecipeCard from '../../components/RecipeCard';
import ImportRecipeModal from '../../components/ImportRecipeModal';
import { slotLabel, isPlanned, DAYS } from '../../data/weeklyRoutine';
import { useActivePlan } from '../../data/ActivePlanContext';
import { useWeeklyRoutine } from '../../data/WeeklyRoutineContext';
import { useDebug } from '../../data/DebugContext';
import { getMealCardViewModel, getAssignmentsForDay, getWeeklyMetrics } from '../../data/planner/selectors';
import { SlotType, PlannedMealAssignment } from '../../data/planner/plannerTypes';
import { FULL_RECIPE_CATALOG } from '../../data/planner/recipeRegistry';
import { useToast } from '../../components/ToastContext';

// Static plan overrides are now handled by ActivePlanContext

export default function DashboardScreen() {
  const router = useRouter();
  const { routine } = useWeeklyRoutine();
  // currentDayIndex = what the pill selector shows (updates instantly)
  // displayedDayIndex = what the meal feed actually renders (only updates after fade-out)
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [displayedDayIndex, setDisplayedDayIndex] = useState(0);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const { workspace, skipAssignment, unskipAssignment, skipAndKeepIngredients, replaceSlot, regenerateDay, regenerateWeek, slotLoading, dayLoading, weekLoading } = useActivePlan();
  const { showToast } = useToast();
  const { updateDebugData } = useDebug();

  // Meal feed fade animation — decoupled so content only swaps after fade-out completes
  const mealFadeAnim = useRef(new Animated.Value(1)).current;
  const pendingDayIndex = useRef(0);

  const switchDay = (idx: number) => {
    if (idx === displayedDayIndex) return; // no-op if same day
    pendingDayIndex.current = idx;
    // We do NOT update currentDayIndex instantly here anymore,
    // to keep the heading in sync with the fading content.
    
    // Fade out the current content
    Animated.timing(mealFadeAnim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      // Swap BOTH heading and rendered cards only after fade-out is done
      setCurrentDayIndex(pendingDayIndex.current);
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

  // Derive active day data from the new hybrid plan
  const planId = workspace.id || 'initial';
  const dayAssignments = workspace.output 
    ? getAssignmentsForDay(workspace.output.assignments, planId, displayedDayIndex)
    : [];
  
  const weeklyMetrics = workspace.output
    ? getWeeklyMetrics(workspace.output.assignments, planId, FULL_RECIPE_CATALOG)
    : { totalCalories: 0, totalProtein: 0, estimatedTotalCostGBP: 0, populatedSlots: 0, totalSlots: 0 };

  // Sync displayed budget into debug overlay — must be in an effect, never during render
  const weeklyBudget = workspace.input?.payload?.budgetWeekly ?? 50;
  const targetCalories = workspace.input?.payload?.targetCalories ?? 2000;
  const targetProtein = workspace.input?.payload?.targetProtein ?? 160;

  useEffect(() => {
    updateDebugData({ dashboardDisplayedBudget: weeklyBudget });
  }, [weeklyBudget, updateDebugData]);

  // Helper to get view model for a specific slot
  const getSlotViewModel = (type: string) => {
    const assignment = dayAssignments.find(a => a.slotType === type);
    if (!assignment) return null;
    const recipeId = assignment.recipeId;
    const recipe = recipeId ? FULL_RECIPE_CATALOG[recipeId] : undefined;
    return getMealCardViewModel(assignment, recipe);
  };

  // Daily macros for the top bar
  const activeMacros = dayAssignments.reduce((acc, a) => {
    if (a.recipeId && FULL_RECIPE_CATALOG[a.recipeId]) {
      const r = FULL_RECIPE_CATALOG[a.recipeId];
      acc.calories += r.macrosPerServing.calories;
      acc.protein += r.macrosPerServing.protein;
    }
    return acc;
  }, { calories: 0, protein: 0 });

  const handleSwap = async (type: string) => {
    const result = await replaceSlot(displayedDayIndex, type as any);
    if (result && result.changed) {
      const label = slotLabel(type as any);
      showToast(`${label} swapped`, 'success');
    } else if (result && !result.changed && result.message) {
      showToast(result.message, result.reason === 'action_ignored' ? 'warning' : 'info');
    }
  };

  const handleSkip = (assignmentId: string) => {
    skipAssignment(assignmentId);
  };

  const handleUnskip = (assignmentId: string) => {
    unskipAssignment(assignmentId);
  };

  const handleReplace = async (type: string) => {
    const result = await replaceSlot(displayedDayIndex, type as any);
    if (result && result.changed) {
      const label = slotLabel(type as any);
      showToast(`${label} swapped`, 'success');
    } else if (result && !result.changed && result.message) {
      showToast(result.message, result.reason === 'action_ignored' ? 'warning' : 'info');
    }
  };

  const handleRegenDay = async (dayIndex: number) => {
    const result = await regenerateDay(dayIndex);
    if (result && result.changed && result.changeSummary) {
      const dayName = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][dayIndex];
      showToast(`${dayName} regenerated - ${result.changeSummary.changedSlotCount} meals updated`, 'success');
    } else if (result && !result.changed && result.message) {
      showToast(result.message, result.reason === 'action_ignored' ? 'warning' : 'info');
    }
  };

  const handleRegenWeek = async () => {
    const result = await regenerateWeek();
    if (result && result.changed && result.changeSummary) {
      const count = result.changeSummary.changedSlotCount;
      const dayNames = result.changeSummary.changedDayIndexes.map(i => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]);
      let daysList = dayNames.join(', ');
      if (dayNames.length > 2) {
        daysList = `${dayNames.slice(0, -1).join(', ')} and ${dayNames[dayNames.length - 1]}`;
      }
      showToast(`Week regenerated - ${count} meals updated across ${daysList}`, 'success');
    } else if (result && !result.changed && result.message) {
      showToast(result.message, result.reason === 'action_ignored' ? 'warning' : 'info');
    }
  };

  const handleSkipAndKeep = (assignmentId: string, recipeId?: string) => {
    if (!recipeId) return;
    const recipe = FULL_RECIPE_CATALOG[recipeId];
    if (recipe) {
      skipAndKeepIngredients(assignmentId, recipe);
    }
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
        <View className="flex-row items-center justify-between mb-3">
           <Text className="text-textSec dark:text-darktextSec text-[12px] font-medium tracking-widest uppercase ml-1">This Week</Text>
           <TouchableOpacity 
              onPress={handleRegenWeek}
              disabled={weekLoading}
              className="flex-row items-center opacity-70 hover:opacity-100 active:scale-95 transition-all"
            >
              <FontAwesome5 name="sync-alt" size={10} className={weekLoading ? 'animate-spin mr-2 text-textMain dark:text-white' : 'mr-2 text-textMain dark:text-white'} />
              <Text className="text-textMain dark:text-darktextMain font-bold text-[10px] uppercase tracking-widest">Regenerate Week</Text>
            </TouchableOpacity>
        </View>
        {/* Day pills — Row of 7 rounded day capsules/cards */}
        <View testID="week-selector-pills" className="flex-row gap-1.5 mb-5">
          {DAYS.map((day, idx) => {
            const isSelected = currentDayIndex === idx;
            const isToday = todayIndex === idx;
            return (
              <TouchableOpacity
                key={idx}
                testID={`week-selector-day-${day.toLowerCase()}`}
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
                  {day}
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
            <Text className="text-textMain dark:text-darktextMain text-[20px] font-medium tracking-tight mr-4">
              {days[currentDayIndex]} ({dayAssignments.length} slots)
            </Text>
          </View>
          {/* Day Summary Chips */}
          <View className="flex-col items-end">
            <View className="flex-row gap-2">
              <View className="bg-surface dark:bg-darksurface px-2.5 py-1 rounded-[6px] border border-black/[0.03] dark:border-darksoftBorder">
                <Text className="text-textMain dark:text-darktextMain font-medium text-[11px]"><Text className="text-peach dark:text-[#C48F5D]">●</Text> {Math.round(activeMacros.calories)} kcal</Text>
              </View>
              <View className="bg-surface dark:bg-darksurface px-2.5 py-1 rounded-[6px] border border-black/[0.03] dark:border-darksoftBorder">
                <Text className="text-textMain dark:text-darktextMain font-medium text-[11px]"><Text className="text-lime dark:text-[#A9B86D]">●</Text> {Math.round(activeMacros.protein)}g pro</Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={() => handleRegenDay(displayedDayIndex)}
              disabled={!!dayLoading[displayedDayIndex]}
              className="flex-row items-center mt-3 opacity-70 hover:opacity-100 active:scale-95 transition-all"
            >
              <FontAwesome5 name="sync-alt" size={10} className={dayLoading[displayedDayIndex] ? 'animate-spin mr-2 text-textSec dark:text-darktextSec' : 'mr-2 text-textSec dark:text-darktextSec'} />
              <Text className="text-textSec dark:text-darktextSec font-bold text-[10px] uppercase tracking-widest">Regenerate Day</Text>
            </TouchableOpacity>
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
                <Text className="text-textMain dark:text-darktextMain text-[32px] font-medium tracking-tight leading-none">Liam</Text>
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

              {['breakfast', 'lunch', 'dinner'].map(slotStr => {
                const slot = slotStr as 'breakfast' | 'lunch' | 'dinner';
                const dayRoutine = routine[currentDayKey] as any;
                const vm = getSlotViewModel(slot);
                const isPlannedSlot = isPlanned(dayRoutine[slot]);

                if (!isPlannedSlot) {
                  const icon = slot === 'breakfast' ? 'coffee' : slot === 'lunch' ? 'utensils' : 'moon';
                  return (
                    <View key={`${slot}-empty-${displayedDayIndex}`} className="bg-surface dark:bg-darksurface rounded-[32px] px-6 py-6 mb-4 md:mb-5 shadow-sm dark:shadow-none border border-black/[0.02] dark:border-darksoftBorder flex-row items-center gap-4">
                      <View className="w-12 h-12 rounded-full bg-sageTint dark:bg-darksageTint items-center justify-center flex-shrink-0">
                        <FontAwesome5 name={icon} size={16} color="#9DCD8B" />
                      </View>
                      <View>
                        <Text className="text-textMain dark:text-darktextMain text-[18px] font-semibold tracking-tight">{slotLabel(slot, dayRoutine[slot])}</Text>
                        <Text className="text-textSec dark:text-darktextSec text-[12px] mt-1 opacity-80">Not scheduled for fuel list processing</Text>
                      </View>
                    </View>
                  );
                }

                const assignment = dayAssignments.find(a => a.slotType === slot);

                // Terminal pool collapse: show a clear error message instead of an endless spinner
                if (vm?.isPoolCollapse || assignment?.state === 'pool_collapse') {
                  const collapseMsg = vm?.collapseUserMessage || assignment?.collapseContext?.userMessage || 'No suitable recipe found under your current constraints.';
                  return (
                    <View key={`${slot}-collapse-${displayedDayIndex}`} className="bg-surface dark:bg-darksurface rounded-[32px] px-6 py-6 mb-4 md:mb-5 border border-amber-200 dark:border-amber-900/30 flex-row items-start gap-4">
                      <View className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/10 items-center justify-center flex-shrink-0 mt-0.5">
                        <FontAwesome5 name="exclamation-circle" size={16} color="#f59e0b" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-textMain dark:text-darktextMain text-[15px] font-semibold tracking-tight">{slot.charAt(0).toUpperCase() + slot.slice(1)} — Could Not Replan</Text>
                        <Text className="text-textSec dark:text-darktextSec text-[12px] mt-1 leading-[18px]">{collapseMsg}</Text>
                        <TouchableOpacity
                          onPress={() => handleReplace(slot)}
                          disabled={!!slotLoading[`${displayedDayIndex}_${slot}`]}
                          className="mt-3 flex-row items-center gap-2 self-start px-4 py-2 bg-amber-50 dark:bg-amber-900/10 rounded-full border border-amber-200 dark:border-amber-800/30 disabled:opacity-40"
                        >
                          <FontAwesome5 name={slotLoading[`${displayedDayIndex}_${slot}`] ? 'spinner' : 'sync-alt'} size={10} color="#f59e0b" />
                          <Text className="text-amber-700 dark:text-amber-400 text-[11px] font-bold uppercase tracking-widest">{slotLoading[`${displayedDayIndex}_${slot}`] ? 'Swapping...' : 'Try Swap'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }

                if (!vm || !vm.recipeId) {
                  const isTrulyGenerating = vm?.state === 'generating' || workspace.status === 'generating';
                  return (
                    <View key={`${slot}-loading-${displayedDayIndex}`} className="bg-surface dark:bg-darksurface rounded-[32px] px-6 py-10 mb-4 md:mb-5 border border-dashed border-primary/20 items-center justify-center">
                      {isTrulyGenerating ? (
                        <>
                          <ActivityIndicator color="#9DCD8B" />
                          <Text className="text-textSec dark:text-darktextSec text-[12px] mt-3">Planning {slot}...</Text>
                        </>
                      ) : (
                        <>
                          <FontAwesome5 name="cloud-meatball" size={24} color="#A3B3A9" />
                          <Text className="text-textSec dark:text-darktextSec text-[12px] mt-3 font-medium">No suitable recipe found</Text>
                          <TouchableOpacity onPress={() => handleSwap(slot)} className="mt-2 px-4 py-1.5 bg-primary/10 rounded-full">
                             <Text className="text-primary text-[11px] font-bold">Try Manual Search</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  );
                }

                const recipe = vm.recipeId ? FULL_RECIPE_CATALOG[vm.recipeId] : undefined;
                
                if (vm.recipeId && !recipe) {
                  return (
                    <View key={`${slot}-missing-${displayedDayIndex}`} className="bg-surface dark:bg-darksurface rounded-[32px] px-6 py-6 mb-4 md:mb-5 border border-red-200 dark:border-red-900/30 flex-row items-center gap-4">
                      <View className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/10 items-center justify-center flex-shrink-0">
                        <FontAwesome5 name="exclamation-triangle" size={16} color="#ef4444" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-textMain dark:text-darktextMain text-[16px] font-semibold tracking-tight">Recipe Not Found</Text>
                        <Text className="text-textSec dark:text-darktextSec text-[11px] mt-1 opacity-80">Reference ID: {vm.recipeId}</Text>
                      </View>
                      <TouchableOpacity onPress={() => handleSwap(slot)} className="px-4 py-2 bg-black/5 dark:bg-white/5 rounded-full">
                        <Text className="text-[11px] font-medium">Re-Plan</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }

                return (
                  <View key={`${slot}-${displayedDayIndex}`} className="mb-4 md:mb-4">
                    <RecipeCard
                      recipe={{
                        ...recipe,
                        calories: vm.calories || 0,
                        protein: (recipe as any).macrosPerServing?.protein || (recipe as any).macros?.protein || 0,
                        tags: vm.tags || [],
                      } as any}
                      slotLabel={vm.slotType.charAt(0).toUpperCase() + vm.slotType.slice(1)}
                      day={['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][displayedDayIndex]}
                      slot={vm.slotType}
                      isSkipped={vm.isSkipped}
                      isGenerating={vm.isGenerating}
                      pantryTransferStatus={vm.pantryTransferStatus}
                      onSwipe={() => handleReplace(vm.slotType)}
                      onSkip={() => handleSkip(vm.assignmentId)}
                      onSkipAndKeep={() => handleSkipAndKeep(vm.assignmentId, vm.recipeId || undefined)}
                      onUnskip={() => handleUnskip(vm.assignmentId)}
                      onReplace={() => handleReplace(vm.slotType)}
                    />
                  </View>
                );
              })}

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
                          <Text className="text-textMain dark:text-darktextMain text-[12px] font-semibold tracking-tight">{Math.round(activeMacros.calories)} <Text className="text-textSec font-normal opacity-70">/ {targetCalories}</Text></Text>
                        </View>
                        <View className="h-1.5 bg-black/[0.04] dark:bg-white/[0.04] rounded-full overflow-hidden">
                          <View className="h-full bg-peach dark:bg-[#C48F5D] rounded-full" style={{ width: `${Math.min((activeMacros.calories / targetCalories) * 100, 100)}%` }} />
                        </View>
                      </View>
                      
                      {/* Protein */}
                      <View>
                        <View className="flex-row justify-between items-baseline mb-2">
                          <Text className="text-textSec dark:text-darktextSec text-[12px] font-medium">Protein</Text>
                          <Text className="text-textMain dark:text-darktextMain text-[12px] font-semibold tracking-tight">{Math.round(activeMacros.protein)}g <Text className="text-textSec font-normal opacity-70">/ {targetProtein}g</Text></Text>
                        </View>
                        <View className="h-1.5 bg-black/[0.04] dark:bg-white/[0.04] rounded-full overflow-hidden">
                          <View className="h-full bg-lime dark:bg-[#A9B86D] rounded-full" style={{ width: `${Math.min((activeMacros.protein / targetProtein) * 100, 100)}%` }} />
                        </View>
                      </View>
                    </View>
                  </>
                );
              })()}
            </View>

            {/* Weekly Budget Card — Airy */}
            {(() => {
              const spent = weeklyMetrics.estimatedTotalCostGBP;
              // Fix: 50.01 would display as 50 but trigger 'OVER BUDGET' under strict float > 50.
              // We round both the display and the logic check to ensure UI truthfulness.
              const displayedSpent = Math.round(spent);
              const isOver = displayedSpent > weeklyBudget;
              return (
                <View testID="dashboard-weekly-budget-card" className="bg-surface dark:bg-darksurface rounded-3xl p-5 mb-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] dark:shadow-none border border-black/[0.03] dark:border-darksoftBorder">
                  <View className="flex-row justify-between items-start mb-6">
                    <Text className="text-textMain dark:text-darktextMain text-[18px] font-medium tracking-tight">Grocery Budget</Text>
                    <Text className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${
                      isOver 
                        ? 'bg-red-500/10 text-red-500' 
                        : 'bg-sageTint/50 text-[#A3B0A7] dark:text-[#A3B0A7] dark:bg-darksageTint'
                    }`}>
                      {isOver ? 'Over Budget' : 'On Track'}
                    </Text>
                  </View>
                  <View className="flex-row items-baseline">
                    <Text className="text-textMain dark:text-darktextMain text-[28px] font-medium tracking-tight leading-none">£{displayedSpent}</Text>
                    <Text className="text-[14px] font-medium text-textSec dark:text-darktextSec opacity-60 ml-1.5">/ £{weeklyBudget}</Text>
                  </View>
                </View>
              );
            })()}

            {/* Next Action — Sage Card */}
            <TouchableOpacity
              testID="dashboard-next-action-card"
              onPress={() => router.push('/shop')}
              className="bg-sageTint dark:bg-darksageTint rounded-3xl p-5 mb-4 shadow-sm border border-transparent dark:border-darksoftBorder active:opacity-90 hover:opacity-95 transition-all flex-row items-center cursor-pointer"
            >
              <View className="flex-1 mr-4">
                <Text className="text-primary dark:text-[#85B674] text-[10px] font-bold uppercase tracking-widest mb-1.5">Weekly Prep</Text>
                <Text className="text-textMain dark:text-darktextMain text-[18px] font-medium tracking-tight">
                  {workspace.output?.assignments.filter(a => !!a.recipeId).length || 0} meals planned
                </Text>
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
