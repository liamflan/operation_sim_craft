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
      testID="recipe-card"
      style={{
        transform: [{ translateX: pan.x }],
        opacity: opacity,
      }}
      {...panResponder.panHandlers}
      className="mb-8"
    >
      <Pressable 
        testID="recipe-card-pressable"
        onPress={onPress}
        className="w-full h-80 md:h-56 rounded-[32px] overflow-hidden active:opacity-90 hover:opacity-95 transition-opacity duration-300 relative bg-black"
        style={{ backfaceVisibility: 'hidden' as any }}
      >
        {/* Branded fallback — shown when image is absent/slowly loading; looks intentional */}
        <View className="absolute inset-0" style={{ backgroundColor: '#C8B89A' }}>
          {/* Warm layered depth */}
          <View
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(145deg, #D4C4A0 0%, #B89A72 60%, #8B6F4E 100%)',
            } as any}
          />
          {/* Subtle radial highlight — top left */}
          <View
            className="absolute"
            style={{ top: -60, left: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,245,220,0.18)' }}
          />
          {/* Centre icon cluster */}
          <View className="absolute inset-0 items-center justify-center">
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                backgroundColor: 'rgba(255,255,255,0.12)',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.18)',
              }}
            >
              <FontAwesome5 name="utensils" size={22} color="rgba(255,255,255,0.7)" />
            </View>
          </View>
        </View>

        <Image 
          source={recipe.imageUrl} 
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backfaceVisibility: 'hidden' as any }}
          contentFit="cover"
          transition={600}
        />
        
        {/* Subtle Inner Top Highlight for depth - Removed as per user request to remove any faint edge/border */}
        {/* <View className="absolute top-0 left-0 right-0 h-[1.5px] bg-white/15 z-20" /> */}
        
        {/* Dedicated Desktop 'Swap' Button for Web mouse users */}
        {onSwipe && (
          <Pressable 
            testID="recipe-card-swap-desktop-btn"
            onPress={(e) => {
              e.stopPropagation();
              onSwipe();
            }}
            className="absolute top-4 right-4 z-30 bg-black/30 hover:bg-black/50 backdrop-blur-md px-3.5 h-9 rounded-full flex-row items-center border border-white/15 transition-colors"
          >
            <FontAwesome5 name="random" size={11} color="rgba(255,255,255,0.85)" className="mr-1.5" />
            <Text className="text-white/90 font-semibold text-xs tracking-wide">Swap</Text>
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
          <Text testID="recipe-card-title" className="text-white font-bold text-3xl md:text-4xl mb-2 tracking-tight leading-tight">
            {recipe.title}
          </Text>
          
          {/* Glassmorphism Pills area */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row flex-wrap gap-2">
              <View className="bg-black/20 px-3 py-1.5 rounded-full flex-row items-center border border-white/10 backdrop-blur-md">
                <FontAwesome5 name="clock" size={12} color="#6DBE75" />
                <Text className="text-white text-xs font-semibold ml-2">{recipe.prepTimeMinutes} Mins</Text>
              </View>
              
              <View className="bg-black/20 px-3 py-1.5 rounded-full flex-row items-center border border-white/10 backdrop-blur-md">
                <FontAwesome5 name="fire" size={12} color="#FF6B5A" />
                <Text className="text-white text-xs font-semibold ml-1">{recipe.macros.calories} kcal</Text>
              </View>

              <View className="bg-black/20 px-3 py-1.5 rounded-full flex-row items-center border border-white/10 backdrop-blur-md hidden sm:flex">
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
