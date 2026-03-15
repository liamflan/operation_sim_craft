import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, Platform, Alert, ActivityIndicator } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { MOCK_INGREDIENTS } from '../../data/seed';
import { useWeeklyRoutine } from '../../data/WeeklyRoutineContext';
import { DAYS, isPlanned } from '../../data/weeklyRoutine';
import { useActivePlan } from '../../data/ActivePlanContext';
import { FULL_RECIPE_CATALOG } from '../../data/planner/recipeRegistry';
import { usePantry } from '../../data/PantryContext';
import PageHeader from '../../components/PageHeader';

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

function computePurchaseRecommendation(
  ingId: string,
  deficit: number,
  requiredAmount: number,
  currentStock: number,
  purchaseSize: number,
  purchaseUnit: string,
  isRestock: boolean,
): { buyAmount: number; note: string } {

  const formatStandardNote = (amountStr: string) => {
    if (purchaseUnit === 'loaf' || ['bottle', 'jar'].includes(purchaseUnit)) {
      return `Used this week: ${amountStr}`;
    }
    return `Needed this week: ${amountStr}`;
  };

  const formatNote = (amountStr: string, isStockReplenish: boolean) => {
    if (isStockReplenish) {
      return `Stock low - using ${amountStr} this week`;
    }
    return formatStandardNote(amountStr);
  };

  const CONDIMENT_UNITS = ['bottle', 'jar'];
  if (CONDIMENT_UNITS.includes(purchaseUnit)) {
    return {
      buyAmount: 1,
      note: formatNote(`${requiredAmount} tbsp`, isRestock),
    };
  }

  if (ingId === 'i6') {
    const bulbs = Math.max(1, Math.ceil(deficit / 10));
    return {
      buyAmount: bulbs,
      note: formatNote(`${requiredAmount} cloves`, isRestock),
    };
  }

  if (ingId === 'i9') {
    const packs = Math.max(1, Math.ceil(deficit / purchaseSize));
    return {
      buyAmount: packs,
      note: formatNote(`${requiredAmount} eggs`, false),
    };
  }

  if (purchaseUnit === 'loaf') {
    const loaves = Math.max(1, Math.ceil(deficit / purchaseSize));
    return {
      buyAmount: loaves,
      note: formatNote(`${requiredAmount} slices`, false),
    };
  }

  if (purchaseUnit === 'bag' || purchaseUnit === 'pack') {
    const units = Math.max(1, Math.ceil(deficit / purchaseSize));
    return {
      buyAmount: units,
      note: formatNote(`${requiredAmount}g`, isRestock),
    };
  }

  const units = Math.max(1, Math.ceil(deficit / (purchaseSize || 1)));
  const ingData = MOCK_INGREDIENTS.find(i=>i.id===ingId);
  const usageUnitText = ingData?.defaultUnit === 'g' || ingData?.defaultUnit === 'ml' 
    ? ingData?.defaultUnit 
    : ` ${ingData?.defaultUnit}`;
    
  return {
    buyAmount: units,
    note: formatNote(`${Math.round(requiredAmount)}${usageUnitText}`, isRestock),
  };
}

function generateShoppingList(workspaceAssignments: any[] = []): CategorizedList {
  const mockPantry: Record<string, number> = { "i8": 20, "i14": 1, "i7": 2000 };
  const ingredientMap: Record<string, { amount: number, recipes: Set<string> }> = {};
  
  workspaceAssignments.forEach((assignment) => {
    if (!assignment.recipeId || assignment.state === 'skipped') return;
    const recipe = FULL_RECIPE_CATALOG[assignment.recipeId];
    if (recipe) {
      recipe.ingredients.forEach(ing => {
        const ingId = ing.canonicalIngredientId;
        if (!ingId) return;
        if (!ingredientMap[ingId]) {
          ingredientMap[ingId] = { amount: 0, recipes: new Set() };
        }
        ingredientMap[ingId].amount += ing.amount;
        ingredientMap[ingId].recipes.add(recipe.title);
      });
    }
  });

  const categorizedList: CategorizedList = {};
  Object.keys(ingredientMap).forEach(ingId => {
    const ingData = MOCK_INGREDIENTS.find(i => i.id === ingId);
    if (!ingData) return;
    const requiredAmount = ingredientMap[ingId].amount;
    const currentStock = mockPantry[ingId] || 0;
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

const StatBadge = ({ label, value, icon, color }: { label: string, value: string | number, icon: string, color: string }) => (
  <View className={`flex-row items-center px-5 py-4 rounded-[24px] ${color} border shadow-sm`}>
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
    className={`flex-row items-center px-5 py-4 rounded-[24px] border ${active ? 'bg-primary/10 border-primary/20 shadow-sm dark:bg-darksageTint' : 'bg-surface dark:bg-darksurface border-black/[0.03] dark:border-darksoftBorder'}`}
  >
    <View className={`w-5 h-5 rounded-[6px] border mr-3 items-center justify-center ${active ? 'bg-primary border-primary' : 'border-black/10 dark:border-white/10'}`}>
      {active && <FontAwesome5 name="check" size={10} color="white" />}
    </View>
    <Text className={`font-medium text-[14px] ${active ? 'text-textMain dark:text-darktextMain' : 'text-textSec dark:text-darktextSec'}`}>{label}</Text>
  </TouchableOpacity>
);

const ActionButton = ({ icon, label, onPress, disabled, variant = 'secondary' }: { icon: string, label?: string, onPress: () => void, disabled?: boolean, variant?: 'primary' | 'secondary' }) => (
  <TouchableOpacity 
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.7}
    className={`flex-row items-center justify-center w-10 h-10 rounded-full ${variant === 'primary' ? 'bg-textMain dark:bg-darktextMain' : 'bg-transparent'} ${disabled ? 'opacity-50' : ''}`}
  >
    <FontAwesome5 name={icon} size={14} color={variant === 'primary' ? (Platform.OS === 'web' ? 'white' : '#1A1F1B') : '#6E7C74'} />
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

const EMPTY_ASSIGNMENTS: any[] = [];

export default function ShoppingListScreen() {
  const router = useRouter();
  const { workspace } = useActivePlan();
  const { routine } = useWeeklyRoutine();
  const { confirmShop } = usePantry();
  
  const assignments = workspace.output?.assignments || EMPTY_ASSIGNMENTS;

  // 1. DERIVED DATA ONLY
  const currentList = useMemo(() => generateShoppingList(assignments), [assignments]);

  // 2. STABLE MUTABLE UI STATE
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [hideStaples, setHideStaples] = useState(false);

  const toggleItem = (itemId: string) => {
    setCheckedMap(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const exclusionSummary = useMemo(() => {
    let takeaway = 0, skipped = 0, quick = 0, out = 0;
    DAYS.forEach(day => {
      (['breakfast','lunch','dinner'] as const).forEach(slot => {
        const mode = routine[day][slot];
        if (mode === 'takeaway') takeaway++;
        else if (mode === 'skip') skipped++;
        else if (mode === 'quick') quick++;
        else if (mode === 'out') out++;
      });
    });
    const parts: string[] = [];
    if (takeaway > 0) parts.push(`${takeaway} takeaway`);
    if (out > 0)      parts.push(`${out} eating out`);
    if (quick > 0)    parts.push(`${quick} quick`);
    if (skipped > 0)  parts.push(`${skipped} skipped`);
    return parts;
  }, [routine]);

  const plannedMealCount = useMemo(() => {
    let count = 0;
    DAYS.forEach(day => {
      (['breakfast','lunch','dinner'] as const).forEach(slot => {
        if (isPlanned(routine[day][slot])) count++;
      });
    });
    return count;
  }, [routine]);

  // Derived display metrics
  const allVisibleItems = useMemo(() => {
    return Object.values(currentList).flat().filter(item => !hideStaples || !item.isRestock);
  }, [currentList, hideStaples]);

  const totalIngredients = allVisibleItems.length;
  const checkedCount = allVisibleItems.filter(item => checkedMap[item.id]).length;
  const categoryCount = Object.keys(currentList).filter(cat => !hideStaples || currentList[cat].some(i => !i.isRestock)).length;

  const handleCopyText = async () => {
    let textOut = "PROVISION SHOPPING LIST\n\n";
    Object.entries(currentList).forEach(([category, items]) => {
      const visible = hideStaples ? items.filter(i => !i.isRestock) : items;
      if (visible.length === 0) return;
      textOut += `📦 ${category.toUpperCase()}\n`;
      visible.forEach(item => {
        const check = checkedMap[item.id] ? "[x]" : "[ ]";
        textOut += `${check} ${item.amount} ${item.unit} ${item.name}${item.isRestock ? " (REPLENISH)" : ""}\n`;
      });
      textOut += "\n";
    });
    await Clipboard.setStringAsync(textOut);
    Platform.OS === 'web' ? window.alert("Copied!") : Alert.alert("Copied", "Shopping list copied.");
  };

  const handleExportCSV = () => {
    if (Platform.OS !== 'web') return;
    setIsExporting(true);
    try {
      let csvContent = "Aisle,Ingredient,Amount,Unit,Recipes\n";
      Object.entries(currentList).forEach(([category, items]) => {
        items.forEach(item => {
          csvContent += `"${category}","${item.name}",${item.amount},"${item.unit}","${item.recipes.join(', ')}"\n`;
        });
      });
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "provision_shopping_list.csv";
      link.click();
      URL.revokeObjectURL(url);
    } finally { setIsExporting(false); }
  };

  return (
    <SafeAreaView className="flex-1 bg-appBg dark:bg-darkappBg">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 w-full mx-auto md:max-w-4xl px-4 md:px-8 pt-10 pb-32">
          
          <View className="print-hide">
            <PageHeader 
              eyebrow="Active Shopping List"
              title="Shopping List"
              subtitle={plannedMealCount === 21 ? "Full week plan" : `Built for ${plannedMealCount} planned meals.`}
              rightActions={
                <View className="hidden md:flex flex-row items-center bg-surface dark:bg-darksurface p-1.5 rounded-full border border-black/5 shadow-sm">
                  <ActionButton icon="copy" onPress={handleCopyText} />
                  <ActionButton icon="file-csv" onPress={handleExportCSV} disabled={isExporting} />
                </View>
              }
            />

            <View className="flex-row flex-wrap gap-4 mb-10">
              <StatBadge label="Total" value={totalIngredients} icon="shopping-basket" color="bg-surface dark:bg-darksurface border-black/5" />
              <StatBadge label="Checked" value={`${checkedCount}/${totalIngredients}`} icon="check-circle" color="bg-surface dark:bg-darksurface border-primary/20 text-primary" />
              <StatBadge label="Sections" value={categoryCount} icon="th-large" color="bg-surface dark:bg-darksurface border-black/5" />
              <View className="ml-auto hidden md:flex">
                <FilterToggle active={hideStaples} onPress={() => setHideStaples(!hideStaples)} label="Hide Pantry Staples" />
              </View>
            </View>

            <View className="md:hidden flex-row gap-3 border-t border-softBorder dark:border-white/5 pt-6">
              <TouchableOpacity onPress={handleCopyText} className="flex-1 bg-textMain dark:bg-darktextMain h-14 rounded-2xl items-center justify-center flex-row shadow-sm">
                <FontAwesome5 name="copy" size={14} color={Platform.OS === 'web' ? 'white' : '#1A1F1B'} className="mr-3" />
                <Text className="text-surface dark:text-textMain font-semibold">Copy List</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setHideStaples(!hideStaples)} className={`w-14 h-14 rounded-2xl items-center justify-center border ${hideStaples ? 'bg-primary border-primary' : 'bg-surface border-black/5'}`}>
                <FontAwesome5 name="eye-slash" size={16} color={hideStaples ? 'white' : '#6E7C74'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* LOADING STATE */}
          {workspace.status === 'generating' && (
            <View className="flex-1 items-center justify-center py-20">
              <ActivityIndicator size="large" color="#9DCD8B" />
              <Text className="text-textSec dark:text-darktextSec mt-4 font-medium">Generating your shopping list...</Text>
            </View>
          )}

          {/* ERROR STATE */}
          {workspace.status === 'error' && (
            <View className="flex-1 items-center justify-center py-20 bg-red-50 dark:bg-red-900/10 rounded-[32px] border border-red-100 dark:border-red-900/20 px-6">
              <FontAwesome5 name="exclamation-circle" size={32} color="#EF4444" />
              <Text className="text-textMain dark:text-darktextMain text-[20px] font-semibold mt-4 text-center">Shopping List Generation Failed</Text>
              <Text className="text-textSec dark:text-darktextSec mt-2 text-center">{workspace.error || 'Unknown error occurred'}</Text>
              <TouchableOpacity onPress={() => router.replace('/calibration')} className="mt-6 bg-red-500 px-8 py-3 rounded-full">
                <Text className="text-white font-bold">Restart Onboarding</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* EMPTY STATE (No output yet) */}
          {workspace.status === 'idle' && (
            <View className="flex-1 items-center justify-center py-20">
              <FontAwesome5 name="clipboard-list" size={48} color="#A3B3A9" />
              <Text className="text-textMain dark:text-darktextMain text-[20px] font-semibold mt-4">No Active Plan</Text>
              <Text className="text-textSec dark:text-darktextSec mt-2 text-center">Complete onboarding to generate your first shopping list.</Text>
              <TouchableOpacity onPress={() => router.replace('/calibration')} className="mt-6 bg-primary px-8 py-3 rounded-full">
                <Text className="text-white font-bold">Start Planning</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ACTUAL LIST CONTENT */}
          {workspace.status === 'ready' && (
            <View className="gap-y-12 mt-10">
              {Object.entries(currentList).map(([category, items]) => {
                const visible = hideStaples ? items.filter(i => !i.isRestock) : items;
                if (visible.length === 0) return null;

                return (
                  <View key={category} className="mb-8">
                    <View className="flex-row items-center mb-5 pl-2">
                      <View className="w-11 h-11 rounded-full bg-sageTint dark:bg-darksageTint items-center justify-center mr-4">
                        <FontAwesome5 name={getCategoryIcon(category)} size={16} color="#9DCD8B" />
                      </View>
                      <Text className="text-textMain dark:text-darktextMain text-[22px] font-medium">{category}</Text>
                    </View>
                
                    <View className="rounded-[32px] overflow-hidden bg-surface dark:bg-darksurface border border-black/5 shadow-sm">
                      {visible.map((item) => (
                        <TouchableOpacity 
                          key={item.id} 
                          onPress={() => toggleItem(item.id)}
                          activeOpacity={0.7}
                          className={`flex-row justify-between items-center py-5 px-6 border-b border-black/5 last:border-0 ${checkedMap[item.id] ? 'bg-black/5 dark:bg-white/5' : ''}`}
                        >
                          <View className="flex-row items-center flex-1 pr-6">
                            <View className={`w-8 h-8 rounded-full border-2 mr-5 items-center justify-center ${checkedMap[item.id] ? 'border-primary/40 bg-primary/20' : 'border-black/10 dark:border-white/10'}`}>
                              {checkedMap[item.id] && <FontAwesome5 name="check" size={10} color="#9DCD8B" />}
                            </View>
                            <View className="flex-1">
                              <View className="flex-row items-center flex-wrap gap-2">
                                {item.isRestock && <View className="px-2 py-0.5 rounded-md bg-peach/15 border border-peach/20"><Text className="text-[9px] font-bold text-peach">REPLENISH</Text></View>}
                                <Text className={`text-textMain dark:text-darktextMain text-[18px] font-medium ${checkedMap[item.id] ? 'opacity-30' : ''}`}>{item.name}</Text>
                              </View>
                              <Text className="text-xs text-textSec mt-1 opacity-60" numberOfLines={1}>{item.purchaseNote}</Text>
                            </View>
                          </View>
                          <View className={checkedMap[item.id] ? 'opacity-30' : ''}>
                            <Text className="font-semibold text-textMain dark:text-darktextMain">{item.amount}{item.displayUnit}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {checkedCount > 0 && workspace.status === 'ready' && (
            <View className="mt-12 pt-8 border-t border-black/5 items-center">
              <TouchableOpacity 
                onPress={() => {
                  const checkedItems = Object.values(currentList).flat().filter(i => checkedMap[i.id]);
                  confirmShop(checkedItems);
                  setCheckedMap({});
                  Platform.OS === 'web' ? window.alert("Pantry updated!") : Alert.alert("Success", "Pantry updated.");
                }}
                className="bg-primary rounded-full px-8 h-16 flex-row items-center justify-center shadow-md w-full md:w-auto md:min-w-[300px]"
              >
                <FontAwesome5 name="check-double" size={16} color="white" className="mr-3" />
                <Text className="text-white font-medium text-[16px]">Complete Shop</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
