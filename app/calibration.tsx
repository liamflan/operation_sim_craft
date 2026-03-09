import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { MOCK_RECIPES } from '../data/seed';

export default function CalibrationScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [diet, setDiet] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState(0);

  const loadingMessages = [
    'Learning your taste profile...',
    'Matching meals to your taste, baseline, and goals',
    'Balancing protein and weekly spend...',
    'Shaping your weekly plan...',
    'Your first plan is ready'
  ];
  const isSetupComplete = loadingStage >= loadingMessages.length - 1;

  useEffect(() => {
    if (step === 3 && !isSetupComplete) {
      const timer = setTimeout(() => {
        setLoadingStage(prev => prev + 1);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [step, loadingStage, isSetupComplete]);

  const toggleVibe = (id: string) => {
    setSelectedVibes(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    // Prevent progression if criteria not met
    if (step === 1 && selectedVibes.length < 3) return;
    if (step === 2 && !diet) return;

    if (step < 3) {
      setStep(step + 1);
    } else {
      // Finish calibration
      router.replace('/(tabs)');
    }
  };

  const handleDebugSkip = () => {
    setSelectedVibes([MOCK_RECIPES[0].id, MOCK_RECIPES[1].id, MOCK_RECIPES[2].id]);
    setDiet('Omnivore');
    router.replace('/(tabs)');
  };

  const renderStep1 = () => (
    <View className="flex-1 w-full items-center justify-center relative">
      <TouchableOpacity 
        testID="calibration-skip-debug-btn"
        onPress={handleDebugSkip}
        className="absolute top-0 right-0 z-50 bg-charcoal/10 dark:bg-white/10 px-4 py-2 rounded-full"
      >
        <Text className="text-xs font-bold text-charcoal dark:text-white uppercase tracking-widest">Skip (Debug)</Text>
      </TouchableOpacity>
      
      <View className="w-full max-w-[940px]">
        <View className="mb-4 md:mb-5">
          <Text className="text-charcoal dark:text-darkcharcoal text-3xl md:text-5xl font-extrabold mb-1 md:mb-2 tracking-tight">What sounds good this week?</Text>
          <Text className="text-gray-500 text-base md:text-xl font-medium">Pick 3-5 meals you'd actually want in your week.</Text>
        </View>

        {/* Selected Counter & Grid Container */}
        <View className="flex-col gap-y-4 md:gap-y-6">
          <View className="flex-row items-center">
            <View className={`px-4 py-2 rounded-full border ${selectedVibes.length >= 3 ? 'bg-avocado/10 border-avocado/30' : 'bg-gray-100 dark:bg-darkgrey border-black/5 dark:border-white/5'}`}>
              <Text className={`font-bold text-base ${selectedVibes.length >= 3 ? 'text-avocado' : 'text-gray-500'}`}>
                {selectedVibes.length} {selectedVibes.length >= 5 ? 'of 5' : 'selected'}
              </Text>
            </View>
            <Text className="text-gray-400 text-sm ml-4 font-medium italic">
              {selectedVibes.length < 3 ? `Pick ${3 - selectedVibes.length} more` : "Perfect. We're learning your taste."}
            </Text>
          </View>

          <View className="flex-row flex-wrap justify-between gap-y-4 md:gap-y-6">
            {MOCK_RECIPES.slice(0, 6).map((recipe) => {
              const isSelected = selectedVibes.includes(recipe.id);
              return (
                <TouchableOpacity
                  key={recipe.id}
                  testID={`calibration-vibe-card-${recipe.id}`}
                  onPress={() => toggleVibe(recipe.id)}
                  activeOpacity={0.8}
                  className={`w-[48.5%] md:w-[31.5%] h-48 md:h-[180px] lg:h-[220px] rounded-[28px] overflow-hidden relative shadow-sm transition-all bg-black ${isSelected ? 'scale-[0.98] shadow-md ring-4 ring-avocado' : 'hover:shadow-md active:scale-[0.98]'}`}
                >
                  {/* Branded fallback — shown when image is absent/slowly loading */}
                  <View className="absolute inset-0" style={{ backgroundColor: '#C8B89A' }}>
                    <LinearGradient
                      colors={['#D4C4A0', '#B89A72', '#8B6F4E']}
                      locations={[0, 0.6, 1]}
                      className="absolute inset-0"
                    />
                    <View
                      className="absolute"
                      style={{ top: -30, left: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,245,220,0.15)' }}
                    />
                    <View className="absolute inset-0 items-center justify-center">
                      <View
                        style={{
                          width: 44, height: 44, borderRadius: 12,
                          backgroundColor: 'rgba(255,255,255,0.12)',
                          alignItems: 'center', justifyContent: 'center',
                          borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
                        }}
                      >
                        <FontAwesome5 name="utensils" size={18} color="rgba(255,255,255,0.7)" />
                      </View>
                    </View>
                  </View>

                  {recipe.imageUrl && (
                    <Image source={recipe.imageUrl} style={{ width: '100%', height: '100%', position: 'absolute' }} contentFit="cover" transition={500} />
                  )}

                  {/* Overlay states */}
                  <View className={`absolute inset-0 justify-center items-center transition-colors duration-300 ${isSelected ? 'bg-black/30' : 'bg-black/5'}`}>
                    {isSelected && (
                      <View className="absolute top-4 right-4 bg-avocado rounded-full p-2.5 shadow-xl">
                        <FontAwesome5 name="check" size={14} color="white" />
                      </View>
                    )}
                  </View>

                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.85)']} locations={[0, 0.4, 1]} className="absolute bottom-0 w-full h-[60%] justify-end p-5 md:p-6 rounded-b-[28px]">
                    <Text className="text-white font-extrabold text-lg md:text-xl leading-tight tracking-tight">{recipe.title}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );

  const renderStep2 = () => {
    const dietOptions = [
      { label: 'Omnivore', description: 'Includes meat, fish, dairy, and eggs' },
      { label: 'Pescatarian', description: 'No meat, but fish is in' },
      { label: 'Vegetarian', description: 'No meat or fish' },
      { label: 'Vegan', description: 'No animal products' }
    ];

    return (
      <View className="flex-1 w-full items-center justify-center">
        <View className="w-full max-w-[860px]">
          <View className="mb-5 md:mb-6">
            <Text className="text-charcoal dark:text-darkcharcoal text-4xl md:text-5xl font-extrabold mb-1 tracking-tight">How do you eat?</Text>
            <Text className="text-gray-500 text-base md:text-lg font-medium">We'll use this as the baseline for your setup.</Text>
          </View>

          <View className="flex-row flex-wrap justify-between gap-y-3.5 md:gap-y-4">
            {dietOptions.map((option) => (
              <TouchableOpacity
                key={option.label}
                testID={`calibration-diet-card-${option.label.toLowerCase()}`}
                onPress={() => setDiet(option.label)}
                activeOpacity={0.8}
                className={`p-5 md:p-7 rounded-[24px] w-full md:w-[48.5%] shadow-sm border border-black/5 dark:border-white/5 transition-all ${diet === option.label
                    ? 'bg-avocado/10 border-avocado/20 scale-[0.98] shadow-md'
                    : 'bg-white/60 dark:bg-darkgrey/60 hover:shadow-md active:scale-[0.98]'
                  }`}
              >
                <View className="flex-row justify-between items-start mb-1.5">
                  <Text className={`text-xl md:text-2xl font-extrabold tracking-tight ${diet === option.label ? 'text-avocado' : 'text-charcoal dark:text-darkcharcoal'}`}>
                    {option.label}
                  </Text>
                  {diet === option.label && (
                    <FontAwesome5 name="check-circle" size={28} color="#6DBE75" />
                  )}
                </View>
                <Text className={`font-medium text-base md:text-lg leading-relaxed ${diet === option.label ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500'}`}>
                  {option.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity testID="calibration-skip-exclusions-btn" className="mt-6 md:mt-8 self-start">
            <Text className="text-gray-400 font-bold text-base underline opacity-60 hover:opacity-100">Skip exclusions for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderStep3 = () => (
    <View className="flex-1 w-full items-center justify-center">
      <View className="w-full max-w-[560px] items-center">
        <View className="items-center mb-5 md:mb-6">
          <View className={`w-20 h-20 md:w-24 md:h-24 rounded-full items-center justify-center mb-5 relative transition-colors duration-500 ${isSetupComplete ? 'bg-avocado shadow-avocado/30' : 'bg-white dark:bg-darkgrey shadow-black/10'}`} style={{ shadowOpacity: 0.15, shadowRadius: 15, shadowOffset: { width: 0, height: 8 } }}>
            {isSetupComplete ? (
              <FontAwesome5 name="check" size={30} color="white" />
            ) : (
              <>
                <ActivityIndicator size="large" color="#6DBE75" />
                <View 
                  className="absolute bg-white dark:bg-darkgrey rounded-full items-center justify-center shadow-md border border-black/5 dark:border-white/5"
                  style={{ width: 32, height: 32 }}
                >
                  <FontAwesome5 name="leaf" size={14} color="#6DBE75" />
                </View>
              </>
            )}
          </View>

          <Text className="text-charcoal dark:text-darkcharcoal text-2xl md:text-3xl font-extrabold mb-1 text-center tracking-tight">
            {isSetupComplete ? 'Plan ready.' : 'Shaping your weekly plan...'}
          </Text>
          <View className="h-6 md:h-7 justify-center mb-2">
            <Text className={`font-bold text-base md:text-lg text-center transition-colors duration-300 ${isSetupComplete ? 'text-avocado' : 'text-blueberry'}`}>
              {loadingMessages[loadingStage]}
            </Text>
          </View>
          <Text className="text-gray-500 text-sm md:text-base text-center px-4 leading-relaxed font-medium italic">
            {isSetupComplete ? 'Your starting plan is ready to review' : 'We’re creating a starting plan based on what you like and how you want to eat.'}
          </Text>
        </View>

        {/* Input Summary Card — Integrated feel */}
        <View className="w-full bg-white dark:bg-darkgrey rounded-[24px] md:rounded-[28px] p-5 md:p-6 shadow-xl border border-black/5 dark:border-white/5">
          <View className="flex-row items-center mb-4">
            <FontAwesome5 name="fingerprint" size={18} color="#6DBE75" className="mr-3" />
            <Text className="text-charcoal dark:text-darkcharcoal font-extrabold text-2xl tracking-tight">Your Profile</Text>
          </View>

          <View className="space-y-4">
            <View className="flex-row justify-between items-center border-b border-black/5 dark:border-white/5 pb-3">
              <Text className="text-gray-500 text-sm md:text-base font-bold uppercase tracking-widest">Taste</Text>
              <Text className="text-charcoal dark:text-gray-300 font-extrabold text-lg md:text-xl">{selectedVibes.length} Picks</Text>
            </View>
            <View className="flex-row justify-between items-center border-b border-black/5 dark:border-white/5 pb-3">
              <Text className="text-gray-500 text-sm md:text-base font-bold uppercase tracking-widest">Baseline</Text>
              <Text className="text-charcoal dark:text-gray-300 font-extrabold text-lg md:text-xl">{diet || 'Omnivore'}</Text>
            </View>
            <View className="flex-row justify-between items-center border-b border-black/5 dark:border-white/5 pb-3">
              <Text className="text-gray-500 text-sm md:text-base font-bold uppercase tracking-widest">Budget</Text>
              <Text className="text-charcoal dark:text-gray-300 font-extrabold text-lg md:text-xl">£50 <Text className="text-xs font-medium text-gray-400">(avg)</Text></Text>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-gray-500 text-sm md:text-base font-bold uppercase tracking-widest">Fueling</Text>
              <Text className="text-charcoal dark:text-gray-300 font-extrabold text-lg md:text-xl">160g P <Text className="text-xs font-medium text-gray-400">/day</Text></Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView testID="calibration-screen" className="flex-1 bg-cream dark:bg-darkcream">
      {/* Desktop Split Layout */}
      <View className="flex-1 md:flex-row">

        {/* Left Sidebar (Desktop Only) / Top Header (Mobile) */}
        <View className="md:w-1/3 md:min-w-[340px] md:max-w-[420px] md:border-r md:border-black/5 dark:md:border-white/5 bg-white dark:bg-darkgrey pt-6 md:pt-16 px-6 md:px-12 flex-col justify-between z-10 shadow-sm md:shadow-none">
          <View>
            <Text className="text-charcoal dark:text-darkcharcoal text-3xl md:text-4xl font-extrabold tracking-tight">Provision</Text>
            <Text className="text-avocado text-sm md:text-base font-bold uppercase tracking-widest mt-1">Taste-Led Planning</Text>
            {/* Progress Indicators (Moved to sidebar on desktop, hidden on mobile here) */}
            <View className="hidden md:flex mt-12 pl-2">
              <View className="flex-row items-center mb-8">
                <View className={`w-8 h-8 rounded-full items-center justify-center mr-5 shadow-sm ${step >= 1 ? 'bg-avocado' : 'bg-gray-100'}`}>
                  <Text className={`font-bold text-sm ${step >= 1 ? 'text-white' : 'text-gray-400'}`}>1</Text>
                </View>
                <Text className={`font-bold text-lg ${step >= 1 ? 'text-charcoal dark:text-darkcharcoal' : 'text-gray-400 dark:text-gray-500'}`}>Taste Profile</Text>
              </View>

              <View className="flex-row items-center mb-8">
                <View className={`w-8 h-8 rounded-full items-center justify-center mr-5 shadow-sm ${step >= 2 ? 'bg-avocado' : 'bg-gray-100 dark:bg-gray-800'}`}>
                  <Text className={`font-bold text-sm ${step >= 2 ? 'text-white' : 'text-gray-400'}`}>2</Text>
                </View>
                <Text className={`font-bold text-lg ${step >= 2 ? 'text-charcoal dark:text-darkcharcoal' : 'text-gray-400 dark:text-gray-500'}`}>Dietary Baseline</Text>
              </View>

              <View className="flex-row items-center">
                <View className={`w-8 h-8 rounded-full items-center justify-center mr-5 shadow-sm ${step >= 3 ? 'bg-avocado' : 'bg-gray-100 dark:bg-gray-800'}`}>
                  <Text className={`font-bold text-sm ${step >= 3 ? 'text-white' : 'text-gray-400'}`}>3</Text>
                </View>
                <Text className={`font-bold text-lg ${step >= 3 ? 'text-charcoal dark:text-darkcharcoal' : 'text-gray-400 dark:text-gray-500'}`}>Plan Setup</Text>
              </View>
            </View>
          </View>

        </View>

        {/* Right Content Area (Forms/Selection) */}
        <View className="flex-1 relative bg-cream dark:bg-darkcream overflow-hidden md:min-h-0">
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            {/* Centered Content Wrapper - Accounts for absolute bottom CTA */}
            <View className="flex-1 w-full items-center justify-center px-4 md:px-8 pt-8 md:pt-12 pb-32 md:pb-40 min-h-full">

              {/* Progress Bar (Mobile Only) */}
              <View className="flex-row gap-2 mb-6 md:mb-10 max-w-sm mx-auto w-full md:hidden absolute top-6 flex-1 z-50 px-4">
                {[1, 2, 3].map((i) => (
                  <View key={i} className={`flex-1 h-2 rounded-full ${i <= step ? 'bg-avocado' : 'bg-charcoal/10'}`} />
                ))}
              </View>

              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </View>
          </ScrollView>

          {/* Persistent Bottom Action (Locks to bottom of right pane, integrated) */}
          <View className="px-6 py-6 md:px-12 md:py-8 border-t border-black/5 dark:border-white/5 bg-cream/95 dark:bg-darkcream/95 backdrop-blur-xl absolute bottom-0 w-full left-0 z-50">
            <View className="mx-auto w-full max-w-[940px] flex-row items-center justify-between">
              {/* Step counter or breadcrumb could go here for better balance */}
              <View className="hidden md:flex">
                <Text className="text-gray-400 font-bold uppercase tracking-[0.2em] text-[10px]">Step {step} of 3</Text>
              </View>

              <TouchableOpacity
                testID="calibration-continue-btn"
                onPress={handleNext}
                disabled={(step === 1 && selectedVibes.length < 3) || (step === 2 && !diet) || (step === 3 && !isSetupComplete)}
                className={`rounded-2xl py-4 px-10 md:py-4.5 md:px-14 items-center justify-center shadow-lg transition-all ${(step === 1 && selectedVibes.length < 3) || (step === 2 && !diet) || (step === 3 && !isSetupComplete)
                    ? 'bg-gray-300 dark:bg-gray-800 opacity-40'
                    : 'bg-charcoal dark:bg-white active:scale-[0.98] active:bg-black dark:active:bg-gray-200'
                  }`}
              >
                <Text className={`font-extrabold text-lg tracking-tight ${(step === 1 && selectedVibes.length < 3) || (step === 2 && !diet) || (step === 3 && !isSetupComplete)
                    ? 'text-gray-500'
                    : 'text-white dark:text-charcoal'
                  }`}>
                  {step === 3 ? "See My Plan" : "Continue"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

      </View>
    </SafeAreaView>
  );
}
