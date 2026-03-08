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
      <Text className="text-white text-3xl font-extrabold mb-2 tracking-tight">What's your vibe?</Text>
      <Text className="text-gray-400 text-lg mb-8">Tap a few meals that make you hungry. We'll learn your taste instantly.</Text>
      
      <View className="md:flex-row md:flex-wrap md:justify-between flex-row flex-wrap justify-between">
        {MOCK_RECIPES.map((recipe) => {
          const isSelected = selectedVibes.includes(recipe.id);
          return (
            <TouchableOpacity 
              key={recipe.id}
              onPress={() => toggleVibe(recipe.id)}
              className="w-[48%] md:w-[48%] h-48 md:h-64 mb-4 md:mb-6 rounded-3xl overflow-hidden relative"
            >
              <Image source={recipe.imageUrl} style={{width: '100%', height: '100%', position: 'absolute'}} contentFit="cover" transition={500} />
              <View className={`absolute inset-0 bg-black/${isSelected ? '60' : '20'} justify-center items-center transition-colors`}>
                {isSelected && (
                  <View className="bg-[#4ade80] rounded-full p-2">
                    <FontAwesome5 name="check" size={24} color="#1A1A1A" />
                  </View>
                )}
              </View>
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} className="absolute bottom-0 w-full p-3">
                <Text className="text-white font-bold">{recipe.title}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View className="flex-1 mt-6">
      <Text className="text-white text-3xl font-extrabold mb-2 tracking-tight">Any rules?</Text>
      <Text className="text-gray-400 text-lg mb-8">Select your dietary baseline.</Text>
      
      <View className="md:flex-row md:flex-wrap md:gap-4 mt-4">
        {['Omnivore', 'Pescatarian', 'Vegetarian', 'Vegan'].map((option) => (
          <TouchableOpacity 
            key={option}
            onPress={() => setDiet(option)}
            className={`p-6 md:p-8 rounded-2xl mb-4 md:w-[48%] border ${diet === option ? 'border-[#4ade80] bg-[#4ade80]/10' : 'border-white/10 bg-white/5 hover:bg-white/10 transition-colors'}`}
          >
            <Text className={`text-xl md:text-2xl font-bold text-center ${diet === option ? 'text-[#4ade80]' : 'text-white'}`}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View className="flex-1 mt-6 justify-center">
      <View className="items-center mb-10">
        <FontAwesome5 name="magic" size={48} color="#fb923c" className="mb-6" />
        <Text className="text-white text-3xl font-extrabold mb-4 text-center tracking-tight">Building your engine...</Text>
        <Text className="text-gray-400 text-lg text-center px-4">Based on your taste profile, we are calculating a £50 weekly budget that hits 160g of protein daily.</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#1A1A1A]">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 px-4 pt-6 pb-32 mx-auto w-full md:max-w-4xl min-h-[90vh] justify-center">
          {/* Progress Bar */}
          <View className="flex-row gap-2 mt-4 mb-8 md:mb-12 max-w-sm mx-auto w-full">
            {[1, 2, 3].map((i) => (
              <View key={i} className={`flex-1 h-2 rounded-full ${i <= step ? 'bg-[#4ade80]' : 'bg-white/10'}`} />
            ))}
          </View>

          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </View>
      </ScrollView>

      {/* Persistent Bottom Action */}
      <View className="p-4 border-t border-white/5 bg-[#1A1A1A] absolute bottom-0 w-full">
        <View className="mx-auto w-full md:max-w-md">
          <TouchableOpacity 
            onPress={handleNext}
            className="bg-white rounded-full p-4 md:p-5 items-center justify-center active:bg-gray-200"
          >
            <Text className="text-[#1A1A1A] font-extrabold text-lg md:text-xl tracking-wide">
              {step === 3 ? "Launch Dashboard" : "Continue"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
