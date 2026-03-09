import React, { useRef } from 'react';
import { View, Text, Pressable, Animated, PanResponder, Dimensions, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { Recipe } from '../data/schema';

type Props = {
  recipe: Recipe;
  onPress?: () => void;
  onSwipe?: () => void;
};

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function RecipeCard({ recipe, onPress, onSwipe }: Props) {
  const pan = useRef(new Animated.ValueXY()).current;
  const opacity = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 3, 0, SCREEN_WIDTH / 3],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  const swipeOverlayOpacity = pan.x.interpolate({
    inputRange: [-100, -20, 0, 20, 100],
    outputRange: [1, 0, 0, 0, 1],
    extrapolate: 'clamp',
  });

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only trigger pan if horizontal movement > vertical movement (prevents blocking scroll)
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x }],
        { useNativeDriver: false } // 'false' because we want to animate layout properties if needed, though for transform true is better, but this is fine for MVP
      ),
      onPanResponderRelease: (evt, gestureState) => {
        if (Math.abs(gestureState.dx) > 120) {
          // Swiped far enough, trigger swap
          Animated.timing(pan, {
            toValue: { x: Math.sign(gestureState.dx) * SCREEN_WIDTH, y: 0 },
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            if (onSwipe) onSwipe();
            // Reset position instantly after swap
            pan.setValue({ x: 0, y: 0 });
          });
        } else {
          // Snap back
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View 
      style={{
        transform: [{ translateX: pan.x }],
        opacity: opacity,
      }}
      {...panResponder.panHandlers}
      className="mb-8"
    >
      <Pressable 
        onPress={onPress}
        className="w-full h-80 md:h-56 rounded-[32px] overflow-hidden active:opacity-90 hover:opacity-95 md:hover:scale-[1.02] transition-all duration-300 relative shadow-2xl bg-gray-200 dark:bg-darkgrey"
      >
        <Image 
          source={recipe.imageUrl} 
          style={{ width: '100%', height: '100%', position: 'absolute' }}
          contentFit="cover"
          transition={600}
        />
        
        {/* Dedicated Desktop 'Swap' Button for Web mouse users */}
        {onSwipe && (
          <Pressable 
            onPress={(e) => {
              e.stopPropagation(); // Prevent opening the recipe
              onSwipe();
            }}
            className="absolute top-4 right-4 z-30 bg-black/40 hover:bg-white dark:hover:bg-darkgrey backdrop-blur-md px-4 h-10 rounded-full flex-row items-center border border-white/20 transition-colors group"
          >
            <FontAwesome5 name="random" size={12} color="white" className="group-hover:text-avocado dark:group-hover:text-white mr-2" />
            <Text className="text-white group-hover:text-charcoal dark:group-hover:text-white font-bold text-sm tracking-wide">Swap</Text>
          </Pressable>
        )}

        {/* Swipe overlay (appears when dragging natively) */}
        <Animated.View 
          style={{ opacity: swipeOverlayOpacity }} 
          className="absolute inset-0 bg-avocado/80 justify-center items-center z-20 pointer-events-none"
        >
          <View className="bg-white dark:bg-darkgrey rounded-full p-4 flex-row items-center shadow-lg">
            <FontAwesome5 name="random" size={24} color="#6DBE75" />
            <Text className="text-avocado font-extrabold text-xl ml-3">SWAP MEAL</Text>
          </View>
        </Animated.View>

        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.9)']}
          locations={[0, 0.4, 1]}
          className="absolute inset-0 w-full h-full justify-end p-6 z-10"
        >
          <Text className="text-white font-bold text-3xl md:text-4xl mb-2 tracking-tight leading-tight shadow-md">
            {recipe.title}
          </Text>
          
          {/* Glassmorphism Pills area */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row flex-wrap gap-2">
              <View className="bg-white/20 px-3 py-1.5 rounded-full flex-row items-center border border-white/20 backdrop-blur-md">
                <FontAwesome5 name="clock" size={12} color="#6DBE75" />
                <Text className="text-white text-xs font-semibold ml-2">{recipe.prepTimeMinutes} Mins</Text>
              </View>
              
              <View className="bg-white/20 px-3 py-1.5 rounded-full flex-row items-center border border-white/20 backdrop-blur-md">
                <FontAwesome5 name="fire" size={12} color="#FF6B5A" />
                <Text className="text-white text-xs font-semibold ml-1">{recipe.macros.calories} kcal</Text>
              </View>

              <View className="bg-white/20 px-3 py-1.5 rounded-full flex-row items-center border border-white/20 backdrop-blur-md hidden sm:flex">
                <FontAwesome5 name="dumbbell" size={12} color="#4F7FFF" />
                <Text className="text-white text-xs font-semibold ml-1">{recipe.macros.protein}g P</Text>
              </View>
            </View>

            <View className="flex-row items-center opacity-80 pl-2">
              <Text className="text-white font-semibold text-xs mr-1 hidden sm:flex">View Recipe</Text>
              <FontAwesome5 name="chevron-right" size={10} color="white" />
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}
