import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { MOCK_RECIPES } from '../../data/seed';
import ImportRecipeModal from '../../components/ImportRecipeModal';

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
            className={`px-4 py-2.5 rounded-2xl border transition-colors ${isSelected ? activeColor : 'bg-transparent border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'}`}
          >
            <Text className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
              {tag}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Custom Tag Entry */}
      {isAddingCustom ? (
        <View className="flex-row items-center bg-white dark:bg-darkgrey border-2 border-avocado rounded-2xl px-3 py-1.5 w-40">
          <TextInput
            testID="chip-selector-custom-input"
            autoFocus
            value={customText}
            onChangeText={setCustomText}
            onSubmitEditing={onAddCustom}
            placeholder="Type..."
            placeholderTextColor="#9ca3af"
            className="flex-1 text-charcoal dark:text-white font-bold text-sm outline-none w-full"
            style={{ outlineWidth: 0, paddingVertical: 4 } as any}
          />
        </View>
      ) : (
        <TouchableOpacity
          testID="chip-selector-add-btn"
          onPress={() => setIsAddingCustom(true)}
          className="px-4 py-2.5 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-darkcharcoal hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-row items-center"
        >
          <FontAwesome5 name="plus" size={10} color="#9CA3AF" className="mr-2" />
          <Text className="font-bold text-sm text-gray-500 dark:text-gray-400">Add</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default function TasteProfileScreen() {
  const [isImportOpen, setIsImportOpen] = useState(false);
  
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

  return (
    <SafeAreaView testID="taste-profile-screen" className="flex-1 bg-cream dark:bg-darkcream">
      <ScrollView testID="taste-profile-scroll" className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 px-4 pt-6 pb-20 mx-auto w-full md:max-w-4xl md:px-8 min-h-[90vh]">
          
          {/* Header Section */}
          <View className="mb-10 mt-4 md:mt-8">
            <Text className="text-charcoal dark:text-darkcharcoal text-4xl md:text-5xl font-extrabold tracking-tight italic">
              Taste Profile
            </Text>
            <Text className="text-gray-500 text-lg font-medium mt-1">The DNA of your meal recommendations.</Text>

            {/* Synthesized DNA Summary (Intelligence Area) */}
            <View className="mt-8 bg-white/60 dark:bg-darkgrey/60 rounded-[32px] p-6 md:p-8 relative overflow-hidden shadow-sm border border-white dark:border-white/5 backdrop-blur-md">
              <View className="flex-row justify-between items-start z-10">
                <View className="flex-1">
                  <View className="flex-row items-center mb-2">
                    <FontAwesome5 name="brain" size={14} color="#6DBE75" className="mr-2" />
                    <Text className="text-avocado font-bold uppercase tracking-widest text-xs">Engine Intelligence</Text>
                  </View>
                  <Text className="text-charcoal dark:text-darkcharcoal text-2xl md:text-3xl font-extrabold tracking-tight mb-4">
                    Extracted Preferences
                  </Text>
                  <View className="flex-row flex-wrap gap-2 mb-4">
                    <IntelligenceBadge label="High-Protein" icon="dumbbell" color="bg-blueberry/10 border-blueberry/20 text-blueberry" />
                    <IntelligenceBadge label="Spicy & Bold" icon="pepper-hot" color="bg-tomato/10 border-tomato/20 text-tomato" />
                    <IntelligenceBadge label="Quick & Balanced" icon="bolt" color="bg-avocado/10 border-avocado/20 text-avocado" />
                  </View>

                  <View className="border-t border-black/5 dark:border-white/5 pt-4">
                    <Text className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">Avoids</Text>
                    <View className="flex-row flex-wrap gap-2">
                      <View className="flex-row items-center">
                        <FontAwesome5 name="times-circle" size={10} color="#FF6B5A" className="mr-1.5" />
                        <Text className="text-charcoal/60 dark:text-white/60 text-xs font-bold">Low-protein fillers</Text>
                      </View>
                      <View className="flex-row items-center ml-2">
                        <FontAwesome5 name="times-circle" size={10} color="#FF6B5A" className="mr-1.5" />
                        <Text className="text-charcoal/60 dark:text-white/60 text-xs font-bold">Bland flavor profiles</Text>
                      </View>
                    </View>
                  </View>
                </View>
                <View className="items-end hidden sm:flex">
                  <View className="w-16 h-16 bg-avocado/10 rounded-full items-center justify-center backdrop-blur-md mb-4 border border-avocado/10">
                    <FontAwesome5 name="dna" size={24} color="#6DBE75" className="opacity-40" />
                  </View>
                  <Text className="text-gray-400 dark:text-gray-500 text-[10px] font-bold text-right leading-tight max-w-[100px] uppercase tracking-tighter">
                    LEARNED FROM: 2 IMPORTS & ONBOARDING
                  </Text>
                </View>
              </View>
              {/* Background abstract decoration placeholder */}
              <View className="absolute -bottom-10 -right-10 w-40 h-40 bg-avocado/20 rounded-full blur-3xl opacity-30" />
            </View>
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
                  onPress={() => alert("Edit Baseline Diet")} 
                />
                <InfoRow 
                   testID="taste-profile-budget-row"
                   label="Weekly Budget" 
                  value={`£${budget}`} 
                  icon="pound-sign" 
                  color="bg-tomato shadow-tomato/30" 
                  onPress={() => alert("Edit Weekly Budget")} 
                />
                <InfoRow 
                  testID="taste-profile-calorie-row"
                  label="Calorie Ceiling" 
                  value={`${calorieGoal} kcal`} 
                  icon="fire" 
                  color="bg-blueberry shadow-blueberry/30" 
                  onPress={() => alert("Edit Calorie Ceiling")} 
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
              <View className="flex-row justify-between items-end mb-6">
                <View>
                  <Text className="text-charcoal dark:text-darkcharcoal text-2xl font-extrabold tracking-tight">Learned Context</Text>
                  <Text className="text-gray-500 text-sm font-medium">Recipes you've added to teach the engine.</Text>
                </View>
                <TouchableOpacity 
                  testID="taste-profile-add-recipe-btn"
                  onPress={() => setIsImportOpen(true)}
                  className="bg-charcoal dark:bg-white py-3 rounded-xl flex-row items-center justify-center hover:scale-[1.02] transition-transform shadow-sm"
                >
                  <FontAwesome5 name="plus" size={14} color={true ? 'white' : '#1A1A1A'} className="mr-2 dark:text-charcoal" />
                  <Text className="text-white dark:text-charcoal font-bold text-sm">Add recipe</Text>
                </TouchableOpacity>
              </View>

              <View className="gap-y-4">
                {scrapedRecipes.length === 0 ? (
                  <View className="bg-white/40 dark:bg-darkgrey/40 rounded-[32px] p-10 items-center justify-center border border-dashed border-black/10 dark:border-white/10">
                    <FontAwesome5 name="cloud-download-alt" size={32} color="#6DBE75" className="mb-4" />
                    <Text className="text-gray-500 text-center font-bold">No recipes imported yet.</Text>
                    <Text className="text-gray-400 text-center text-xs mt-1">Add URLs on the dashboard to shape your DNA.</Text>
                  </View>
                ) : (
                  scrapedRecipes.map((item) => (
                    <View key={item.id} className="bg-white dark:bg-darkgrey rounded-[28px] p-6 shadow-sm border border-black/5 dark:border-white/5">
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1 pr-4">
                          <Text className="text-charcoal dark:text-darkcharcoal font-bold text-xl mb-1 tracking-tight">{item.title}</Text>
                          <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest">{item.domain} • {item.date}</Text>
                        </View>
                        <TouchableOpacity 
                          testID={`taste-profile-delete-recipe-${item.id}`}
                          onPress={() => deleteRecipe(item.id)}
                          className="w-10 h-10 bg-gray-50 dark:bg-black/20 rounded-full items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <FontAwesome5 name="trash-alt" size={14} color="#FF6B5A" />
                        </TouchableOpacity>
                      </View>
                      
                      <View className="flex-row flex-wrap gap-2 mt-4">
                        {item.tags?.map(tag => (
                          <View key={tag} className="bg-blueberry/10 px-3 py-1 rounded-full">
                            <Text className="text-blueberry text-[10px] font-extrabold uppercase tracking-wider">{tag}</Text>
                          </View>
                        ))}
                      </View>
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

          </View>
        </View>
      </ScrollView>
      
      {/* Recipe Import Pipeline Modal */}
      <ImportRecipeModal 
        visible={isImportOpen} 
        onClose={() => setIsImportOpen(false)} 
        onSave={(payload) => {
          // In a real app, send payload.tasteProfileUpdates and payload.userFeedback to Gemini/DB
          
          // For MVP, visually add the recipe to the "Learned Context" list
          const newRecipe = {
            id: Date.now().toString(),
            title: payload.recipe.title,
            domain: payload.recipe.domain,
            macros: payload.recipe.macros,
            date: 'Just now',
            tags: payload.recipe.tags.slice(0, 2) // Just take first two for the small badge UI
          };
          
          setScrapedRecipes(prev => [newRecipe, ...prev]);
          setIsImportOpen(false);
          
          // Show simulated success feedback
          alert(`Successfully learned from ${payload.recipe.domain}! Feedback recorded: "${payload.userFeedback}"`);
        }} 
      />
      
    </SafeAreaView>
  );
}
