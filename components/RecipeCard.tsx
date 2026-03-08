import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { Recipe } from '../data/schema';

type Props = {
  recipe: Recipe;
  onPress?: () => void;
};

export default function RecipeCard({ recipe, onPress }: Props) {
  return (
    <Pressable 
      onPress={onPress}
      className="w-full h-80 rounded-[32px] overflow-hidden mb-8 active:opacity-90 hover:opacity-95 md:hover:scale-[1.02] transition-all duration-300 relative shadow-2xl"
    >
      <Image 
        source={recipe.imageUrl} 
        style={{ width: '100%', height: '100%', position: 'absolute' }}
        contentFit="cover"
        transition={600}
      />
      
      {/* Dark gradient mapping bottom up for text readability */}
      <LinearGradient
        colors={['transparent', 'rgba(44,44,44,0.95)']}
        className="absolute bottom-0 w-full h-1/2 justify-end p-6"
      >
        <Text className="text-white font-bold text-3xl mb-3 tracking-tight leading-tight shadow-md">
          {recipe.title}
        </Text>
        
        {/* Glassmorphism Pills area */}
        <View className="flex-row flex-wrap gap-2 mt-1">
          <View className="bg-white/20 px-3 py-1.5 rounded-full flex-row items-center border border-white/20 backdrop-blur-md">
            <FontAwesome5 name="clock" size={12} color="#6DBE75" />
            <Text className="text-white text-xs font-semibold ml-2">{recipe.prepTimeMinutes} Mins</Text>
          </View>
          
          <View className="bg-white/20 px-3 py-1.5 rounded-full flex-row items-center border border-white/20 backdrop-blur-md">
            <FontAwesome5 name="fire" size={12} color="#FF6B5A" />
            <Text className="text-white text-xs font-semibold ml-1">{recipe.macros.calories} kcal</Text>
          </View>

          <View className="bg-white/20 px-3 py-1.5 rounded-full flex-row items-center border border-white/20 backdrop-blur-md">
            <FontAwesome5 name="dumbbell" size={12} color="#4F7FFF" />
            <Text className="text-white text-xs font-semibold ml-1">{recipe.macros.protein}g P</Text>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}
