import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, Platform, Alert } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { MOCK_RECIPES, MOCK_INGREDIENTS } from '../../data/seed';
import { UserProfile } from '../../data/schema';
import { useWeeklyRoutine } from '../../data/WeeklyRoutineContext';
import { WeeklyRoutine, DAYS, isPlanned } from '../../data/weeklyRoutine';

// ─── Shopping Intelligence Layer ────────────────────────────────────────────

export type ShoppingListItem = { 
  id: string,
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

function generateShoppingList(routine?: WeeklyRoutine): CategorizedList {
  const mockUser: UserProfile = { 
    id: "u1", 
    name: "Liam", 
    targetMacros: { calories: 2400, protein: 160, carbs: 250, fats: 80 }, 
    budgetWeekly: 50, 
    dietaryPreference: "Omnivore" as const, 
    allergies: [],
    pantry: {
      "i8": 20,
      "i14": 1,
      "i7": 2000,
    }
  };
  // Static seed plan — mirrors the Dashboard seed until planWeek() is wired in.
  const weeklyPlan = [
    { date: 'Mon', breakfast: 'r3', lunch: 'r5', dinner: 'r1' },
    { date: 'Tue', breakfast: 'r7', lunch: 'r6', dinner: 'r4' },
    { date: 'Wed', breakfast: 'r3', lunch: 'r1', dinner: 'r2' },
    { date: 'Thu', breakfast: 'r7', lunch: 'r4', dinner: 'r6' },
    { date: 'Fri', breakfast: 'r3', lunch: 'r5', dinner: 'r1' },
    { date: 'Sat', breakfast: 'r7', lunch: 'r8', dinner: 'r2' },
    { date: 'Sun', breakfast: 'r3', lunch: 'r6', dinner: 'r4' },
  ];

  const ingredientMap: Record<string, { amount: number, recipes: Set<string> }> = {};
  weeklyPlan.forEach((day, idx: number) => {
    const dayKey = DAYS[idx % DAYS.length];
    const slots: Array<{ id: string | undefined; slot: 'breakfast'|'lunch'|'dinner' }> = [
      { id: day.breakfast, slot: 'breakfast' },
      { id: day.lunch,     slot: 'lunch'     },
      { id: day.dinner,    slot: 'dinner'    },
    ];
    slots.forEach(({ id: recipeId, slot }) => {
      if (!recipeId) return;
      // Skip if the user's routine marks this slot as non-planned
      if (routine && !isPlanned(routine[dayKey][slot])) return;
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
    const currentStock = mockUser.pantry ? (mockUser.pantry as Record<string,number>)[ingId] || 0 : 0;
    const purchaseSize = ingData.purchaseSize || 1;
    const purchaseUnit = ingData.purchaseUnit || ingData.defaultUnit;
    const deficit = ingData.isStaple ? Math.max(0, requiredAmount - currentStock) : requiredAmount;
    if (deficit <= 0 && !!ingData.isStaple) return;
    const isRestock = !!ingData.isStaple && currentStock < requiredAmount;
    const { buyAmount, note } = computePurchaseRecommendation(
      ingId, deficit, requiredAmount, currentStock, purchaseSize, purchaseUnit, isRestock
    );
    if (!categorizedList[ingData.category]) categorizedList[ingData.category] = [];
    categorizedList[ingData.category].push({
      id: ingId,
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

// Module-level initial list (no routine = include everything)
const initialList = generateShoppingList();

// Sub-components for structure and utility
const StatBadge = ({ label, value, icon, color }: { label: string, value: string | number, icon: string, color: string }) => (
  <View className={`flex-row items-center px-5 py-4 rounded-[24px] ${color} border shadow-[0_2px_12px_rgba(0,0,0,0.02)] transition-all`}>
    <View className="mr-3 w-5 h-5 items-center justify-center opacity-80">
      <FontAwesome5 name={icon} size={14} color="currentColor" />
    </View>
    <View>
      <Text className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-0.5">{label}</Text>
      <Text className="font-medium text-[20px] tracking-tight leading-none">{value}</Text>
    </View>
  </View>
);

const FilterToggle = ({ active, onPress, label }: { active: boolean, onPress: () => void, label: string }) => (
  <TouchableOpacity 
    onPress={onPress}
    className={`flex-row items-center px-5 py-4 rounded-[24px] border transition-all ${active ? 'bg-primary/10 border-primary/20 shadow-sm dark:bg-darksageTint dark:border-darksageTint' : 'bg-surface dark:bg-darksurface border-black/[0.03] dark:border-darksoftBorder shadow-[0_2px_12px_rgba(0,0,0,0.02)]'}`}
  >
    <View className={`w-5 h-5 rounded-[6px] border mr-3 items-center justify-center ${active ? 'bg-primary border-primary dark:bg-primary dark:border-primary' : 'border-black/10 dark:border-white/10'}`}>
      {active && <FontAwesome5 name="check" size={10} color="white" />}
    </View>
    <Text className={`font-medium text-[14px] ${active ? 'text-textMain dark:text-darktextMain' : 'text-textSec dark:text-darktextSec'}`}>{label}</Text>
  </TouchableOpacity>
);

const ActionButton = ({ icon, label, onPress, disabled, variant = 'secondary' }: { icon: string, label?: string, onPress: () => void, disabled?: boolean, variant?: 'primary' | 'secondary' }) => (
  <TouchableOpacity 
    onPress={onPress}
    disabled={disabled}
    className={`flex-row items-center justify-center w-10 h-10 rounded-full transition-all ${
      variant === 'primary' 
        ? 'bg-textMain dark:bg-darktextMain text-surface dark:text-textMain shadow-sm' 
        : 'bg-transparent hover:bg-black/5 dark:hover:bg-white/5'
    } ${disabled ? 'opacity-50' : 'active:scale-[0.95]'}`}
  >
    <FontAwesome5 name={icon} size={14} color={variant === 'primary' ? (Platform.OS === 'web' ? 'white' : '#1A1F1B') : '#6E7C74'} className={label ? "mr-2" : ""} />
    {label ? <Text className={`font-medium text-[13px] ${variant === 'primary' ? 'text-surface dark:text-textMain' : 'text-textSec'}`}>{label}</Text> : null}
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

import { usePantry } from '../../data/PantryContext';
import PageHeader from '../../components/PageHeader';

export default function ShoppingListScreen() {
  const { routine } = useWeeklyRoutine();

  // Re-compute the shopping list whenever the routine changes
  const routineFilteredList = useMemo(() => generateShoppingList(routine), [routine]);

  const [list, setList] = useState(initialList);
  const [isExporting, setIsExporting] = useState(false);
  const [hideStaples, setHideStaples] = useState(false);
  
  const { confirmShop } = usePantry();

  // Sync list whenever routine changes
  React.useEffect(() => { setList(routineFilteredList); }, [routineFilteredList]);

  // Compute exclusion summary for the header
  const exclusionSummary = useMemo(() => {
    let takeaway = 0, skipped = 0, quick = 0, out = 0;
    DAYS.forEach(day => {
      (['breakfast','lunch','dinner'] as Array<'breakfast'|'lunch'|'dinner'>).forEach(slot => {
        const mode = routine[day][slot];
        if (mode === 'takeaway') takeaway++;
        else if (mode === 'skip') skipped++;
        else if (mode === 'quick') quick++;
        else if (mode === 'out') out++;
      });
    });
    const parts: string[] = [];
    if (takeaway > 0) parts.push(`${takeaway} takeaway ${takeaway === 1 ? 'night' : 'nights'}`);
    if (out > 0)      parts.push(`${out} eating out`);
    if (quick > 0)    parts.push(`${quick} quick ${quick === 1 ? 'meal' : 'meals'}`);
    if (skipped > 0)  parts.push(`${skipped} skipped`);
    return parts;
  }, [routine]);

  const plannedMealCount = useMemo(() => {
    let count = 0;
    DAYS.forEach(day => {
      (['breakfast','lunch','dinner'] as Array<'breakfast'|'lunch'|'dinner'>).forEach(slot => {
        if (isPlanned(routine[day][slot])) count++;
      });
    });
    return count;
  }, [routine]);

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
    <SafeAreaView testID="shopping-list-screen" className="flex-1 bg-appBg dark:bg-darkappBg">
      <ScrollView testID="shopping-list-scroll" className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 w-full mx-auto md:max-w-4xl px-4 md:px-8 pt-10 pb-32 min-h-[90vh]">
          
          {/* Header Section */}
          <View className="print-hide">
            <PageHeader 
              eyebrow="Active Shopping List"
              title="The Fuel List"
              subtitle={
                plannedMealCount === 21
                  ? `Built for this week's full plan.`
                  : exclusionSummary.length > 0
                    ? `Built for ${plannedMealCount} planned meals — ${exclusionSummary.join(' and ')} excluded.`
                    : `Built for ${plannedMealCount} planned meals this week.`
              }
              rightActions={
                <View className="hidden md:flex flex-row items-center bg-surface dark:bg-darksurface p-1.5 rounded-full border border-black/[0.03] dark:border-darksoftBorder shadow-sm">
                  <ActionButton icon="copy" onPress={handleCopyText} />
                  <ActionButton icon="file-csv" onPress={handleExportCSV} disabled={isExporting} />
                  <ActionButton icon="print" onPress={() => Platform.OS === 'web' ? window.print() : Alert.alert("Web only")} />
                </View>
              }
            />

            {/* Contextual Summary Area */}
            <View className="flex-row flex-wrap gap-4 mb-10">
              <StatBadge label="Total" value={totalIngredients} icon="shopping-basket" color="bg-surface dark:bg-darksurface border-black/[0.03] dark:border-darksoftBorder text-textMain dark:text-darktextMain" />
              <StatBadge label="Checked" value={`${checkedCount}/${totalIngredients}`} icon="check-circle" color="bg-surface dark:bg-darksurface border border-primary/20 dark:border-primary/20 text-primary" />
              <StatBadge label="Sections" value={categoryCount} icon="th-large" color="bg-surface dark:bg-darksurface border-black/[0.03] dark:border-darksoftBorder text-textMain dark:text-darktextMain" />
              
              <View className="ml-auto hidden md:flex">
                <FilterToggle 
                  active={hideStaples} 
                  onPress={() => setHideStaples(!hideStaples)} 
                  label="Show Pantry Staples" 
                />
              </View>
            </View>

            {/* Mobile Actions Drawer (Simulated) */}
            <View className="md:hidden flex-row gap-3 border-t border-softBorder dark:border-white/5 pt-6">
              <TouchableOpacity onPress={handleCopyText} className="flex-1 bg-textMain dark:bg-darktextMain h-14 rounded-2xl items-center justify-center flex-row shadow-sm">
                <FontAwesome5 name="copy" size={14} color={Platform.OS === 'web' ? 'white' : '#1A1F1B'} className="mr-3" />
                <Text className="text-surface dark:text-textMain font-semibold text-body">Copy List</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setHideStaples(!hideStaples)} className={`w-14 h-14 rounded-2xl items-center justify-center border ${hideStaples ? 'bg-primary border-primary' : 'bg-surface border-softBorder dark:border-white/5 shadow-sm'}`}>
                <FontAwesome5 name="eye-slash" size={16} color={hideStaples ? 'white' : '#6E7C74'} />
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
                <View key={category} className="mb-12 print:mb-6 print:break-inside-avoid">
                  <View className="flex-row items-center mb-5 print:mb-2 pl-2">
                    <View className="w-11 h-11 print:hidden rounded-full bg-sageTint dark:bg-darksageTint items-center justify-center mr-4 shadow-sm">
                      <FontAwesome5 name={getCategoryIcon(category)} size={16} color="#9DCD8B" />
                    </View>
                    <View>
                      <Text className="text-textMain dark:text-darktextMain print:text-black text-[22px] font-medium print:font-bold tracking-tight">
                        {category}
                      </Text>
                      <Text className="text-textSec dark:text-darktextSec font-medium text-[12px] print:hidden opacity-80 mt-0.5">{visibleItems.length} items to collect</Text>
                    </View>
                  </View>
                
                  {/* The printed list uses standard simple borders and no card styling */}
                  <View className={`rounded-[32px] print:rounded-none overflow-hidden print:border-t-0 print:border-l-0 print:border-r-0 print:border-b-0 ${category === 'Pantry Staples' ? 'bg-orange-50/50 dark:bg-[#2A2520] border border-orange-100 dark:border-[#38312B] print:bg-transparent print:shadow-none' : 'bg-surface dark:bg-darksurface border border-black/[0.03] dark:border-darksoftBorder print:bg-transparent shadow-[0_2px_12px_rgba(0,0,0,0.02)]'} transition-all`}>
                    {visibleItems.map((item, idx) => (
                      <TouchableOpacity 
                        key={idx} 
                        onPress={() => toggleItem(category, idx)}
                        activeOpacity={0.7}
                        className={`flex-row justify-between items-center py-5 px-6 print:py-2 print:px-0 border-b border-black/[0.03] dark:border-darksoftBorder print:border-gray-300 last:border-0 print:last:border-b transition-all ${item.checked ? 'bg-black/[0.015] dark:bg-white/[0.02] print:bg-transparent print:opacity-50' : 'hover:bg-black/[0.01] dark:hover:bg-white/[0.01]'} print:break-inside-avoid`}
                      >
                        <View className="flex-row items-center flex-1 pr-6 print:pr-2">
                          <View className={`w-8 h-8 print:w-5 print:h-5 rounded-full print:rounded-sm border-2 print:border-[1.5px] print:border-black mr-5 print:mr-3 items-center justify-center flex-shrink-0 transition-all ${item.checked ? 'border-primary/40 bg-primary/20 print:border-black print:bg-transparent' : 'border-black/10 dark:border-white/10 bg-surface dark:bg-darksurface print:border-black print:bg-transparent'}`}>
                            {item.checked && (
                              <FontAwesome5 name="check" size={10} color={Platform.OS === 'web' ? '#7BA96A' : '#9DCD8B'} className="print:text-black" />
                            )}
                          </View>
                          
                          <View className="flex-shrink flex-1 justify-center">
                            <View className="flex-row items-center flex-wrap gap-2.5 print:gap-1 print:min-h-0">
                              {item.isRestock && (
                                <View className={`px-2.5 py-1 print:px-0 print:py-0 rounded-[6px] print:rounded-none flex-row items-center ${item.checked ? 'bg-black/5 dark:bg-white/5 print:bg-transparent' : 'bg-peach/15 border border-peach/20 dark:border-peach/10 print:bg-transparent print:border-none'}`}>
                                  <FontAwesome5 name="redo-alt" size={8} color={item.checked ? '#9CA3AF' : '#C48F5D'} className="mr-1.5 print:hidden" />
                                  <Text className={`text-[10px] print:text-xs font-semibold uppercase tracking-widest print:tracking-normal print:lowercase print:italic ${item.checked ? 'text-gray-400 print:text-black' : 'text-peach dark:text-[#C48F5D] print:text-black'}`}>
                                    <Text className="hidden print:flex">(</Text>Replenish<Text className="hidden print:flex">)</Text>
                                  </Text>
                                </View>
                              )}
                              <Text className={`text-textMain dark:text-darktextMain print:text-black text-[18px] print:text-base font-medium print:font-normal flex-wrap tracking-wide leading-none ${item.checked ? 'opacity-30 print:opacity-100' : ''}`}>
                                {item.name}
                              </Text>
                            </View>
                            <View className="flex-row items-baseline mt-1.5 print:hidden opacity-60">
                              <FontAwesome5 name={item.isRestock ? "box-open" : "utensils"} size={10} color="#8C9A90" className="mr-2" />
                              <Text className={`text-[12px] font-medium ${item.checked ? 'line-through decoration-black/20 text-textSec dark:text-gray-400' : 'text-textSec dark:text-darktextSec'}`}>
                                {item.purchaseNote}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View className={`items-end min-w-[70px] print:min-w-0 ${item.checked ? 'opacity-30 print:opacity-100' : ''}`}>
                          {item.unit === 'g' || item.unit === 'ml' ? (
                            <View className="bg-appBg dark:bg-black/20 border border-black/[0.04] dark:border-white/5 px-3 py-1.5 rounded-lg flex-row items-baseline justify-end print:bg-transparent print:border-none print:p-0">
                              <Text className="font-semibold print:font-normal text-[14px] print:text-base text-textMain dark:text-darktextMain print:text-black">
                                {item.amount}{item.displayUnit}
                              </Text>
                            </View>
                          ) : (
                            <View className="bg-appBg dark:bg-black/20 border border-black/[0.04] dark:border-white/5 px-3 py-1.5 rounded-lg items-end print:items-baseline justify-end print:justify-start print:flex-row print:bg-transparent print:border-none print:p-0 print:gap-1">
                              <Text className="font-semibold print:font-normal text-[16px] print:text-base text-textMain dark:text-darktextMain print:text-black leading-none mb-0.5 print:mb-0 text-right print:text-left">
                                {item.amount}
                              </Text>
                              <Text className="text-[11px] print:text-base font-medium print:font-normal text-textSec dark:text-darktextSec print:text-black lowercase text-right print:text-left">
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
          
          {/* Post-Shop Integration Action */}
          {checkedCount > 0 && (
            <View className="mt-12 mb-8 pt-8 border-t border-black/5 dark:border-white/5 items-center print-hide">
              <TouchableOpacity 
                onPress={() => {
                  const checkedItems = Object.values(list).flat().filter(item => item.checked);
                  confirmShop(checkedItems);
                  
                  // Reset checked bounds
                  const resetList = { ...list };
                  Object.keys(resetList).forEach(cat => {
                    resetList[cat].forEach(item => { item.checked = false; });
                  });
                  setList(resetList);
                  
                  if (Platform.OS === 'web') {
                    window.alert("Shop completed. Items written to Pantry.");
                  } else {
                    Alert.alert("Shop Complete", "Purchased items have been logged to your Pantry.");
                  }
                }}
                className="bg-primary hover:bg-primary-hover active:opacity-90 transition-all rounded-full px-8 h-16 flex-row items-center justify-center shadow-md dark:shadow-none shadow-primary/20 dark:border dark:border-primary/20 w-full md:w-auto md:min-w-[300px]"
              >
                <FontAwesome5 name="check-double" size={16} color="white" className="mr-3" />
                <Text className="text-white font-medium text-[16px] tracking-wide">Complete Shop</Text>
              </TouchableOpacity>
              <Text className="text-textSec dark:text-darktextSec font-medium text-[12px] mt-4 opacity-80">Add {checkedCount} item{checkedCount > 1 ? 's' : ''} to Pantry memory.</Text>
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
