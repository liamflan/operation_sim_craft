import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import PageHeader from '../../components/PageHeader';
import { MOCK_RECIPES } from '../../data/seed';
import { FontAwesome5 } from '@expo/vector-icons';
import ImportRecipeModal from '../../components/ImportRecipeModal';
import { useWeeklyRoutine } from '../../data/WeeklyRoutineContext';
import {
  DAYS, Day, MealSlot, MealMode,
  BREAKFAST_OPTIONS, LUNCH_OPTIONS, DINNER_OPTIONS,
  ROUTINE_PRESETS,
} from '../../data/weeklyRoutine';

// Predefined Tags
const PREDEFINED_GOALS = ['High Protein', 'Lower Carb', 'Fast Prep', 'Calorie Deficit', 'Budget-First'];
const PREDEFINED_RESTRICTIONS = ['No Dairy', 'No Nuts', 'Gluten-Free', 'Halal', 'Avoid Pork', 'Avoid Shellfish'];

// Sub-components for structure and intelligence feel
const InfoRow = ({ label, value, icon, color, onPress, testID }: { label: string, value: string, icon: string, color: string, onPress?: () => void, testID?: string }) => (
  <TouchableOpacity 
    testID={testID}
    onPress={onPress}
    disabled={!onPress}
    className="flex-row items-center justify-between py-4 border-b border-black/5 dark:border-white/5 last:border-0"
  >
    <View className="flex-row items-center">
      <View className={`w-10 h-10 rounded-xl ${color} items-center justify-center mr-4 shadow-sm`}>
        <FontAwesome5 name={icon} size={16} color="white" />
      </View>
      <View>
        <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-0.5">{label}</Text>
        <Text className="text-charcoal dark:text-darkcharcoal text-lg font-extrabold">{value}</Text>
      </View>
    </View>
    {onPress && (
      <View className="w-8 h-8 rounded-full bg-gray-100 dark:bg-black/20 items-center justify-center">
        <FontAwesome5 name="pen" size={10} color="#9CA3AF" />
      </View>
    )}
  </TouchableOpacity>
);

const IntelligenceBadge = ({ label, icon, color }: { label: string, icon: string, color: string }) => (
  <View className={`flex-row items-center px-3 py-1.5 rounded-xl border ${color}`}>
    <FontAwesome5 name={icon} size={10} color="currentColor" className="mr-2" />
    <Text className="font-extrabold text-[10px] uppercase tracking-wider">{label}</Text>
  </View>
);

// Core Rule Edit Modal
const CoreRuleModal = ({ 
  visible, onClose, title, value, onSave, type, prefix, suffix 
}: { 
  visible: boolean, onClose: () => void, title: string, value: string, onSave: (val: string) => void, type: 'diet' | 'number', prefix?: string, suffix?: string 
}) => {
  const [tempValue, setTempValue] = useState(value);
  
  React.useEffect(() => { if (visible) setTempValue(value) }, [visible, value]);

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-center items-center bg-black/40 p-4">
        <View className="bg-white dark:bg-darkgrey w-full max-w-[320px] rounded-[32px] p-6 shadow-xl border border-black/5 dark:border-white/10">
          <Text className="text-charcoal dark:text-darkcharcoal text-2xl font-extrabold tracking-tight mb-6">{title}</Text>
          
          {type === 'diet' ? (
            <View className="flex-col gap-2">
              {['Omnivore', 'Pescatarian', 'Vegetarian', 'Vegan'].map(option => (
                <TouchableOpacity 
                  key={option}
                  onPress={() => setTempValue(option)}
                  className={`py-3.5 px-4 rounded-xl border transition-all ${tempValue === option ? 'bg-avocado border-avocado shadow-sm' : 'bg-gray-50 dark:bg-black/20 border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5'}`}
                >
                  <Text className={`font-bold text-base ${tempValue === option ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View className="flex-row items-center justify-center bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-black/5 dark:border-white/5">
              {prefix && <Text className="text-gray-400 dark:text-gray-500 font-extrabold text-3xl mr-1">{prefix}</Text>}
              <TextInput
                autoFocus
                keyboardType="numeric"
                value={tempValue}
                onChangeText={setTempValue}
                className="text-charcoal dark:text-white font-extrabold text-3xl text-center outline-none min-w-[60px]"
                style={{ outlineWidth: 0 } as any}
              />
              {suffix && <Text className="text-gray-400 dark:text-gray-500 font-bold text-xl ml-2">{suffix}</Text>}
            </View>
          )}

          <View className="flex-row gap-3 mt-8">
            <TouchableOpacity onPress={onClose} className="flex-1 py-3.5 rounded-xl border border-black/10 dark:border-white/10 items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/5">
              <Text className="text-gray-500 font-bold">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { onSave(tempValue); onClose(); }} className="flex-1 bg-avocado py-3.5 rounded-xl items-center justify-center shadow-md hover:scale-[1.02] transition-transform">
              <Text className="text-white font-bold">Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// Reusable Chip Selector for Goals & Restrictions
const ChipSelector = ({ 
  options, selected, onToggle, 
  customText, setCustomText, isAddingCustom, setIsAddingCustom, onAddCustom,
  activeColor
}: any) => {
  // Combine predefined + any unique custom selections
  const allTags = Array.from(new Set([...options, ...selected]));

  return (
    <View className="flex-row flex-wrap gap-2">
      {allTags.map((tag: any) => {
        const isSelected = selected.includes(tag);
        return (
          <TouchableOpacity
            key={tag}
            testID={`chip-selector-${tag.replace(/\s+/g, '-').toLowerCase()}`}
            onPress={() => onToggle(tag)}
            className={`px-4 py-2.5 rounded-2xl border transition-all active:scale-95 ${isSelected ? `${activeColor} shadow-sm` : 'bg-white dark:bg-darkgrey border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'}`}
          >
            <Text className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
              {tag}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Custom Tag Entry */}
      {isAddingCustom ? (
        <View className="flex-row items-center bg-white dark:bg-darkgrey border-2 border-avocado rounded-2xl px-3 py-1 w-40 shadow-sm">
          <TextInput
            testID="chip-selector-custom-input"
            autoFocus
            value={customText}
            onChangeText={setCustomText}
            onSubmitEditing={onAddCustom}
            onBlur={() => { if (!customText.trim()) setIsAddingCustom(false); }}
            placeholder="Type..."
            placeholderTextColor="#9ca3af"
            className="flex-1 text-charcoal dark:text-white font-bold text-sm outline-none w-full"
            style={{ outlineWidth: 0, paddingVertical: 6 } as any}
          />
        </View>
      ) : (
        <TouchableOpacity
          testID="chip-selector-add-btn"
          onPress={() => setIsAddingCustom(true)}
          className="px-4 py-2.5 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-black/20 hover:bg-gray-100 dark:hover:bg-black/40 hover:border-gray-400 dark:hover:border-gray-500 transition-all active:scale-95 flex-row items-center"
        >
          <FontAwesome5 name="plus" size={10} color="#9CA3AF" className="mr-2" />
          <Text className="font-bold text-sm text-gray-500 dark:text-gray-400">Add</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Weekly Routine Section ───────────────────────────────────────────────────

type SlotOptions = { value: string; label: string }[];

function SlotPicker({ options, value, onChange }: {
  options: SlotOptions;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View className="flex-row bg-black/[0.05] dark:bg-white/5 rounded-xl p-0.5 gap-0.5">
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className={`px-2.5 py-1.5 rounded-lg transition-all ${
              active
                ? 'bg-white dark:bg-darkgrey shadow-sm'
                : 'hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Text className={`text-[11px] font-bold text-center leading-none ${
              active ? 'text-charcoal dark:text-white' : 'text-gray-400 dark:text-gray-500'
            }`}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function WeeklyRoutineSection() {
  const { routine, setSlot, applyPreset, reset } = useWeeklyRoutine();
  const [activePreset, setActivePreset] = useState<string | null>('full');

  const handlePreset = (key: string, routineData: any) => {
    applyPreset(routineData);
    setActivePreset(key);
  };

  const handleSlotChange = (day: Day, slot: MealSlot, mode: MealMode) => {
    setSlot(day, slot, mode);
    setActivePreset(null); // custom configuration
  };

  return (
    <View className="mt-6">
      {/* Preset pills */}
      <View className="flex-row flex-wrap gap-2 mb-6">
        {ROUTINE_PRESETS.map(preset => (
          <TouchableOpacity
            key={preset.key}
            onPress={() => handlePreset(preset.key, preset.routine)}
            className={`px-3.5 py-2 rounded-xl border transition-all ${
              activePreset === preset.key
                ? 'bg-avocado/10 border-avocado/30'
                : 'bg-white/60 dark:bg-white/5 border-black/5 dark:border-white/10 hover:bg-black/5'
            }`}
          >
            <Text className={`text-xs font-bold ${
              activePreset === preset.key ? 'text-avocado' : 'text-gray-500 dark:text-gray-400'
            }`}>{preset.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          onPress={() => handlePreset('full', ROUTINE_PRESETS[0].routine)}
          className="px-3.5 py-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 hover:bg-black/5 transition-all"
        >
          <Text className="text-xs font-bold text-gray-400">Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Column headers */}
      <View className="flex-row mb-2 pl-14">
        <Text className="flex-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">Breakfast</Text>
        <Text className="flex-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">Lunch</Text>
        <Text className="flex-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">Dinner</Text>
      </View>

      {/* Day rows */}
      <View className="bg-white/50 dark:bg-darkgrey/50 rounded-3xl overflow-hidden border border-black/5 dark:border-white/5 shadow-sm">
        {DAYS.map((day, idx) => (
          <View
            key={day}
            className={`flex-row items-center px-4 py-3 ${
              idx < DAYS.length - 1 ? 'border-b border-black/[0.04] dark:border-white/[0.04]' : ''
            }`}
          >
            {/* Day label */}
            <View className="w-10 mr-4">
              <Text className="font-extrabold text-xs text-charcoal dark:text-white uppercase tracking-widest">{day}</Text>
            </View>

            {/* Breakfast picker */}
            <View className="flex-1 mr-1.5">
              <SlotPicker
                options={BREAKFAST_OPTIONS}
                value={routine[day].breakfast}
                onChange={(v) => handleSlotChange(day, 'breakfast', v as any)}
              />
            </View>

            {/* Lunch picker */}
            <View className="flex-1 mr-1.5">
              <SlotPicker
                options={LUNCH_OPTIONS}
                value={routine[day].lunch}
                onChange={(v) => handleSlotChange(day, 'lunch', v as any)}
              />
            </View>

            {/* Dinner picker */}
            <View className="flex-1">
              <SlotPicker
                options={DINNER_OPTIONS}
                value={routine[day].dinner}
                onChange={(v) => handleSlotChange(day, 'dinner', v as any)}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function TasteProfileScreen() {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<{title: string, value: string, type: 'diet'|'number', onSave: (v:string)=>void, prefix?: string, suffix?: string} | null>(null);
  
  // Mock data for the taste profile
  const [scrapedRecipes, setScrapedRecipes] = useState([
    { id: '1', title: 'High-Protein Greek Yogurt Bowl', domain: 'tasty.co', macros: '+25g Protein', date: 'Just now', tags: ['High-Protein', 'Breakfast'] },
    { id: '2', title: 'Spicy Black Bean Burger', domain: 'bbcgoodfood.com', macros: '+18g Protein, Vegan', date: 'Yesterday', tags: ['Spicy', 'Vegan', 'Dinner'] },
  ]);

  const [diet, setDiet] = useState('Omnivore');
  const [budget, setBudget] = useState(50);
  const [calorieGoal, setCalorieGoal] = useState(2400);

  // New Dietary Goals & Restrictions state
  const [selectedGoals, setSelectedGoals] = useState<string[]>(['High Protein']);
  const [customGoalText, setCustomGoalText] = useState('');
  const [isAddingGoal, setIsAddingGoal] = useState(false);

  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>([]);
  const [customRestrictionText, setCustomRestrictionText] = useState('');
  const [isAddingRestriction, setIsAddingRestriction] = useState(false);

  const deleteRecipe = (id: string) => {
    setScrapedRecipes(prev => prev.filter(r => r.id !== id));
  };

  // --- Dynamic Intelligence Computation ---
  const dynamicBadges = React.useMemo(() => {
    const badges: { label: string, icon: string, color: string }[] = [];
    
    // 1. Explicit Goals have highest priority
    if (selectedGoals.includes('High Protein')) {
      badges.push({ label: 'High-Protein', icon: 'dumbbell', color: 'bg-blueberry/10 border-blueberry/20 text-blueberry' });
    }
    if (selectedGoals.includes('Lower Carb') || selectedGoals.includes('Weight Loss') || selectedGoals.includes('Calorie Deficit')) {
      badges.push({ label: 'Lean & Light', icon: 'weight', color: 'bg-tangerine/10 border-tangerine/20 text-tangerine' });
    }
    if (diet === 'Vegan' || diet === 'Vegetarian') {
       badges.push({ label: 'Plant-Based', icon: 'leaf', color: 'bg-avocado/10 border-avocado/20 text-avocado' });
    }

    // 2. Inferred from Recipes (If we need more badges to get to 3)
    const tagCounts: Record<string, number> = {};
    scrapedRecipes.forEach(recipe => {
      recipe.tags?.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    if (tagCounts['Spicy'] > 0 && !badges.find(b => b.label === 'Spicy & Bold')) {
      badges.push({ label: 'Spicy & Bold', icon: 'pepper-hot', color: 'bg-tomato/10 border-tomato/20 text-tomato' });
    }
    if ((tagCounts['Dinner'] > 0 || tagCounts['Quick'] > 0) && !badges.find(b => b.icon === 'bolt')) {
      badges.push({ label: 'Quick & Balanced', icon: 'bolt', color: 'bg-avocado/10 border-avocado/20 text-avocado' });
    }

    // Fallbacks if empty
    if (badges.length === 0) {
      badges.push({ label: 'Balanced', icon: 'balance-scale', color: 'bg-gray-100 text-gray-500 border-gray-200' });
    }

    return badges.slice(0, 3);
  }, [selectedGoals, diet, scrapedRecipes]);

  const dynamicAvoids = React.useMemo(() => {
    // Broad dietary frameworks shouldn't be listed as duplicate "Avoids"
    const frameworks = ['Halal', 'Gluten-Free', 'Kosher'];
    const explicitAvoids = selectedRestrictions.filter(res => !frameworks.includes(res));
    // Normalize string to just the noun (e.g. "Avoid Pork" -> "Pork", "No Dairy" -> "Dairy")
    return explicitAvoids.slice(0, 3).map(res => res.replace(/^(Avoid|No)\s+/i, ''));
  }, [selectedRestrictions]);

  return (
    <SafeAreaView testID="taste-profile-screen" className="flex-1 bg-cream dark:bg-darkcream">
      <ScrollView testID="taste-profile-scroll" className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 w-full mx-auto md:max-w-4xl px-4 md:px-8 pt-10 pb-32 min-h-[90vh]">
          
          {/* Header Section */}
          <PageHeader 
            eyebrow="MEAL RECOMMENDATION PROFILE"
            title="Taste Profile"
            subtitle="What shapes your recommendations."
          />

          {/* Synthesized DNA Summary (Intelligence Area) */}
          <View className="bg-white/60 dark:bg-darkgrey/60 rounded-[32px] p-6 md:p-8 relative overflow-hidden shadow-sm border border-white dark:border-white/5 backdrop-blur-md">
              <View className="flex-row justify-between items-start z-10">
                <View className="flex-1">
                  <View className="flex-row items-center mb-2">
                    <FontAwesome5 name="brain" size={14} color="#6DBE75" className="mr-2" />
                    <Text className="text-avocado font-bold uppercase tracking-widest text-xs">WHAT WE'RE LEARNING</Text>
                  </View>
                  <Text className="text-charcoal dark:text-darkcharcoal text-2xl md:text-3xl font-extrabold tracking-tight mb-4">
                    Extracted Preferences
                  </Text>
                  <View className="flex-row flex-wrap gap-2 mb-4">
                    {dynamicBadges.map((badge, idx) => (
                      <IntelligenceBadge key={idx} label={badge.label} icon={badge.icon} color={badge.color} />
                    ))}
                  </View>

                  <View className="border-t border-black/5 dark:border-white/5 pt-4">
                    <Text className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">Exclusions</Text>
                    <View className="flex-row flex-wrap gap-2">
                       {dynamicAvoids.length === 0 ? (
                         <Text className="text-charcoal/40 dark:text-white/40 text-xs font-bold italic">No active exclusions</Text>
                       ) : (
                         dynamicAvoids.map((avoid, idx) => (
                           <View key={idx} className="flex-row items-center mr-3 mb-1">
                             <FontAwesome5 name="times-circle" size={10} color="#FF6B5A" className="mr-1.5" />
                             <Text className="text-charcoal/60 dark:text-white/60 text-xs font-bold">{avoid}</Text>
                           </View>
                         ))
                       )}
                    </View>
                  </View>
                </View>
                <View className="items-end justify-start hidden sm:flex">
                  <View className="bg-avocado/10 px-3 py-1.5 rounded-xl border border-avocado/20 flex-row items-center">
                    <FontAwesome5 name="bolt" size={10} color="#6DBE75" className="mr-2" />
                    <Text className="text-avocado font-bold text-[10px] uppercase tracking-wider">
                      Learned from {scrapedRecipes.length} imports & onboarding
                    </Text>
                  </View>
                </View>
              </View>
              {/* Background abstract decoration placeholder */}
              <View className="absolute -bottom-10 -right-10 w-40 h-40 bg-avocado/20 rounded-full blur-3xl opacity-30" />
            </View>

          <View className="gap-y-16">
            
            {/* 1. Core Rules (User Defined) */}
            <View>
              <View className="flex-row justify-between items-center mb-6">
                <View>
                  <Text className="text-charcoal dark:text-darkcharcoal text-2xl font-extrabold tracking-tight">Core Rules</Text>
                  <Text className="text-gray-500 text-sm font-medium">What you've explicitly told us.</Text>
                </View>
              </View>

              <View className="bg-white/60 dark:bg-darkgrey/60 rounded-[32px] p-6 shadow-sm border border-white dark:border-white/5">
                <InfoRow 
                  testID="taste-profile-diet-row"
                  label="Baseline Diet" 
                  value={diet} 
                  icon="leaf" 
                  color="bg-avocado shadow-avocado/30" 
                  onPress={() => setEditingRule({ title: 'Baseline Diet', value: diet, type: 'diet', onSave: setDiet })} 
                />
                <InfoRow 
                   testID="taste-profile-budget-row"
                   label="Weekly Budget" 
                  value={`£${budget}`} 
                  icon="pound-sign" 
                  color="bg-tomato shadow-tomato/30" 
                  onPress={() => setEditingRule({ title: 'Weekly budget', value: budget.toString(), type: 'number', prefix: '£', onSave: (v) => setBudget(Number(v) || budget) })} 
                />
                <InfoRow 
                  testID="taste-profile-calorie-row"
                  label="Calorie Ceiling" 
                  value={`${calorieGoal} kcal`} 
                  icon="fire" 
                  color="bg-blueberry shadow-blueberry/30" 
                  onPress={() => setEditingRule({ title: 'Daily calorie target', value: calorieGoal.toString(), type: 'number', suffix: 'kcal', onSave: (v) => setCalorieGoal(Number(v) || calorieGoal) })} 
                />
              </View>
            </View>

            {/* 1.5 Dietary Goals & Restrictions (Optional Refinement Layer) */}
            <View>
              <View className="flex-row justify-between items-center mb-6">
                <View>
                  <Text className="text-charcoal dark:text-darkcharcoal text-2xl font-extrabold tracking-tight">Goals & Restrictions</Text>
                  <Text className="text-gray-500 text-sm font-medium">Fine-tune your recommendations.</Text>
                </View>
              </View>

              <View className="bg-white/60 dark:bg-darkgrey/60 rounded-[32px] p-6 shadow-sm border border-white dark:border-white/5 space-y-8">
                {/* Goals */}
                <View>
                  <View className="flex-row items-center mb-4">
                    <FontAwesome5 name="bullseye" size={12} color="#4F7FFF" className="mr-2" />
                    <Text className="text-charcoal dark:text-gray-300 font-bold uppercase tracking-widest text-xs">Dietary Goals</Text>
                  </View>
                  <ChipSelector 
                    options={PREDEFINED_GOALS}
                    selected={selectedGoals}
                    onToggle={(goal: string) => setSelectedGoals(prev => prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal])}
                    customText={customGoalText}
                    setCustomText={setCustomGoalText}
                    isAddingCustom={isAddingGoal}
                    setIsAddingCustom={setIsAddingGoal}
                    onAddCustom={() => {
                      if (customGoalText.trim() && !selectedGoals.includes(customGoalText.trim())) {
                        setSelectedGoals([...selectedGoals, customGoalText.trim()]);
                      }
                      setCustomGoalText('');
                      setIsAddingGoal(false);
                    }}
                    activeColor="bg-blueberry text-white border-blueberry"
                  />
                </View>

                {/* Restrictions */}
                <View className="border-t border-black/5 dark:border-white/5 pt-6">
                  <View className="flex-row items-center mb-4">
                    <FontAwesome5 name="ban" size={12} color="#FF6B5A" className="mr-2" />
                    <Text className="text-charcoal dark:text-gray-300 font-bold uppercase tracking-widest text-xs">Exclusions & Allergies</Text>
                  </View>
                  <ChipSelector 
                    options={PREDEFINED_RESTRICTIONS}
                    selected={selectedRestrictions}
                    onToggle={(restriction: string) => setSelectedRestrictions(prev => prev.includes(restriction) ? prev.filter(r => r !== restriction) : [...prev, restriction])}
                    customText={customRestrictionText}
                    setCustomText={setCustomRestrictionText}
                    isAddingCustom={isAddingRestriction}
                    setIsAddingCustom={setIsAddingRestriction}
                    onAddCustom={() => {
                      if (customRestrictionText.trim() && !selectedRestrictions.includes(customRestrictionText.trim())) {
                        setSelectedRestrictions([...selectedRestrictions, customRestrictionText.trim()]);
                      }
                      setCustomRestrictionText('');
                      setIsAddingRestriction(false);
                    }}
                    activeColor="bg-tomato text-white border-tomato"
                  />
                </View>
              </View>
            </View>

            {/* 2. Learned Context (Live Engine Activity) */}
            <View>
              <View className="flex-row justify-between items-center mb-6">
                <View>
                  <Text className="text-charcoal dark:text-darkcharcoal text-2xl font-extrabold tracking-tight">What Provision has learned</Text>
                  <Text className="text-gray-500 text-sm font-medium">Recipes and actions shaping future recommendations.</Text>
                </View>
                <TouchableOpacity 
                  testID="taste-profile-add-recipe-btn"
                  onPress={() => setIsImportOpen(true)}
                  className="bg-avocado/10 px-4 py-2.5 rounded-xl border border-avocado/20 flex-row items-center justify-center hover:bg-avocado/20 transition-colors shadow-sm ml-4"
                >
                  <FontAwesome5 name="plus" size={10} color="#6DBE75" className="mr-2" />
                  <Text className="text-avocado font-bold text-sm tracking-wide">Import recipe</Text>
                </TouchableOpacity>
              </View>

              <View className="gap-y-4">
                {/* Behavioral Signals */}
                {(selectedGoals.length > 0 || diet !== 'Omnivore' || selectedRestrictions.length > 0) && (
                  <View className="flex-row flex-wrap gap-2 mb-2">
                    {diet !== 'Omnivore' && (
                      <View className="bg-avocado/10 border border-avocado/20 px-3 py-1.5 rounded-full flex-row items-center">
                        <FontAwesome5 name="info-circle" size={10} color="#6DBE75" className="mr-2" />
                        <Text className="text-avocado text-xs font-bold">Baseline: {diet}</Text>
                      </View>
                    )}
                    {selectedGoals.map(goal => (
                      <View key={`goal-${goal}`} className="bg-blueberry/10 border border-blueberry/20 px-3 py-1.5 rounded-full flex-row items-center">
                        <FontAwesome5 name="info-circle" size={10} color="#4F7FFF" className="mr-2" />
                        <Text className="text-blueberry text-xs font-bold">Goal: {goal}</Text>
                      </View>
                    ))}
                    {selectedRestrictions.map(res => (
                      <View key={`res-${res}`} className="bg-tomato/10 border border-tomato/20 px-3 py-1.5 rounded-full flex-row items-center">
                        <FontAwesome5 name="info-circle" size={10} color="#FF6B5A" className="mr-2" />
                        <Text className="text-tomato text-xs font-bold">Avoid: {res.replace(/^(Avoid|No)\s+/i, '')}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Imported Recipes */}
                {scrapedRecipes.length === 0 ? (
                  <View className="bg-white/40 dark:bg-darkgrey/40 rounded-[32px] p-10 items-center justify-center border border-dashed border-black/10 dark:border-white/10">
                    <FontAwesome5 name="cloud-download-alt" size={32} color="#6DBE75" className="mb-4" />
                    <Text className="text-gray-500 text-center font-bold">No recipes imported yet.</Text>
                    <Text className="text-gray-400 text-center text-xs mt-1">Add URLs on the dashboard to shape your DNA.</Text>
                  </View>
                ) : (
                  scrapedRecipes.map((item) => (
                    <View key={item.id} className="bg-white dark:bg-darkgrey rounded-[28px] p-5 shadow-sm border border-black/5 dark:border-white/5 flex-row justify-between items-start">
                      <View className="flex-1 pr-6">
                        <View className="flex-row items-center mb-1.5">
                          <Text className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest">{item.domain}</Text>
                          <View className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-2" />
                          <Text className="text-gray-400/80 text-[10px] font-bold uppercase tracking-widest">{item.date}</Text>
                        </View>
                        <Text className="text-charcoal dark:text-darkcharcoal font-extrabold text-xl leading-tight mb-3">{item.title}</Text>
                        
                        <View className="flex-row flex-wrap gap-2">
                          {item.tags?.map(tag => (
                            <View key={tag} className="bg-charcoal/5 dark:bg-white/5 border border-black/5 dark:border-white/5 px-2.5 py-1 rounded-lg">
                              <Text className="text-gray-500 dark:text-gray-400 text-[10px] font-extrabold uppercase tracking-wider">{tag}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      
                      <TouchableOpacity 
                        testID={`taste-profile-delete-recipe-${item.id}`}
                        onPress={() => deleteRecipe(item.id)}
                        className="w-10 h-10 bg-gray-50 dark:bg-black/20 rounded-2xl items-center justify-center border border-black/5 dark:border-white/5 hover:bg-tomato/10 hover:border-tomato/20 transition-colors group"
                      >
                        <FontAwesome5 name="trash-alt" size={14} color="#9CA3AF" className="group-hover:text-tomato transition-colors" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* 3. Vibe Matches (Onboarding Anchors) */}
            <View className="mb-8">
              <View className="mb-6">
                <Text className="text-charcoal dark:text-darkcharcoal text-2xl font-extrabold tracking-tight">Vibe Matches</Text>
                <Text className="text-gray-500 text-sm font-medium">Meals you picked during onboarding.</Text>
              </View>
              
              <View className="flex-row gap-4">
                {MOCK_RECIPES.slice(0, 2).map((recipe) => (
                  <View key={recipe.id} className="flex-1 h-44 rounded-[32px] overflow-hidden relative shadow-md bg-gray-100">
                    <Image source={recipe.imageUrl} style={{width: '100%', height: '100%', position: 'absolute'}} contentFit="cover" />
                    {/* Subtle Top Inner Highlight for premium feel */}
                    <View className="absolute top-0 left-0 right-0 h-[1.5px] bg-white/20 z-20" />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.8)']} locations={[0, 0.4, 1]} className="absolute inset-0 justify-end p-5">
                       <Text className="text-white font-extrabold text-lg leading-tight tracking-tight shadow-sm" numberOfLines={2}>
                        {recipe.title}
                       </Text>
                    </LinearGradient>
                  </View>
                ))}
              </View>
            </View>

            {/* 4. Weekly Routine */}
            <View>
              <View className="flex-row justify-between items-center mb-1">
                <View>
                  <Text className="text-charcoal dark:text-darkcharcoal text-2xl font-extrabold tracking-tight">Weekly Routine</Text>
                  <Text className="text-gray-500 text-sm font-medium mt-0.5">Tell Provision which meals you actually want help planning.</Text>
                </View>
              </View>

              {/* Preset row */}
              <WeeklyRoutineSection />
            </View>

          </View>
        </View>
      </ScrollView>
      
      {/* Recipe Import Pipeline Modal */}
      <ImportRecipeModal 
        visible={isImportOpen} 
        onClose={() => setIsImportOpen(false)} 
        onSave={(payload) => {
          const newRecipe = {
            id: Date.now().toString(),
            title: payload.recipe.title,
            domain: payload.recipe.domain,
            macros: payload.recipe.macros,
            date: 'Just now',
            tags: payload.recipe.tags.slice(0, 2)
          };
          
          setScrapedRecipes(prev => [newRecipe, ...prev]);
          setIsImportOpen(false);
        }} 
      />

      {editingRule && (
        <CoreRuleModal 
          visible={!!editingRule} 
          onClose={() => setEditingRule(null)} 
          title={editingRule.title} 
          value={editingRule.value} 
          type={editingRule.type} 
          onSave={editingRule.onSave} 
          prefix={editingRule.prefix}
          suffix={editingRule.suffix}
        />
      )}
      
    </SafeAreaView>
  );
}
