import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, Switch, TextInput, Modal } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../components/ThemeContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { isDarkMode, toggleDarkMode } = useTheme();

  const [diet, setDiet] = useState('Omnivore');
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

  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-darkcream">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 px-4 pt-6 pb-20 mx-auto w-full md:max-w-7xl md:px-12 min-h-[90vh]">
          {/* Header Section */}
          <View className="mb-8 md:mb-12 mt-4 md:mt-8 flex-row items-center justify-between">
            <View>
              <Text className="text-charcoal dark:text-darkcharcoal text-4xl md:text-5xl font-extrabold tracking-tight">Settings</Text>
              <Text className="text-gray-500 text-lg md:text-xl mt-2 font-medium">Manage your engine guardrails and app preferences.</Text>
            </View>
            <View className="hidden md:flex flex-row items-center bg-white dark:bg-darkgrey py-2 px-4 rounded-full border border-black/5 shadow-sm">
              <View className="w-8 h-8 rounded-full bg-avocado items-center justify-center mr-3">
                <Text className="text-white font-bold text-xs">LF</Text>
              </View>
              <Text className="text-charcoal dark:text-darkcharcoal font-bold">Liam F.</Text>
            </View>
          </View>

          <View className="md:flex-row md:gap-12">
            
            {/* Left Column: Core Engine Settings */}
            <View className="md:flex-1">
              <Text className="text-charcoal dark:text-darkcharcoal text-xl font-extrabold mb-4 flex-row items-center"><FontAwesome5 name="sliders-h" size={18} color="#6DBE75" />  Engine Guardrails</Text>
              
              <View className="bg-white/60 dark:bg-darkgrey/60 rounded-3xl p-6 mb-8 border border-white dark:border-white/5 shadow-sm backdrop-blur-md">
                
                {/* Dietary Baseline */}
                <View className="flex-row justify-between items-center mb-6 border-b border-black/5 dark:border-white/5 pb-6">
                  <View className="flex-1 mr-4">
                    <Text className="text-charcoal dark:text-darkcharcoal font-bold text-lg">Dietary Baseline</Text>
                    <Text className="text-gray-500 text-sm flex-wrap">Your primary eating style</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => setEditingDiet(true)}
                    className="bg-charcoal/5 px-4 py-2 rounded-xl active:bg-charcoal/10 transition-colors"
                  >
                    <Text className="text-avocado font-bold">{diet}</Text>
                  </TouchableOpacity>
                </View>

                {/* Weekly Budget */}
                <View className="flex-row justify-between items-center mb-6 border-b border-black/5 dark:border-white/5 pb-6">
                  <View className="flex-1 mr-4">
                    <Text className="text-charcoal dark:text-darkcharcoal font-bold text-lg">Weekly Budget</Text>
                    <Text className="text-gray-500 text-sm flex-wrap">Hard limit for grocery generation</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => { setTempBudget(budget); setEditingBudget(true); }}
                    className="bg-charcoal/5 px-4 py-2 rounded-xl active:bg-charcoal/10 transition-colors flex-row items-center"
                  >
                    <Text className="text-avocado font-bold mr-2">£{budget}</Text>
                    <FontAwesome5 name="pen" size={10} color="#6DBE75" />
                  </TouchableOpacity>
                </View>

                {/* Daily Calories */}
                <View className="flex-row justify-between items-center">
                  <View className="flex-1 mr-4">
                    <Text className="text-charcoal dark:text-darkcharcoal font-bold text-lg">Daily Calories</Text>
                    <Text className="text-gray-500 text-sm flex-wrap">Target ceiling for meal math</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => { setTempCalories(calories); setEditingCalories(true); }}
                    className="bg-charcoal/5 px-4 py-2 rounded-xl active:bg-charcoal/10 transition-colors flex-row items-center"
                  >
                    <Text className="text-avocado font-bold mr-2">{calories} kcal</Text>
                    <FontAwesome5 name="pen" size={10} color="#6DBE75" />
                  </TouchableOpacity>
                </View>

              </View>
            </View>

            {/* Right Column: App Preferences & Advanced */}
            <View className="md:flex-1">
              <Text className="text-charcoal dark:text-darkcharcoal text-xl font-extrabold mb-4 flex-row items-center"><FontAwesome5 name="cog" size={18} color="#4F7FFF" />  App Preferences</Text>
              
              <View className="bg-white/60 dark:bg-darkgrey/60 rounded-3xl p-6 mb-8 border border-white dark:border-white/5 shadow-sm backdrop-blur-md">
                
                {/* Toggle Item */}
                <View className="flex-row justify-between items-center mb-6 border-b border-black/5 dark:border-white/5 pb-6">
                  <View>
                    <Text className="text-charcoal dark:text-darkcharcoal font-bold text-lg">Dark Mode</Text>
                    <Text className="text-gray-500 text-sm">OLED friendly recipe cards</Text>
                  </View>
                  <Switch 
                    value={isDarkMode} 
                    onValueChange={toggleDarkMode}
                    trackColor={{ false: '#e4e4e7', true: '#6DBE75' }}
                    thumbColor={'#ffffff'}
                  />
                </View>

                {/* Toggle Item */}
                <View className="flex-row justify-between items-center mb-6 border-b border-black/5 dark:border-white/5 pb-6">
                  <View>
                    <Text className="text-charcoal dark:text-darkcharcoal font-bold text-lg">Push Notifications</Text>
                    <Text className="text-gray-500 text-sm">Reminders to prep ingredients</Text>
                  </View>
                  <Switch 
                    value={notifications} 
                    onValueChange={setNotifications}
                    trackColor={{ false: '#e4e4e7', true: '#6DBE75' }}
                    thumbColor={'#ffffff'}
                  />
                </View>

                {/* Toggle Item */}
                <View className="flex-row justify-between items-center">
                  <View className="max-w-[80%]">
                    <Text className="text-charcoal dark:text-darkcharcoal font-bold text-lg">Auto-Deplete Pantry <Text className="text-tomato font-bold text-xs uppercase bg-tomato/10 px-2 py-0.5 rounded-md ml-2">Beta</Text></Text>
                    <Text className="text-gray-500 text-sm mt-1">Automatically remove staple ingredients from your shopping list if bought recently.</Text>
                  </View>
                  <Switch 
                    value={autoDeplete} 
                    onValueChange={setAutoDeplete}
                    trackColor={{ false: '#e4e4e7', true: '#6DBE75' }}
                    thumbColor={'#ffffff'}
                  />
                </View>
              </View>

              {/* Danger Zone */}
              <View className="mt-8">
                <Text className="text-tomato font-bold tracking-wider uppercase text-sm mb-3 ml-2">Danger Zone</Text>
                <TouchableOpacity 
                  onPress={() => router.replace('/calibration')}
                  className="bg-white dark:bg-darkgrey border-2 border-tomato/20 p-4 rounded-2xl items-center active:bg-tomato/5 transition-colors"
                >
                  <Text className="text-tomato font-bold text-lg">Reset Engine (Restart Calibration)</Text>
                </TouchableOpacity>
              </View>

            </View>

          </View>
        </View>
      </ScrollView>

      {/* -- Modals for Editing Values -- */}

      {/* Diet Selection Modal */}
      <Modal visible={editingDiet} transparent={true} animationType="fade">
        <View className="flex-1 bg-black/40 justify-center items-center p-4">
          <View className="bg-cream w-full max-w-sm rounded-3xl p-6 shadow-xl border border-white/50">
            <Text className="text-charcoal text-2xl font-extrabold mb-6">Select Diet</Text>
            {['Omnivore', 'Pescatarian', 'Vegetarian', 'Vegan'].map(option => (
              <TouchableOpacity 
                key={option}
                onPress={() => { setDiet(option); setEditingDiet(false); }}
                className={`p-4 rounded-xl border-2 mb-3 ${diet === option ? 'border-avocado bg-avocado/10' : 'border-black/5 bg-white'}`}
              >
                <Text className={`text-center font-bold text-lg ${diet === option ? 'text-avocado' : 'text-charcoal'}`}>{option}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setEditingDiet(false)} className="mt-4 py-3">
              <Text className="text-center font-bold text-gray-400">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Budget Input Modal */}
      <Modal visible={editingBudget} transparent={true} animationType="fade">
        <View className="flex-1 bg-black/40 justify-center items-center p-4">
          <View className="bg-cream w-full max-w-sm rounded-3xl p-6 shadow-xl border border-white/50">
            <Text className="text-charcoal text-2xl font-extrabold mb-2">Weekly Budget</Text>
            <Text className="text-gray-500 mb-6 font-medium">Set the hard limit for generating groceries (in £).</Text>
            
            <View className="flex-row items-center bg-white border-2 border-avocado rounded-2xl px-4 py-3 mb-6">
              <Text className="text-charcoal text-xl font-bold mr-2">£</Text>
              <TextInput 
                autoFocus
                keyboardType="numeric"
                value={tempBudget}
                onChangeText={setTempBudget}
                className="flex-1 text-charcoal text-xl font-bold outline-none"
                style={{ outlineWidth: 0 } as any}
              />
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setEditingBudget(false)} className="flex-1 bg-gray-200 p-4 rounded-xl items-center">
                <Text className="text-gray-500 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveBudget} className="flex-1 bg-charcoal p-4 rounded-xl items-center">
                <Text className="text-white font-bold">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Calories Input Modal */}
      <Modal visible={editingCalories} transparent={true} animationType="fade">
        <View className="flex-1 bg-black/40 justify-center items-center p-4">
          <View className="bg-cream w-full max-w-sm rounded-3xl p-6 shadow-xl border border-white/50">
            <Text className="text-charcoal text-2xl font-extrabold mb-2">Daily Calories</Text>
            <Text className="text-gray-500 mb-6 font-medium">Target ceiling for engine algorithm calculation.</Text>
            
            <View className="flex-row items-center bg-white border-2 border-avocado rounded-2xl px-4 py-3 mb-6">
              <TextInput 
                autoFocus
                keyboardType="numeric"
                value={tempCalories}
                onChangeText={setTempCalories}
                className="flex-1 text-charcoal text-xl font-bold text-right outline-none"
                style={{ outlineWidth: 0 } as any}
              />
              <Text className="text-gray-400 text-lg font-bold ml-2">kcal</Text>
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setEditingCalories(false)} className="flex-1 bg-gray-200 p-4 rounded-xl items-center">
                <Text className="text-gray-500 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveCalories} className="flex-1 bg-charcoal p-4 rounded-xl items-center">
                <Text className="text-white font-bold">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
