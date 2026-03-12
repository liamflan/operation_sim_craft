import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, Switch, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../components/ThemeContext';
import { useActivePlan } from '../../data/ActivePlanContext';
import { DietaryBaseline } from '../../data/planner/plannerTypes';

export default function SettingsScreen() {
  const router = useRouter();
  const { isDarkMode, toggleDarkMode } = useTheme();

  const { workspace, updateUserDiet } = useActivePlan();

  const diet = workspace.userDiet;
  const setDiet = (newDiet: DietaryBaseline) => updateUserDiet(newDiet);

  const [budget, setBudget] = useState('50');
  const [calories, setCalories] = useState('2400');
  
  const [notifications, setNotifications] = useState(true);
  const [autoDeplete, setAutoDeplete] = useState(false);

  // Edit State Modals
  const [editingDiet, setEditingDiet] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [editingCalories, setEditingCalories] = useState(false);
  
  const [tempBudget, setTempBudget] = useState(budget);
  const [tempCalories, setTempCalories] = useState(calories);

  const saveBudget = () => {
    setBudget(tempBudget);
    setEditingBudget(false);
  }

  const saveCalories = () => {
    setCalories(tempCalories);
    setEditingCalories(false);
  }

  useEffect(() => {
    if (Platform.OS === 'web' && (editingDiet || editingBudget || editingCalories)) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setEditingDiet(false);
          setEditingBudget(false);
          setEditingCalories(false);
        }
      };
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [editingDiet, editingBudget, editingCalories]);

  return (
    <SafeAreaView className="flex-1 bg-appBg dark:bg-darkappBg">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 px-4 pt-6 pb-20 mx-auto w-full md:max-w-7xl md:px-12 min-h-[90vh]">
          {/* Header Section */}
          <View className="mb-8 md:mb-12 mt-4 md:mt-8 flex-row items-center justify-between">
            <View>
              <Text className="text-textMain dark:text-darktextMain text-display font-semibold tracking-tight">Settings</Text>
              <Text className="text-textSec text-body-lg mt-2 font-medium">Manage your taste profile and app preferences.</Text>
            </View>
            <View className="hidden md:flex flex-row items-center bg-surface dark:bg-darkgrey py-2 px-4 rounded-full border border-softBorder shadow-sm">
              <View className="w-8 h-8 rounded-full bg-primary items-center justify-center mr-3">
                <Text className="text-white font-semibold text-caption">LF</Text>
              </View>
              <Text className="text-textMain dark:text-darktextMain font-semibold">Liam F.</Text>
            </View>
          </View>

          <View className="md:flex-row md:gap-12">
            
            {/* Left Column: Core Engine Settings */}
            <View className="md:flex-1">
              <Text className="text-textMain dark:text-darktextMain text-h2 font-semibold mb-5 flex-row items-center tracking-tight"><FontAwesome5 name="sliders-h" size={18} color="#9DCD8B" className="mr-3" />  Taste Profile Settings</Text>
              
              <View className="bg-surface dark:bg-darkgrey/60 rounded-[32px] p-7 mb-8 border border-softBorder dark:border-white/5 shadow-sm backdrop-blur-md">
                
                {/* Dietary Baseline */}
                <View className="flex-row justify-between items-center mb-6 border-b border-softBorder dark:border-white/5 pb-6">
                  <View className="flex-1 mr-4">
                    <Text className="text-textMain dark:text-darktextMain font-semibold text-h3">Dietary Baseline</Text>
                    <Text className="text-textSec text-body-sm flex-wrap mt-0.5">Your primary eating style</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => setEditingDiet(true)}
                    className="bg-primary/10 px-5 py-2.5 rounded-2xl active:bg-primary/20 transition-colors"
                  >
                    <Text className="text-primary font-semibold text-body-sm">{diet}</Text>
                  </TouchableOpacity>
                </View>

                {/* Weekly Budget */}
                <View className="flex-row justify-between items-center mb-6 border-b border-softBorder dark:border-white/5 pb-6">
                  <View className="flex-1 mr-4">
                    <Text className="text-textMain dark:text-darktextMain font-semibold text-h3">Weekly Budget</Text>
                    <Text className="text-textSec text-body-sm flex-wrap mt-0.5">Hard limit for grocery generation</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => { setTempBudget(budget); setEditingBudget(true); }}
                    className="bg-primary/10 px-5 py-2.5 rounded-2xl active:bg-primary/20 transition-colors flex-row items-center"
                  >
                    <Text className="text-primary font-semibold text-body-sm mr-2.5">£{budget}</Text>
                    <FontAwesome5 name="pen" size={10} color="#9DCD8B" />
                  </TouchableOpacity>
                </View>

                {/* Daily Calories */}
                <View className="flex-row justify-between items-center">
                  <View className="flex-1 mr-4">
                    <Text className="text-textMain dark:text-darktextMain font-semibold text-h3">Daily Calories</Text>
                    <Text className="text-textSec text-body-sm flex-wrap mt-0.5">Target ceiling for meal math</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => { setTempCalories(calories); setEditingCalories(true); }}
                    className="bg-primary/10 px-5 py-2.5 rounded-2xl active:bg-primary/20 transition-colors flex-row items-center"
                  >
                    <Text className="text-primary font-semibold text-body-sm mr-2.5">{calories} kcal</Text>
                    <FontAwesome5 name="pen" size={10} color="#9DCD8B" />
                  </TouchableOpacity>
                </View>

              </View>
            </View>

            {/* Right Column: App Preferences & Advanced */}
            <View className="md:flex-1">
              <Text className="text-textMain dark:text-darktextMain text-h2 font-semibold mb-5 flex-row items-center tracking-tight"><FontAwesome5 name="cog" size={18} color="#FFB380" className="mr-3" />  App Preferences</Text>
              
              <View className="bg-surface dark:bg-darkgrey/60 rounded-[32px] p-7 mb-8 border border-softBorder dark:border-white/5 shadow-sm backdrop-blur-md">
                
                {/* Toggle Item */}
                <View className="flex-row justify-between items-center mb-6 border-b border-softBorder dark:border-white/5 pb-6">
                  <View>
                    <Text className="text-textMain dark:text-darktextMain font-semibold text-h3">Dark Mode</Text>
                    <Text className="text-textSec text-body-sm mt-0.5">OLED friendly recipe cards</Text>
                  </View>
                  <Switch 
                    value={isDarkMode} 
                    onValueChange={toggleDarkMode}
                    trackColor={{ false: '#e4e4e7', true: '#9DCD8B' }}
                    thumbColor={'#ffffff'}
                  />
                </View>

                {/* Toggle Item */}
                <View className="flex-row justify-between items-center mb-6 border-b border-softBorder dark:border-white/5 pb-6">
                  <View>
                    <Text className="text-textMain dark:text-darktextMain font-semibold text-h3">Push Notifications</Text>
                    <Text className="text-textSec text-body-sm mt-0.5">Reminders to prep ingredients</Text>
                  </View>
                  <Switch 
                    value={notifications} 
                    onValueChange={setNotifications}
                    trackColor={{ false: '#e4e4e7', true: '#9DCD8B' }}
                    thumbColor={'#ffffff'}
                  />
                </View>

                {/* Toggle Item */}
                <View className="flex-row justify-between items-center">
                  <View className="max-w-[80%]">
                    <Text className="text-textMain dark:text-darktextMain font-semibold text-h3">Auto-Deplete Pantry <Text className="text-danger font-semibold text-[10px] uppercase tracking-widest bg-danger/10 px-2 py-0.5 rounded-md ml-2">Beta</Text></Text>
                    <Text className="text-textSec text-body-sm mt-1.5">Automatically remove staple ingredients from your shopping list if bought recently.</Text>
                  </View>
                  <Switch 
                    value={autoDeplete} 
                    onValueChange={setAutoDeplete}
                    trackColor={{ false: '#e4e4e7', true: '#9DCD8B' }}
                    thumbColor={'#ffffff'}
                  />
                </View>
              </View>

              {/* Danger Zone */}
              <View className="mt-8">
                <Text className="text-danger font-semibold tracking-widest uppercase text-caption mb-4 ml-2">Danger Zone</Text>
                <TouchableOpacity 
                  onPress={() => router.replace('/calibration')}
                  className="bg-surface dark:bg-darkgrey border-2 border-danger/10 p-5 rounded-[24px] items-center active:bg-danger/5 transition-colors"
                >
                  <Text className="text-danger font-semibold text-body-lg">Reset Taste Profile (Restart Calibration)</Text>
                </TouchableOpacity>
              </View>

            </View>

          </View>
        </View>
      </ScrollView>

      {/* -- Modals for Editing Values -- */}

      {/* Diet Selection Modal */}
      <Modal visible={editingDiet} transparent={true} animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-center items-center bg-black/40 dark:bg-black/60 p-4">
          <View className="bg-surface dark:bg-darksurface w-full max-w-[340px] rounded-[32px] p-8 shadow-xl border border-black/[0.05] dark:border-darksoftBorder">
            <Text className="text-textMain dark:text-darktextMain text-[24px] font-medium tracking-tight mb-6">Select Diet</Text>
            
            <View className="flex-col gap-2">
              {['Omnivore', 'Pescatarian', 'Vegetarian', 'Vegan'].map(option => (
                <TouchableOpacity 
                  key={option}
                  onPress={() => { setDiet(option as DietaryBaseline); setEditingDiet(false); }}
                  className={`py-4 px-5 rounded-[20px] border transition-all ${diet === option ? 'bg-primary border-primary shadow-sm' : 'bg-black/[0.02] dark:bg-white/[0.02] border-black/[0.04] dark:border-white/5 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'}`}
                >
                  <Text className={`font-medium text-[16px] ${diet === option ? 'text-white' : 'text-textSec dark:text-darktextSec'}`}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="mt-8">
              <TouchableOpacity onPress={() => setEditingDiet(false)} className="w-full py-4 rounded-full border border-black/10 dark:border-white/10 items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/5 active:scale-95">
                <Text className="text-textSec dark:text-darktextSec font-medium text-[15px]">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Budget Input Modal */}
      <Modal visible={editingBudget} transparent={true} animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-center items-center bg-black/40 dark:bg-black/60 p-4">
          <View className="bg-surface dark:bg-darksurface w-full max-w-[340px] rounded-[32px] p-8 shadow-xl border border-black/[0.05] dark:border-darksoftBorder">
            <Text className="text-textMain dark:text-darktextMain text-[24px] font-medium tracking-tight mb-1">Weekly Budget</Text>
            <Text className="text-textSec dark:text-darktextSec text-[14px] font-medium mb-6">Set the limit for generating groceries.</Text>
            
            <View className="flex-row items-center justify-center bg-black/[0.02] dark:bg-white/[0.02] p-6 rounded-[24px] border border-black/[0.04] dark:border-white/5 focus-within:border-black/10 dark:focus-within:border-white/10 transition-colors">
              <Text className="text-textSec/60 dark:text-darktextSec/60 font-medium text-[32px] mr-1">£</Text>
              <TextInput 
                autoFocus
                keyboardType="numeric"
                value={tempBudget}
                onChangeText={setTempBudget}
                className="text-textMain dark:text-darktextMain font-medium text-[40px] text-center outline-none min-w-[80px]"
                style={{ outlineWidth: 0 } as any}
              />
            </View>

            <View className="flex-row gap-2 mt-8">
              <TouchableOpacity onPress={() => setEditingBudget(false)} className="flex-1 py-3.5 rounded-full border border-black/10 dark:border-white/10 items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/5 active:scale-95">
                <Text className="text-textSec dark:text-darktextSec font-medium text-[14px]">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveBudget} className="flex-1 bg-primary py-3.5 rounded-full items-center justify-center shadow-sm hover:bg-primary-hover active:scale-95 transition-all">
                <Text className="text-white font-medium text-[14px]">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Calories Input Modal */}
      <Modal visible={editingCalories} transparent={true} animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-center items-center bg-black/40 dark:bg-black/60 p-4">
          <View className="bg-surface dark:bg-darksurface w-full max-w-[340px] rounded-[32px] p-8 shadow-xl border border-black/[0.05] dark:border-darksoftBorder">
            <Text className="text-textMain dark:text-darktextMain text-[24px] font-medium tracking-tight mb-1">Daily Calories</Text>
            <Text className="text-textSec dark:text-darktextSec text-[14px] font-medium mb-6">Target ceiling for meal math.</Text>
            
            <View className="flex-row items-center justify-center bg-black/[0.02] dark:bg-white/[0.02] p-6 rounded-[24px] border border-black/[0.04] dark:border-white/5 focus-within:border-black/10 dark:focus-within:border-white/10 transition-colors">
              <TextInput 
                autoFocus
                keyboardType="numeric"
                value={tempCalories}
                onChangeText={setTempCalories}
                className="text-textMain dark:text-darktextMain font-medium text-[40px] text-center outline-none min-w-[80px]"
                style={{ outlineWidth: 0 } as any}
              />
              <Text className="text-textSec/60 dark:text-darktextSec/60 font-medium text-[20px] ml-2">kcal</Text>
            </View>

            <View className="flex-row gap-2 mt-8">
              <TouchableOpacity onPress={() => setEditingCalories(false)} className="flex-1 py-3.5 rounded-full border border-black/10 dark:border-white/10 items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/5 active:scale-95">
                <Text className="text-textSec dark:text-darktextSec font-medium text-[14px]">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveCalories} className="flex-1 bg-primary py-3.5 rounded-full items-center justify-center shadow-sm hover:bg-primary-hover active:scale-95 transition-all">
                <Text className="text-white font-medium text-[14px]">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}
