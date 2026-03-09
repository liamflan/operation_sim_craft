import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, TextInput, TouchableOpacity, LayoutAnimation } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import RecipeCard from '../../components/RecipeCard';
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
  const [swappedMeals, setSwappedMeals] = useState<Record<string, string>>({}); // Tracks meal swaps for today

  const todayPlan = weeklyPlan[currentDayIndex];
  
  // Helper to fetch the actual active meal ID (accounting for user swaps)
  const getActiveMealId = (type: 'breakfast' | 'lunch' | 'dinner') => {
    return swappedMeals[type] || todayPlan[type];
  };

  // Helper to find recipe object
  const getRecipe = (id?: string) => MOCK_RECIPES.find(r => r.id === id);

  // Re-calculate macros based on ACTIVE meals (including swaps)
  const activePlan = {
    ...todayPlan,
    breakfast: getActiveMealId('breakfast'),
    lunch: getActiveMealId('lunch'),
    dinner: getActiveMealId('dinner'),
  };
  const todayMacros = calculateDailyMacros(activePlan, MOCK_RECIPES);

  const handleSwap = (type: 'breakfast' | 'lunch' | 'dinner') => {
    const currentId = getActiveMealId(type);
    // In a real app, query the engine for a matched alternative.
    // For MVP: grab a random recipe that isn't the current one.
    const alternatives = MOCK_RECIPES.filter(r => r.id !== currentId);
    const newRecipe = alternatives[Math.floor(Math.random() * Math.min(alternatives.length, 5))]; // Pick from first 5
    
    setSwappedMeals(prev => ({ ...prev, [type]: newRecipe.id }));
  };

  // In a real app, this would open a modal or sheet to input the URL
  const handleAddRecipeClick = () => {
    alert("Open 'Add Recipe URL' modal");
  };

  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-darkcream">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 px-4 pt-6 pb-20 mx-auto w-full md:max-w-7xl md:flex-row md:pt-12 md:px-12">
          
          {/* Left Column (Desktop) / Top Section (Mobile) */}
          <View className="md:w-1/3 md:min-w-[340px] md:pr-12 md:sticky md:top-12 h-fit">
            {/* Header Section (Compacted) */}
            <View className="flex-row justify-between items-end mb-4 md:mt-0 pb-3 border-b border-black/5 dark:border-white/5">
              <View>
                <Text className="text-gray-500 text-xs font-bold uppercase tracking-widest">Welcome back,</Text>
                <Text className="text-charcoal dark:text-darkcharcoal text-2xl font-extrabold tracking-tight mt-0.5">{mockUser.name}</Text>
              </View>
            </View>

            {/* Daily Progress Card */}
            <View className="bg-white/60 dark:bg-darkgrey/60 rounded-3xl p-5 mb-4 border border-white dark:border-white/5 shadow-sm backdrop-blur-md">
              <View className="mb-4">
                <Text className="text-charcoal dark:text-darkcharcoal text-xl font-bold tracking-tight">Today</Text>
                <Text className="text-gray-500 text-sm font-medium">Daily Progress</Text>
              </View>

              <View className="space-y-4">
                <View>
                  <View className="flex-row justify-between items-end mb-1">
                    <Text className="text-charcoal dark:text-gray-300 font-bold">Calories: 0 <Text className="text-gray-400 font-normal">/ {mockUser.targetMacros.calories}</Text></Text>
                    <Text className="text-avocado text-xs font-bold">{mockUser.targetMacros.calories} left</Text>
                  </View>
                  <View className="h-2 w-full bg-gray-200 dark:bg-black/40 rounded-full overflow-hidden">
                    <View className="h-full bg-avocado rounded-full" style={{ width: '0%' }}></View>
                  </View>
                </View>
                
                <View className="mt-3">
                  <View className="flex-row justify-between items-end mb-1">
                    <Text className="text-charcoal dark:text-gray-300 font-bold">Protein: 0g <Text className="text-gray-400 font-normal">/ {mockUser.targetMacros.protein}g</Text></Text>
                    <Text className="text-blueberry text-xs font-bold">{mockUser.targetMacros.protein}g left</Text>
                  </View>
                  <View className="h-2 w-full bg-gray-200 dark:bg-black/40 rounded-full overflow-hidden">
                    <View className="h-full bg-blueberry rounded-full" style={{ width: '0%' }}></View>
                  </View>
                </View>

                <View className="mt-3">
                  <View className="flex-row justify-between items-end mb-1">
                    <Text className="text-charcoal dark:text-gray-300 font-bold">Meals: 0 <Text className="text-gray-400 font-normal">/ 3 completed</Text></Text>
                  </View>
                  <View className="h-2 w-full bg-gray-200 dark:bg-black/40 rounded-full overflow-hidden">
                    <View className="h-full bg-tomato rounded-full" style={{ width: '0%' }}></View>
                  </View>
                </View>
              </View>
            </View>

            {/* Weekly Budget Card */}
            <View className="bg-white/60 dark:bg-darkgrey/60 rounded-3xl p-5 mb-5 border border-white dark:border-white/5 shadow-sm backdrop-blur-md">
              <View className="flex-row justify-between items-start mb-4">
                <View>
                  <Text className="text-charcoal dark:text-darkcharcoal text-xl font-bold tracking-tight">Weekly Budget</Text>
                  <Text className="text-avocado font-bold text-sm mt-0.5">On track for the week</Text>
                </View>
              </View>

              <View className="flex-row justify-between items-end border-t border-black/5 dark:border-white/5 pt-4">
                <View>
                  <Text className="text-charcoal dark:text-darkcharcoal text-3xl font-extrabold">£34<Text className="text-lg font-medium text-gray-400"> / £{mockUser.budgetWeekly}</Text></Text>
                </View>
                <Text className="text-gray-500 font-bold mb-1">£{mockUser.budgetWeekly - 34} remaining</Text>
              </View>
            </View>

            {/* Next Action Widget */}
            <TouchableOpacity 
              onPress={() => router.push('/explore')}
              className="bg-avocado rounded-3xl p-5 mb-5 shadow-sm active:opacity-80 transition-opacity hover:opacity-90"
            >
              <View className="flex-row items-start justify-between mb-3">
                <View className="flex-1 mr-4">
                  <Text className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">Next Action</Text>
                  <Text className="text-white text-lg font-bold leading-tight">12 ingredients needed for this week's plan</Text>
                </View>
                <View className="w-10 h-10 bg-white/20 rounded-full items-center justify-center">
                  <FontAwesome5 name="shopping-basket" size={16} color="white" />
                </View>
              </View>
              <View className="bg-white/20 self-start px-4 py-2 rounded-full flex-row items-center border border-white/30">
                <Text className="text-white font-bold text-sm mr-2">Open Fuel List</Text>
                <FontAwesome5 name="arrow-right" size={10} color="white" />
              </View>
            </TouchableOpacity>

            {/* Taste Profile Summary */}
            <View className="bg-white/60 dark:bg-darkgrey/60 rounded-3xl p-5 mb-8 border border-white dark:border-white/5 shadow-sm backdrop-blur-md">
              <View className="flex-row justify-between items-center mb-3">
                <View>
                  <Text className="text-charcoal dark:text-darkcharcoal text-xl font-bold tracking-tight">Taste Profile</Text>
                  <Text className="text-gray-500 text-sm font-medium">Shaping next week's plan</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/taste-profile')}>
                  <Text className="text-avocado font-bold">View full</Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row flex-wrap gap-2 mb-4 mt-2">
                <View className="bg-gray-100 dark:bg-black/20 px-3 py-1.5 rounded-full border border-black/5 dark:border-white/5">
                  <Text className="text-charcoal dark:text-gray-300 text-xs font-bold">High-protein</Text>
                </View>
                <View className="bg-gray-100 dark:bg-black/20 px-3 py-1.5 rounded-full border border-black/5 dark:border-white/5">
                  <Text className="text-charcoal dark:text-gray-300 text-xs font-bold">Spicy</Text>
                </View>
                <View className="bg-gray-100 dark:bg-black/20 px-3 py-1.5 rounded-full border border-black/5 dark:border-white/5">
                  <Text className="text-charcoal dark:text-gray-300 text-xs font-bold">Quick meals</Text>
                </View>
              </View>
              
              <Text className="text-gray-400 text-xs font-medium mb-4">Based on 4 imported recipes</Text>

              <TouchableOpacity 
                onPress={handleAddRecipeClick}
                className="bg-gray-100 dark:bg-black/20 hover:bg-gray-200 dark:hover:bg-black/40 py-3 rounded-xl flex-row items-center justify-center border border-black/5 dark:border-white/5 transition-colors"
              >
                <FontAwesome5 name="plus" size={12} color="#9CA3AF" className="mr-2" />
                <Text className="text-gray-600 dark:text-gray-300 font-bold text-sm">Add recipe</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Right Column (Desktop) / Bottom Section (Mobile) */}
          <View className="md:w-2/3">
            <Text className="text-charcoal dark:text-darkcharcoal text-3xl font-extrabold mb-8 tracking-tight capitalize">
              {todayPlan.date}, <Text className="text-gray-400 font-medium">March 9</Text>
            </Text>

        <View className="mb-20">
          <Text className="text-gray-400 text-sm mb-3 uppercase tracking-wider font-bold ml-2">Breakfast</Text>
          {getRecipe(getActiveMealId('breakfast')) && (
            <RecipeCard 
              recipe={getRecipe(getActiveMealId('breakfast'))!} 
              onSwipe={() => handleSwap('breakfast')}
            />
          )}

          <Text className="text-gray-400 text-sm mb-3 mt-4 uppercase tracking-wider font-bold ml-2">Lunch</Text>
          {getRecipe(getActiveMealId('lunch')) && (
            <RecipeCard 
               recipe={getRecipe(getActiveMealId('lunch'))!} 
               onSwipe={() => handleSwap('lunch')}
            />
          )}

          <Text className="text-gray-400 text-sm mb-3 mt-4 uppercase tracking-wider font-bold ml-2">Dinner</Text>
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
    </SafeAreaView>
  );
}
