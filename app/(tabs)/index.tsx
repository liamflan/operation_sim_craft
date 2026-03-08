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
  const [recipeLink, setRecipeLink] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [recentScrapes, setRecentScrapes] = useState<{url: string, title: string, macros: string}[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
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

  // Mock Handle Scrape
  const handleScrape = () => {
    if (!recipeLink) return;
    setIsScraping(true);
    setShowSuccess(false);
    
    setTimeout(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsScraping(false);
      
      // Extract a fake domain name to make it look real
      const domainMatch = recipeLink.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n?]+)/img);
      const domain = domainMatch ? domainMatch[0].replace('https://', '').replace('www.', '') : 'Recipe Website';
      
      setRecentScrapes(prev => [{
        url: recipeLink,
        title: `Pulled from ${domain}`,
        macros: '+45g Protein added to Taste Profile'
      }, ...prev].slice(0, 3)); // Keep last 3
      
      setRecipeLink('');
      setShowSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => setShowSuccess(false), 3000);
    }, 1500);
  };

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 px-4 pt-6 pb-20 mx-auto w-full md:max-w-7xl md:flex-row md:pt-12 md:px-12">
          
          {/* Left Column (Desktop) / Top Section (Mobile) */}
          <View className="md:w-1/3 md:min-w-[340px] md:pr-12 md:sticky md:top-12 h-fit">
            {/* Header Section */}
            <View className="flex-row justify-between items-start mb-8 md:mb-12 mt-4 md:mt-0">
              <View>
                <Text className="text-gray-500 text-lg font-medium">Welcome back,</Text>
                <Text className="text-charcoal text-4xl md:text-5xl font-extrabold tracking-tight mt-1">{mockUser.name}</Text>
              </View>
            </View>

            {/* Taste Profile Quick Add Feature */}
            <View className="bg-white/60 rounded-3xl p-6 mb-8 border border-white shadow-sm backdrop-blur-md">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-charcoal text-xl font-bold tracking-tight">Taste Profile</Text>
                <TouchableOpacity onPress={() => router.push('/taste-profile')}>
                  <Text className="text-avocado font-bold">View full</Text>
                </TouchableOpacity>
              </View>
              <Text className="text-gray-600 text-sm mb-4 leading-relaxed">Paste a recipe URL to extract macros and teach the engine your exact preferences.</Text>
              
              <View className="flex-row h-12 shadow-sm rounded-xl mb-2">
                <TextInput 
                  value={recipeLink}
                  onChangeText={setRecipeLink}
                  placeholder="https://tasty.co/..."
                  placeholderTextColor="#9ca3af"
                  className="flex-1 bg-white border border-gray-100 rounded-xl px-4 text-charcoal mr-3 font-medium"
                />
                <TouchableOpacity 
                  onPress={handleScrape}
                  disabled={isScraping || !recipeLink}
                  className={`justify-center items-center px-6 rounded-xl transition-colors ${isScraping || !recipeLink ? 'bg-avocado/50' : 'bg-avocado hover:bg-[#5dae65] active:opacity-80'}`}
                >
                  {isScraping ? (
                    <FontAwesome5 name="cog" size={16} color="white" />
                  ) : (
                    <FontAwesome5 name="plus" size={16} color="white" />
                  )}
                </TouchableOpacity>
              </View>

              {/* Success Feedback */}
              {showSuccess && (
                <View className="bg-avocado/10 rounded-lg p-3 border border-avocado/20 flex-row items-center mb-2">
                  <FontAwesome5 name="check-circle" size={14} color="#6DBE75" />
                  <Text className="text-avocado font-medium text-sm ml-2">Recipe successfully parsed & added!</Text>
                </View>
              )}

              {/* Recent Scrapes History */}
              {recentScrapes.length > 0 && (
                <View className="mt-4 border-t border-black/5 pt-4">
                  <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Recent Additions</Text>
                  {recentScrapes.map((scrape, idx) => (
                    <View key={idx} className="flex-row items-center mb-2">
                      <View className="w-8 h-8 rounded-full bg-white items-center justify-center border border-black/5 mr-3">
                        <FontAwesome5 name="link" size={12} color="#a1a1aa" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-charcoal font-bold text-sm" numberOfLines={1}>{scrape.title}</Text>
                        <Text className="text-blueberry text-xs font-medium">{scrape.macros}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Macro Summary Ring (Mocked) */}
            <View className="bg-white/60 rounded-3xl p-6 mb-8 border border-white shadow-sm backdrop-blur-md">
              <Text className="text-charcoal text-xl font-bold mb-6">Today's Fuel</Text>
              <View className="flex-row justify-between md:flex-col md:gap-6">
                <View>
                  <Text className="text-gray-500 text-sm mb-1 font-medium">Calories</Text>
                  <Text className="text-tomato text-3xl font-extrabold">{todayMacros.calories} <Text className="text-base font-medium text-gray-400">/ {mockUser.targetMacros.calories}</Text></Text>
                </View>
                <View>
                  <Text className="text-gray-500 text-sm mb-1 font-medium">Protein</Text>
                  <Text className="text-blueberry text-3xl font-extrabold">{todayMacros.protein}g <Text className="text-base font-medium text-gray-400">/ {mockUser.targetMacros.protein}g</Text></Text>
                </View>
              </View>
            </View>
          </View>

          {/* Right Column (Desktop) / Bottom Section (Mobile) */}
          <View className="md:w-2/3">
            <Text className="text-charcoal text-3xl font-extrabold mb-8 tracking-tight capitalize">
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
