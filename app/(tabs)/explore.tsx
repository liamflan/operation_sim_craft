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

// Sub-components for structure and utility
const StatBadge = ({ label, icon, color, testID }: { label: string, icon: string, color: string, testID?: string }) => (
  <View testID={testID} className={`flex-row items-center px-3 py-1.5 rounded-full ${color}`}>
    <FontAwesome5 name={icon} size={12} color="currentColor" className="mr-2" />
    <Text className="font-bold text-xs">{label}</Text>
  </View>
);

const FilterToggle = ({ active, onPress, label, testID }: { active: boolean, onPress: () => void, label: string, testID?: string }) => (
  <TouchableOpacity 
    testID={testID}
    onPress={onPress}
    className={`flex-row items-center px-4 py-2 rounded-xl border transition-all ${active ? 'bg-avocado border-avocado' : 'bg-white dark:bg-darkgrey border-black/5 dark:border-white/5'}`}
  >
    <View className={`w-4 h-4 rounded-md border mr-3 items-center justify-center ${active ? 'bg-white border-white' : 'border-gray-300 dark:border-gray-600'}`}>
      {active && <FontAwesome5 name="check" size={8} color="#6DBE75" />}
    </View>
    <Text className={`font-bold text-sm ${active ? 'text-white' : 'text-gray-500'}`}>{label}</Text>
  </TouchableOpacity>
);

const ActionButton = ({ icon, label, onPress, disabled, testID }: { icon: string, label: string, onPress: () => void, disabled?: boolean, testID?: string }) => (
  <TouchableOpacity 
    testID={testID}
    onPress={onPress}
    disabled={disabled}
    className={`flex-row items-center px-4 py-2.5 rounded-xl border border-black/5 dark:border-white/5 bg-white dark:bg-darkgrey shadow-sm active:bg-gray-50 dark:active:bg-darkgrey/80 transition-all ${disabled ? 'opacity-50' : ''}`}
  >
    <FontAwesome5 name={icon} size={14} color="#4A4A4A" className={label ? "mr-2" : ""} />
    {label ? <Text className="text-charcoal dark:text-darkcharcoal font-bold text-sm">{label}</Text> : null}
  </TouchableOpacity>
);

const getCategoryIcon = (cat: string) => {
  switch (cat) {
    case 'Produce': return 'carrot';
    case 'Meat & Seafood': return 'drumstick-bite';
    case 'Dairy & Eggs': return 'cheese';
    case 'Pantry Staples': return 'mortar-pestle';
    case 'Grains & Pasta': return 'bread-slice';
    default: return 'shopping-basket';
  }
};

export default function ShoppingListScreen() {
  const [list, setList] = useState(initialList);
  const [isExporting, setIsExporting] = useState(false);
  const [hideStaples, setHideStaples] = useState(false);

  const totalIngredients = Object.values(list).flat().filter(item => !hideStaples || !item.isRestock).length;
  const categoryCount = Object.keys(list).filter(cat => !hideStaples || list[cat].some(i => !i.isRestock)).length;
  const checkedCount = Object.values(list).flat().filter(item => item.checked).length;

  const toggleItem = (category: string, index: number) => {
    const newList = { ...list };
    newList[category][index].checked = !newList[category][index].checked;
    setList(newList);
  };

  const handleCopyText = async () => {
    let textOut = "PROVISION FUEL LIST\n\n";
    Object.entries(list).forEach(([category, items]) => {
      const visibleItems = hideStaples ? items.filter(i => !i.isRestock) : items;
      if (visibleItems.length === 0) return;

      textOut += `📦 ${category.toUpperCase()}\n`;
      visibleItems.forEach(item => {
        const checkPrefix = item.checked ? "[x]" : "[ ]";
        const restockPrefix = item.isRestock ? " (REPLENISH)" : "";
        textOut += `${checkPrefix} ${item.amount}${item.unit} ${item.name}${restockPrefix}\n`;
      });
      textOut += "\n";
    });
    
    await Clipboard.setStringAsync(textOut);
    if (Platform.OS === 'web') {
      window.alert("Grouped list copied to clipboard!");
    } else {
      Alert.alert("Copied", "Shopping list copied to clipboard (grouped by aisle).");
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
    <SafeAreaView testID="shopping-list-screen" className="flex-1 bg-cream dark:bg-darkcream">
      <ScrollView testID="shopping-list-scroll" className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 px-4 pt-6 pb-20 mx-auto w-full md:max-w-4xl md:px-8 min-h-[90vh]">
          
          {/* Header Section (Hidden on Print) */}
          <View className="mb-10 mt-4 md:mt-8 print-hide">
            <View className="flex-row justify-between items-start mb-6">
              <View>
                <Text className="text-charcoal dark:text-darkcharcoal text-4xl md:text-5xl font-extrabold tracking-tight italic">
                  The Fuel List
                </Text>
                <Text className="text-gray-500 text-lg font-medium mt-1">Based on this week's engine calibration.</Text>
              </View>
              
              {/* Desktop Global Actions Toolbar */}
              <View className="hidden md:flex flex-row gap-2">
                <ActionButton testID="shopping-list-copy-btn" icon="copy" label="Copy List" onPress={handleCopyText} />
                <ActionButton testID="shopping-list-export-btn" icon="file-csv" label="Export" onPress={handleExportCSV} disabled={isExporting} />
                <ActionButton testID="shopping-list-print-btn" icon="print" label="" onPress={() => {
                  if (Platform.OS === 'web') {
                    window.print();
                  } else {
                    Alert.alert("Not Supported", "Printing is currently only supported on Web.");
                  }
                }} />
              </View>
            </View>

            {/* Summary Stats Row */}
            <View className="flex-row flex-wrap gap-4 mb-8">
              <StatBadge testID="stat-total-items" label={`${totalIngredients} items`} icon="shopping-basket" color="bg-avocado/10 text-avocado" />
              <StatBadge testID="stat-categories" label={`${categoryCount} categories`} icon="th-large" color="bg-blueberry/10 text-blueberry" />
              <StatBadge testID="stat-checked" label={`${checkedCount} checked`} icon="check-circle" color="bg-gray-100 dark:bg-darkgrey text-gray-500" />
            </View>

            {/* Utility Toolbar */}
            <View className="flex-row flex-wrap items-center justify-between border-t border-b border-black/5 dark:border-white/5 py-4 gap-4 print-hide">
              <View className="flex-row gap-4">
                <FilterToggle 
                  testID="filter-hide-staples"
                  active={hideStaples} 
                  onPress={() => setHideStaples(!hideStaples)} 
                  label="Hide Pantry Staples" 
                />
              </View>
              
              {/* Mobile Actions (Shown only on small screens) */}
              <View className="md:hidden flex-row gap-2 w-full mt-2">
                <TouchableOpacity onPress={handleCopyText} className="flex-1 bg-charcoal h-12 rounded-xl items-center justify-center flex-row">
                  <FontAwesome5 name="copy" size={14} color="white" className="mr-2" />
                  <Text className="text-white font-bold">Copy Text</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Dedicated Print-Only Header */}
          <View style={{ display: 'none' }} className="print:flex mb-8 border-b-2 border-black pb-4 print-expand">
            <Text className="text-black text-3xl font-extrabold italic uppercase tracking-tight">Provision Fuel List</Text>
            <Text className="text-gray-800 text-sm font-bold tracking-widest uppercase mt-1">Week of {new Date().toLocaleDateString()}</Text>
          </View>

          <View className="gap-y-12">
            {Object.entries(list).map(([category, items]) => {
              const visibleItems = hideStaples ? items.filter(i => !i.isRestock) : items;
              if (visibleItems.length === 0) return null;

              return (
                <View key={category} className="mb-4">
                  <View className="flex-row justify-between items-end mb-4 border-b border-black/5 dark:border-white/5 pb-2">
                    <View className="flex-row items-center">
                      <View className="w-8 h-8 rounded-lg bg-white dark:bg-darkgrey border border-black/5 dark:border-white/5 items-center justify-center mr-3 shadow-sm">
                        <FontAwesome5 name={getCategoryIcon(category)} size={14} color="#6DBE75" />
                      </View>
                      <Text testID={`category-header-${category.replace(/\s+/g, '-').toLowerCase()}`} className="text-charcoal dark:text-darkcharcoal text-xl md:text-2xl font-extrabold tracking-tight">
                        {category}
                      </Text>
                    </View>
                    <Text className="text-gray-400 font-bold text-sm mb-1">{visibleItems.length} items</Text>
                  </View>
                
                    <View className={`rounded-3xl overflow-hidden border shadow-sm transition-all print-element ${category === 'Pantry Staples' ? 'bg-avocado/[0.03] border-avocado/20' : 'bg-white/60 dark:bg-darkgrey/60 border-white dark:border-white/5'}`}>
                      {visibleItems.map((item, idx) => (
                        <TouchableOpacity 
                          key={idx} 
                          testID={`item-row-${category.replace(/\s+/g, '-').toLowerCase()}-${idx}`}
                          onPress={() => toggleItem(category, idx)}
                          className={`flex-row justify-between items-center py-4 px-5 border-b border-black/5 dark:border-white/5 last:border-0 hover:bg-white/90 dark:hover:bg-white/10 transition-colors ${item.checked ? 'opacity-40 bg-gray-50 dark:bg-black/20' : ''}`}
                        >
                          <View className="flex-row items-center flex-1 pr-4">
                            <View className={`w-6 h-6 rounded-full border-2 mr-4 items-center justify-center flex-shrink-0 transition-all ${item.checked ? 'border-avocado bg-avocado' : 'border-gray-300 dark:border-gray-600'}`}>
                              {item.checked && <FontAwesome5 name="check" size={10} color="white" />}
                            </View>
                            <View className="flex-shrink flex-1">
                              <View className="flex-row items-center flex-wrap gap-x-2">
                                {item.isRestock && (
                                  <View className={`px-2 py-0.5 rounded-md flex-row items-center border ${item.checked ? 'bg-gray-200 dark:bg-gray-700 border-transparent' : 'bg-tomato/10 dark:bg-tomato/20 border-tomato/30'}`}>
                                    <FontAwesome5 name="redo" size={8} color={item.checked ? '#9CA3AF' : '#FF6B5A'} className="mr-1" />
                                    <Text className={`text-[9px] font-bold uppercase tracking-wider ${item.checked ? 'text-gray-500 dark:text-gray-400' : 'text-tomato dark:text-tomato'}`}>REPLENISH</Text>
                                  </View>
                                )}
                                <Text className={`text-charcoal dark:text-darkcharcoal text-lg font-bold flex-wrap leading-tight ${item.checked ? 'line-through text-gray-500 dark:text-gray-500 font-medium' : ''}`}>
                                  {item.name}
                                </Text>
                              </View>
                              {/* Traceability: show which meals this ingredient belongs to */}
                              <Text className={`text-xs mt-1 leading-tight font-medium ${item.checked ? 'text-gray-400 line-through' : 'text-gray-400 dark:text-gray-500'}`}>
                                {item.isRestock ? "Available in your pantry (Replenish stock)" : `For: ${item.recipes.join(', ')}`}
                              </Text>
                            </View>
                          </View>
                          <View className="items-end min-w-[60px]">
                            <Text className={`font-extrabold text-lg ${item.checked ? 'text-gray-400' : 'text-avocado'}`}>
                              {item.amount}
                            </Text>
                            <Text className={`text-[10px] font-bold uppercase tracking-widest ${item.checked ? 'text-gray-400' : 'text-gray-400 dark:text-gray-500'}`}>
                              {item.unit}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }
