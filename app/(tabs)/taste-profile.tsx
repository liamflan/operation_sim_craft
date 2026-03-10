import React, { useState, useEffect } from 'react';
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
    className="flex-row items-center justify-between py-5 border-b border-black/[0.03] dark:border-darksoftBorder last:border-0 hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors"
  >
    <View className="flex-row items-center pl-2">
      <View className={`w-12 h-12 rounded-[16px] ${color} items-center justify-center mr-5 shadow-sm`}>
        <FontAwesome5 name={icon} size={16} color={color.includes('bg-') ? 'white' : 'currentColor'} />
      </View>
      <View>
        <Text className="text-textSec dark:text-darktextSec text-[11px] font-bold uppercase tracking-widest mb-1">{label}</Text>
        <Text className="text-textMain dark:text-darktextMain text-[20px] font-medium tracking-tight">{value}</Text>
      </View>
    </View>
    {onPress && (
      <View className="w-9 h-9 rounded-full bg-black/[0.03] dark:bg-white/[0.05] items-center justify-center mr-2">
        <FontAwesome5 name="pen" size={12} color="#8C9A90" />
      </View>
    )}
  </TouchableOpacity>
);

const IntelligenceBadge = ({ label, icon, color }: { label: string, icon: string, color: string }) => (
  <View className={`flex-row items-center px-4 py-2.5 rounded-full border ${color}`}>
    <FontAwesome5 name={icon} size={12} color="currentColor" className="mr-2" />
    <Text className="font-semibold text-[13px] tracking-wide">{label}</Text>
  </View>
);

// Core Rule Edit Modal
const CoreRuleModal = ({ 
  visible, onClose, title, value, onSave, type, prefix, suffix 
}: { 
  visible: boolean, onClose: () => void, title: string, value: string, onSave: (val: string) => void, type: 'diet' | 'number', prefix?: string, suffix?: string 
}) => {
  const [tempValue, setTempValue] = useState(value);
  
  useEffect(() => { if (visible) setTempValue(value) }, [visible, value]);

  useEffect(() => {
    if (Platform.OS === 'web' && visible) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [visible, onClose]);

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-center items-center bg-black/40 dark:bg-black/60 p-4">
        <View className="bg-surface dark:bg-darksurface w-full max-w-[340px] rounded-[32px] p-8 shadow-xl border border-black/[0.05] dark:border-darksoftBorder">
          <Text className="text-textMain dark:text-darktextMain text-[24px] font-medium tracking-tight mb-6">{title}</Text>
          
          {type === 'diet' ? (
            <View className="flex-col gap-2">
              {['Omnivore', 'Pescatarian', 'Vegetarian', 'Vegan'].map(option => (
                <TouchableOpacity 
                  key={option}
                  onPress={() => setTempValue(option)}
                  className={`py-4 px-5 rounded-[20px] border transition-all ${tempValue === option ? 'bg-primary border-primary shadow-sm' : 'bg-black/[0.02] dark:bg-white/[0.02] border-black/[0.04] dark:border-white/5 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'}`}
                >
                  <Text className={`font-medium text-[16px] ${tempValue === option ? 'text-white' : 'text-textSec dark:text-darktextSec'}`}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View className="flex-row items-center justify-center bg-black/[0.02] dark:bg-white/[0.02] p-6 rounded-[24px] border border-black/[0.04] dark:border-white/5">
              {prefix && <Text className="text-textSec/60 dark:text-darktextSec/60 font-medium text-[32px] mr-1">{prefix}</Text>}
              <TextInput
                autoFocus
                keyboardType="numeric"
                value={tempValue}
                onChangeText={setTempValue}
                className="text-textMain dark:text-darktextMain font-medium text-[40px] text-center outline-none min-w-[80px]"
                style={{ outlineWidth: 0 } as any}
              />
              {suffix && <Text className="text-textSec/60 dark:text-darktextSec/60 font-medium text-[20px] ml-2">{suffix}</Text>}
            </View>
          )}

          <View className="flex-row gap-3 mt-8">
            <TouchableOpacity onPress={onClose} className="flex-1 py-4 rounded-full border border-black/10 dark:border-white/10 items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/5 active:scale-95">
              <Text className="text-textSec dark:text-darktextSec font-medium text-[15px]">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { onSave(tempValue); onClose(); }} className="flex-1 bg-primary py-4 rounded-full items-center justify-center shadow-sm hover:bg-primary-hover active:scale-95 transition-all">
              <Text className="text-white font-medium text-[15px]">Save</Text>
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
            className={`px-5 py-3 rounded-full border transition-all active:scale-95 ${isSelected ? `${activeColor} shadow-sm border-transparent` : 'bg-surface dark:bg-darksurface border-black/[0.05] dark:border-darksoftBorder hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'}`}
          >
            <Text className={`font-medium text-[14px] ${isSelected ? 'text-white' : 'text-textSec dark:text-darktextSec'}`}>
              {tag}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Custom Tag Entry */}
      {isAddingCustom ? (
        <View className="flex-row items-center bg-surface dark:bg-darksurface border border-primary rounded-full px-5 py-1.5 w-40 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <TextInput
            testID="chip-selector-custom-input"
            autoFocus
            value={customText}
            onChangeText={setCustomText}
            onSubmitEditing={onAddCustom}
            onBlur={() => { if (!customText.trim()) setIsAddingCustom(false); }}
            placeholder="Type..."
            placeholderTextColor="#8C9A90"
            className="flex-1 text-textMain dark:text-darktextMain font-medium text-[14px] outline-none w-full"
            style={{ outlineWidth: 0, paddingVertical: 6 } as any}
          />
        </View>
      ) : (
        <TouchableOpacity
          testID="chip-selector-add-btn"
          onPress={() => setIsAddingCustom(true)}
          className="px-5 py-3 rounded-full border border-dashed border-black/10 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.015] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-all active:scale-95 flex-row items-center"
        >
          <FontAwesome5 name="plus" size={10} color="#8C9A90" className="mr-2" />
          <Text className="font-medium text-[14px] text-textSec dark:text-darktextSec">Add</Text>
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
    <View className="flex-row bg-black/[0.04] dark:bg-white/[0.05] rounded-[12px] p-1 gap-1 flex-1 h-10 items-center justify-between">
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className={`flex-1 h-full items-center justify-center rounded-[8px] transition-all ${
              active
                ? 'bg-surface dark:bg-[#343A36] shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-none border border-black/[0.02] dark:border-white/5'
                : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.02] border border-transparent'
            }`}
          >
            <Text className={`text-[11px] font-bold text-center leading-none tracking-wide ${
              active ? 'text-textMain dark:text-darktextMain' : 'text-textSec/60 dark:text-darktextSec/60'
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
      <View className="flex-row flex-wrap gap-2.5 mb-8">
        {ROUTINE_PRESETS.map(preset => (
          <TouchableOpacity
            key={preset.key}
            onPress={() => handlePreset(preset.key, preset.routine)}
            className={`px-5 py-2.5 rounded-full border transition-all active:scale-95 ${
              activePreset === preset.key
                ? 'bg-primary/10 border-primary/20 shadow-sm dark:bg-darksageTint dark:border-darksageTint'
                : 'bg-surface dark:bg-darksurface border-black/[0.03] dark:border-darksoftBorder hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
            }`}
          >
            <Text className={`text-[13px] font-medium ${
              activePreset === preset.key ? 'text-primary dark:text-white' : 'text-textSec dark:text-darktextSec'
            }`}>{preset.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          onPress={() => handlePreset('full', ROUTINE_PRESETS[0].routine)}
          className="px-5 py-2.5 rounded-full border border-dashed border-black/10 dark:border-white/10 hover:bg-black/[0.02] transition-all active:scale-95"
        >
          <Text className="text-[13px] font-medium text-textSec/60 dark:text-darktextSec/60">Reset Defaults</Text>
        </TouchableOpacity>
      </View>

      {/* Column headers */}
      <View className="flex-row mb-3 pl-[88px] pr-4">
        <Text className="flex-1 text-[10px] font-bold uppercase tracking-widest text-textSec/60 dark:text-darktextSec/60 text-center">Breakfast</Text>
        <Text className="flex-1 text-[10px] font-bold uppercase tracking-widest text-textSec/60 dark:text-darktextSec/60 text-center">Lunch</Text>
        <Text className="flex-1 text-[10px] font-bold uppercase tracking-widest text-textSec/60 dark:text-darktextSec/60 text-center">Dinner</Text>
      </View>

      {/* Day rows */}
      <View className="bg-surface dark:bg-darksurface rounded-[32px] overflow-hidden border border-black/[0.03] dark:border-darksoftBorder shadow-[0_2px_12px_rgba(0,0,0,0.02)] py-2">
        {DAYS.map((day, idx) => (
          <View
            key={day}
            className={`flex-row items-center px-4 py-3.5 ${
              idx < DAYS.length - 1 ? 'border-b border-black/[0.03] dark:border-darksoftBorder' : ''
            }`}
          >
            {/* Day label */}
            <View className="w-[64px] mr-2">
              <Text className="font-bold text-[11px] text-textMain dark:text-darktextMain uppercase tracking-[0.2em]">{day}</Text>
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

  useEffect(() => {
    if (Platform.OS === 'web' && (isImportOpen || editingRule)) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsImportOpen(false);
          setEditingRule(null);
        }
      };
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isImportOpen, editingRule]);

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
    <SafeAreaView testID="taste-profile-screen" className="flex-1 bg-appBg dark:bg-darkappBg">
      <ScrollView testID="taste-profile-scroll" className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 w-full mx-auto md:max-w-4xl px-4 md:px-8 pt-10 pb-32 min-h-[90vh]">
          
          {/* Header Section */}
          <PageHeader 
            eyebrow="MEAL RECOMMENDATION PROFILE"
            title="Taste Profile"
            subtitle="What shapes your recommendations."
          />

          {/* Synthesis Hero Area */}
          <View className="bg-surface dark:bg-darksurface rounded-[32px] p-6 md:p-8 relative overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-black/[0.03] dark:border-darksoftBorder mb-12">
            <View className="flex-row justify-between items-start z-10">
              <View className="flex-1">
                <View className="flex-row items-center mb-3">
                  <FontAwesome5 name="brain" size={14} color="#8C9A90" className="mr-2" />
                  <Text className="text-textSec dark:text-darktextSec font-bold uppercase tracking-widest text-[11px]">Intelligent Overview</Text>
                </View>
                <Text className="text-textMain dark:text-darktextMain text-[28px] md:text-[32px] font-medium tracking-tight mb-6">
                  Your Taste Identity
                </Text>
                
                <View className="flex-row flex-wrap gap-2.5 mb-6">
                  {dynamicBadges.map((badge, idx) => (
                    <IntelligenceBadge key={idx} label={badge.label} icon={badge.icon} color={badge.color} />
                  ))}
                </View>

                <View className="flex-row items-center border-t border-black/[0.04] dark:border-darksoftBorder pt-5">
                  <Text className="text-textSec dark:text-darktextSec text-[11px] font-bold uppercase tracking-widest mr-4">Avoids</Text>
                  <View className="flex-row flex-wrap gap-2">
                     {dynamicAvoids.length === 0 ? (
                       <Text className="text-textSec/60 dark:text-darktextSec/60 text-[13px] font-medium italic">No active exclusions</Text>
                     ) : (
                       dynamicAvoids.map((avoid, idx) => (
                         <View key={idx} className="bg-danger/10 px-3 py-1.5 rounded-lg flex-row items-center">
                           <FontAwesome5 name="times-circle" size={10} color="#D97C6C" className="mr-1.5" />
                           <Text className="text-danger dark:text-[#D97C6C] font-semibold text-[12px]">{avoid}</Text>
                         </View>
                       ))
                     )}
                  </View>
                </View>
              </View>
              <View className="items-end justify-start hidden sm:flex">
                <View className="bg-primary/10 px-4 py-2 rounded-2xl border border-primary/20 flex-row items-center">
                  <FontAwesome5 name="bolt" size={12} color="#7BA96A" className="mr-2.5" />
                  <Text className="text-primary font-bold text-[11px] uppercase tracking-wider">
                    {scrapedRecipes.length} Learning Signals
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View className="gap-y-16">
            
            {/* 1. Planning Guardrails (Unified Core Rules + Dietary Goals) */}
            <View>
              <View className="mb-6 pl-2">
                <Text className="text-textMain dark:text-darktextMain text-[22px] font-medium tracking-tight">Planning Guardrails</Text>
                <Text className="text-textSec dark:text-darktextSec text-[14px] font-medium mt-1">Foundational rules for your recommendations.</Text>
              </View>

              <View className="bg-surface dark:bg-darksurface rounded-[32px] p-2 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-black/[0.03] dark:border-darksoftBorder mb-6">
                <View className="px-4">
                  <InfoRow 
                    testID="taste-profile-diet-row"
                    label="Baseline Diet" 
                    value={diet} 
                    icon="leaf" 
                    color="bg-primary" 
                    onPress={() => setEditingRule({ title: 'Baseline Diet', value: diet, type: 'diet', onSave: setDiet })} 
                  />
                  <InfoRow 
                    testID="taste-profile-budget-row"
                    label="Weekly Budget" 
                    value={`£${budget}`} 
                    icon="pound-sign" 
                    color="bg-peach" 
                    onPress={() => setEditingRule({ title: 'Weekly budget', value: budget.toString(), type: 'number', prefix: '£', onSave: (v) => setBudget(Number(v) || budget) })} 
                  />
                  <InfoRow 
                    testID="taste-profile-calorie-row"
                    label="Calorie Ceiling" 
                    value={`${calorieGoal} kcal`} 
                    icon="fire" 
                    color="bg-danger" 
                    onPress={() => setEditingRule({ title: 'Daily calorie target', value: calorieGoal.toString(), type: 'number', suffix: 'kcal', onSave: (v) => setCalorieGoal(Number(v) || calorieGoal) })} 
                  />
                </View>
              </View>

              {/* Goals & Restrictions Chips (Integrated as a sub-section of Guardrails) */}
              <View className="bg-surface dark:bg-darksurface rounded-[32px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-black/[0.03] dark:border-darksoftBorder space-y-8">
                <View>
                  <View className="flex-row items-center mb-5">
                    <View className="w-8 h-8 rounded-full bg-blueberry/10 items-center justify-center mr-3">
                      <FontAwesome5 name="bullseye" size={12} color="#4F7FFF" />
                    </View>
                    <Text className="text-textMain dark:text-darktextMain font-medium text-[16px]">Active Goals</Text>
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

                <View className="border-t border-black/[0.04] dark:border-darksoftBorder pt-6">
                  <View className="flex-row items-center mb-5">
                    <View className="w-8 h-8 rounded-full bg-danger/10 items-center justify-center mr-3">
                      <FontAwesome5 name="ban" size={12} color="#FF6B5A" />
                    </View>
                    <Text className="text-textMain dark:text-darktextMain font-medium text-[16px]">Exclusions & Allergies</Text>
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
                    activeColor="bg-danger text-white border-danger"
                  />
                </View>
              </View>
            </View>

            {/* 2. Learned Context (Live Engine Activity) */}
            <View>
              <View className="flex-row justify-between items-end mb-6 pl-2">
                <View className="flex-1 pr-4">
                  <Text className="text-textMain dark:text-darktextMain text-[22px] font-medium tracking-tight">Vibe Signals</Text>
                  <Text className="text-textSec dark:text-darktextSec text-[14px] font-medium mt-1">Signals learned from your imports.</Text>
                </View>
                <TouchableOpacity 
                  testID="taste-profile-add-recipe-btn"
                  onPress={() => setIsImportOpen(true)}
                  className="bg-primary hover:bg-primary-hover active:scale-95 transition-all px-5 py-3 rounded-full shadow-sm flex-row items-center justify-center"
                >
                  <FontAwesome5 name="plus" size={12} color="white" className="mr-2" />
                  <Text className="text-white font-medium text-[14px] tracking-wide">Import</Text>
                </TouchableOpacity>
              </View>

              <View className="gap-y-4">
                {/* Behavioral Signals */}
                {(selectedGoals.length > 0 || diet !== 'Omnivore' || selectedRestrictions.length > 0) && (
                  <View className="flex-row flex-wrap gap-2 mb-2 pl-2">
                    {diet !== 'Omnivore' && (
                      <View className="bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full flex-row items-center">
                        <FontAwesome5 name="info-circle" size={10} color="#7BA96A" className="mr-2" />
                        <Text className="text-primary text-[11px] font-bold uppercase tracking-wider">Baseline: {diet}</Text>
                      </View>
                    )}
                    {selectedGoals.map(goal => (
                      <View key={`goal-${goal}`} className="bg-blueberry/10 border border-blueberry/20 px-3 py-1.5 rounded-full flex-row items-center">
                        <FontAwesome5 name="info-circle" size={10} color="#4F7FFF" className="mr-2" />
                        <Text className="text-blueberry text-[11px] font-bold uppercase tracking-wider">Goal: {goal}</Text>
                      </View>
                    ))}
                    {selectedRestrictions.map(res => (
                      <View key={`res-${res}`} className="bg-danger/10 border border-danger/20 px-3 py-1.5 rounded-full flex-row items-center">
                        <FontAwesome5 name="info-circle" size={10} color="#FF6B5A" className="mr-2" />
                        <Text className="text-danger dark:text-[#D97C6C] text-[11px] font-bold uppercase tracking-wider">Avoid: {res.replace(/^(Avoid|No)\s+/i, '')}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Imported Recipes */}
                {scrapedRecipes.length === 0 ? (
                  <View className="bg-surface dark:bg-darksurface rounded-[32px] p-10 items-center justify-center border border-dashed border-black/10 dark:border-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                    <FontAwesome5 name="cloud-download-alt" size={32} color="#8C9A90" className="mb-4 opacity-50" />
                    <Text className="text-textSec dark:text-darktextSec text-center font-medium text-[16px]">No signals imported yet.</Text>
                    <Text className="text-textSec/60 dark:text-darktextSec/60 text-center text-[13px] mt-1">Import recipes to shape your DNA.</Text>
                  </View>
                ) : (
                  scrapedRecipes.map((item) => (
                    <View key={item.id} className="bg-surface dark:bg-darksurface rounded-[28px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-black/[0.03] dark:border-darksoftBorder flex-row justify-between items-start">
                      <View className="flex-1 pr-6">
                        <View className="flex-row items-center mb-2.5">
                          <Text className="text-textSec dark:text-darktextSec text-[11px] font-bold uppercase tracking-widest">{item.domain}</Text>
                          <View className="w-1 h-1 bg-black/10 dark:bg-white/10 rounded-full mx-2" />
                          <Text className="text-textSec/60 dark:text-darktextSec/60 text-[11px] font-bold uppercase tracking-widest">{item.date}</Text>
                        </View>
                        <Text className="text-textMain dark:text-darktextMain font-medium text-[20px] leading-tight mb-4 tracking-tight">{item.title}</Text>
                        
                        <View className="flex-row flex-wrap gap-2">
                          {item.tags?.map(tag => (
                            <View key={tag} className="bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/5 px-2.5 py-1 rounded-lg">
                              <Text className="text-textSec dark:text-darktextSec text-[10px] font-bold uppercase tracking-widest">{tag}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      
                      <TouchableOpacity 
                        testID={`taste-profile-delete-recipe-${item.id}`}
                        onPress={() => deleteRecipe(item.id)}
                        className="w-11 h-11 bg-black/[0.02] dark:bg-white/[0.02] rounded-full items-center justify-center border border-black/[0.03] dark:border-white/[0.03] hover:bg-danger/10 hover:border-danger/20 transition-colors group active:scale-95"
                      >
                        <FontAwesome5 name="trash-alt" size={14} color="#8C9A90" className="group-hover:text-danger transition-colors" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* 3. Vibe Matches (Onboarding Anchors) */}
            <View>
              <View className="mb-6 pl-2">
                <Text className="text-textMain dark:text-darktextMain text-[22px] font-medium tracking-tight">Taste Gallery</Text>
                <Text className="text-textSec dark:text-darktextSec text-[14px] font-medium mt-1">Meals you anchored during onboarding.</Text>
              </View>
              
              <View className="flex-row gap-4">
                {MOCK_RECIPES.slice(0, 2).map((recipe) => (
                  <View key={recipe.id} className="flex-1 h-[200px] rounded-[32px] overflow-hidden relative shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-none dark:border dark:border-darksoftBorder bg-black/5 dark:bg-white/5">
                    <Image source={recipe.imageUrl} style={{width: '100%', height: '100%', position: 'absolute'}} contentFit="cover" />
                    {/* Subtle Top Inner Highlight for premium feel */}
                    <View className="absolute top-0 left-0 right-0 h-[1.5px] bg-white/20 z-20" />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.9)']} locations={[0, 0.4, 1]} className="absolute inset-0 justify-end p-6">
                       <Text className="text-white font-medium text-[18px] leading-tight tracking-tight shadow-sm" numberOfLines={2}>
                        {recipe.title}
                       </Text>
                    </LinearGradient>
                  </View>
                ))}
              </View>
            </View>

            {/* 4. Weekly Routine */}
            <View className="mb-8">
              <View className="flex-row justify-between items-center mb-6 pl-2">
                <View>
                  <Text className="text-textMain dark:text-darktextMain text-[22px] font-medium tracking-tight">Weekly Routine</Text>
                  <Text className="text-textSec dark:text-darktextSec text-[14px] font-medium mt-1">Tell Provision which meals you want planned.</Text>
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
