import React, { useRef } from 'react';
import { View, Text, Pressable, Animated, PanResponder, Dimensions, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { Recipe } from '../data/schema';

type Props = {
  recipe: Recipe;
  slotLabel?: string;
  onPress?: () => void;
  onSwipe?: () => void;
};

const SCREEN_WIDTH = Dimensions.get('window').width;

// Subtle food-oriented fallback background tints (rotate between them for variety)
const FALLBACK_GRADIENTS: [string, string][] = [
  ['#EEF4E8', '#D8EAD0'],  // sage / herb
  ['#F5EFE6', '#EDE0CC'],  // warm parchment
  ['#EBF0F0', '#D5E5E5'],  // muted teal
  ['#F2EDF5', '#E5DDEE'],  // soft lavender
  ['#F5F0E6', '#EAE0CC'],  // honey / oat
];

// Deterministic gradient picker from recipe id
function getFallbackGradient(id: string): [string, string] {
  const numeric = parseInt(id.replace(/\D/g, ''), 10) || 0;
  return FALLBACK_GRADIENTS[numeric % FALLBACK_GRADIENTS.length];
}

// Premium fallback used when imageUrl yields nothing
function FallbackCard({ recipe }: { recipe: Recipe }) {
  const [light, dark] = getFallbackGradient(recipe.id);
  return (
    <LinearGradient
      colors={[light, dark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ position: 'absolute', width: '100%', height: '100%' }}
    >
      {/* Faint circle decorations for depth */}
      <View
        style={{
          position: 'absolute',
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: 'rgba(255,255,255,0.18)',
          top: -60,
          right: -60,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 130,
          height: 130,
          borderRadius: 65,
          backgroundColor: 'rgba(255,255,255,0.12)',
          bottom: 20,
          left: -30,
        }}
      />

      {/* Centered icon treatment */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.45)',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.6)',
            shadowColor: '#000',
            shadowOpacity: 0.04,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <FontAwesome5 name="utensils" size={22} color="#9DCD8B" />
        </View>
      </View>
    </LinearGradient>
  );
}

export default function RecipeCard({ recipe, slotLabel, onPress, onSwipe }: Props) {
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
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (evt, gestureState) => {
        if (Math.abs(gestureState.dx) > 120) {
          Animated.timing(pan, {
            toValue: { x: Math.sign(gestureState.dx) * SCREEN_WIDTH, y: 0 },
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            if (onSwipe) onSwipe();
            pan.setValue({ x: 0, y: 0 });
          });
        } else {
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
        className="w-full h-64 md:h-[260px] rounded-3xl overflow-hidden active:scale-[0.99] transition-transform duration-300 relative shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-none dark:border dark:border-darksoftBorder"
      >
        {/* Premium fallback — always renders first, image fades over it */}
        <FallbackCard recipe={recipe} />

        {/* Full Bleed Image — crossfades in with expo-image transition */}
        {recipe.imageUrl ? (
          <Image
            source={recipe.imageUrl}
            style={{ width: '100%', height: '100%', position: 'absolute' }}
            contentFit="cover"
            transition={{ duration: 400, effect: 'cross-dissolve' }}
          />
        ) : null}

        {/* Top Controls Row */}
        <View className="absolute top-4 left-4 right-4 z-30 flex-row justify-between items-start pointer-events-none">
          {slotLabel ? (
            <View className="bg-white/10 dark:bg-black/20 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/30 dark:border-white/10 shadow-sm">
              <Text className="text-white text-[10px] font-bold uppercase tracking-widest">{slotLabel}</Text>
            </View>
          ) : <View />}

          {onSwipe && (
            <Pressable
              testID="recipe-card-swap-desktop-btn"
              onPress={(e) => {
                e.stopPropagation();
                onSwipe();
              }}
              className="bg-black/20 hover:bg-black/30 dark:bg-black/40 dark:hover:bg-black/60 backdrop-blur-md px-4 h-10 rounded-full flex-row items-center border border-white/20 dark:border-white/10 shadow-sm active:scale-95 transition-all pointer-events-auto"
            >
              <FontAwesome5 name="random" size={12} color="white" className="mr-2" />
              <Text className="text-white font-medium text-[13px] tracking-wide">Swap</Text>
            </Pressable>
          )}
        </View>

        {/* Swipe overlay feedback */}
        <Animated.View
          style={{ opacity: swipeOverlayOpacity }}
          className="absolute inset-0 bg-[#F4F7F2]/80 dark:bg-[#181C1A]/80 justify-center items-center z-20 pointer-events-none backdrop-blur-sm"
        >
          <View className="bg-white dark:bg-darksurface rounded-full px-6 py-4 flex-row items-center shadow-lg dark:shadow-sm border border-softBorder/50 dark:border-darksoftBorder">
            <FontAwesome5 name="random" size={18} color="#9DCD8B" />
            <Text className="text-textMain dark:text-darktextMain font-bold text-[16px] ml-3 tracking-widest uppercase">Swap Meal</Text>
          </View>
        </Animated.View>

        {/* Bottom gradient + content */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.7)']}
          locations={[0.5, 0.75, 1]}
          className="absolute inset-0 w-full h-full justify-end p-6 z-10"
        >
          <Text testID="recipe-card-title" className="text-white font-medium text-[28px] md:text-[32px] leading-[1.15] mb-4 tracking-tight">
            {recipe.title}
          </Text>

          <View className="flex-row items-center justify-between">
            <View className="flex-row flex-wrap gap-2.5">
              <View className="bg-white/20 dark:bg-black/30 backdrop-blur-md px-3.5 py-1.5 rounded-full flex-row items-center border border-white/20 dark:border-white/10">
                <FontAwesome5 name="clock" size={10} color="white" />
                <Text className="text-white text-[12px] font-medium ml-2">{recipe.prepTimeMinutes} Mins</Text>
              </View>

              <View className="bg-white/20 dark:bg-black/30 backdrop-blur-md px-3.5 py-1.5 rounded-full flex-row items-center border border-white/20 dark:border-white/10">
                <FontAwesome5 name="fire" size={10} color="white" />
                <Text className="text-white text-[12px] font-medium ml-2">{recipe.macros.calories} kcal</Text>
              </View>

              <View className="bg-white/20 dark:bg-black/30 backdrop-blur-md px-3.5 py-1.5 rounded-full flex-row items-center border border-white/20 dark:border-white/10">
                <FontAwesome5 name="seedling" size={10} color="white" />
                <Text className="text-white text-[12px] font-medium ml-2">{recipe.macros.protein}g Protein</Text>
              </View>
            </View>

            <View className="flex-row items-center opacity-90 p-2">
              <Text className="text-white/90 font-medium text-[13px] mr-2">View Recipe</Text>
              <FontAwesome5 name="arrow-right" size={10} color="rgba(255,255,255,0.9)" />
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}
