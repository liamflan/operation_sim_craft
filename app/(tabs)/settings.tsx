import React from 'react';
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, Switch } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const router = useRouter();

  const [diet, setDiet] = React.useState('Omnivore');
  const [budget, setBudget] = React.useState('50');
  const [calories, setCalories] = React.useState('2400');
  
  const [darkMode, setDarkMode] = React.useState(false);
  const [notifications, setNotifications] = React.useState(true);
  const [autoDeplete, setAutoDeplete] = React.useState(false);

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 px-4 pt-6 pb-20 mx-auto w-full md:max-w-7xl md:px-12 min-h-[90vh]">
          {/* Header Section */}
          <View className="mb-8 md:mb-12 mt-4 md:mt-8 flex-row items-center justify-between">
            <View>
              <Text className="text-charcoal text-4xl md:text-5xl font-extrabold tracking-tight">Settings</Text>
              <Text className="text-gray-500 text-lg md:text-xl mt-2 font-medium">Manage your engine guardrails and app preferences.</Text>
            </View>
            <View className="hidden md:flex flex-row items-center bg-white py-2 px-4 rounded-full border border-black/5 shadow-sm">
              <View className="w-8 h-8 rounded-full bg-avocado items-center justify-center mr-3">
                <Text className="text-white font-bold text-xs">LF</Text>
              </View>
              <Text className="text-charcoal font-bold">Liam F.</Text>
            </View>
          </View>

          <View className="md:flex-row md:gap-12">
            
            {/* Left Column: Core Engine Settings */}
            <View className="md:flex-1">
              <Text className="text-charcoal text-xl font-extrabold mb-4 flex-row items-center"><FontAwesome5 name="sliders-h" size={18} color="#6DBE75" />  Engine Guardrails</Text>
              
              <View className="bg-white/60 rounded-3xl p-6 mb-8 border border-white shadow-sm backdrop-blur-md">
                
                {/* Setting Item */}
                <View className="flex-row justify-between items-center mb-6 border-b border-black/5 pb-6">
                  <View>
                    <Text className="text-charcoal font-bold text-lg">Dietary Baseline</Text>
                    <Text className="text-gray-500 text-sm">Your primary eating style</Text>
                  </View>
                  <TouchableOpacity className="bg-charcoal/5 px-4 py-2 rounded-xl active:bg-charcoal/10 transition-colors">
                    <Text className="text-avocado font-bold">{diet}</Text>
                  </TouchableOpacity>
                </View>

                {/* Setting Item */}
                <View className="flex-row justify-between items-center mb-6 border-b border-black/5 pb-6">
                  <View>
                    <Text className="text-charcoal font-bold text-lg">Weekly Budget</Text>
                    <Text className="text-gray-500 text-sm">Hard limit for grocery generation</Text>
                  </View>
                  <TouchableOpacity className="bg-charcoal/5 px-4 py-2 rounded-xl active:bg-charcoal/10 transition-colors">
                    <Text className="text-avocado font-bold">£{budget}</Text>
                  </TouchableOpacity>
                </View>

                {/* Setting Item */}
                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="text-charcoal font-bold text-lg">Daily Calories</Text>
                    <Text className="text-gray-500 text-sm">Target ceiling for meal math</Text>
                  </View>
                  <TouchableOpacity className="bg-charcoal/5 px-4 py-2 rounded-xl active:bg-charcoal/10 transition-colors">
                    <Text className="text-avocado font-bold">{calories} kcal</Text>
                  </TouchableOpacity>
                </View>

              </View>
            </View>

            {/* Right Column: App Preferences & Advanced */}
            <View className="md:flex-1">
              <Text className="text-charcoal text-xl font-extrabold mb-4 flex-row items-center"><FontAwesome5 name="cog" size={18} color="#4F7FFF" />  App Preferences</Text>
              
              <View className="bg-white/60 rounded-3xl p-6 mb-8 border border-white shadow-sm backdrop-blur-md">
                
                {/* Toggle Item */}
                <View className="flex-row justify-between items-center mb-6 border-b border-black/5 pb-6">
                  <View>
                    <Text className="text-charcoal font-bold text-lg">Dark Mode</Text>
                    <Text className="text-gray-500 text-sm">OLED friendly recipe cards</Text>
                  </View>
                  <Switch 
                    value={darkMode} 
                    onValueChange={setDarkMode}
                    trackColor={{ false: '#e4e4e7', true: '#6DBE75' }}
                    thumbColor={'#ffffff'}
                  />
                </View>

                {/* Toggle Item */}
                <View className="flex-row justify-between items-center mb-6 border-b border-black/5 pb-6">
                  <View>
                    <Text className="text-charcoal font-bold text-lg">Push Notifications</Text>
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
                    <Text className="text-charcoal font-bold text-lg">Auto-Deplete Pantry <Text className="text-tomato font-bold text-xs uppercase bg-tomato/10 px-2 py-0.5 rounded-md ml-2">Beta</Text></Text>
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
                  className="bg-white border-2 border-tomato/20 p-4 rounded-2xl items-center active:bg-tomato/5 transition-colors"
                >
                  <Text className="text-tomato font-bold text-lg">Reset Engine (Restart Calibration)</Text>
                </TouchableOpacity>
              </View>

            </View>

          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
