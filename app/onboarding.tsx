import React, { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MOCK_RECIPES } from '../data/seed';

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [diet, setDiet] = useState<string | null>(null);

  const toggleVibe = (id: string) => {
    setSelectedVibes(prev => 
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      // Finish onboarding
      router.replace('/(tabs)');
    }
  };

  const renderStep1 = () => (
    <View className="flex-1 mt-6">
      <Text className="text-charcoal text-3xl font-extrabold mb-2 tracking-tight">What's your vibe?</Text>
      <Text className="text-gray-500 text-lg mb-8">Tap a few meals that make you hungry. We'll learn your taste instantly.</Text>
      
      <View className="md:flex-row md:flex-wrap md:justify-between flex-row flex-wrap justify-between">
        {MOCK_RECIPES.map((recipe) => {
          const isSelected = selectedVibes.includes(recipe.id);
          return (
            <TouchableOpacity 
              key={recipe.id}
              onPress={() => toggleVibe(recipe.id)}
              className="w-[48%] md:w-[48%] h-48 md:h-64 mb-4 md:mb-6 rounded-3xl overflow-hidden relative shadow-sm"
            >
              <Image source={recipe.imageUrl} style={{width: '100%', height: '100%', position: 'absolute'}} contentFit="cover" transition={500} />
              <View className={`absolute inset-0 bg-charcoal/${isSelected ? '60' : '10'} justify-center items-center transition-colors`}>
                {isSelected && (
                  <View className="bg-avocado rounded-full p-2">
                    <FontAwesome5 name="check" size={24} color="white" />
                  </View>
                )}
              </View>
              <LinearGradient colors={['transparent', 'rgba(44,44,44,0.9)']} className="absolute bottom-0 w-full p-3">
                <Text className="text-cream font-bold">{recipe.title}</Text>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View className="flex-1 mt-6">
      <Text className="text-charcoal text-3xl font-extrabold mb-2 tracking-tight">Any rules?</Text>
      <Text className="text-gray-500 text-lg mb-8">Select your dietary baseline.</Text>
      
      <View className="md:flex-row md:flex-wrap md:gap-4 mt-4">
        {['Omnivore', 'Pescatarian', 'Vegetarian', 'Vegan'].map((option) => (
          <TouchableOpacity 
            key={option}
            onPress={() => setDiet(option)}
            className={`p-6 md:p-8 rounded-2xl mb-4 md:w-[48%] border shadow-sm ${diet === option ? 'border-avocado bg-avocado/10' : 'border-black/5 bg-white/60 hover:bg-white/80 transition-colors'}`}
          >
            <Text className={`text-xl md:text-2xl font-bold text-center ${diet === option ? 'text-avocado' : 'text-charcoal'}`}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View className="flex-1 mt-6 justify-center">
      <View className="items-center mb-10">
        <FontAwesome5 name="magic" size={48} color="#FF6B5A" className="mb-6" />
        <Text className="text-charcoal text-3xl font-extrabold mb-4 text-center tracking-tight">Building your engine...</Text>
        <Text className="text-gray-500 text-lg text-center px-4">Based on your taste profile, we are calculating a £50 weekly budget that hits 160g of protein daily.</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-cream">
      {/* Desktop Split Layout */}
      <View className="flex-1 md:flex-row">
        
        {/* Left Sidebar (Desktop Only) / Top Header (Mobile) */}
        <View className="md:w-1/3 md:min-w-[340px] md:border-r md:border-black/5 bg-white pt-6 md:pt-12 px-6 flex-col justify-between">
          <View>
            <Text className="text-charcoal text-3xl font-extrabold tracking-tight">Provision</Text>
            <Text className="text-avocado text-sm font-bold uppercase tracking-widest mt-1">Engine Setup</Text>
            
            {/* Progress Indicators (Moved to sidebar on desktop, hidden on mobile here) */}
            <View className="hidden md:flex mt-12">
              <View className="flex-row items-center mb-6">
                <View className={`w-8 h-8 rounded-full items-center justify-center mr-4 ${step >= 1 ? 'bg-avocado' : 'bg-gray-200'}`}>
                  <Text className={`font-bold ${step >= 1 ? 'text-white' : 'text-gray-400'}`}>1</Text>
                </View>
                <Text className={`font-bold text-lg ${step >= 1 ? 'text-charcoal' : 'text-gray-400'}`}>Taste Profile</Text>
              </View>
              
              <View className="flex-row items-center mb-6">
                <View className={`w-8 h-8 rounded-full items-center justify-center mr-4 ${step >= 2 ? 'bg-avocado' : 'bg-gray-200'}`}>
                  <Text className={`font-bold ${step >= 2 ? 'text-white' : 'text-gray-400'}`}>2</Text>
                </View>
                <Text className={`font-bold text-lg ${step >= 2 ? 'text-charcoal' : 'text-gray-400'}`}>Dietary Baseline</Text>
              </View>
              
              <View className="flex-row items-center">
                <View className={`w-8 h-8 rounded-full items-center justify-center mr-4 ${step >= 3 ? 'bg-avocado' : 'bg-gray-200'}`}>
                  <Text className={`font-bold ${step >= 3 ? 'text-white' : 'text-gray-400'}`}>3</Text>
                </View>
                <Text className={`font-bold text-lg ${step >= 3 ? 'text-charcoal' : 'text-gray-400'}`}>Engine Calculation</Text>
              </View>
            </View>
          </View>

          {/* Mock Settings / Profile (Desktop Only) */}
          <View className="hidden md:flex pb-8 mt-auto">
            <TouchableOpacity className="flex-row items-center p-4 rounded-2xl hover:bg-black/5 transition-colors">
              <View className="w-10 h-10 bg-avocado rounded-full items-center justify-center mr-3 shadow-sm border border-black/5">
                <Text className="text-white font-bold text-sm leading-none">LF</Text>
              </View>
              <View>
                <Text className="text-charcoal font-bold leading-tight">Liam F.</Text>
                <Text className="text-gray-500 text-xs">Settings</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Right Content Area (Forms/Selection) */}
        <View className="flex-1 relative bg-cream">
          <ScrollView 
            className="flex-1" 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }} // padding bottom for fixed footer
          >
            <View className="flex-1 px-4 md:px-12 mx-auto w-full max-w-4xl justify-center py-12">
              
              {/* Progress Bar (Mobile Only) */}
              <View className="flex-row gap-2 mb-8 max-w-sm mx-auto w-full md:hidden">
                {[1, 2, 3].map((i) => (
                  <View key={i} className={`flex-1 h-2 rounded-full ${i <= step ? 'bg-avocado' : 'bg-charcoal/10'}`} />
                ))}
              </View>

              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </View>
          </ScrollView>

          {/* Persistent Bottom Action (Locks to bottom of right pane on desktop) */}
          <View className="p-4 border-t border-black/5 bg-cream/90 md:bg-white/80 md:backdrop-blur-md absolute bottom-0 w-full left-0 z-50">
            <View className="mx-auto w-full max-w-md md:max-w-none md:flex-row md:justify-end md:px-8">
              <TouchableOpacity 
                onPress={handleNext}
                className="bg-charcoal rounded-full p-4 md:px-12 items-center justify-center active:bg-charcoal/80 shadow-md transition-transform hover:scale-[1.02]"
              >
                <Text className="text-cream font-extrabold text-lg md:text-xl tracking-wide">
                  {step === 3 ? "Launch Dashboard" : "Continue"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

      </View>
    </SafeAreaView>
  );
}
