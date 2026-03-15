import React, { useMemo, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions, 
  Platform, 
  SafeAreaView,
  Image as RNImage,
  useWindowDimensions 
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MOCK_RECIPES } from '../../data/seed';

// Helper to normalize image sources for native stability
const getSafeSource = (imageUrl: any) => {
  if (!imageUrl) return null;
  if (typeof imageUrl === 'string') {
    const trimmed = imageUrl.trim();
    if (trimmed.startsWith('http')) return { uri: trimmed };
    if (Platform.OS === 'web') return { uri: trimmed }; // Handle local paths on web
  }
  if (typeof imageUrl === 'number') return imageUrl; // asset from require()
  return null;
};

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  // Find recipe from MOCK_RECIPES or handle not found
  const recipe = useMemo(() => MOCK_RECIPES.find(r => r.id === id), [id]);

  if (!recipe) {
    return (
      <View className="flex-1 items-center justify-center bg-appBg">
        <Text className="text-textSec font-medium">Recipe not found</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 px-6 py-2 bg-primary rounded-full">
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const safeHeroSource = getSafeSource(recipe.imageUrl);

  return (
    <SafeAreaView className="flex-1 bg-appBg dark:bg-darkappBg">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1">
          {/* Header Image Section */}
          <View className="h-[400px] relative w-full overflow-hidden">
            {Platform.OS !== 'web' ? (
              safeHeroSource ? (
                <RNImage 
                  source={safeHeroSource} 
                  style={{ width: '100%', height: '100%' }} 
                  resizeMode="cover"
                />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F4F0' }}>
                  <FontAwesome5 name="utensils" size={32} color="#CBD5E1" />
                </View>
              )
            ) : (
              safeHeroSource && (
                <Image 
                  source={safeHeroSource} 
                  style={{ width: '100%', height: '100%' }} 
                  contentFit="cover"
                />
              )
            )}
            
            <LinearGradient 
              colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.8)']} 
              className="absolute inset-0 z-10" 
            />

            {/* Back Button */}
            <View className="absolute top-6 left-6 z-20">
              <TouchableOpacity 
                onPress={() => router.back()}
                activeOpacity={0.7}
                className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md items-center justify-center border border-white/30"
              >
                <FontAwesome5 name="chevron-left" size={16} color="white" />
              </TouchableOpacity>
            </View>

            {/* Recipe Metadata Overlay */}
            <View className="absolute bottom-10 left-8 right-8 z-20">
              <View className="flex-row items-center mb-3">
                <View className="bg-primary px-3 py-1.5 rounded-lg mr-3 shadow-sm">
                  <Text className="text-white text-[11px] font-bold uppercase tracking-wider">{recipe.dietaryBaseline}</Text>
                </View>
                <View className="flex-row items-center bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20">
                  <FontAwesome5 name="clock" size={10} color="white" className="mr-2" />
                  <Text className="text-white text-[11px] font-bold uppercase tracking-wider">{recipe.totalMinutes}m</Text>
                </View>
              </View>
              <Text className="text-white text-[36px] font-medium tracking-tighter leading-tight shadow-xl">{recipe.title}</Text>
            </View>
          </View>

          {/* Content Area */}
          <View 
            className={`px-8 pt-12 pb-32 -mt-10 bg-appBg dark:bg-darkappBg rounded-t-[40px] z-30 shadow-2xl ${
              isDesktop ? 'max-w-4xl mx-auto' : ''
            }`}
          >
            {/* Macro Bar */}
            <View className="flex-row bg-surface dark:bg-darksurface rounded-[32px] p-8 justify-between border border-black/[0.03] dark:border-darksoftBorder shadow-[0_2px_12px_rgba(0,0,0,0.02)] mb-12">
               <View className="items-center flex-1">
                 <Text className="text-textMain dark:text-darktextMain text-[24px] font-semibold mb-1">{recipe.macrosPerServing.calories}</Text>
                 <Text className="text-textSec/50 text-[10px] font-bold uppercase tracking-widest">Calories</Text>
               </View>
               <View className="w-[1px] h-10 bg-black/[0.05] self-center" />
               <View className="items-center flex-1">
                 <Text className="text-textMain dark:text-darktextMain text-[24px] font-semibold mb-1">{recipe.macrosPerServing.protein}g</Text>
                 <Text className="text-textSec/50 text-[10px] font-bold uppercase tracking-widest">Protein</Text>
               </View>
               <View className="w-[1px] h-10 bg-black/[0.05] self-center" />
               <View className="items-center flex-1">
                 <Text className="text-textMain dark:text-darktextMain text-[24px] font-semibold mb-1">{recipe.macrosPerServing.fat}g</Text>
                 <Text className="text-textSec/50 text-[10px] font-bold uppercase tracking-widest">Fat</Text>
               </View>
            </View>

            {/* Description / Blurb */}
            <View className="mb-12 px-2">
               <Text className="text-textSec dark:text-darktextSec text-[16px] leading-relaxed font-medium">
                  {recipe.description || "A delicately balanced meal crafted by Provision\'s intelligence engine to align with your health targets and taste profile signals."}
               </Text>
            </View>

            {/* Ingredients Section */}
            <View className="mb-14">
              <View className="flex-row items-center mb-8 px-2">
                <View className="w-10 h-10 rounded-2xl bg-peach/10 items-center justify-center mr-4">
                  <FontAwesome5 name="shopping-basket" size={14} color="#D4A373" />
                </View>
                <View>
                   <Text className="text-textMain dark:text-darktextMain text-[22px] font-medium tracking-tight">Ingredients</Text>
                   <Text className="text-textSec/50 text-[11px] font-bold uppercase tracking-widest">Adjusted for your plan</Text>
                </View>
              </View>

              <View className="bg-surface dark:bg-darksurface rounded-[32px] overflow-hidden border border-black/[0.03] dark:border-darksoftBorder">
                {recipe.ingredients.map((ing, idx) => (
                   <View 
                    key={`${ing.name}-${idx}`}
                    className={`flex-row items-center justify-between px-8 py-5 ${
                      idx < recipe.ingredients.length - 1 ? 'border-b border-black/[0.03] dark:border-darksoftBorder' : ''
                    }`}
                   >
                     <View className="flex-row items-center flex-1 pr-4">
                        <View className="w-1.5 h-1.5 rounded-full bg-primary/30 mr-4" />
                        <Text className="text-textMain dark:text-darktextMain text-[17px] font-medium tracking-tight">{ing.name}</Text>
                     </View>
                     <Text className="text-textSec/60 font-medium text-[15px]">{ing.amount} {ing.unit}</Text>
                   </View>
                ))}
              </View>
            </View>

            {/* Instructions Title */}
            <View className="mb-8 px-2 flex-row items-center">
              <View className="w-10 h-10 rounded-2xl bg-avocado/10 items-center justify-center mr-4">
                 <FontAwesome5 name="utensils" size={14} color="#7BA96A" />
              </View>
              <Text className="text-textMain dark:text-darktextMain text-[22px] font-medium tracking-tight">How to make it</Text>
            </View>

            {/* Placeholder Instructions */}
            <View className="bg-surface dark:bg-darksurface rounded-[32px] p-8 border border-black/[0.03] dark:border-darksoftBorder">
               <View className="gap-y-8">
                 {[1, 2, 3].map((step) => (
                   <View key={step} className="flex-row">
                      <View className="mr-6 items-center">
                         <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center border border-primary/20">
                            <Text className="text-primary font-bold text-[13px]">{step}</Text>
                         </View>
                         {step < 3 && <View className="w-[1px] h-12 bg-black/[0.05] mt-3" />}
                      </View>
                      <View className="flex-1 pt-1">
                         <Text className="text-textMain dark:text-darktextMain font-medium text-[16px] leading-relaxed">
                            {step === 1 ? "Prep the core ingredients and organize your workspace for optimal efficiency." : 
                             step === 2 ? "Begin the primary cooking process, focusing on heat management and timing." : 
                             "Plate carefully and add your final seasoning touch before serving."}
                         </Text>
                      </View>
                   </View>
                 ))}
               </View>
            </View>

            {/* Global CTA */}
            <View className="mt-16 bg-primary dark:bg-sage px-8 py-10 rounded-[40px] items-center shadow-xl">
               <Text className="text-white text-[24px] font-medium text-center mb-2">Love this meal?</Text>
               <Text className="text-white/70 text-[15px] text-center mb-8 px-4 font-medium">Add it to your regulars to see it more often in your weekly plans.</Text>
               <TouchableOpacity 
                activeOpacity={0.7}
                className="bg-white px-10 py-5 rounded-full shadow-sm active:scale-95"
               >
                 <Text className="text-primary font-bold text-[16px]">Save to Regulars</Text>
               </TouchableOpacity>
            </View>

            {/* Related Recommendations Area */}
            <View className="mt-20">
              <View className="flex-row justify-between items-baseline mb-8 px-2">
                 <Text className="text-textMain dark:text-darktextMain text-[22px] font-medium tracking-tight">Similar to this</Text>
                 <TouchableOpacity activeOpacity={0.7}>
                    <Text className="text-primary font-bold text-[13px]">See All</Text>
                 </TouchableOpacity>
              </View>

              <View className="flex-row gap-4">
                {MOCK_RECIPES.filter(r => r.id !== recipe.id).slice(0, 2).map((item) => {
                  const safeItemImg = getSafeSource(item.imageUrl);
                  return (
                    <TouchableOpacity 
                      key={item.id}
                      onPress={() => router.push(`/recipe/${item.id}`)}
                      activeOpacity={0.8}
                      className="flex-1 h-[140px] rounded-[28px] overflow-hidden relative border border-black/[0.03] dark:border-darksoftBorder"
                    >
                      {Platform.OS !== 'web' ? (
                        safeItemImg ? (
                          <RNImage 
                            source={safeItemImg} 
                            style={{ width: '100%', height: '100%' }} 
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F4F0' }}>
                            <FontAwesome5 name="utensils" size={16} color="#CBD5E1" />
                          </View>
                        )
                      ) : (
                        safeItemImg && (
                          <Image 
                            source={safeItemImg} 
                            style={{ width: '100%', height: '100%' }} 
                            contentFit="cover"
                          />
                        )
                      )}
                      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} className="absolute inset-0 justify-end p-4">
                         <Text className="text-white font-medium text-[14px] leading-tight" numberOfLines={2}>{item.title}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

          </View>
        </View>
      </ScrollView>

      {/* Action Bar - Fixed Bottom (Mobile) or Sidebar (Desktop Context) */}
      {!isDesktop && (
        <View 
          className="absolute bottom-10 left-8 right-8 bg-surface dark:bg-darksurface px-8 py-5 rounded-[28px] flex-row items-center justify-between shadow-2xl border border-black/[0.02]"
        >
          <View>
             <Text className="text-textSec/40 text-[10px] uppercase font-bold tracking-widest">Est. Cost</Text>
             <Text className="text-textMain dark:text-darktextMain text-[20px] font-bold">£{recipe.estimatedCostPerServingGBP.toFixed(2)}</Text>
          </View>
          <TouchableOpacity 
            activeOpacity={0.7}
            className="bg-primary px-8 py-4 rounded-2xl shadow-sm"
          >
             <Text className="text-white font-bold text-[15px]">Cook This Now</Text>
          </TouchableOpacity>
        </View>
      )}

    </SafeAreaView>
  );
}
