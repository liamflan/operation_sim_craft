import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, SafeAreaView, TextInput, TouchableOpacity, useWindowDimensions, LayoutAnimation, Platform, StatusBar, Animated, ActivityIndicator, Dimensions } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import RecipeCard from '../../components/RecipeCard';
import ImportRecipeModal from '../../components/ImportRecipeModal';
import SwapDrawer from '../../components/SwapDrawer';
import { slotLabel, isPlanned, DAYS } from '../../data/weeklyRoutine';
import { useActivePlan, PlannerActionStatus, getFriendlyReason } from '../../data/ActivePlanContext';
import { useWeeklyRoutine } from '../../data/WeeklyRoutineContext';
import { useDebug } from '../../data/DebugContext';
import { getMealCardViewModel, getAssignmentsForDay, getWeeklyMetrics } from '../../data/planner/selectors';
import { SlotType, PlannedMealAssignment } from '../../data/planner/plannerTypes';
import { FULL_RECIPE_CATALOG } from '../../data/planner/recipeRegistry';
import { useToast } from '../../components/ToastContext';

export default function DashboardScreen() {
  const router = useRouter();
  const { routine } = useWeeklyRoutine();
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [displayedDayIndex, setDisplayedDayIndex] = useState(0);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const {
    workspace,
    regenerateDay,
    regenerateWeek,
    replaceSlot,
    dayLoading,
    weekLoading,
    slotLoading,
    skipAssignment,
    unskipAssignment,
    skipAndKeepIngredients,
    getSwapCandidates,
    toggleLock,
  } = useActivePlan();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 1024;
  const { showToast } = useToast();
  const { updateDebugData } = useDebug();

  const [swapDrawerVisible, setSwapDrawerVisible] = useState(false);
  const [activeSwapSlot, setActiveSwapSlot] = useState<{ dayIndex: number; slot: SlotType } | null>(null);

  const mealFadeAnim = useRef(new Animated.Value(1)).current;
  const pendingDayIndex = useRef(0);

  const switchDay = (idx: number) => {
    if (idx === displayedDayIndex) return;
    pendingDayIndex.current = idx;
    
    Animated.timing(mealFadeAnim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      setCurrentDayIndex(pendingDayIndex.current);
      setDisplayedDayIndex(pendingDayIndex.current);
      Animated.timing(mealFadeAnim, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }).start();
    });
  };

  const currentDayKey = DAYS[displayedDayIndex];

  const planId = workspace.planId || 'initial';
  const dayAssignments = workspace.output 
    ? getAssignmentsForDay(workspace.output.assignments as PlannedMealAssignment[], planId, displayedDayIndex)
    : [];
  
  const weeklyMetrics = workspace.output
    ? getWeeklyMetrics(workspace.output.assignments as PlannedMealAssignment[], planId, FULL_RECIPE_CATALOG)
    : { totalCalories: 0, totalProtein: 0, estimatedTotalCostGBP: 0, populatedSlots: 0, totalSlots: 0 };

  const weeklyBudget = workspace.input?.payload?.budgetWeekly ?? 50;
  const targetCalories = workspace.input?.payload?.targetCalories ?? 2000;
  const targetProtein = workspace.input?.payload?.targetProtein ?? 160;

  useEffect(() => {
    updateDebugData({ dashboardDisplayedBudget: weeklyBudget });
  }, [weeklyBudget, updateDebugData]);

  const getSlotViewModel = (type: string) => {
    const assignment = dayAssignments.find(a => a.slotType === type);
    if (!assignment) return null;
    const recipeId = assignment.recipeId;
    const recipe = recipeId ? FULL_RECIPE_CATALOG[recipeId] : undefined;
    return getMealCardViewModel(assignment, recipe);
  };

  const activeMacros = dayAssignments.reduce((acc, a) => {
    if (a.recipeId && FULL_RECIPE_CATALOG[a.recipeId]) {
      const r = FULL_RECIPE_CATALOG[a.recipeId];
      acc.calories += r.macrosPerServing.calories;
      acc.protein += r.macrosPerServing.protein;
    }
    return acc;
  }, { calories: 0, protein: 0 });

  const handleSwap = (type: string) => {
    setActiveSwapSlot({ dayIndex: displayedDayIndex, slot: type as SlotType });
    setSwapDrawerVisible(true);
  };

  const handleSkip = (assignmentId: string) => {
    skipAssignment(assignmentId);
  };

  const handleUnskip = (assignmentId: string) => {
    unskipAssignment(assignmentId);
  };

  const handleReplace = async (type: string) => {
    await handleSwap(type);
  };

  const handleRegenDay = async (dayIndex: number) => {
    const result = await regenerateDay(dayIndex);
    const dayName = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][dayIndex];
    
    if (result.status === 'success_changed') {
      showToast(`${dayName} updated`, 'success', { category: 'planner' });
    } else if (result.status === 'success_unchanged') {
      showToast(`No better plan found for ${dayName}`, 'info', { category: 'planner' });
    } else if (result.status.startsWith('failed_')) {
      const friendly = getFriendlyReason(result.status, result.reason);
      showToast(`Couldn’t regenerate ${dayName} - ${friendly}`, 'error', { category: 'planner' });
    }
  };

  const handleRegenWeek = async () => {
    const result = await regenerateWeek();
    
    if (result.status === 'success_changed') {
      showToast(`Week updated`, 'success', { category: 'planner' });
    } else if (result.status === 'success_unchanged') {
      showToast(`No better week plan found`, 'info', { category: 'planner' });
    } else if (result.status.startsWith('failed_')) {
      const friendly = getFriendlyReason(result.status, result.reason);
      showToast(`Couldn’t regenerate week - ${friendly}`, 'error', { category: 'planner' });
    }
  };

  const handleSkipAndKeep = (assignmentId: string, recipeId?: string) => {
    if (!recipeId) return;
    const recipe = FULL_RECIPE_CATALOG[recipeId];
    if (recipe) {
      skipAndKeepIngredients(assignmentId, recipe);
    }
  };

  const [tasteProfileTags] = useState(['High-protein', 'Spicy', 'Quick meals']);

  const handleAddRecipeClick = () => setImportModalVisible(true);

  const MobileDashboard = () => {
    // REAL DATA: Date/Day Context Stability
    // REAL DATA: Date/Day Context Stability (Dervied from Plan Generation)
    const monday = useMemo(() => {
      const baseDate = workspace.generatedAt ? new Date(workspace.generatedAt) : new Date();
      // Ensure we always show the week of the plan, not the current device wall-clock week
      const d = new Date(baseDate);
      const jsDay = d.getDay();
      const diff = jsDay === 0 ? -6 : 1 - jsDay;
      d.setDate(d.getDate() + diff);
      d.setHours(0, 0, 0, 0);
      return d;
    }, [workspace.generatedAt]);
    
    const activeDate = useMemo(() => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + displayedDayIndex);
      return d;
    }, [monday, displayedDayIndex]);

    const dateString = activeDate.toLocaleDateString('en-GB', { 
      weekday: 'long', 
      day: 'numeric',
      month: 'short' 
    });
    
    // REAL DATA: Dynamic Greeting Rooted in Payload
    const userFirstName = (workspace.input?.payload as any)?.userName || "Gourmet";

    // REAL DATA: Taste Profile Summary
    const tasteProfileSummary = useMemo(() => {
      const payload = workspace.input?.payload;
      if (!payload) return 'Personalised Plan';
      const items: string[] = [];
      if (payload.diet) items.push(payload.diet);
      if (payload.preferredCuisineIds && payload.preferredCuisineIds.length > 0) {
        items.push(`${payload.preferredCuisineIds.length} Cuisines`);
      }
      return items.join(' • ') || 'Personalised Plan';
    }, [workspace.input?.payload]);

    const budgetWarning = weeklyMetrics.estimatedTotalCostGBP > weeklyBudget;

    return (
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* 1. Brand & Greeting */}
          <View className="px-6 pt-6 pb-4 flex-row justify-between items-center">
            <View className="flex-1">
              <Text className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-1">{dateString}</Text>
              <Text className="text-slate-900 text-3xl font-bold tracking-tight leading-none" numberOfLines={1}>Hey, {userFirstName}</Text>
            </View>
            <TouchableOpacity 
              activeOpacity={0.7} 
              className="size-12 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 shadow-sm"
            >
              <FontAwesome5 name="cog" size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>
 
          {/* 2. Unified Day Selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pl-6 py-2">
            {DAYS.map((day, idx) => {
              const isSelected = currentDayIndex === idx;
              const pillDate = new Date(monday);
              pillDate.setDate(monday.getDate() + idx);
              const dayNum = pillDate.getDate();
 
              return (
                <TouchableOpacity
                  key={day}
                  activeOpacity={0.85}
                  onPress={() => switchDay(idx)}
                  className={`flex h-[72px] min-w-[56px] items-center justify-center rounded-[20px] mr-3 ${
                    isSelected ? 'bg-primary shadow-md shadow-primary/20' : 'bg-white border border-slate-50 shadow-sm'
                  }`}
                >
                  <Text className={`text-[10px] uppercase font-black tracking-widest mb-1 ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                    {day.slice(0, 3)}
                  </Text>
                  <Text className={`text-[17px] font-bold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                    {dayNum}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
 
          {/* 3. Daily Feed */}
          <View className="px-6 py-6">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-slate-900 text-[20px] font-bold tracking-tight">Daily Planner</Text>
              <TouchableOpacity 
                activeOpacity={0.6}
                onPress={() => handleRegenDay(displayedDayIndex)} 
                disabled={!!dayLoading?.[displayedDayIndex]}
                className="size-10 items-center justify-center bg-slate-50 rounded-full"
              >
                <FontAwesome5 name="sync-alt" size={12} color="#8ca18f" spin={dayLoading?.[displayedDayIndex]} />
              </TouchableOpacity>
            </View>
 
            <Animated.View style={{ opacity: mealFadeAnim }}>
              {['breakfast', 'lunch', 'dinner'].map(slot => {
                const vm = getSlotViewModel(slot);
                const assignmentRef = dayAssignments.find(a => a.slotType === slot);
                const dayRoutine = routine[DAYS[displayedDayIndex]] as any;
                
                if (!isPlanned(dayRoutine[slot])) return null;
 
                if (!vm || !vm.recipeId) {
                  return (
                    <View key={slot} className="bg-slate-50/50 h-[120px] rounded-[24px] border border-dashed border-slate-200 items-center justify-center mb-6">
                      <ActivityIndicator color="#8ca18f" />
                    </View>
                  );
                }
 
                const recipe = FULL_RECIPE_CATALOG[vm.recipeId];
                return (
                  <RecipeCard
                    key={slot}
                    variant="mobile"
                    recipe={{ ...recipe, calories: vm.calories || 0 } as any}
                    slot={slot}
                    day={DAYS[displayedDayIndex]}
                    isSkipped={vm.isSkipped}
                    isLocked={assignmentRef?.state === 'locked'}
                    isGenerating={vm.isGenerating}
                    pantryTransferStatus={assignmentRef?.pantryTransferStatus || null}
                    onSwipe={() => handleSwap(slot)}
                    onSkip={() => handleSkip(vm.assignmentId)}
                    onUnskip={() => handleUnskip(vm.assignmentId)}
                    onSkipAndKeep={() => handleSkipAndKeep(vm.assignmentId, vm.recipeId || undefined)}
                    onReplace={() => handleReplace(slot)}
                    onLock={() => toggleLock(vm.assignmentId)}
                  />
                );
              })}
            </Animated.View>
          </View>
 
          {/* 4. Weekly Progress Tracker */}
          <View className="px-6 mb-8">
            <View className="bg-slate-50 rounded-[32px] p-6 border border-slate-100">
               <View className="flex-row justify-between items-center mb-6">
                  <Text className="text-slate-900 text-lg font-bold tracking-tight">Status Overview</Text>
                  <TouchableOpacity 
                    activeOpacity={0.8}
                    onPress={handleRegenWeek} 
                    disabled={weekLoading}
                    className="flex-row items-center gap-2 bg-white px-5 h-[44px] rounded-[16px] border border-slate-200 shadow-sm active:opacity-70"
                  >
                    <FontAwesome5 name="sync-alt" size={10} color="#8ca18f" spin={weekLoading} />
                    <Text className="text-slate-600 text-[10px] font-black uppercase tracking-[0.1em]">Update Week</Text>
                  </TouchableOpacity>
               </View>
 
               <View className="gap-6 mb-8">
                  <View>
                    <View className="flex-row justify-between mb-2">
                       <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Daily Energy</Text>
                       <Text className="text-slate-900 text-xs font-bold">{Math.round(activeMacros.calories)} / {targetCalories} kcal</Text>
                    </View>
                    <View className="h-2 bg-white rounded-full border border-slate-100 overflow-hidden">
                       <View className="h-full bg-primary" style={{ width: `${Math.min((activeMacros.calories / targetCalories) * 100, 100)}%` }} />
                    </View>
                  </View>
                  <View>
                    <View className="flex-row justify-between mb-2">
                       <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Protein Intake</Text>
                       <Text className="text-slate-900 text-xs font-bold">{Math.round(activeMacros.protein)}g / {targetProtein}g</Text>
                    </View>
                    <View className="h-2 bg-white rounded-full border border-slate-100 overflow-hidden">
                       <View className="h-full bg-primary/40" style={{ width: `${Math.min((activeMacros.protein / targetProtein) * 100, 100)}%` }} />
                    </View>
                  </View>
               </View>
 
               <View className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm">
                  <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[0.1em] mb-2">Spend Tracker</Text>
                  <View className="flex-row items-baseline">
                    <Text className={`text-2xl font-bold tracking-tight ${budgetWarning ? 'text-red-500' : 'text-slate-900'}`}>£{Math.round(weeklyMetrics.estimatedTotalCostGBP)}</Text>
                    <Text className="text-slate-400 text-sm font-medium ml-1.5">/ £{weeklyBudget}</Text>
                  </View>
                  {budgetWarning && (
                    <Text className="text-red-400 text-[10px] font-bold uppercase tracking-wider mt-2">Exceeding Weekly Plan</Text>
                  )}
               </View>
            </View>
          </View>
 
          {/* 5. Workspace Tools - TRUE PARITY styling */}
          <View className="px-6 pb-12">
            <Text className="text-slate-900 text-lg font-bold tracking-tight mb-5">Workspace Tools</Text>
            
            <View className="gap-3">
              <TouchableOpacity 
                activeOpacity={0.8} 
                onPress={() => router.push('/shopping-list')} 
                className="flex-row items-center px-4 h-[60px] rounded-[20px] bg-slate-50 border border-slate-100 active:opacity-70"
              >
                <View className="size-10 rounded-[14px] bg-white items-center justify-center shadow-sm">
                  <FontAwesome5 name="shopping-basket" size={16} color="#8ca18f" />
                </View>
                <View className="flex-1 ml-4">
                  <Text className="text-slate-900 text-sm font-bold">Shopping List</Text>
                  <Text className="text-slate-400 text-[10px] font-medium uppercase tracking-wide">Manage and export items</Text>
                </View>
                <FontAwesome5 name="chevron-right" size={10} color="#cbd5e1" />
              </TouchableOpacity>
 
              <TouchableOpacity 
                activeOpacity={0.8} 
                onPress={() => router.push('/taste-profile')} 
                className="flex-row items-center px-4 h-[60px] rounded-[20px] bg-slate-50 border border-slate-100 active:opacity-70"
              >
                <View className="size-10 rounded-[14px] bg-white items-center justify-center shadow-sm">
                  <FontAwesome5 name="utensils" size={14} color="#8ca18f" />
                </View>
                <View className="flex-1 ml-4">
                  <Text className="text-slate-900 text-sm font-bold">Taste Profile</Text>
                  <Text className="text-slate-400 text-[10px] font-medium uppercase tracking-wide">{tasteProfileSummary}</Text>
                </View>
                <FontAwesome5 name="chevron-right" size={10} color="#cbd5e1" />
              </TouchableOpacity>
 
              <TouchableOpacity 
                activeOpacity={0.8} 
                onPress={handleAddRecipeClick} 
                className="flex-row items-center px-4 h-[60px] rounded-[20px] bg-white border border-dashed border-slate-200 active:opacity-70"
              >
                <View className="size-10 rounded-[14px] bg-slate-50 items-center justify-center">
                  <FontAwesome5 name="plus" size={12} color="#94a3b8" />
                </View>
                <View className="flex-1 ml-4">
                  <Text className="text-slate-500 text-sm font-bold">Import Custom Recipe</Text>
                  <Text className="text-slate-300 text-[10px] font-medium italic">Gemini-powered parsing</Text>
                </View>
              </TouchableOpacity>
            </View>
 
            {/* 6. Quick Preps: Isolated Beta */}
            <View className="mt-8 pt-8 border-t border-slate-50">
               <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-slate-900 text-lg font-bold tracking-tight">Quick Preps</Text>
                  <View className="bg-slate-100 px-2 py-0.5 rounded-full">
                     <Text className="text-slate-400 text-[8px] font-black uppercase tracking-widest">Beta</Text>
                  </View>
               </View>
               <View className="flex-row gap-3 opacity-60">
                  <View className="flex-1 p-4 rounded-[22px] bg-slate-50 border border-slate-100">
                    <FontAwesome5 name="clock" size={12} color="#94a3b8" style={{ marginBottom: 8 }} />
                    <Text className="text-slate-800 text-xs font-bold">Ingredient Prep</Text>
                    <Text className="text-slate-400 text-[10px] mt-1">Available in v2.1</Text>
                  </View>
                  <View className="flex-1 p-4 rounded-[22px] bg-slate-50 border border-slate-100">
                    <FontAwesome5 name="box" size={12} color="#94a3b8" style={{ marginBottom: 8 }} />
                    <Text className="text-slate-800 text-xs font-bold">Bulk Actions</Text>
                    <Text className="text-slate-400 text-[10px] mt-1">Available in v2.1</Text>
                  </View>
               </View>
            </View>
          </View>
        </ScrollView>
 
        <StatusBar barStyle="dark-content" />
      </SafeAreaView>
    );
  };

  const DesktopDashboard = () => {
    const isDayLoading = !!dayLoading?.[displayedDayIndex];
    const fullDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const activeFullDayName = fullDays?.[currentDayIndex] ?? '';
    const daysArr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const activeDayLabel = daysArr?.[currentDayIndex] ?? '';

    return (
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
          <View
            testID="dashboard-main-column"
            className="flex-1 min-w-0"
          >
            <View className="flex-row justify-between items-end mb-4 pt-1">
              <View>
                <Text className="text-textSec text-[11px] font-medium tracking-[0.15em] mb-1 opacity-80 uppercase">Morning,</Text>
                <Text className="text-textMain dark:text-darktextMain text-[32px] font-medium tracking-tight leading-none">Liam</Text>
              </View>
              
              <View className="flex-row items-center gap-2 bg-surface dark:bg-darksurface px-4 py-2 rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-none border border-black/[0.02] dark:border-darksoftBorder">
                <FontAwesome5 name="calendar-day" size={10} color="#9DCD8B" />
                <Text className="text-textMain dark:text-darktextMain font-medium text-[11px] uppercase tracking-widest ml-1">This Week</Text>
                <View className="w-[1px] h-3 bg-softBorder dark:bg-darksoftBorder mx-1" />
                <Text className="text-textSec dark:text-darktextSec text-[11px] font-medium">Mar 9 – 15</Text>
              </View>
            </View>

            <View testID="dashboard-week-selector" className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                 <Text className="text-textSec dark:text-darktextSec text-[12px] font-medium tracking-widest uppercase ml-1">This Week</Text>
                 <TouchableOpacity 
                    onPress={handleRegenWeek}
                    disabled={weekLoading}
                    activeOpacity={0.7}
                    className="flex-row items-center opacity-70"
                  >
                    <FontAwesome5 name="sync-alt" size={10} className={weekLoading ? 'animate-spin mr-2 text-textMain dark:text-white' : 'mr-2 text-textMain dark:text-white'} />
                    <Text className="text-textMain dark:text-darktextMain font-bold text-[10px] uppercase tracking-widest">Regenerate Week</Text>
                  </TouchableOpacity>
              </View>
              <View testID="week-selector-pills" className="flex-row gap-1.5 mb-5">
                {DAYS.map((day, idx) => {
                  const isSelected = currentDayIndex === idx;
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => switchDay(idx)}
                      activeOpacity={0.8}
                      className={`flex-1 items-center justify-center py-2.5 rounded-[12px] border ${
                        isSelected
                          ? 'bg-primary/10 dark:bg-darksageTint border-primary/20 dark:border-primary/20 shadow-[0_2px_8px_rgba(157,205,139,0.15)] dark:shadow-none'
                          : 'bg-[#FBFCF8] dark:bg-darksurface border-black/[0.04] dark:border-darksoftBorder'
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
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View testID="week-selector-active-day" className="flex-row items-center justify-between pb-2">
                <View>
                  <Text testID="dashboard-current-date-heading" className="text-textMain dark:text-darktextMain text-[28px] font-medium tracking-tight mb-1">
                    {activeFullDayName}
                  </Text>
                  <Text className="text-textMain dark:text-darktextMain text-[20px] font-medium tracking-tight mr-4">
                    {activeDayLabel} ({dayAssignments.length} slots)
                  </Text>
                </View>
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
                    disabled={isDayLoading}
                    activeOpacity={0.7}
                    className="flex-row items-center mt-3 opacity-70"
                  >
                    <FontAwesome5 name="sync-alt" size={10} className={isDayLoading ? 'animate-spin mr-2 text-textSec dark:text-darktextSec' : 'mr-2 text-textSec dark:text-darktextSec'} />
                    <Text className="text-textSec dark:text-darktextSec font-bold text-[10px] uppercase tracking-widest">Regenerate Day</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <Animated.View testID="dashboard-meal-feed" className="mt-2" style={{ opacity: mealFadeAnim }}>
              {['breakfast', 'lunch', 'dinner'].map(slotStr => {
                const slot = slotStr as 'breakfast' | 'lunch' | 'dinner';
                const dayRoutine = routine[currentDayKey] as any;
                const vm = getSlotViewModel(slot);
                const isPlannedSlot = isPlanned(dayRoutine[slot]);
                const assignmentRef = dayAssignments.find(a => a.slotType === slot);

                if (!isPlannedSlot) {
                  const icon = slot === 'breakfast' ? 'coffee' : slot === 'lunch' ? 'utensils' : 'moon';
                  return (
                    <View key={`${slot}-empty-${displayedDayIndex}`} className="bg-surface dark:bg-darksurface rounded-[32px] px-6 py-6 mb-4 md:mb-5 shadow-sm dark:shadow-none border border-black/[0.02] dark:border-darksoftBorder flex-row items-center gap-4">
                      <View className="w-12 h-12 rounded-full bg-sageTint dark:bg-darksageTint items-center justify-center flex-shrink-0">
                        <FontAwesome5 name={icon} size={16} color="#9DCD8B" />
                      </View>
                      <View>
                        <Text className="text-textMain dark:text-darktextMain text-[18px] font-semibold tracking-tight">{slotLabel(slot, dayRoutine[slot])}</Text>
                        <Text className="text-textSec dark:text-darktextSec text-[12px] mt-1 opacity-80">Not scheduled</Text>
                      </View>
                    </View>
                  );
                }

                if (!vm || !vm.recipeId) {
                   return (
                    <View key={`${slot}-loading-${displayedDayIndex}`} className="bg-surface dark:bg-darksurface rounded-[32px] px-6 py-10 mb-4 md:mb-5 border border-dashed border-primary/20 items-center justify-center">
                      <ActivityIndicator color="#9DCD8B" />
                      <Text className="text-textSec dark:text-darktextSec text-[12px] mt-3">Planning {slot}...</Text>
                    </View>
                  );
                }

                const recipe = FULL_RECIPE_CATALOG[vm.recipeId];
                return (
                  <View key={`${slot}-${displayedDayIndex}`} className="mb-4 md:mb-4">
                    <RecipeCard
                      recipe={{
                        ...recipe,
                        calories: vm.calories || 0,
                        tags: vm.tags || [],
                      } as any}
                      slotLabel={vm.slotType.charAt(0).toUpperCase() + vm.slotType.slice(1)}
                      day={DAYS[displayedDayIndex]}
                      slot={vm.slotType}
                      isSkipped={vm.isSkipped}
                      isLocked={assignmentRef?.state === 'locked'}
                      isGenerating={vm.isGenerating}
                      onSwipe={() => handleReplace(vm.slotType)}
                      onSkip={() => handleSkip(vm.assignmentId)}
                      onUnskip={() => handleUnskip(vm.assignmentId)}
                      onReplace={() => handleReplace(vm.slotType)}
                      onLock={() => toggleLock(vm.assignmentId)}
                    />
                  </View>
                );
              })}
            </Animated.View>
          </View>

          <View
            testID="dashboard-support-column"
            style={Platform.OS === 'web'
              ? {
                  width: 320,
                  flexShrink: 0,
                  marginTop: 104,
                } as any
              : { marginTop: 40 }
            }
          >
            <View className="bg-surface dark:bg-darksurface rounded-3xl p-5 mb-4 border border-black/[0.03] dark:border-darksoftBorder">
              <Text className="text-textMain dark:text-darktextMain text-[18px] font-medium mb-6">Active Plan</Text>
              <View className="gap-6">
                <View>
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-textSec text-[12px]">Calories</Text>
                    <Text className="text-textMain text-[12px] font-semibold">{Math.round(activeMacros.calories)} / {targetCalories}</Text>
                  </View>
                  <View className="h-1.5 bg-black/[0.04] rounded-full overflow-hidden">
                    <View className="h-full bg-peach rounded-full" style={{ width: `${Math.min((activeMacros.calories / targetCalories) * 100, 100)}%` }} />
                  </View>
                </View>
                <View>
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-textSec text-[12px]">Protein</Text>
                    <Text className="text-textMain text-[12px] font-semibold">{Math.round(activeMacros.protein)}g / {targetProtein}g</Text>
                  </View>
                  <View className="h-1.5 bg-black/[0.04] rounded-full overflow-hidden">
                    <View className="h-full bg-lime rounded-full" style={{ width: `${Math.min((activeMacros.protein / targetProtein) * 100, 100)}%` }} />
                  </View>
                </View>
              </View>
            </View>

            <View className="bg-surface dark:bg-darksurface rounded-3xl p-5 mb-4 border border-black/[0.03] dark:border-darksoftBorder">
               <Text className="text-textMain dark:text-darktextMain text-[18px] font-medium mb-6">Grocery Budget</Text>
               <View className="flex-row items-baseline">
                <Text className="text-textMain text-[28px] font-medium">£{Math.round(weeklyMetrics.estimatedTotalCostGBP)}</Text>
                <Text className="text-[14px] text-textSec ml-1.5">/ £{weeklyBudget}</Text>
              </View>
            </View>

            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => router.push('/shopping-list')} 
              className="bg-sageTint rounded-3xl p-5 mb-4 flex-row items-center"
            >
              <View className="flex-1">
                <Text className="text-primary text-[10px] font-bold uppercase mb-1.5">SHOPPING LIST</Text>
                <Text className="text-textMain text-[18px] font-medium">{workspace.output?.assignments.filter(a => !!a.recipeId).length || 0} meals planned</Text>
              </View>
              <FontAwesome5 name="arrow-right" size={14} color="#9DCD8B" />
            </TouchableOpacity>

            <View className="bg-surface dark:bg-darksurface rounded-3xl p-5 border border-black/[0.03] dark:border-darksoftBorder">
               <View className="flex-row justify-between items-center mb-5">
                <Text className="text-textMain text-[18px] font-medium">Taste Profile</Text>
                <TouchableOpacity onPress={() => router.push('/taste-profile')}>
                  <Text className="text-textSec text-[12px]">Edit</Text>
                </TouchableOpacity>
              </View>
              <View className="flex-row flex-wrap gap-2 mb-6">
                {tasteProfileTags.map(tag => (
                  <View key={tag} className="bg-appBg border border-black/[0.04] px-2.5 py-1.5 rounded-full">
                    <Text className="text-textMain text-[11px] font-medium opacity-80">{tag}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={handleAddRecipeClick} 
                className="py-3 rounded-full border border-softBorder/80 bg-surface items-center"
              >
                <Text className="text-textSec font-medium text-[13px]">Import Recipe Link</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <View testID="dashboard-screen" className="flex-1 bg-white dark:bg-slate-900">
      {isDesktop ? <DesktopDashboard /> : <MobileDashboard />}
      
      <ImportRecipeModal
        visible={importModalVisible}
        onClose={() => setImportModalVisible(false)}
      />

      <SwapDrawer
        isVisible={swapDrawerVisible}
        onClose={() => setSwapDrawerVisible(false)}
        dayIndex={activeSwapSlot?.dayIndex ?? 0}
        slotType={activeSwapSlot?.slot ?? 'lunch'}
        currentRecipeId={activeSwapSlot ? (dayAssignments.find(a => a.slotType === activeSwapSlot.slot)?.recipeId ?? null) : null}
      />
    </View>
  );
}
