import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, Platform, Alert } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { generateWeeklyPlan } from '../../data/engine';
import { MOCK_RECIPES, MOCK_INGREDIENTS } from '../../data/seed';
import { UserProfile } from '../../data/schema';

// ─── Shopping Intelligence Layer ────────────────────────────────────────────

export type ShoppingListItem = { 
  name: string, 
  amount: number,      // Purchase quantity (in retail units)
  unit: string,        // Purchase unit (singular)
  displayUnit: string, // Correctly pluralized unit for display
  checked: boolean, 
  recipes: string[], 
  usageAmount: number, // Raw recipe consumption this week
  usageUnit: string,   // Raw recipe unit (e.g. "slice", "tbsp")
  isRestock: boolean,  // True if we're buying to replenish pantry stock
  purchaseNote: string // Human-readable context for the buy recommendation
};
export type CategorizedList = Record<string, ShoppingListItem[]>;

// Pluralization rules for retail units
const PLURAL_RULES: Record<string, string> = {
  loaf:   'loaves',
  bottle: 'bottles',
  jar:    'jars',
  pack:   'packs',
  bulb:   'bulbs',
  bag:    'bags',
  item:   'items',
  head:   'heads',
  bunch:  'bunches',
  g:      'g',
  ml:     'ml',
  carton: 'cartons',
};

function pluralize(amount: number, singular: string): string {
  if (amount === 1) return singular;
  return PLURAL_RULES[singular] ?? `${singular}s`;
}

// Ingredient-specific conversion strategies
// Returns { buyAmount, note } given the raw weekly deficit and ingredient config.
function computePurchaseRecommendation(
  ingId: string,
  deficit: number,
  requiredAmount: number,
  currentStock: number,
  purchaseSize: number,
  purchaseUnit: string,
  isRestock: boolean,
): { buyAmount: number; note: string } {

  // Format helpers for natural phrasing
  const formatStandardNote = (amountStr: string) => {
    // Items that feel like they are "used up" from a whole
    if (purchaseUnit === 'loaf' || ['bottle', 'jar'].includes(purchaseUnit)) {
      return `Used this week: ${amountStr}`;
    }
    // Items that feel like they are "needed" as discrete units
    return `Needed this week: ${amountStr}`;
  };

  const formatNote = (amountStr: string, isStockReplenish: boolean) => {
    if (isStockReplenish) {
      return `Stock low - using ${amountStr} this week`;
    }
    return formatStandardNote(amountStr);
  };

  // ── Condiments & pantry liquids (soy sauce, olive oil, etc.) ─────────────
  const CONDIMENT_UNITS = ['bottle', 'jar'];
  if (CONDIMENT_UNITS.includes(purchaseUnit)) {
    return {
      buyAmount: 1,
      note: formatNote(`${requiredAmount} tbsp`, isRestock),
    };
  }

  // ── Garlic (cloves → bulbs) ──────────────────────────────────────────────
  if (ingId === 'i6') {
    const CLOVES_PER_BULB = 10;
    const bulbs = Math.max(1, Math.ceil(deficit / CLOVES_PER_BULB));
    return {
      buyAmount: bulbs,
      note: formatNote(`${requiredAmount} cloves`, isRestock),
    };
  }

  // ── Eggs (Dynamic based on purchaseSize, e.g., 6-pack or 12-carton) ──────
  if (ingId === 'i9') {
    const packs = Math.max(1, Math.ceil(deficit / purchaseSize));
    return {
      buyAmount: packs,
      note: formatNote(`${requiredAmount} eggs`, false),
    };
  }

  // ── Bread (slices → loaves) ──────────────────────────────────────────────
  if (purchaseUnit === 'loaf') {
    const loaves = Math.max(1, Math.ceil(deficit / purchaseSize));
    return {
      buyAmount: loaves,
      note: formatNote(`${requiredAmount} slices`, false),
    };
  }

  // ── Produce sold by weight (g → pack/bag) ────────────────────────────────
  if (purchaseUnit === 'bag' || purchaseUnit === 'pack') {
    const units = Math.max(1, Math.ceil(deficit / purchaseSize));
    return {
      buyAmount: units,
      note: formatNote(`${requiredAmount}g`, isRestock),
    };
  }

  // ── Default: item-for-item or raw weight ──────────────────────────
  const units = Math.max(1, Math.ceil(deficit / (purchaseSize || 1)));
  const usageUnitText = ingDataForNote(ingId)?.defaultUnit === 'g' || ingDataForNote(ingId)?.defaultUnit === 'ml' 
    ? ingDataForNote(ingId)?.defaultUnit 
    : ` ${ingDataForNote(ingId)?.defaultUnit}`;
    
  return {
    buyAmount: units,
    note: formatNote(`${Math.round(requiredAmount)}${usageUnitText}`, isRestock),
  };
}

// Temporary helper just for note-building inside computePurchaseRecommendation
import { MOCK_INGREDIENTS as ALL_MOCKS } from '../../data/seed';
function ingDataForNote(id: string) { return ALL_MOCKS.find(i=>i.id===id); }

function generateShoppingList(): CategorizedList {
  const mockUser: UserProfile = { 
    id: "u1", 
    name: "Liam", 
    targetMacros: { calories: 2400, protein: 160, carbs: 250, fats: 80 }, 
    budgetWeekly: 50, 
    dietaryPreference: "Omnivore" as const, 
    allergies: [],
    // Mock pantry: lots of olive oil, but very low soy sauce; rice stocked
    pantry: {
      "i8": 20,   // 20 tbsp Olive Oil — plenty for the week
      "i14": 1,   // 1 tbsp Soy Sauce — needs restock
      "i7": 2000, // 2kg Rice — plenty
    }
  };
  const weeklyPlan = generateWeeklyPlan(mockUser);
  
  // Aggregate ingredient usage across all recipes this week
  const ingredientMap: Record<string, { amount: number, recipes: Set<string> }> = {};
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

  const categorizedList: CategorizedList = {};
  
  Object.keys(ingredientMap).forEach(ingId => {
    const ingData = MOCK_INGREDIENTS.find(i => i.id === ingId);
    if (!ingData) return;

    const requiredAmount = ingredientMap[ingId].amount;
    const currentStock = mockUser.pantry ? mockUser.pantry[ingId] || 0 : 0;
    const purchaseSize = ingData.purchaseSize || 1;
    const purchaseUnit = ingData.purchaseUnit || ingData.defaultUnit;

    // Staples: only buy if pantry stock is insufficient
    const deficit = ingData.isStaple 
      ? Math.max(0, requiredAmount - currentStock)
      : requiredAmount;

    if (deficit <= 0 && !!ingData.isStaple) return; // Well stocked, skip

    const isRestock = !!ingData.isStaple && currentStock < requiredAmount;

    const { buyAmount, note } = computePurchaseRecommendation(
      ingId, deficit, requiredAmount, currentStock, purchaseSize, purchaseUnit, isRestock
    );

    if (!categorizedList[ingData.category]) {
      categorizedList[ingData.category] = [];
    }

    categorizedList[ingData.category].push({
      name: ingData.name,
      amount: buyAmount,
      unit: purchaseUnit,
      displayUnit: pluralize(buyAmount, purchaseUnit),
      checked: false,
      recipes: Array.from(ingredientMap[ingId].recipes),
      usageAmount: requiredAmount,
      usageUnit: ingData.defaultUnit,
      isRestock,
      purchaseNote: note,
    });
  });

  return categorizedList;
}

const initialList = generateShoppingList();

// Sub-components for structure and utility
const StatBadge = ({ label, value, icon, color }: { label: string, value: string | number, icon: string, color: string }) => (
  <View className={`flex-row items-center px-4 py-2 rounded-2xl ${color} border border-black/5 dark:border-white/5 shadow-sm`}>
    <View className="mr-3 w-5 h-5 items-center justify-center opacity-70">
      <FontAwesome5 name={icon} size={13} color="currentColor" />
    </View>
    <View>
      <Text className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-0.5">{label}</Text>
      <Text className="font-extrabold text-base leading-none">{value}</Text>
    </View>
  </View>
);

const FilterToggle = ({ active, onPress, label }: { active: boolean, onPress: () => void, label: string }) => (
  <TouchableOpacity 
    onPress={onPress}
    className={`flex-row items-center px-5 py-3 rounded-2xl border transition-all ${active ? 'bg-avocado border-avocado shadow-md' : 'bg-white dark:bg-darkgrey border-black/5 dark:border-white/5'}`}
  >
    <View className={`w-5 h-5 rounded-md border mr-3 items-center justify-center ${active ? 'bg-white border-white' : 'border-gray-300 dark:border-gray-600'}`}>
      {active && <FontAwesome5 name="check" size={10} color="#6DBE75" />}
    </View>
    <Text className={`font-bold text-sm ${active ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>{label}</Text>
  </TouchableOpacity>
);

const ActionButton = ({ icon, label, onPress, disabled, variant = 'secondary' }: { icon: string, label?: string, onPress: () => void, disabled?: boolean, variant?: 'primary' | 'secondary' }) => (
  <TouchableOpacity 
    onPress={onPress}
    disabled={disabled}
    className={`flex-row items-center h-11 px-4 rounded-xl transition-all ${
      variant === 'primary' 
        ? 'bg-charcoal dark:bg-white text-white dark:text-charcoal' 
        : 'bg-white/80 dark:bg-darkgrey/80 border border-black/5 dark:border-white/10'
    } ${disabled ? 'opacity-50' : 'active:scale-[0.98]'}`}
  >
    <FontAwesome5 name={icon} size={14} color={variant === 'primary' ? (Platform.OS === 'web' ? 'white' : '#1C1C1E') : '#71717a'} className={label ? "mr-2.5" : ""} />
    {label ? <Text className={`font-bold text-sm ${variant === 'primary' ? 'text-white dark:text-charcoal' : 'text-gray-600 dark:text-gray-400'}`}>{label}</Text> : null}
  </TouchableOpacity>
);

const getCategoryIcon = (cat: string) => {
  switch (cat) {
    case 'Produce': return 'leaf';
    case 'Meat & Seafood': return 'drumstick-bite';
    case 'Dairy & Eggs': return 'egg';
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
        textOut += `${checkPrefix} ${item.amount} ${item.unit} ${item.name}${restockPrefix} [Usage: ${item.usageAmount}${item.usageUnit}]\n`;
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
        <View className="flex-1 px-4 pt-10 pb-32 mx-auto w-full md:max-w-5xl md:px-12 min-h-screen">
          
          {/* Header Section */}
          <View className="mb-12 print-hide">
            <View className="flex-row justify-between items-end mb-10">
              <View className="flex-1 pr-8">
                <View className="flex-row items-center mb-2">
                  <View className="w-2 h-2 rounded-full bg-avocado mr-3" />
                  <Text className="text-avocado text-xs font-bold uppercase tracking-[0.2em]">Active Shopping List</Text>
                </View>
                <Text className="text-charcoal dark:text-darkcharcoal text-4xl md:text-5xl font-extrabold tracking-tight">
                  The Fuel List
                </Text>
                <Text className="text-gray-500 text-lg md:text-xl font-medium mt-2 leading-relaxed">Built from this week's plan.</Text>
              </View>
              
              {/* Tightened Desktop Actions */}
              <View className="hidden md:flex flex-row items-center bg-white/50 dark:bg-darkgrey/50 p-1.5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
                <ActionButton icon="copy" onPress={handleCopyText} />
                <View className="w-px h-6 bg-black/5 dark:bg-white/10 mx-1" />
                <ActionButton icon="file-csv" onPress={handleExportCSV} disabled={isExporting} />
                <View className="w-px h-6 bg-black/5 dark:bg-white/10 mx-1" />
                <ActionButton icon="print" onPress={() => Platform.OS === 'web' ? window.print() : Alert.alert("Web only")} />
              </View>
            </View>

            {/* Contextual Summary Area */}
            <View className="flex-row flex-wrap gap-3 mb-10">
              <StatBadge label="Total" value={totalIngredients} icon="shopping-basket" color="bg-white dark:bg-darkgrey text-charcoal dark:text-darkcharcoal" />
              <StatBadge label="Checked" value={`${checkedCount}/${totalIngredients}`} icon="check-circle" color="bg-avocado/10 text-avocado" />
              <StatBadge label="Sections" value={categoryCount} icon="th-large" color="bg-blueberry/10 text-blueberry" />
              
              <View className="ml-auto hidden md:flex">
                <FilterToggle 
                  active={hideStaples} 
                  onPress={() => setHideStaples(!hideStaples)} 
                  label="Show Pantry Staples" 
                />
              </View>
            </View>

            {/* Mobile Actions Drawer (Simulated) */}
            <View className="md:hidden flex-row gap-3 border-t border-black/5 pt-6">
              <TouchableOpacity onPress={handleCopyText} className="flex-1 bg-charcoal dark:bg-white h-14 rounded-2xl items-center justify-center flex-row shadow-lg">
                <FontAwesome5 name="copy" size={14} color={Platform.OS === 'web' ? 'white' : '#1C1C1E'} className="mr-3" />
                <Text className="text-white dark:text-charcoal font-extrabold text-base">Copy List</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setHideStaples(!hideStaples)} className={`w-14 h-14 rounded-2xl items-center justify-center border ${hideStaples ? 'bg-avocado border-avocado' : 'bg-white border-black/5 shadow-sm'}`}>
                <FontAwesome5 name="eye-slash" size={16} color={hideStaples ? 'white' : '#71717a'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Dedicated Print-Only Header */}
          <View style={{ display: 'none' }} className="print:flex mb-6 border-b border-black pb-2 print-expand">
            <Text className="text-black text-2xl font-bold uppercase tracking-tight">Fuel List</Text>
            <Text className="text-gray-800 text-sm font-bold tracking-widest uppercase mt-1">Week of {new Date().toLocaleDateString()}</Text>
          </View>

          <View className="gap-y-12">
            {Object.entries(list).map(([category, items]) => {
              const visibleItems = hideStaples ? items.filter(i => !i.isRestock) : items;
              if (visibleItems.length === 0) return null;

              return (
                <View key={category} className="mb-10 print:mb-6 print:break-inside-avoid">
                  <View className="flex-row items-center mb-6 print:mb-2 pl-1">
                    <View className="w-10 h-10 print:hidden rounded-2xl bg-white dark:bg-darkgrey border border-black/5 dark:border-white/10 items-center justify-center mr-4 shadow-sm">
                      <FontAwesome5 name={getCategoryIcon(category)} size={16} color="#6DBE75" />
                    </View>
                    <View>
                      <Text className="text-charcoal dark:text-darkcharcoal print:text-black text-2xl print:text-lg font-extrabold print:font-bold tracking-tight">
                        {category}
                      </Text>
                      <Text className="text-gray-400 font-bold text-[10px] print:hidden uppercase tracking-widest">{visibleItems.length} items to collect</Text>
                    </View>
                  </View>
                
                  {/* The printed list uses standard simple borders and no card styling */}
                  <View className={`rounded-[28px] print:rounded-none overflow-hidden border print:border-t-0 print:border-l-0 print:border-r-0 print:border-b-0 ${category === 'Pantry Staples' ? 'bg-avocado/[0.03] border-avocado/20 shadow-sm print:bg-transparent print:shadow-none' : 'bg-white/40 dark:bg-darkgrey/40 border-black/5 dark:border-white/5 print:bg-transparent'} transition-all`}>
                    {visibleItems.map((item, idx) => (
                      <TouchableOpacity 
                        key={idx} 
                        onPress={() => toggleItem(category, idx)}
                        activeOpacity={0.7}
                        className={`flex-row justify-between items-start py-5 px-6 print:py-2 print:px-0 border-b border-black/5 dark:border-white/5 print:border-gray-300 last:border-0 print:last:border-b transition-all ${item.checked ? 'bg-black/[0.02] dark:bg-white/[0.02] print:bg-transparent print:opacity-50' : ''} print:break-inside-avoid`}
                      >
                        <View className="flex-row items-start flex-1 pr-6 print:pr-2">
                          <View className={`w-7 h-7 print:w-5 print:h-5 print:mt-1 mt-0.5 rounded-lg print:rounded-sm border-2 print:border-[1.5px] print:border-black mr-5 print:mr-3 items-center justify-center flex-shrink-0 transition-all ${item.checked ? 'border-avocado/30 bg-avocado/10 print:border-black print:bg-transparent' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-darkgrey print:border-black print:bg-transparent'}`}>
                            {item.checked ? (
                              <FontAwesome5 name="check" size={10} color={Platform.OS === 'web' ? 'inherit' : '#6DBE75'} className="print:text-black" />
                            ) : (
                              <View className="w-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 print:hidden" />
                            )}
                          </View>
                          
                          <View className="flex-shrink flex-1">
                            <View className="flex-row items-center flex-wrap gap-2 print:gap-1 min-h-[28px] print:min-h-0 pt-0.5 print:pt-0.5">
                              {item.isRestock && (
                                <View className={`px-2 py-0.5 print:px-0 print:py-0 rounded-md print:rounded-none flex-row items-center ${item.checked ? 'bg-gray-100 dark:bg-gray-800 print:bg-transparent' : 'bg-tomato/10 border border-tomato/20 print:bg-transparent print:border-none'}`}>
                                  <FontAwesome5 name="redo-alt" size={8} color={item.checked ? '#9CA3AF' : '#FF6B5A'} className="mr-1.5 print:hidden" />
                                  <Text className={`text-[10px] print:text-xs font-bold uppercase tracking-wider print:tracking-normal print:lowercase print:italic ${item.checked ? 'text-gray-400 print:text-black' : 'text-tomato print:text-black'}`}>
                                    <Text className="hidden print:flex">(</Text>Replenish pantry<Text className="hidden print:flex">)</Text>
                                  </Text>
                                </View>
                              )}
                              <Text className={`text-charcoal dark:text-darkcharcoal print:text-black text-lg print:text-base font-bold print:font-normal flex-wrap tracking-tight leading-none ${item.checked ? 'opacity-30 print:opacity-100' : ''}`}>
                                {item.name}
                              </Text>
                            </View>
                            <View className="flex-row items-start mt-1.5 print:hidden opacity-60">
                              <FontAwesome5 name={item.isRestock ? "box-open" : "utensils"} size={9} color="#71717a" className="mr-2 mt-0.5" />
                              <Text className={`text-xs font-semibold leading-relaxed ${item.checked ? 'line-through' : 'text-gray-500 dark:text-gray-400'}`}>
                                {item.purchaseNote}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View className={`items-end min-w-[70px] print:min-w-0 ${item.checked ? 'opacity-30 print:opacity-100' : ''}`}>
                          {item.unit === 'g' || item.unit === 'ml' ? (
                            <View className="flex-row items-baseline justify-end w-full">
                              <Text className="font-extrabold print:font-normal text-2xl print:text-base text-avocado print:text-black">
                                {item.amount}{item.displayUnit}
                              </Text>
                            </View>
                          ) : (
                            <View className="items-end print:items-baseline justify-end print:justify-start print:flex-row w-full print:gap-1">
                              <Text className="font-extrabold print:font-normal text-2xl print:text-base text-avocado print:text-black leading-none mb-0.5 print:mb-0 text-right print:text-left">
                                {item.amount}
                              </Text>
                              <Text className="text-[11px] print:text-base font-bold print:font-normal text-gray-400 print:text-black lowercase text-right print:text-left">
                                {item.displayUnit}
                              </Text>
                            </View>
                          )}
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
