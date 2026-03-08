import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, TextInput, TouchableOpacity } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
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
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [recipeLink, setRecipeLink] = useState('');
  const [isScraping, setIsScraping] = useState(false);

  const todayPlan = weeklyPlan[currentDayIndex];
  
  // Calculate today's macros
  const todayMacros = calculateDailyMacros(todayPlan, MOCK_RECIPES);
  
  // Helper to find recipe
  const getRecipe = (id?: string) => MOCK_RECIPES.find(r => r.id === id);

  // Mock Handle Scrape
  const handleScrape = () => {
    if (!recipeLink) return;
    setIsScraping(true);
    setTimeout(() => {
      setIsScraping(false);
      setRecipeLink('');
      // In a real app we'd use a toast or an alert
      console.log("Taste profile updated with new recipe!");
    }, 1500);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#1A1A1A]">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 px-4 pt-6 pb-20 mx-auto w-full md:max-w-6xl md:flex-row md:pt-12">
          
          {/* Left Column (Desktop) / Top Section (Mobile) */}
          <View className="md:w-1/3 md:pr-8 md:sticky md:top-12 h-fit">
            {/* Header Section */}
            <View className="flex-row justify-between items-start mb-8 md:mb-12 mt-4 md:mt-0">
              <View>
                <Text className="text-gray-400 text-lg font-medium">Welcome back,</Text>
                <Text className="text-white text-4xl md:text-5xl font-extrabold tracking-tight mt-1">{mockUser.name}</Text>
              </View>
            </View>

            {/* Recipe Upload Feature */}
            <View className="bg-white/5 rounded-3xl p-6 mb-8 border border-white/10 backdrop-blur-md">
              <Text className="text-white text-xl font-bold mb-2 tracking-tight">Train the Engine</Text>
              <Text className="text-gray-400 text-sm mb-4 leading-relaxed">Paste a recipe URL to refine your taste profile and automatically add it to your database.</Text>
              <View className="flex-row h-12">
                <TextInput 
                  value={recipeLink}
                  onChangeText={setRecipeLink}
                  placeholder="https://tasty.co/..."
                  placeholderTextColor="#6b7280"
                  className="flex-1 bg-[#1A1A1A]/80 border border-white/10 rounded-xl px-4 text-white mr-3 font-medium shadow-inner"
                />
                <TouchableOpacity 
                  onPress={handleScrape}
                  className="bg-[#4ade80] justify-center items-center px-6 rounded-xl active:opacity-80 hover:bg-[#22c55e] transition-colors shadow-md"
                >
                  {isScraping ? (
                    <FontAwesome5 name="cog" size={16} color="#1A1A1A" />
                  ) : (
                    <FontAwesome5 name="plus" size={16} color="#1A1A1A" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Macro Summary Ring (Mocked) */}
            <View className="bg-white/5 rounded-3xl p-6 mb-8 border border-white/10 backdrop-blur-md">
              <Text className="text-white text-xl font-bold mb-6">Today's Fuel</Text>
              <View className="flex-row justify-between md:flex-col md:gap-6">
                <View>
                  <Text className="text-gray-400 text-sm mb-1">Calories</Text>
                  <Text className="text-[#fb923c] text-3xl font-extrabold">{todayMacros.calories} <Text className="text-base font-medium text-gray-500">/ {mockUser.targetMacros.calories}</Text></Text>
                </View>
                <View>
                  <Text className="text-gray-400 text-sm mb-1">Protein</Text>
                  <Text className="text-[#60a5fa] text-3xl font-extrabold">{todayMacros.protein}g <Text className="text-base font-medium text-gray-500">/ {mockUser.targetMacros.protein}g</Text></Text>
                </View>
              </View>
            </View>
          </View>

          {/* Right Column (Desktop) / Bottom Section (Mobile) */}
          <View className="md:w-2/3">
            <Text className="text-white text-3xl font-bold mb-8 tracking-tight capitalize">
              {todayPlan.date}, <Text className="text-gray-400 font-medium">March 9</Text>
            </Text>

        <View className="mb-20">
          <Text className="text-gray-400 text-sm mb-3 uppercase tracking-wider font-bold ml-2">Breakfast</Text>
          {getRecipe(todayPlan.breakfast) && (
            <RecipeCard recipe={getRecipe(todayPlan.breakfast)!} />
          )}

          <Text className="text-gray-400 text-sm mb-3 mt-4 uppercase tracking-wider font-bold ml-2">Lunch</Text>
          {getRecipe(todayPlan.lunch) && (
            <RecipeCard recipe={getRecipe(todayPlan.lunch)!} />
          )}

          <Text className="text-gray-400 text-sm mb-3 mt-4 uppercase tracking-wider font-bold ml-2">Dinner</Text>
          {getRecipe(todayPlan.dinner) && (
            <RecipeCard recipe={getRecipe(todayPlan.dinner)!} />
          )}
        </View>

          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
