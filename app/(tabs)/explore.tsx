import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { generateWeeklyPlan } from '../../data/engine';
import { MOCK_RECIPES, MOCK_INGREDIENTS } from '../../data/seed';

// Utility to generate a compiled shopping list
function generateShoppingList() {
  const mockUser = { id: "u1", name: "Liam", targetMacros: { calories: 2400, protein: 160, carbs: 250, fats: 80 }, budgetWeekly: 50, dietaryPreference: "Omnivore" as const, allergies: [] };
  const weeklyPlan = generateWeeklyPlan(mockUser);
  
  const ingredientMap: Record<string, number> = {};
  
  // Aggregate all ingredients
  weeklyPlan.forEach(day => {
    [day.breakfast, day.lunch, day.dinner].forEach(recipeId => {
      if (!recipeId) return;
      const recipe = MOCK_RECIPES.find(r => r.id === recipeId);
      if (recipe) {
        recipe.ingredients.forEach(ing => {
          ingredientMap[ing.ingredientId] = (ingredientMap[ing.ingredientId] || 0) + ing.amount;
        });
      }
    });
  });

  // Group by Category
  const categorizedList: Record<string, {name: string, amount: number, unit: string, checked: boolean}[]> = {};
  
  Object.keys(ingredientMap).forEach(ingId => {
    const ingData = MOCK_INGREDIENTS.find(i => i.id === ingId);
    if (ingData) {
      if (!categorizedList[ingData.category]) {
        categorizedList[ingData.category] = [];
      }
      categorizedList[ingData.category].push({
        name: ingData.name,
        amount: ingredientMap[ingId],
        unit: ingData.defaultUnit,
        checked: false
      });
    }
  });

  return categorizedList;
}

const initialList = generateShoppingList();

export default function ShoppingListScreen() {
  const [list, setList] = useState(initialList);

  const toggleItem = (category: string, index: number) => {
    const newList = { ...list };
    newList[category][index].checked = !newList[category][index].checked;
    setList(newList);
  };

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 px-4 pt-6 pb-20 mx-auto w-full md:max-w-7xl md:px-12 min-h-[90vh]">
          {/* Header Section */}
          <View className="mb-8 md:mb-12 mt-4 md:mt-8">
            <Text className="text-charcoal text-4xl md:text-5xl font-extrabold tracking-tight">The Fuel List</Text>
            <Text className="text-gray-500 text-lg md:text-xl font-medium mt-2">Generic ingredients for the week.</Text>
          </View>

          <View className="md:grid md:grid-cols-2 md:gap-8 gap-y-8">
            {Object.entries(list).map(([category, items]) => (
              <View key={category} className="mb-8 md:mb-0 h-fit">
                <Text className="text-charcoal text-xl md:text-2xl font-bold mb-4 border-b border-black/10 pb-3 flex-row items-center">
                  {category}
                </Text>
                
                <View className="bg-white/60 rounded-2xl p-2 border border-white shadow-sm">
                  {items.map((item, idx) => (
                    <TouchableOpacity 
                      key={idx} 
                      onPress={() => toggleItem(category, idx)}
                      className={`flex-row justify-between items-center p-4 border-b border-black/5 last:border-0 hover:bg-white/80 transition-colors ${item.checked ? 'opacity-40' : ''}`}
                    >
                      <View className="flex-row items-center flex-1 pr-4">
                        <View className={`w-6 h-6 rounded-full border-2 mr-4 items-center justify-center flex-shrink-0 ${item.checked ? 'border-avocado bg-avocado' : 'border-gray-400'}`}>
                          {item.checked && <FontAwesome5 name="check" size={10} color="white" />}
                        </View>
                        <Text className={`text-charcoal text-lg font-medium flex-wrap ${item.checked ? 'line-through' : ''}`}>
                          {item.name}
                        </Text>
                      </View>
                      <Text className="text-gray-500 font-bold whitespace-nowrap">
                        {item.amount} <Text className="text-sm font-normal">{item.unit}</Text>
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
