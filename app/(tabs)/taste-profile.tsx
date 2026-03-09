import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { MOCK_RECIPES } from '../../data/seed';

export default function TasteProfileScreen() {
  // Mock data for the taste profile
  const [scrapedRecipes, setScrapedRecipes] = useState([
    { id: '1', title: 'High-Protein Greek Yogurt Bowl', domain: 'tasty.co', macros: '+25g Protein', date: 'Just now' },
    { id: '2', title: 'Spicy Black Bean Burger', domain: 'bbcgoodfood.com', macros: '+18g Protein, Vegan', date: 'Yesterday' },
  ]);

  const [diet, setDiet] = useState('Omnivore');
  const [budget, setBudget] = useState(50);
  const [calorieGoal, setCalorieGoal] = useState(2400);

  const deleteRecipe = (id: string) => {
    setScrapedRecipes(prev => prev.filter(r => r.id !== id));
  };

  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-darkcream">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 px-4 pt-6 pb-20 mx-auto w-full md:max-w-7xl md:px-12 min-h-[90vh]">
          {/* Header Section */}
          <View className="mb-8 md:mb-12 mt-4 md:mt-8">
            <Text className="text-charcoal dark:text-darkcharcoal text-4xl md:text-5xl font-extrabold tracking-tight">Taste Profile</Text>
            <Text className="text-gray-500 text-lg md:text-xl font-medium mt-2">The DNA of your meal recommendations.</Text>
          </View>

          <View className="md:grid md:grid-cols-2 md:gap-8 gap-y-8">
            {/* Left Column: Core Rules */}
            <View className="mb-0 h-fit">
              <Text className="text-charcoal dark:text-darkcharcoal text-2xl font-bold mb-4 border-b border-black/10 dark:border-white/10 pb-3">
                Core Rules
              </Text>
              
              <View className="bg-white/60 dark:bg-darkgrey/60 rounded-3xl p-6 border border-white dark:border-white/5 shadow-sm mb-6">
                <View className="flex-row justify-between items-center mb-6">
                  <View>
                    <Text className="text-gray-500 font-medium mb-1">Baseline Diet</Text>
                    <Text className="text-charcoal dark:text-darkcharcoal text-xl font-bold">{diet}</Text>
                  </View>
                  <View className="w-12 h-12 bg-avocado/20 rounded-full items-center justify-center">
                    <FontAwesome5 name="leaf" size={20} color="#6DBE75" />
                  </View>
                </View>

                <View className="flex-row justify-between items-center mb-6">
                  <View>
                    <Text className="text-gray-500 font-medium mb-1">Weekly Budget</Text>
                    <Text className="text-charcoal dark:text-darkcharcoal text-xl font-bold">£{budget}</Text>
                  </View>
                  <View className="w-12 h-12 bg-tomato/20 rounded-full items-center justify-center">
                    <FontAwesome5 name="pound-sign" size={20} color="#FF6B5A" />
                  </View>
                </View>

                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="text-gray-500 font-medium mb-1">Calorie Ceiling</Text>
                    <Text className="text-charcoal dark:text-darkcharcoal text-xl font-bold">{calorieGoal} kcal</Text>
                  </View>
                  <View className="w-12 h-12 bg-blueberry/20 rounded-full items-center justify-center">
                    <FontAwesome5 name="fire" size={20} color="#4F7FFF" />
                  </View>
                </View>
              </View>

              <Text className="text-charcoal dark:text-darkcharcoal text-2xl font-bold mb-4 border-b border-black/10 dark:border-white/10 pb-3 mt-8">
                Vibe Matches
              </Text>
              <Text className="text-gray-500 text-sm mb-4">Recipes you explicitly liked during onboarding.</Text>

              <View className="flex-row flex-wrap justify-between">
                {MOCK_RECIPES.slice(0, 2).map((recipe) => (
                  <View key={recipe.id} className="w-[48%] h-32 rounded-2xl overflow-hidden relative shadow-sm mb-4">
                    <View className="absolute inset-0 bg-black/40 z-10 justify-end p-2">
                       <Text className="text-white font-bold text-xs" numberOfLines={2}>{recipe.title}</Text>
                    </View>
                  </View>
                ))}
              </View>

            </View>

            {/* Right Column: Learned Context (Scraped) */}
            <View className="h-fit">
              <Text className="text-charcoal dark:text-darkcharcoal text-2xl font-bold mb-4 border-b border-black/10 dark:border-white/10 pb-3 flex-row justify-between items-center">
                Learned Context
              </Text>
              <Text className="text-gray-500 text-sm mb-4">Recipes you've scraped to feed the engine's algorithm.</Text>
              
              <View className="bg-white/60 dark:bg-darkgrey/60 rounded-3xl p-4 border border-white dark:border-white/5 shadow-sm">
                {scrapedRecipes.length === 0 ? (
                   <View className="p-8 items-center justify-center">
                     <FontAwesome5 name="ghost" size={32} color="#a1a1aa" className="mb-4" />
                     <Text className="text-gray-500 text-center">No recipes scraped yet. Add some on the dashboard to teach the engine!</Text>
                   </View>
                ) : (
                  scrapedRecipes.map((item, idx) => (
                    <View key={item.id} className={`p-4 border-b border-black/5 dark:border-white/5 ${idx === scrapedRecipes.length - 1 ? 'border-b-0' : ''}`}>
                      <View className="flex-row justify-between items-start mb-2">
                        <View className="flex-1 pr-4">
                          <Text className="text-charcoal dark:text-darkcharcoal font-bold text-lg mb-1">{item.title}</Text>
                          <Text className="text-gray-500 text-xs font-medium">Pulled from {item.domain} • {item.date}</Text>
                        </View>
                        <TouchableOpacity 
                          onPress={() => deleteRecipe(item.id)}
                          className="w-8 h-8 bg-black/5 dark:bg-white/10 rounded-full items-center justify-center hover:bg-tomato/20"
                        >
                          <FontAwesome5 name="trash" size={12} color="#FF6B5A" />
                        </TouchableOpacity>
                      </View>
                      
                      <View className="bg-blueberry/10 self-start px-2 py-1 rounded-md mt-1">
                        <Text className="text-blueberry text-xs font-bold">{item.macros}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>

          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
