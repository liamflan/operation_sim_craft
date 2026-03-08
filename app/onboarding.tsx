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
      <Text className="text-charcoal text-3xl md:text-5xl font-extrabold mb-3 tracking-tight">What's your vibe?</Text>
      <Text className="text-gray-500 text-lg md:text-xl mb-12">Tap a few meals that make you hungry. We'll learn your taste instantly.</Text>
      
      <View className="flex-row flex-wrap justify-between md:justify-start md:gap-[2%]">
        {MOCK_RECIPES.map((recipe) => {
          const isSelected = selectedVibes.includes(recipe.id);
          return (
            <TouchableOpacity 
              key={recipe.id}
              onPress={() => toggleVibe(recipe.id)}
              className="w-[48%] md:w-[32%] h-48 md:h-72 mb-4 md:mb-6 rounded-3xl overflow-hidden relative shadow-sm group hover:shadow-md transition-all active:scale-[0.98]"
            >
              <Image source={recipe.imageUrl} style={{width: '100%', height: '100%', position: 'absolute'}} contentFit="cover" transition={500} />
              <View className={`absolute inset-0 justify-center items-center transition-colors duration-300 ${isSelected ? 'bg-charcoal/60 backdrop-blur-sm' : 'bg-charcoal/10 group-hover:bg-charcoal/20'}`}>
                {isSelected && (
                  <View className="bg-avocado rounded-full p-3 shadow-lg transform scale-100 transition-transform">
                    <FontAwesome5 name="check" size={24} color="white" />
                  </View>
                )}
              </View>
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.9)']} locations={[0, 0.5, 1]} className="absolute bottom-0 w-full h-[60%] justify-end p-4 md:p-5">
                <Text className="text-cream font-bold text-base md:text-lg leading-tight">{recipe.title}</Text>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View className="flex-1 mt-6 md:mt-12">
      <Text className="text-charcoal text-3xl md:text-5xl font-extrabold mb-3 tracking-tight">Any rules?</Text>
      <Text className="text-gray-500 text-lg md:text-xl mb-12">Select your dietary baseline.</Text>
      
      <View className="md:flex-row md:flex-wrap md:gap-[4%] flex-col mt-4">
        {['Omnivore', 'Pescatarian', 'Vegetarian', 'Vegan'].map((option) => (
          <TouchableOpacity 
            key={option}
            onPress={() => setDiet(option)}
            className={`p-6 md:p-10 rounded-3xl mb-4 md:mb-8 md:w-[48%] border-2 shadow-sm transition-all active:scale-[0.98] ${diet === option ? 'border-avocado bg-avocado/10' : 'border-black/5 bg-white/60 hover:border-black/10 hover:bg-white/90'}`}
          >
            <Text className={`text-2xl md:text-3xl font-extrabold text-center ${diet === option ? 'text-avocado' : 'text-charcoal'}`}>{option}</Text>
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
        <View className="md:w-1/3 md:min-w-[340px] md:max-w-[420px] md:border-r md:border-black/5 bg-white pt-6 md:pt-16 px-6 md:px-12 flex-col justify-between z-10 shadow-sm md:shadow-none">
          <View>
            <Text className="text-charcoal text-3xl md:text-4xl font-extrabold tracking-tight">Provision</Text>
            <Text className="text-avocado text-sm md:text-base font-bold uppercase tracking-widest mt-1">Engine Setup</Text>
            
            {/* Progress Indicators (Moved to sidebar on desktop, hidden on mobile here) */}
            <View className="hidden md:flex mt-16 pl-2">
              <View className="flex-row items-center mb-10">
                <View className={`w-10 h-10 rounded-full items-center justify-center mr-6 shadow-sm ${step >= 1 ? 'bg-avocado' : 'bg-gray-100'}`}>
                  <Text className={`font-bold text-lg ${step >= 1 ? 'text-white' : 'text-gray-400'}`}>1</Text>
                </View>
                <Text className={`font-bold text-xl ${step >= 1 ? 'text-charcoal' : 'text-gray-400'}`}>Taste Profile</Text>
              </View>
              
              <View className="flex-row items-center mb-10">
                <View className={`w-10 h-10 rounded-full items-center justify-center mr-6 shadow-sm ${step >= 2 ? 'bg-avocado' : 'bg-gray-100'}`}>
                  <Text className={`font-bold text-lg ${step >= 2 ? 'text-white' : 'text-gray-400'}`}>2</Text>
                </View>
                <Text className={`font-bold text-xl ${step >= 2 ? 'text-charcoal' : 'text-gray-400'}`}>Dietary Baseline</Text>
              </View>
              
              <View className="flex-row items-center">
                <View className={`w-10 h-10 rounded-full items-center justify-center mr-6 shadow-sm ${step >= 3 ? 'bg-avocado' : 'bg-gray-100'}`}>
                  <Text className={`font-bold text-lg ${step >= 3 ? 'text-white' : 'text-gray-400'}`}>3</Text>
                </View>
                <Text className={`font-bold text-xl ${step >= 3 ? 'text-charcoal' : 'text-gray-400'}`}>Engine Calculation</Text>
              </View>
            </View>
          </View>

          {/* Mock Settings / Profile (Desktop Only) */}
          <View className="hidden md:flex pb-10 mt-auto">
            <TouchableOpacity className="flex-row items-center p-4 -ml-4 rounded-2xl hover:bg-black/5 transition-colors group">
              <View className="w-12 h-12 bg-avocado rounded-full items-center justify-center mr-4 shadow-sm border border-black/5 group-hover:scale-105 transition-transform">
                <Text className="text-white font-bold text-sm leading-none">LF</Text>
              </View>
              <View>
                <Text className="text-charcoal font-bold text-lg leading-tight mb-1">Liam F.</Text>
                <Text className="text-gray-500 text-sm font-medium">Settings & Preferences</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Right Content Area (Forms/Selection) */}
        <View className="flex-1 relative bg-cream">
          <ScrollView 
            className="flex-1" 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }} 
          >
            {/* Top aligned, max-width expanded area */}
            <View className="flex-1 px-4 md:px-16 pt-6 md:pt-20 mx-auto w-full md:max-w-6xl justify-start">
              
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
