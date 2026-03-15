import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Pressable, Platform, StatusBar,
  Image as RNImage
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWindowDimensions } from 'react-native';

import { MOCK_RECIPES, MOCK_INGREDIENTS } from '../../data/seed';
import { Recipe, MethodStep as MethodStepType, Substitution as SubstitutionType } from '../../data/schema';
import { NormalizedRecipe } from '../../data/planner/plannerTypes';
import { FULL_RECIPE_CATALOG } from '../../data/planner/recipeRegistry';
import { useTheme } from '../../components/ThemeContext';

type DisplayRecipe = (Recipe | NormalizedRecipe);

// ─── MOCK PANTRY STATE (mirrors PantryContext placeholder) ───────────────────
// ingredientId → status: 'in_pantry' | 'low_stock' | 'in_fuel_list'
const MOCK_PANTRY: Record<string, 'in_pantry' | 'low_stock' | 'in_fuel_list'> = {
  i7: 'in_pantry',    // Basmati Rice
  i8: 'in_pantry',    // Olive Oil
  i13: 'in_pantry',   // Miso Paste
  i14: 'low_stock',   // Soy Sauce
  i6: 'in_fuel_list', // Garlic
};

type IngredientStatus = 'in_pantry' | 'low_stock' | 'in_fuel_list' | 'need_to_buy';

function getIngredientStatus(ingredientId: string): IngredientStatus {
  return MOCK_PANTRY[ingredientId] ?? 'need_to_buy';
}

// ─── FALLBACK GRADIENTS ──────────────────────────────────────────────────────
const FALLBACK_LIGHT: [string, string][] = [
  ['#E8F2E0', '#C8DFC0'],
  ['#F3E9DB', '#E5D5BE'],
  ['#E3ECEC', '#C8DEDE'],
  ['#EEE8F5', '#DDD5EE'],
  ['#F0EAD8', '#E2D5BD'],
];
const FALLBACK_DARK: [string, string][] = [
  ['#243028', '#1A241D'],
  ['#2E2820', '#221E16'],
  ['#1E2828', '#161E1E'],
  ['#28222E', '#1E1A24'],
  ['#2A2418', '#1E1A10'],
];
const FOOD_ICONS = ['utensils', 'carrot', 'fish', 'drumstick-bite', 'seedling'] as const;

function getGradient(id: string, isDark: boolean): [string, string] {
  const n = parseInt(id.replace(/\D/g, ''), 10) || 0;
  const arr = isDark ? FALLBACK_DARK : FALLBACK_LIGHT;
  return arr[n % arr.length];
}

// ─── RECIPE IMAGE / FALLBACK ─────────────────────────────────────────────────
function RecipeHeroImage({ recipe, isDark }: { recipe: DisplayRecipe; isDark: boolean }) {
  const [failed, setFailed] = useState(false);
  const n = parseInt(recipe.id.replace(/\D/g, ''), 10) || 0;
  const [startColor, endColor] = getGradient(recipe.id, isDark);
  const iconName = FOOD_ICONS[n % FOOD_ICONS.length];
  const circleAlpha = isDark ? '0.08' : '0.18';

  return (
    <View style={{ width: '100%', height: '100%' }}>
      {/* Fallback always underneath */}
      <View style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: isDark ? '#2A332C' : '#EEF4E8' }}>
        <View style={{ position: 'absolute', width: 300, height: 300, borderRadius: 150,
          backgroundColor: `rgba(157,205,139,${isDark ? '0.05' : '0.12'})`, top: -100, right: -100 }} />
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100,
          backgroundColor: `rgba(157,205,139,${isDark ? '0.08' : '0.18'})`, bottom: -50, left: -60 }} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{
            width: 80, height: 80, borderRadius: 24,
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.4)',
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.6)',
          }}>
            <FontAwesome5 name={iconName} size={32} color={isDark ? 'rgba(122,184,104,0.5)' : 'rgba(157,205,139,0.7)'} />
          </View>
        </View>
      </View>
      {/* Actual image — unmounted on error so browser broken-img never shows */}
      {recipe.imageUrl && !failed ? (
        Platform.OS === 'web' ? (
          <Image
            source={recipe.imageUrl}
            style={{ width: '100%', height: '100%', position: 'absolute' }}
            contentFit="cover"
            transition={{ duration: 500, effect: 'cross-dissolve' }}
            onError={() => setFailed(true)}
          />
        ) : (() => {
          const val = recipe.imageUrl;
          const src = typeof val === 'string' && val.trim().startsWith('http') ? { uri: val } : typeof val === 'number' ? val : null;
          return src ? (
            <RNImage source={src} style={{ width: '100%', height: '100%', position: 'absolute' }} resizeMode="cover" onError={() => setFailed(true)} />
          ) : null;
        })()
      ) : null}
    </View>
  );
}

// ─── SMALL METADATA CHIP ─────────────────────────────────────────────────────
function MetaChip({ icon, label, isDark }: { icon: string; label: string; isDark: boolean }) {
  return (
    <View className="flex-row items-center bg-black/[0.04] dark:bg-white/[0.06] px-3 py-1.5 rounded-full border border-black/[0.04] dark:border-white/[0.06] mr-2 mb-2">
      <FontAwesome5 name={icon} size={10} color={isDark ? '#8C9A90' : '#6E7C74'} />
      <Text className="text-textMain dark:text-darktextMain text-[12px] font-medium ml-2">{label}</Text>
    </View>
  );
}

// ─── PASTEL TAG CHIP ─────────────────────────────────────────────────────────
function TagChip({ label }: { label: string }) {
  const palettes = [
    { bg: 'bg-sageTint dark:bg-darksageTint', text: 'text-[#3D6250] dark:text-[#85B674]' },
    { bg: 'bg-[#FEF3E8] dark:bg-[#2E2218]', text: 'text-[#7A4A20] dark:text-[#C48F5D]' },
    { bg: 'bg-[#F0EEF8] dark:bg-[#221E2E]', text: 'text-[#4A3A7A] dark:text-[#9B8FCC]' },
    { bg: 'bg-[#EBF5F0] dark:bg-[#1A2820]', text: 'text-[#2A5040] dark:text-[#72A890]' },
  ];
  const h = label.charCodeAt(0) % palettes.length;
  const p = palettes[h];
  return (
    <View className={`${p.bg} px-3 py-1 rounded-full border border-black/[0.03] dark:border-white/[0.05] mr-2 mb-2`}>
      <Text className={`${p.text} text-[11px] font-semibold tracking-wide`}>{label}</Text>
    </View>
  );
}

// ─── INSIGHT CARD ─────────────────────────────────────────────────────────────
function InsightCard({ icon, label, sub, accent }: { icon: string; label: string; sub?: string; accent?: string }) {
  return (
    <View className="bg-sageTint/40 dark:bg-[#1C241E] border border-primary/20 dark:border-primary/10 rounded-2xl px-4 py-3.5 mr-3" style={{ minWidth: 160 }}>
      <View className="flex-row items-center mb-1.5">
        <View className="w-6 h-6 rounded-full bg-primary/20 dark:bg-primary/10 items-center justify-center mr-2.5">
          <FontAwesome5 name={icon} size={10} color="#9DCD8B" />
        </View>
        <Text className="text-textMain dark:text-darktextMain text-[13px] font-semibold tracking-tight leading-tight flex-1">{label}</Text>
      </View>
      {sub ? <Text className="text-textSec dark:text-darktextSec text-[11px] font-medium opacity-80 ml-8">{sub}</Text> : null}
    </View>
  );
}

// ─── INGREDIENT ROW ──────────────────────────────────────────────────────────
function IngredientRow({
  amount, unit, name, status, checked, onToggle
}: {
  amount: number; unit: string; name: string;
  status: IngredientStatus; checked: boolean; onToggle: () => void;
}) {
  const statusConfig = {
    in_pantry: { label: 'In Pantry', bg: 'bg-sageTint dark:bg-darksageTint', text: 'text-[#3D6250] dark:text-[#85B674]', dot: 'bg-primary' },
    low_stock:  { label: 'Low Stock', bg: 'bg-[#FEF3E8] dark:bg-[#2E2218]', text: 'text-[#7A4A20] dark:text-[#C48F5D]', dot: 'bg-warning' },
    in_fuel_list: { label: 'On List', bg: 'bg-[#F0EEF8] dark:bg-[#221E2E]', text: 'text-[#4A3A7A] dark:text-[#9B8FCC]', dot: 'bg-[#9B8FCC]' },
    need_to_buy:  { label: 'Need to Buy', bg: 'bg-[#FDF0EE] dark:bg-[#2A1E1C]', text: 'text-[#7A3020] dark:text-danger', dot: 'bg-danger' },
  }[status];

  return (
    <Pressable
      onPress={onToggle}
      className="flex-row items-center py-3.5 border-b border-black/[0.04] dark:border-darksoftBorder active:bg-black/[0.01] dark:active:bg-white/[0.01]"
    >
      {/* Checkbox */}
      <View className={`w-5 h-5 rounded-[6px] border mr-4 items-center justify-center flex-shrink-0 ${
        checked
          ? 'bg-primary border-primary'
          : 'border-softBorder dark:border-darksoftBorder'
      }`}>
        {checked ? <FontAwesome5 name="check" size={9} color="white" /> : null}
      </View>

      {/* Amount + unit */}
      <Text className={`w-20 text-[13px] font-medium flex-shrink-0 ${checked ? 'text-textSec dark:text-darktextSec opacity-50 line-through' : 'text-textSec dark:text-darktextSec'}`}>
        {amount % 1 !== 0 ? amount.toFixed(1) : amount} {unit}
      </Text>

      {/* Name */}
      <Text className={`flex-1 text-[14px] ${checked ? 'opacity-40 line-through text-textMain dark:text-darktextMain' : 'text-textMain dark:text-darktextMain font-medium'}`}>
        {name}
      </Text>

      {/* Status badge */}
      <View className={`${statusConfig.bg} px-2.5 py-1 rounded-full ml-3 flex-row items-center`}>
        <View className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot} mr-1.5`} />
        <Text className={`${statusConfig.text} text-[10px] font-semibold`}>{statusConfig.label}</Text>
      </View>
    </Pressable>
  );
}

// ─── METHOD STEP CARD ────────────────────────────────────────────────────────
function MethodStepCard({ step }: { step: MethodStepType }) {
  return (
    <View className="flex-row mb-4">
      {/* Step number bubble */}
      <View className="w-8 h-8 rounded-full bg-sageTint dark:bg-darksageTint items-center justify-center mr-4 flex-shrink-0 mt-0.5 border border-primary/20 dark:border-primary/20">
        <Text className="text-[#3D6250] dark:text-[#85B674] text-[12px] font-bold">{step.step}</Text>
      </View>
      {/* Content */}
      <View className="flex-1">
        {step.timeCue ? (
          <View className="flex-row items-center mb-1.5">
            <FontAwesome5 name="clock" size={9} color="#9DCD8B" />
            <Text className="text-primary text-[11px] font-semibold ml-1.5 tracking-wide">{step.timeCue}</Text>
          </View>
        ) : null}
        <Text className="text-textMain dark:text-darktextMain text-[15px] leading-[1.55]">{step.text}</Text>
      </View>
    </View>
  );
}

// ─── NUTRITION NUTRITION ROW ────────────────────────────────────────────────────────
function NutritionRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View className="flex-row justify-between items-center py-2.5 border-b border-black/[0.03] dark:border-darksoftBorder">
      <Text className="text-textSec dark:text-darktextSec text-[13px]">{label}</Text>
      <Text className={`text-[14px] font-semibold ${color}`}>{value}</Text>
    </View>
  );
}

// ─── RELATED RECIPE CARD (mini) ──────────────────────────────────────────────
function RelatedRecipeCard({ recipe, label, isDark, onPress }: {
  recipe: DisplayRecipe; label?: string; isDark: boolean; onPress: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const n = parseInt(recipe.id.replace(/\D/g, ''), 10) || 0;
  const iconName = FOOD_ICONS[n % FOOD_ICONS.length];

  return (
    <Pressable
      onPress={onPress}
      className="mr-5"
      style={{ width: 176 }}
    >
      <View className="w-full aspect-[4/3] rounded-[20px] overflow-hidden mb-2.5 shadow-[0_4px_12px_rgba(0,0,0,0.04)] dark:shadow-none bg-[#F5F8F2] dark:bg-[#1A221C] border border-primary/10 dark:border-primary/5">
        {/* Premium Fallback pattern */}
        <View style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: isDark ? 'rgba(157,205,139,0.03)' : 'rgba(157,205,139,0.08)', top: -40, right: -40 }} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View className="w-12 h-12 rounded-full items-center justify-center border" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.6)', borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.8)' }}>
            <FontAwesome5 name={iconName} size={18} color={isDark ? 'rgba(122,184,104,0.4)' : 'rgba(157,205,139,0.7)'} />
          </View>
        </View>

        {recipe.imageUrl && !failed ? (
          Platform.OS === 'web' ? (
            <Image source={recipe.imageUrl} style={{ width: '100%', height: '100%', position: 'absolute' }}
              contentFit="cover" transition={{ duration: 400, effect: 'cross-dissolve' }}
              onError={() => setFailed(true)} />
          ) : (() => {
            const val = recipe.imageUrl;
            const src = typeof val === 'string' && val.trim().startsWith('http') ? { uri: val } : typeof val === 'number' ? val : null;
            return src ? (
              <RNImage source={src} style={{ width: '100%', height: '100%', position: 'absolute' }} resizeMode="cover" onError={() => setFailed(true)} />
            ) : null;
          })()
        ) : null}
        
        {label ? (
          <View className="absolute top-2.5 left-2.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
            <Text className="text-white text-[9px] font-bold uppercase tracking-widest">{label}</Text>
          </View>
        ) : null}
      </View>
      
      <View className="px-1.5">
        <Text className="text-textMain dark:text-darktextMain text-[15px] font-bold tracking-tight leading-tight mb-0.5" numberOfLines={2}>
          {recipe.title}
        </Text>
        {recipe.tags[0] ? (
          <Text className="text-textSec dark:text-darktextSec text-[12px] font-medium opacity-70">{recipe.tags[0]}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ─── NOT FOUND STATE ─────────────────────────────────────────────────────────
function NotFound({ onBack }: { onBack: () => void }) {
  return (
    <View className="flex-1 bg-appBg dark:bg-darkappBg items-center justify-center px-8">
      <View className="w-16 h-16 rounded-full bg-sageTint dark:bg-darksageTint items-center justify-center mb-6">
        <FontAwesome5 name="search" size={24} color="#9DCD8B" />
      </View>
      <Text className="text-textMain dark:text-darktextMain text-[22px] font-medium tracking-tight mb-2 text-center">Recipe not found</Text>
      <Text className="text-textSec dark:text-darktextSec text-[15px] text-center mb-8 leading-relaxed opacity-70">
        We couldn't find this recipe in your plan.
      </Text>
      <TouchableOpacity onPress={onBack}
        className="bg-primary px-6 py-3 rounded-full flex-row items-center">
        <FontAwesome5 name="arrow-left" size={12} color="white" />
        <Text className="text-white font-semibold text-[14px] ml-2">Back to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── SECTION HEADER ──────────────────────────────────────────────────────────
function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View className="flex-row justify-between items-center mb-4">
      <Text className="text-textMain dark:text-darktextMain text-[18px] font-medium tracking-tight">{title}</Text>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction}>
          <Text className="text-primary text-[13px] font-medium">{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── SUPPORT WIDGET CARD WRAPPER ─────────────────────────────────────────────
function WidgetCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <View className={`bg-surface dark:bg-darksurface rounded-3xl p-5 border border-black/[0.03] dark:border-darksoftBorder shadow-[0_2px_12px_rgba(0,0,0,0.02)] dark:shadow-none mb-4 ${className}`}>
      {children}
    </View>
  );
}

// ─── PLANNING FLAG ROW ────────────────────────────────────────────────────────
function PlanningFlag({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between py-2.5 border-b border-black/[0.03] dark:border-darksoftBorder">
      <View className="flex-row items-center">
        <FontAwesome5 name={icon} size={11} color="#9DCD8B" />
        <Text className="text-textSec dark:text-darktextSec text-[13px] ml-2.5">{label}</Text>
      </View>
      <View>{value}</View>
    </View>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function RecipeDetailPage() {
  const { id } = useLocalSearchParams<{ id: string; day?: string; slot?: string }>();
  const { day, slot } = useLocalSearchParams<{ day?: string; slot?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isDarkMode } = useTheme();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  // ── Find recipe ──────────────────────────────────────────────────────────────
  const recipe = FULL_RECIPE_CATALOG[id] || MOCK_RECIPES.find(r => r.id === id);

  // ── Back navigation ──────────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)' as any);
  }, [router]);

  if (!recipe) return <NotFound onBack={handleBack} />;

  // ── Ingredient state ─────────────────────────────────────────────────────────
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const [addedToFuelList, setAddedToFuelList] = useState(false);

  const toggleIngredient = (ingId: string) => {
    setCheckedIngredients(prev => {
      const next = new Set(prev);
      if (next.has(ingId)) next.delete(ingId);
      else next.add(ingId);
      return next;
    });
  };

  // ── Derive related recipes ───────────────────────────────────────────────────
  const getRelatedRecipes = (): { recipe: Recipe; label: string }[] => {
    const ids = recipe.relatedRecipeIds ?? [];
    const related: { recipe: Recipe; label: string }[] = [];
    const labels = ['More like this', 'Higher Protein', 'Faster', 'Lower Cost'];

    if (ids.length > 0) {
      ids.slice(0, 4).forEach((rid, i) => {
        const r = MOCK_RECIPES.find(x => x.id === rid);
        if (r) related.push({ recipe: r, label: labels[i] ?? 'Similar' });
      });
    } else {
      // Derive from shared tags
      const tagMatches = MOCK_RECIPES
        .filter(r => r.id !== recipe.id && r.tags.some(t => recipe.tags.includes(t)))
        .slice(0, 4);
      tagMatches.forEach((r, i) => related.push({ recipe: r, label: labels[i] ?? 'Similar' }));
    }
    return related;
  };

  const relatedRecipes = getRelatedRecipes();

  // ── Ingredient breakdown ─────────────────────────────────────────────────────
  const ingredientRows = ((recipe.ingredients ?? []) as any[]).map(ing => {
    const ingId = ing.ingredientId || ing.canonicalIngredientId || '';
    const info = MOCK_INGREDIENTS.find(i => i.id === ingId);
    const status = getIngredientStatus(ingId);
    return { ...ing, ingredientId: ingId, name: info?.name ?? ing.name ?? ingId, status };
  });

  const missingCount = ingredientRows.filter(i =>
    i.status === 'need_to_buy' && !checkedIngredients.has(i.ingredientId)
  ).length;
  const pantryCount = ingredientRows.filter(i =>
    i.status === 'in_pantry' || i.status === 'in_fuel_list'
  ).length;

  const handleAddMissing = () => {
    // In production: add only need_to_buy ingredients to fuel list
    setAddedToFuelList(true);
  };

  // ── Timing display ───────────────────────────────────────────────────────────
  const totalTime = recipe.totalTimeMinutes ?? ((recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0));
  const contextLabel = day && slot ? `${day} ${slot}` : 'Planned Meal';

  // ── Difficulty colour ────────────────────────────────────────────────────────
  const difficultyColor = (({
    Easy: 'text-[#3D6250] dark:text-[#85B674]',
    Medium: 'text-[#7A4A20] dark:text-[#C48F5D]',
    Hard: 'text-[#7A3020] dark:text-danger',
  }) as Record<string, string>)[(recipe as any).difficulty ?? 'Easy'] ?? 'text-textSec dark:text-darktextSec';

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <View
      className="flex-1 bg-appBg dark:bg-darkappBg"
      style={Platform.OS === 'web'
        ? { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' } as any
        : { flex: 1 }}
    >
      {/* ── TOP CONTEXT BAR ─────────────────────────────────────────────────── */}
      <View
        className="flex-row items-center justify-between px-5 py-3.5 bg-appBg dark:bg-darkappBg align-middle border-b border-transparent dark:border-white/[0.02]"
        style={Platform.OS === 'web' ? { flexShrink: 0 } as any : undefined}
      >
        {/* Back */}
        <TouchableOpacity onPress={handleBack}
          className="flex-row items-center gap-2 h-10 -ml-1 active:opacity-60 flex-1">
          <FontAwesome5 name="chevron-left" size={13} color={isDarkMode ? '#8C9A90' : '#4A5C50'} />
          <Text className="text-textMain dark:text-darktextMain font-medium text-[14px]">Back</Text>
        </TouchableOpacity>

        {/* Context label */}
        <View className="flex-row items-center bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.04] px-4 py-1.5 rounded-full justify-center">
          <FontAwesome5 name="calendar-check" size={10} color={isDarkMode ? '#A0ABA5' : '#6E7C74'} />
          <Text className="text-textSec dark:text-darktextSec text-[12px] font-semibold ml-2 tracking-wide">{contextLabel}</Text>
        </View>

        {/* Right actions */}
        <View className="flex-row items-center gap-1.5 flex-1 justify-end">
          <TouchableOpacity className="w-10 h-10 rounded-full bg-surface dark:bg-darksurface border border-black/[0.04] dark:border-white/[0.04] shadow-sm dark:shadow-none items-center justify-center active:opacity-60">
            <FontAwesome5 name="bookmark" size={12} color={isDarkMode ? '#8C9A90' : '#6E7C74'} />
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center justify-center gap-1.5 bg-surface dark:bg-darksurface border border-black/[0.04] dark:border-white/[0.04] shadow-sm dark:shadow-none px-4 h-10 rounded-full active:opacity-60">
            <FontAwesome5 name="random" size={10} color={isDarkMode ? '#8C9A90' : '#6E7C74'} />
            <Text className="text-textSec dark:text-darktextSec text-[13px] font-medium">Swap</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── SCROLLABLE BODY ──────────────────────────────────────────────────── */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        style={Platform.OS === 'web' ? { height: '100%' } as any : undefined}
      >
        <View
          className="w-full max-w-[1400px] mx-auto px-4 md:px-8 lg:px-12 pb-24 pt-6"
          style={isDesktop
            ? { display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 32 } as any
            : undefined}
        >

          {/* ══ LEFT / MAIN COLUMN ════════════════════════════════════════════ */}
          <View style={isDesktop ? { flex: 1, minWidth: 0 } as any : undefined}>

            {/* ── HERO ──────────────────────────────────────────────────────── */}
            <View className="mb-5">
              {/* Hero image */}
              <View className="w-full h-[280px] md:h-[340px] rounded-4xl overflow-hidden mb-4 shadow-[0_8px_32px_rgba(0,0,0,0.07)] dark:shadow-none">
                <RecipeHeroImage recipe={recipe} isDark={isDarkMode} />
                {/* Bottom gradient overlay with title */}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.75)']}
                  locations={[0.3, 0.65, 1]}
                  style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%',
                    justifyContent: 'flex-end', padding: 24, paddingBottom: 20 }}
                >
                  {/* Slot badge */}
                  {day && slot ? (
                    <View className="bg-black/40 backdrop-blur-md self-start px-3.5 py-1.5 rounded-full border border-white/10 mb-2.5">
                      <Text className="text-white text-[10px] font-bold uppercase tracking-[0.2em]">{day} • {slot}</Text>
                    </View>
                  ) : null}
                  <Text className="text-white text-[32px] md:text-[38px] font-medium tracking-tight leading-[1.1]">
                    {recipe.title}
                  </Text>
                </LinearGradient>
              </View>

              {/* Description */}
              {recipe.description ? (
                <Text className="text-textSec dark:text-darktextSec text-[16px] leading-[1.6] mb-3 opacity-80">
                  {recipe.description}
                </Text>
              ) : null}

              {/* Metadata chips row */}
              <View className="flex-row flex-wrap gap-x-0 gap-y-0 mb-2">
                {recipe.prepTimeMinutes ? <MetaChip icon="clock" label={`${recipe.prepTimeMinutes}m prep`} isDark={isDarkMode} /> : null}
                {recipe.cookTimeMinutes ? <MetaChip icon="fire" label={`${recipe.cookTimeMinutes}m cook`} isDark={isDarkMode} /> : null}
                <MetaChip icon="bolt" label={`${(recipe as any).macros?.calories ?? (recipe as any).macrosPerServing?.calories ?? 0} kcal`} isDark={isDarkMode} />
                <MetaChip icon="seedling" label={`${(recipe as any).macros?.protein ?? (recipe as any).macrosPerServing?.protein ?? 0}g protein`} isDark={isDarkMode} />
                {recipe.servings ? <MetaChip icon="users" label={`${recipe.servings} serving${recipe.servings > 1 ? 's' : ''}`} isDark={isDarkMode} /> : null}
                {((recipe as any).costPerServingGBP || (recipe as any).estimatedCostPerServingGBP) ? (
                  <MetaChip icon="pound-sign" label={`£${((recipe as any).costPerServingGBP || (recipe as any).estimatedCostPerServingGBP).toFixed(2)}/srv`} isDark={isDarkMode} />
                ) : null}
                {recipe.difficulty ? (
                  <View className="flex-row items-center bg-black/[0.04] dark:bg-white/[0.06] px-3 py-1.5 rounded-full border border-black/[0.04] dark:border-white/[0.06] mr-2 mb-2">
                    <Text className={`text-[12px] font-semibold ${difficultyColor}`}>{recipe.difficulty}</Text>
                  </View>
                ) : null}
              </View>

              {/* Tag chips */}
              <View className="flex-row flex-wrap gap-x-0 gap-y-0 mb-4">
                {(recipe.tags ?? []).map(tag => <TagChip key={tag} label={tag} />)}
              </View>

              {/* Hero primary actions */}
              <View className="flex-row gap-3">
                <TouchableOpacity className="flex-1 bg-primary py-3.5 rounded-full items-center justify-center shadow-[0_4px_16px_rgba(157,205,139,0.35)] active:opacity-85">
                  <Text className="text-white font-semibold text-[15px] tracking-wide">
                    {day && slot ? `Planned for ${day} ${slot}` : 'Keep in Plan'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity className="px-5 py-3.5 rounded-full border border-black/[0.06] dark:border-white/[0.06] bg-surface dark:bg-darksurface shadow-[0_2px_8px_rgba(0,0,0,0.02)] items-center justify-center flex-row gap-2 active:opacity-75">
                  <FontAwesome5 name="random" size={14} color={isDarkMode ? '#8C9A90' : '#6E7C74'} />
                  <Text className="text-textSec dark:text-darktextSec font-semibold text-[15px]">Swap</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── PROVISION INSIGHT STRIP ─────────────────────────────────── */}
            <View className="mb-6">
              <View className="flex-row items-center gap-2 mb-3 ml-1">
                <FontAwesome5 name="sparkles" size={10} color="#9DCD8B" />
                <Text className="text-primary text-[11px] font-bold uppercase tracking-[0.16em]">Provision Insights</Text>
              </View>
              <View className="bg-surface dark:bg-[#161A18] rounded-[24px] py-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/[0.02] dark:border-white/[0.02]">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                  <InsightCard icon="bullseye" label="Fits your High-Protein goal" sub="163g → target 160g" />
                  {pantryCount > 0 ? (
                    <InsightCard icon="box-open" label={`${pantryCount} pantry items match`} sub="Already in stock" />
                  ) : null}
                  {missingCount > 0 ? (
                    <InsightCard icon="shopping-basket" label={`${missingCount} items to buy`} sub="Not yet on Fuel List" />
                  ) : null}
                  {((recipe as any).costPerServingGBP || (recipe as any).estimatedCostPerServingGBP) ? (
                    <InsightCard icon="pound-sign" label={`£${((recipe as any).costPerServingGBP || (recipe as any).estimatedCostPerServingGBP).toFixed(2)} per serving`} sub="Within weekly budget" />
                  ) : null}
                  <InsightCard icon="star" label="Taste profile match" sub="You prefer quick savory meals" />
                  {recipe.reheatsWell ? (
                    <InsightCard icon="redo" label="Reheats well" sub="Great for meal prep" />
                  ) : null}
                </ScrollView>
              </View>
            </View>

            {/* major spacing updates from here on */}
            {/* ── INGREDIENTS ─────────────────────────────────────────────── */}
            <View className="bg-surface dark:bg-darksurface rounded-3xl p-6 border border-black/[0.03] dark:border-darksoftBorder shadow-[0_4px_16px_rgba(0,0,0,0.03)] dark:shadow-none mb-6">
              <SectionHeader
                title="Ingredients"
                action={missingCount > 0 && !addedToFuelList ? `Add ${missingCount} to Fuel List` : addedToFuelList ? '✓ Added' : undefined}
                onAction={handleAddMissing}
              />

              {/* Legend */}
              <View className="flex-row flex-wrap gap-3 mb-4">
                {[
                  { dot: 'bg-primary', label: 'In Pantry' },
                  { dot: 'bg-warning', label: 'Low Stock' },
                  { dot: 'bg-[#9B8FCC]', label: 'On List' },
                  { dot: 'bg-danger', label: 'Need to Buy' },
                ].map(item => (
                  <View key={item.label} className="flex-row items-center">
                    <View className={`w-2 h-2 rounded-full ${item.dot} mr-1.5`} />
                    <Text className="text-textSec dark:text-darktextSec text-[11px]">{item.label}</Text>
                  </View>
                ))}
              </View>

              {ingredientRows.map((ing, idx) => (
                <IngredientRow
                  key={ing.ingredientId || `ing-${idx}`}
                  amount={ing.amount}
                  unit={ing.unit}
                  name={ing.name}
                  status={ing.status}
                  checked={checkedIngredients.has(ing.ingredientId)}
                  onToggle={() => toggleIngredient(ing.ingredientId)}
                />
              ))}

              {missingCount > 0 && !addedToFuelList ? (
                <TouchableOpacity
                  onPress={handleAddMissing}
                  className="mt-4 py-3 rounded-full border border-primary/30 bg-sageTint dark:bg-darksageTint flex-row items-center justify-center gap-2 active:opacity-75"
                >
                  <FontAwesome5 name="plus" size={11} color="#9DCD8B" />
                  <Text className="text-[#3D6250] dark:text-[#85B674] font-semibold text-[13px]">
                    Add {missingCount} missing item{missingCount > 1 ? 's' : ''} to Fuel List
                  </Text>
                </TouchableOpacity>
              ) : addedToFuelList ? (
                <View className="mt-4 py-3 rounded-full bg-sageTint dark:bg-darksageTint flex-row items-center justify-center gap-2">
                  <FontAwesome5 name="check" size={11} color="#9DCD8B" />
                  <Text className="text-[#3D6250] dark:text-[#85B674] font-semibold text-[13px]">Added to Fuel List</Text>
                </View>
              ) : null}
            </View>

            {/* ── METHOD ──────────────────────────────────────────────────── */}
            <View className="bg-surface dark:bg-darksurface rounded-3xl p-6 border border-black/[0.03] dark:border-darksoftBorder shadow-[0_4px_16px_rgba(0,0,0,0.03)] dark:shadow-none mb-6">
              <SectionHeader title="Method" />
              {recipe.method && recipe.method.length > 0 ? (
                recipe.method.map(step => <MethodStepCard key={step.step} step={step} />)
              ) : (
                <View className="py-6 items-center">
                  <FontAwesome5 name="clipboard-list" size={24} color={isDarkMode ? '#3A4840' : '#C8DFC0'} />
                  <Text className="text-textSec dark:text-darktextSec text-[14px] mt-3 opacity-60">
                    Method steps unavailable for this recipe
                  </Text>
                </View>
              )}
            </View>

            {/* ── SUBSTITUTIONS ────────────────────────────────────────────── */}
            {recipe.substitutions && recipe.substitutions.length > 0 ? (
              <View className="bg-surface dark:bg-darksurface rounded-3xl p-6 border border-black/[0.03] dark:border-darksoftBorder shadow-[0_4px_16px_rgba(0,0,0,0.03)] dark:shadow-none mb-6">
                <SectionHeader title="Substitutions" />
                {((recipe as any).substitutions as any[]).map((sub, i) => (
                  <View key={i} className="flex-row items-start py-3 border-b border-black/[0.04] dark:border-darksoftBorder">
                    {/* Original */}
                    <View className="flex-1 pr-2">
                      <Text className="text-textSec dark:text-darktextSec text-[11px] uppercase tracking-wide mb-1 opacity-60">Original</Text>
                      <Text className="text-textMain dark:text-darktextMain text-[14px] font-medium">{sub.original}</Text>
                    </View>
                    {/* Arrow */}
                    <View className="px-3 pt-5">
                      <FontAwesome5 name="arrow-right" size={10} color="#9DCD8B" />
                    </View>
                    {/* Swap */}
                    <View className="flex-1 pl-2">
                      <Text className="text-textSec dark:text-darktextSec text-[11px] uppercase tracking-wide mb-1 opacity-60">Swap</Text>
                      <Text className="text-textMain dark:text-darktextMain text-[14px] font-medium">{sub.swap}</Text>
                      <Text className="text-textSec dark:text-darktextSec text-[11px] mt-1 opacity-65 italic">{sub.reason}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {/* ── NOTES ────────────────────────────────────────────────────── */}
            {recipe.notes ? (
              <View className="bg-sageTint/60 dark:bg-darksageTint rounded-3xl p-6 border border-primary/10 dark:border-primary/5 mb-8">
                <View className="flex-row items-center mb-3">
                  <FontAwesome5 name="lightbulb" size={12} color="#9DCD8B" />
                  <Text className="text-[#3D6250] dark:text-[#85B674] text-[12px] font-bold uppercase tracking-widest ml-2">Chef's Note</Text>
                </View>
                <Text className="text-textMain dark:text-darktextMain text-[14px] leading-relaxed">{(recipe as any).notes}</Text>
              </View>
            ) : null}

            {/* ── RELATED RECIPES ──────────────────────────────────────────── */}
            {relatedRecipes.length > 0 ? (
              <View className="mb-8 pt-4">
                <View className="mb-4 ml-1">
                  <Text className="text-textMain dark:text-darktextMain text-[20px] font-semibold tracking-tight">You might also like</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
                  {relatedRecipes.map(({ recipe: r, label }) => (
                    <RelatedRecipeCard
                      key={r.id}
                      recipe={r}
                      label={label}
                      isDark={isDarkMode}
                      onPress={() => router.push(`/recipe/${r.id}${day ? `?day=${day}&slot=${slot ?? ''}` : ''}` as any)}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* ── MARK COOKED (bottom action on mobile) ─────────────────────── */}
            {!isDesktop ? (
              <TouchableOpacity className="py-3.5 rounded-full border border-softBorder dark:border-darksoftBorder flex-row items-center justify-center gap-2.5 bg-surface dark:bg-darksurface mb-6">
                <FontAwesome5 name="check-circle" size={13} color="#9DCD8B" />
                <Text className="text-textMain dark:text-darktextMain font-medium text-[14px]">Mark as Cooked</Text>
              </TouchableOpacity>
            ) : null}

          </View>
          {/* ══ END LEFT COLUMN ══════════════════════════════════════════════ */}

          {/* ══ RIGHT / SUPPORT COLUMN (desktop only) ════════════════════════ */}
          {isDesktop ? (
            <View style={{ width: 300, flexShrink: 0, position: 'sticky', top: 24, alignSelf: 'flex-start' } as any}>

              {/* Nutrition widget */}
              <WidgetCard>
                <SectionHeader title="Nutrition" />
                <NutritionRow label="Calories" value={`${(recipe as any).macros?.calories ?? (recipe as any).macrosPerServing?.calories ?? 0} kcal`} color="text-peach dark:text-[#C48F5D]" />
                <NutritionRow label="Protein" value={`${(recipe as any).macros?.protein ?? (recipe as any).macrosPerServing?.protein ?? 0}g`} color="text-lime dark:text-[#A9B86D]" />
                <NutritionRow label="Carbs" value={`${(recipe as any).macros?.carbs ?? (recipe as any).macrosPerServing?.carbs ?? 0}g`} color="text-[#9B8FCC] dark:text-[#9B8FCC]" />
                <NutritionRow label="Fats" value={`${(recipe as any).macros?.fats ?? (recipe as any).macrosPerServing?.fats ?? 0}g`} color="text-[#C48F5D] dark:text-[#C48F5D]" />
                {recipe.servings ? (
                  <Text className="text-textSec dark:text-darktextSec text-[11px] mt-3 opacity-60">
                    Per serving · {recipe.servings} serving{recipe.servings > 1 ? 's' : ''}
                  </Text>
                ) : null}
              </WidgetCard>

              {/* Planning details */}
              <WidgetCard>
                <SectionHeader title="Planning Details" />
                {recipe.prepTimeMinutes ? (
                  <PlanningFlag icon="clock" label="Prep time" value={<Text className="text-textMain dark:text-darktextMain text-[13px] font-semibold">{recipe.prepTimeMinutes}m</Text>} />
                ) : null}
                {recipe.cookTimeMinutes ? (
                  <PlanningFlag icon="fire" label="Cook time" value={<Text className="text-textMain dark:text-darktextMain text-[13px] font-semibold">{recipe.cookTimeMinutes}m</Text>} />
                ) : null}
                <PlanningFlag icon="hourglass-half" label="Total time" value={<Text className="text-textMain dark:text-darktextMain text-[13px] font-semibold">{totalTime}m</Text>} />
                {recipe.difficulty ? (
                  <PlanningFlag icon="signal" label="Difficulty" value={<Text className={`text-[13px] font-semibold ${difficultyColor}`}>{(recipe as any).difficulty}</Text>} />
                ) : null}
                {((recipe as any).estimatedCostGBP || (recipe as any).estimatedCostTotalGBP) ? (
                  <PlanningFlag icon="pound-sign" label="Est. cost" value={<Text className="text-textMain dark:text-darktextMain text-[13px] font-semibold">£{((recipe as any).estimatedCostGBP || (recipe as any).estimatedCostTotalGBP).toFixed(2)}</Text>} />
                ) : null}
                {recipe.reheatsWell !== undefined ? (
                  <PlanningFlag icon="redo" label="Reheats well" value={
                    <View className={`px-2 py-0.5 rounded-full ${recipe.reheatsWell ? 'bg-sageTint dark:bg-darksageTint' : 'bg-[#F5F0EC] dark:bg-[#2A2420]'}`}>
                      <Text className={`text-[11px] font-semibold ${recipe.reheatsWell ? 'text-[#3D6250] dark:text-[#85B674]' : 'text-textSec dark:text-darktextSec opacity-60'}`}>
                        {recipe.reheatsWell ? 'Yes' : 'No'}
                      </Text>
                    </View>
                  } />
                ) : null}
                {recipe.freezerFriendly !== undefined ? (
                  <PlanningFlag icon="snowflake" label="Freezer friendly" value={
                    <View className={`px-2 py-0.5 rounded-full ${recipe.freezerFriendly ? 'bg-sageTint dark:bg-darksageTint' : 'bg-[#F5F0EC] dark:bg-[#2A2420]'}`}>
                      <Text className={`text-[11px] font-semibold ${recipe.freezerFriendly ? 'text-[#3D6250] dark:text-[#85B674]' : 'text-textSec dark:text-darktextSec opacity-60'}`}>
                        {recipe.freezerFriendly ? 'Yes' : 'No'}
                      </Text>
                    </View>
                  } />
                ) : null}
              </WidgetCard>

              {/* Support actions */}
              <WidgetCard>
                <SectionHeader title="Actions" />
                <TouchableOpacity className="py-3 rounded-2xl bg-sageTint dark:bg-darksageTint flex-row items-center px-4 mb-2.5 active:opacity-75">
                  <FontAwesome5 name="check-circle" size={13} color="#9DCD8B" />
                  <Text className="text-[#3D6250] dark:text-[#85B674] font-medium text-[13px] ml-3">Mark as Cooked</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAddMissing}
                  className="py-3 rounded-2xl border border-softBorder dark:border-darksoftBorder flex-row items-center px-4 mb-2.5 active:opacity-75 bg-surface dark:bg-darksurface"
                >
                  <FontAwesome5 name="shopping-basket" size={13} color={isDarkMode ? '#8C9A90' : '#6E7C74'} />
                  <Text className="text-textMain dark:text-darktextMain font-medium text-[13px] ml-3">
                    {addedToFuelList ? '✓ Added to Fuel List' : `Add ${missingCount} Missing to Fuel List`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity className="py-3 rounded-2xl border border-softBorder dark:border-darksoftBorder flex-row items-center px-4 active:opacity-75 bg-surface dark:bg-darksurface">
                  <FontAwesome5 name="random" size={13} color={isDarkMode ? '#8C9A90' : '#6E7C74'} />
                  <Text className="text-textMain dark:text-darktextMain font-medium text-[13px] ml-3">Swap This Meal</Text>
                </TouchableOpacity>
              </WidgetCard>

              {/* Pantry summary */}
              <WidgetCard>
                <SectionHeader title="Pantry & Fuel List" />
                <View className="flex-row justify-between mb-3">
                  <View className="flex-1 bg-sageTint dark:bg-darksageTint rounded-2xl p-3 mr-2 items-center">
                    <Text className="text-[#3D6250] dark:text-[#85B674] text-[22px] font-medium">{pantryCount}</Text>
                    <Text className="text-textSec dark:text-darktextSec text-[11px] mt-0.5">in pantry</Text>
                  </View>
                  <View className="flex-1 bg-[#FDF0EE] dark:bg-[#2A1E1C] rounded-2xl p-3 ml-2 items-center">
                    <Text className="text-danger text-[22px] font-medium">{missingCount}</Text>
                    <Text className="text-textSec dark:text-darktextSec text-[11px] mt-0.5">to buy</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => router.push('/(tabs)/pantry' as any)}
                  className="flex-row items-center justify-center py-2.5 border border-softBorder dark:border-darksoftBorder rounded-full active:opacity-70">
                  <Text className="text-textSec dark:text-darktextSec text-[12px] font-medium mr-2">View Pantry</Text>
                  <FontAwesome5 name="arrow-right" size={10} color={isDarkMode ? '#8C9A90' : '#6E7C74'} />
                </TouchableOpacity>
              </WidgetCard>

            </View>
          ) : null}
          {/* ══ END RIGHT COLUMN ════════════════════════════════════════════ */}
        </View>
      </ScrollView>
    </View>
  );
}
