import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, Platform, Alert } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { generateWeeklyPlan } from '../../data/engine';
import { MOCK_RECIPES, MOCK_INGREDIENTS } from '../../data/seed';
import { UserProfile } from '../../data/schema';

// Utility to generate a compiled shopping list with built in traceability
export type ShoppingListItem = { name: string, amount: number, unit: string, checked: boolean, recipes: string[], isRestock?: boolean };
export type CategorizedList = Record<string, ShoppingListItem[]>;

function generateShoppingList(): CategorizedList {
  const mockUser: UserProfile = { 
    id: "u1", 
    name: "Liam", 
    targetMacros: { calories: 2400, protein: 160, carbs: 250, fats: 80 }, 
    budgetWeekly: 50, 
    dietaryPreference: "Omnivore" as const, 
    allergies: [],
    // Mock pantry: Lots of Olive oil (i8), but very low on Soy Sauce (i14)
    pantry: {
      "i8": 20, // 20 tbsp Olive Oil available
      "i14": 1, // Only 1 tbsp Soy Sauce left (needs restock)
      "i7": 2000, // 2kg Rice available
    }
  };
  const weeklyPlan = generateWeeklyPlan(mockUser);
  
  // Track amount and the unique recipes it's used in
  const ingredientMap: Record<string, { amount: number, recipes: Set<string> }> = {};
  
  // Aggregate all ingredients
  weeklyPlan.forEach(day => {
    [day.breakfast, day.lunch, day.dinner].forEach(recipeId => {
      if (!recipeId) return;
      const recipe = MOCK_RECIPES.find(r => r.id === recipeId);
      if (recipe) {
        recipe.ingredients.forEach(ing => {
          if (!ingredientMap[ing.ingredientId]) {
            ingredientMap[ing.ingredientId] = { amount: 0, recipes: new Set() };
          }
          ingredientMap[ing.ingredientId].amount += ing.amount;
          ingredientMap[ing.ingredientId].recipes.add(recipe.title);
        });
      }
    });
  });

  // Group by Category and apply Auto-Deplete logic
  const categorizedList: CategorizedList = {};
  
  Object.keys(ingredientMap).forEach(ingId => {
    const ingData = MOCK_INGREDIENTS.find(i => i.id === ingId);
    if (!ingData) return;

    const requiredAmount = ingredientMap[ingId].amount;
    const currentStock = mockUser.pantry ? mockUser.pantry[ingId] || 0 : 0;

    if (ingData.isStaple) {
      if (currentStock >= requiredAmount) {
        // Sufficient stock, do not add to shopping list.
        return; 
      } else {
        // Low stock! Replace generic amount with the purchaseSize (e.g., 1 bottle)
        if (!categorizedList[ingData.category]) categorizedList[ingData.category] = [];
        categorizedList[ingData.category].push({
          name: ingData.name, 
          amount: ingData.purchaseSize || 1,
          unit: ingData.purchaseUnit || "item",
          checked: false,
          recipes: ["Pantry Staple (Low Stock)"],
          isRestock: true
        });
        return;
      }
    }

    // Normal non-staple item
    if (!categorizedList[ingData.category]) {
      categorizedList[ingData.category] = [];
    }
    categorizedList[ingData.category].push({
      name: ingData.name,
      amount: requiredAmount,
      unit: ingData.defaultUnit,
      checked: false,
      recipes: Array.from(ingredientMap[ingId].recipes)
    });
  });

  return categorizedList;
}

const initialList = generateShoppingList();

export default function ShoppingListScreen() {
  const [list, setList] = useState(initialList);
  const [isExporting, setIsExporting] = useState(false);

  const toggleItem = (category: string, index: number) => {
    const newList = { ...list };
    newList[category][index].checked = !newList[category][index].checked;
    setList(newList);
  };

  const handleCopyText = async () => {
    let textOut = "PROVISION FUEL LIST\n\n";
    Object.entries(list).forEach(([category, items]) => {
      textOut += `--- ${category.toUpperCase()} ---\n`;
      items.forEach(item => {
        textOut += `[ ] ${item.amount}${item.unit} ${item.name} (${item.recipes.join(', ')})\n`;
      });
      textOut += "\n";
    });
    
    await Clipboard.setStringAsync(textOut);
    if (Platform.OS === 'web') {
      window.alert("List copied to clipboard!");
    } else {
      Alert.alert("Copied", "Shopping list copied to clipboard.");
    }
  };

  const handleExportCSV = () => {
    if (Platform.OS !== 'web') {
      Alert.alert("Not Supported", "CSV export is currently only supported on Web.");
      return;
    }
    
    setIsExporting(true);
    try {
      let csvContent = "Aisle,Ingredient,Amount,Unit,Recipes\n";
      Object.entries(list).forEach(([category, items]) => {
        items.forEach(item => {
          // Escape quotes and commas for safe CSV
          const escapedName = `"${item.name.replace(/"/g, '""')}"`;
          const escapedRecipes = `"${item.recipes.join(', ').replace(/"/g, '""')}"`;
          csvContent += `"${category}",${escapedName},${item.amount},"${item.unit}",${escapedRecipes}\n`;
        });
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "provision_fuel_list.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
      window.alert("Failed to export CSV.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-darkcream">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 px-4 pt-6 pb-20 mx-auto w-full md:max-w-7xl md:px-12 min-h-[90vh]">
          
          {/* Header Section */}
          <View className="mb-8 md:mb-12 mt-4 md:mt-8 flex-col md:flex-row md:items-end justify-between">
            <View className="mb-6 md:mb-0">
              <Text className="text-charcoal dark:text-darkcharcoal text-4xl md:text-5xl font-extrabold tracking-tight">The Fuel List</Text>
              <Text className="text-gray-500 text-lg md:text-xl font-medium mt-2">Aggregated ingredients for the week.</Text>
            </View>
            
            {/* Action Buttons */}
            <View className="flex-row gap-3">
              <TouchableOpacity 
                onPress={handleCopyText}
                className="bg-white dark:bg-darkgrey border border-black/5 dark:border-white/5 px-4 py-3 rounded-xl flex-row items-center shadow-sm active:bg-gray-50 dark:active:bg-darkgrey/80"
              >
                <FontAwesome5 name="copy" size={16} color="#4A4A4A" className="mr-2" style={{ color: '#4A4A4A' }} />
                <Text className="text-charcoal dark:text-darkcharcoal font-bold">Copy Text</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={handleExportCSV}
                disabled={isExporting}
                className="bg-charcoal px-4 py-3 rounded-xl flex-row items-center shadow-sm active:bg-charcoal/80"
              >
                <FontAwesome5 name="file-csv" size={16} color="#FFFFFF" className="mr-2" />
                <Text className="text-white font-bold">Export CSV</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="md:grid md:grid-cols-2 md:gap-x-12 md:gap-y-10 gap-y-8 mt-4">
            {Object.entries(list).map(([category, items]) => (
              <View key={category} className="mb-8 md:mb-0 h-fit">
                <Text className="text-charcoal dark:text-darkcharcoal text-xl md:text-2xl font-bold mb-4 border-b border-black/10 dark:border-white/10 pb-3 flex-row items-center">
                  <FontAwesome5 name={category === 'Produce' ? 'carrot' : category === 'Meat & Seafood' ? 'drumstick-bite' : category === 'Dairy & Eggs' ? 'cheese' : 'shopping-basket'} size={18} color="#6DBE75" className="mr-2" />
                  {' ' + category}
                </Text>
                
                <View className="bg-white/60 dark:bg-darkgrey/60 rounded-3xl overflow-hidden border border-white dark:border-white/5 shadow-sm">
                  {items.map((item, idx) => (
                    <TouchableOpacity 
                      key={idx} 
                      onPress={() => toggleItem(category, idx)}
                      className={`flex-row justify-between items-center py-3 px-4 border-b border-black/5 dark:border-white/5 last:border-0 hover:bg-white/90 dark:hover:bg-white/10 transition-colors ${item.checked ? 'opacity-40 bg-gray-50 dark:bg-black/20' : ''}`}
                    >
                      <View className="flex-row items-center flex-1 pr-4">
                        <View className={`w-6 h-6 rounded-full border-2 mr-4 items-center justify-center flex-shrink-0 ${item.checked ? 'border-avocado bg-avocado' : 'border-gray-300 dark:border-gray-600'}`}>
                          {item.checked && <FontAwesome5 name="check" size={10} color="white" />}
                        </View>
                        <View className="flex-shrink flex-1">
                          <View className="flex-row items-center flex-wrap gap-x-2">
                            {item.isRestock && (
                              <View className={`px-2 py-0.5 rounded flex-row items-center ${item.checked ? 'bg-gray-200 dark:bg-gray-700' : 'bg-tomato/20 dark:bg-tomato/30'}`}>
                                <FontAwesome5 name="exclamation-circle" size={10} color={item.checked ? '#9CA3AF' : '#FF6B5A'} className="mr-1" />
                                <Text className={`text-[10px] font-bold uppercase tracking-wider ${item.checked ? 'text-gray-500 dark:text-gray-400' : 'text-tomato dark:text-tomato'}`}>RESTOCK</Text>
                              </View>
                            )}
                            <Text className={`text-charcoal dark:text-darkcharcoal text-lg font-bold flex-wrap leading-tight ${item.checked ? 'line-through text-gray-500 dark:text-gray-500' : ''}`}>
                              {item.name}
                            </Text>
                          </View>
                          {/* Traceability: show which meals this ingredient belongs to */}
                          <Text className={`text-xs mt-0.5 leading-tight ${item.checked ? 'text-gray-400 line-through' : 'text-gray-400 dark:text-gray-500'}`}>
                            {item.recipes.join(', ')}
                          </Text>
                        </View>
                      </View>
                      <Text className={`font-extrabold text-right ml-2 ${item.checked ? 'text-gray-400' : 'text-avocado'}`}>
                        {item.amount} <Text className="text-sm font-bold">{item.unit}</Text>
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
