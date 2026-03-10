import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Dimensions, ActivityIndicator, Animated } from 'react-native';
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
      <View className="w-full max-w-[940px]">
        
        {/* Header Block tightly integrated with count */}
        <View className="mb-6 md:mb-8 items-center md:items-start text-center md:text-left">
          <Text className="text-[32px] md:text-[44px] tracking-tight font-bold text-textMain dark:text-darktextMain mb-2 md:mb-3">
            What sounds good this week?
          </Text>
          <Text className="text-[15px] md:text-[17px] font-medium text-textSec dark:text-darktextSec mb-6 leading-relaxed max-w-[500px]">
            Pick 3 to 5 meals you'd actually want to eat. We use this to learn your baseline preferences.
          </Text>
          
          <View className="flex-row items-center bg-black/[0.03] dark:bg-white/[0.03] rounded-full p-1 border border-black/[0.04] dark:border-white/5 pr-4">
            <View className={`px-4 py-2 rounded-full ${selectedVibes.length >= 3 ? 'bg-primary shadow-sm' : 'bg-surface dark:bg-darksurface shadow-sm'}`}>
              <Text className={`font-bold text-[13px] tracking-wide ${selectedVibes.length >= 3 ? 'text-white' : 'text-textSec dark:text-darktextSec'}`}>
                {selectedVibes.length} {selectedVibes.length >= 5 ? 'of 5' : 'selected'}
              </Text>
            </View>
            <Text className="text-[13px] font-semibold text-textSec/80 dark:text-darktextSec/80 ml-4">
              {selectedVibes.length < 3 ? `Pick ${3 - selectedVibes.length} more` : "Perfect. We're learning your taste."}
            </Text>
          </View>
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
                className={`w-[48.5%] md:w-[31.5%] h-52 md:h-[190px] lg:h-[240px] rounded-[24px] overflow-hidden relative transition-all bg-surface dark:bg-darksurface border border-black/[0.04] dark:border-white/5 ${isSelected ? 'scale-[0.98] ring-4 ring-primary ring-offset-2 ring-offset-appBg dark:ring-offset-darkappBg shadow-md' : 'hover:shadow-md hover:scale-[0.99] active:scale-[0.98]'}`}
              >
                {/* Intentional Fallback Card */}
                <View className="absolute inset-0 bg-sageTint dark:bg-[#2A332E]">
                  <View className="absolute inset-0 opacity-40">
                    <LinearGradient
                      colors={['transparent', 'rgba(157,205,139,0.3)']}
                      className="absolute inset-0"
                    />
                  </View>
                  <View className="absolute inset-0 items-center justify-center">
                    <View className="w-12 h-12 rounded-[14px] bg-white/40 dark:bg-black/20 items-center justify-center border border-white/50 dark:border-white/10 shadow-sm">
                      <FontAwesome5 name="utensils" size={18} color="#9DCD8B" />
                    </View>
                  </View>
                </View>

                {recipe.imageUrl && (
                  <Image source={recipe.imageUrl} style={{ width: '100%', height: '100%', position: 'absolute' }} contentFit="cover" transition={500} />
                )}

                <View className={`absolute inset-0 justify-center items-center transition-colors duration-300 ${isSelected ? 'bg-primary/20 dark:bg-primary/30' : 'bg-black/10'}`}>
                  {isSelected && (
                    <View className="absolute top-4 right-4 bg-primary dark:bg-primary shadow-lg rounded-full w-8 h-8 items-center justify-center transform scale-100">
                      <FontAwesome5 name="check" size={12} color="white" />
                    </View>
                  )}
                </View>

                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']} locations={[0, 0.5, 1]} className="absolute bottom-0 w-full h-[65%] justify-end p-5 rounded-b-[24px]">
                  <Text className="text-white font-bold text-[17px] md:text-[19px] leading-snug tracking-tight text-shadow-sm">{recipe.title}</Text>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );

  const renderStep2 = () => {
    const dietOptions = [
      { label: 'Omnivore', icon: 'drumstick-bite', description: 'Includes meat, fish, dairy, and eggs' },
      { label: 'Pescatarian', icon: 'fish', description: 'No meat, but fish is in' },
      { label: 'Vegetarian', icon: 'carrot', description: 'No meat or fish' },
      { label: 'Vegan', icon: 'leaf', description: 'No animal products' }
    ];

    return (
      <View className="flex-1 w-full items-center justify-center">
        <View className="w-full max-w-[860px]">
          <View className="mb-8 md:mb-12 items-center md:items-start text-center md:text-left">
            <Text className="text-[32px] md:text-[44px] font-bold tracking-tight text-textMain dark:text-darktextMain mb-2 md:mb-3">How do you eat?</Text>
            <Text className="text-[15px] md:text-[17px] font-medium text-textSec dark:text-darktextSec leading-relaxed">We'll use this as the baseline rule for your meal setup.</Text>
          </View>

          <View className="flex-row flex-wrap justify-between gap-y-4 md:gap-y-5">
            {dietOptions.map((option) => {
              const isActive = diet === option.label;
              return (
                <TouchableOpacity
                  key={option.label}
                  testID={`calibration-diet-card-${option.label.toLowerCase()}`}
                  onPress={() => setDiet(option.label)}
                  activeOpacity={0.8}
                  className={`p-6 md:p-7 rounded-[28px] w-full md:w-[48.5%] transition-all border ${
                    isActive
                      ? 'bg-primary/5 dark:bg-primary/10 border-primary shadow-sm scale-[0.99]'
                      : 'bg-surface dark:bg-darksurface border-black/[0.04] dark:border-white/5 hover:border-black/10 dark:hover:border-white/10 hover:shadow-sm active:scale-[0.99]'
                  }`}
                >
                  <View className="flex-row justify-between items-center mb-4">
                    <View className={`w-12 h-12 rounded-[16px] items-center justify-center ${isActive ? 'bg-primary/10 dark:bg-primary/20' : 'bg-black/[0.04] dark:bg-white/[0.04]'}`}>
                      <FontAwesome5 name={option.icon} size={18} color={isActive ? '#9DCD8B' : '#8C9A90'} />
                    </View>
                    {isActive ? (
                      <View className="bg-primary rounded-full w-6 h-6 items-center justify-center shadow-sm">
                        <FontAwesome5 name="check" size={10} color="white" />
                      </View>
                    ) : (
                      <View className="w-6 h-6 rounded-full border-2 border-black/[0.08] dark:border-white/10" />
                    )}
                  </View>
                  <Text className={`text-[20px] md:text-[22px] font-bold tracking-tight mb-1.5 ${isActive ? 'text-primary dark:text-[#85B674]' : 'text-textMain dark:text-darktextMain'}`}>
                    {option.label}
                  </Text>
                  <Text className={`font-medium text-[14px] leading-relaxed ${isActive ? 'text-textMain/80 dark:text-darktextMain/80' : 'text-textSec dark:text-darktextSec'}`}>
                    {option.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View className="mt-8 md:mt-10 items-center md:items-start">
            <TouchableOpacity 
              testID="calibration-skip-exclusions-btn" 
              className="px-6 py-3 rounded-full bg-black/[0.03] dark:bg-white/[0.03] hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-colors border border-black/[0.04] dark:border-white/5"
            >
              <Text className="text-textSec dark:text-darktextSec font-semibold text-[13px] tracking-wide">Skip exclusions for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderStep3 = () => (
    <View className="flex-1 w-full items-center justify-center">
      <View className="w-full max-w-[600px]">
        {/* Generation Header */}
        <View className="items-center mb-10">
          <View className="relative mb-5 items-center justify-center">
            {/* Main Visual: Compact, premium disc */}
            <View 
              style={{ width: isSetupComplete ? 96 : 80, height: isSetupComplete ? 96 : 80 }}
              className={`rounded-full items-center justify-center relative transition-all duration-700 ${
                isSetupComplete 
                  ? 'bg-primary shadow-[0_4px_12px_rgba(157,205,139,0.25)] dark:shadow-none' 
                  : 'bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/10'
              }`}
            >
              {isSetupComplete ? (
                <FontAwesome5 name="check" size={32} color="white" />
              ) : (
                <>
                  <ActivityIndicator size="small" color="#9DCD8B" style={{ transform: [{ scale: 1.2 }] }} />
                  {/* Leaf icon in center stays subtle */}
                  <View className="absolute w-9 h-9 bg-surface dark:bg-[#2A332E] rounded-full items-center justify-center shadow-sm border border-black/[0.04] dark:border-white/10">
                    <FontAwesome5 name="leaf" size={12} color="#9DCD8B" />
                  </View>
                </>
              )}
            </View>
          </View>

          <Text className="text-[28px] md:text-[34px] font-bold text-textMain dark:text-darktextMain tracking-tight mb-4 text-center">
            {isSetupComplete ? 'Your plan is ready.' : 'Shaping your week...'}
          </Text>
          <View className="min-h-[32px] justify-center mb-0 px-5 bg-black/[0.03] dark:bg-white/[0.04] rounded-full border border-black/[0.04] dark:border-white/5 mx-auto">
            <Text className={`font-semibold text-[13px] text-center transition-colors duration-300 ${isSetupComplete ? 'text-primary dark:text-[#85B674]' : 'text-textMain/70 dark:text-darktextMain/70'}`}>
              {loadingMessages[loadingStage]}
            </Text>
          </View>
        </View>

        {/* Integrated Profile Summary Card */}
        <View className="w-full bg-surface dark:bg-darksurface rounded-[32px] p-7 md:p-8 shadow-[0_2px_16px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/[0.04] dark:border-white/5 overflow-hidden relative">
          {/* Subtle decoration */}
          <View className="absolute -top-10 -right-10 w-40 h-40 bg-sageTint/40 dark:bg-darksageTint/20 rounded-full" style={{ filter: 'blur(40px)' } as any} />
          
          <View className="flex-row items-center mb-6 border-b border-black/[0.04] dark:border-white/5 pb-5">
            <View className="w-10 h-10 rounded-[14px] bg-primary/10 dark:bg-primary/20 items-center justify-center mr-4">
              <FontAwesome5 name="fingerprint" size={16} color="#9DCD8B" />
            </View>
            <View>
              <Text className="text-[11px] font-bold text-textSec/60 dark:text-darktextSec/60 uppercase tracking-[0.15em] mb-0.5">Provision DNA</Text>
              <Text className="text-textMain dark:text-darktextMain font-bold text-[18px] tracking-tight">Your New Profile</Text>
            </View>
          </View>

          <View className="flex-row flex-wrap">
            <View className="w-1/2 mb-6">
              <Text className="text-textSec dark:text-darktextSec text-[11px] font-bold uppercase tracking-widest mb-1.5">Taste Anchors</Text>
              <Text className="text-textMain dark:text-darktextMain font-bold text-[18px]">{selectedVibes.length} Picks</Text>
            </View>
            <View className="w-1/2 mb-6 pl-4 border-l border-black/[0.04] dark:border-white/5">
              <Text className="text-textSec dark:text-darktextSec text-[11px] font-bold uppercase tracking-widest mb-1.5">Baseline</Text>
              <Text className="text-textMain dark:text-darktextMain font-bold text-[18px]">{diet || 'Omnivore'}</Text>
            </View>
            <View className="w-1/2">
              <Text className="text-textSec dark:text-darktextSec text-[11px] font-bold uppercase tracking-widest mb-1.5">Budget Target</Text>
              <Text className="text-textMain dark:text-darktextMain font-bold text-[18px]">£50 <Text className="text-[13px] font-medium text-textSec/60">(avg)</Text></Text>
            </View>
            <View className="w-1/2 pl-4 border-l border-black/[0.04] dark:border-white/5">
              <Text className="text-textSec dark:text-darktextSec text-[11px] font-bold uppercase tracking-widest mb-1.5">Fueling</Text>
              <Text className="text-textMain dark:text-darktextMain font-bold text-[18px]">160g P <Text className="text-[13px] font-medium text-textSec/60">/day</Text></Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView testID="calibration-screen" className="flex-1 bg-appBg dark:bg-darkappBg">
      {/* ─── Desktop Split Layout ─── */}
      <View className="flex-1 md:flex-row">

        {/* ─── Left Sidebar (Desktop Only) / Top Header (Mobile) ─── */}
        <View className="md:w-1/3 md:min-w-[320px] md:max-w-[380px] md:border-r md:border-softBorder dark:md:border-white/5 bg-surface dark:bg-darksurface pt-6 md:pt-16 pb-8 md:pb-12 px-6 md:px-12 flex-col justify-between z-10 shadow-[0_4px_24px_rgba(0,0,0,0.02)] md:shadow-none">
          <View>
            <Text className="text-textMain dark:text-darktextMain text-[28px] md:text-[34px] font-bold tracking-tight mb-0.5">Provision</Text>
            <Text className="text-primary dark:text-[#85B674] text-[11px] font-bold uppercase tracking-[0.15em]">Taste-Led Planning</Text>
            
            {/* ─── Progress Indicators (Sidebar on desktop) ─── */}
            <View className="hidden md:flex mt-16 pl-1 pr-4 relative">
              {[
                { number: 1, label: 'Taste Profile' },
                { number: 2, label: 'Dietary Baseline' },
                { number: 3, label: 'Plan Setup' }
              ].map((s, idx) => {
                const isActive = step === s.number;
                const isCompleted = step > s.number;

                return (
                  <View key={s.number}>
                    <View className="flex-row items-center relative z-10">
                      <View 
                        className={`w-[34px] h-[34px] rounded-full flex items-center justify-center mr-4 transition-colors duration-300 ${
                          isActive ? 'bg-primary dark:bg-[#85B674] shadow-[0_2px_12px_rgba(157,205,139,0.3)]' :
                          isCompleted ? 'bg-sageTint dark:bg-darksageTint' :
                          'bg-appBg dark:bg-darkgrey border border-softBorder dark:border-white/5'
                        }`}
                      >
                        {isCompleted ? (
                          <FontAwesome5 name="check" size={12} color="#9DCD8B" />
                        ) : (
                          <Text className={`text-[13px] font-bold ${isActive ? 'text-white' : 'text-textSec/60 dark:text-darktextSec/60'}`}>
                            {s.number}
                          </Text>
                        )}
                      </View>
                      <Text className={`text-[16px] font-bold tracking-tight transition-colors duration-300 ${
                        isActive ? 'text-textMain dark:text-darktextMain' : 
                        isCompleted ? 'text-textMain/70 dark:text-darktextMain/70' : 
                        'text-textSec/40 dark:text-darktextSec/40'
                      }`}>
                        {s.label}
                      </Text>
                    </View>
                    
                    {/* Clean segmented connector line */}
                    {idx < 2 && (
                      <View className="ml-[16px] w-[2px] h-[36px] my-1 bg-black/[0.04] dark:bg-white/[0.04] relative z-0">
                        {/* Active fill */}
                        <View 
                          className="absolute top-0 left-0 w-full bg-primary transition-all duration-500" 
                          style={{ height: step > s.number ? '100%' : '0%' } as any} 
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Debug Control pinned to bottom of sidebar nicely */}
          <TouchableOpacity 
            testID="calibration-skip-debug-btn"
            onPress={handleDebugSkip}
            className="hidden md:flex flex-row items-center opacity-50 hover:opacity-100 transition-opacity self-start py-2"
          >
            <FontAwesome5 name="fast-forward" size={10} color="#8C9A90" className="mr-2" />
            <Text className="text-[11px] font-bold text-textSec dark:text-[#6E7C74] uppercase tracking-widest">Dev Skip</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Right Content Area (Forms/Selection) ─── */}
        <View className="flex-1 relative bg-appBg dark:bg-darkappBg overflow-hidden md:min-h-0">
          
          {/* Mobile Top Progress Bar */}
          <View className="flex-row gap-1.5 md:hidden px-6 pt-5 pb-3 bg-surface dark:bg-darksurface z-20 shadow-sm border-b border-black/[0.04] dark:border-white/5">
            {[1, 2, 3].map((i) => (
              <View key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-black/[0.04] dark:bg-white/[0.05]'}`} />
            ))}
          </View>

          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            {/* Centered Content Wrapper - Accounts for absolute bottom CTA */}
            <View className="flex-1 w-full items-center justify-center px-5 md:px-10 pt-6 md:pt-12 pb-32 md:pb-40 min-h-full">
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </View>
          </ScrollView>

          {/* ─── Persistent Bottom Action Area ─── */}
          <View className="px-6 py-5 md:px-12 md:py-6 border-t border-black/[0.05] dark:border-white/5 bg-surface/95 dark:bg-darksurface/95 absolute bottom-0 w-full left-0 z-50 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]" style={{ backdropFilter: 'blur(12px)' } as any}>
            <View className="mx-auto w-full max-w-[940px] flex-row items-center justify-between">
              
              <View className="hidden md:flex flex-row items-center">
                <Text className="text-[12px] font-bold uppercase tracking-widest text-textSec/60 dark:text-darktextSec/60">
                  Step {step} <Text className="opacity-50">/ 3</Text>
                </Text>
              </View>

              <TouchableOpacity
                testID="calibration-continue-btn"
                onPress={handleNext}
                disabled={(step === 1 && selectedVibes.length < 3) || (step === 2 && !diet) || (step === 3 && !isSetupComplete)}
                className={`rounded-full py-4 px-12 md:py-4 md:px-14 items-center justify-center transition-all flex-row ${
                  (step === 1 && selectedVibes.length < 3) || (step === 2 && !diet) || (step === 3 && !isSetupComplete)
                    ? 'bg-black/[0.04] dark:bg-white/[0.05]'
                    : 'bg-primary hover:bg-primary-hover active:scale-[0.98] shadow-[0_4px_16px_rgba(157,205,139,0.3)]'
                }`}
              >
                <Text className={`text-[16px] font-bold tracking-tight ${(step === 1 && selectedVibes.length < 3) || (step === 2 && !diet) || (step === 3 && !isSetupComplete) ? 'text-textSec/50 dark:text-darktextSec/50' : 'text-white'}`}>
                  {step === 3 ? "See My Plan" : "Continue"}
                </Text>
                {step < 3 && !((step === 1 && selectedVibes.length < 3) || (step === 2 && !diet)) && (
                  <FontAwesome5 name="arrow-right" size={12} color="white" style={{ marginLeft: 10, marginTop: 1 }} />
                )}
              </TouchableOpacity>
              
              {/* Mobile Dev Skip */}
              <TouchableOpacity 
                testID="calibration-skip-debug-btn-mob"
                onPress={handleDebugSkip}
                className="md:hidden p-3 opacity-50 absolute right-6"
              >
                <FontAwesome5 name="fast-forward" size={14} color="#8C9A90" />
              </TouchableOpacity>

            </View>
          </View>
        </View>

      </View>
    </SafeAreaView>
  );
}
