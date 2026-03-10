import React, { useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, Animated, PanResponder, Dimensions, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Recipe } from '../data/schema';
import { useTheme } from './ThemeContext';

type Props = {
  recipe: Recipe;
  slotLabel?: string;
  /** Day string forwarded as query param, e.g. 'Monday' */
  day?: string;
  /** Slot string forwarded as query param, e.g. 'Dinner' */
  slot?: string;
  onPress?: () => void;
  onSwipe?: () => void;
};

const SCREEN_WIDTH = Dimensions.get('window').width;

// Subtle food-oriented fallback background tints — light + dark pairs (rotate between them for variety)
const FALLBACK_GRADIENTS_LIGHT: [string, string][] = [
  ['#E8F2E0', '#C8DFC0'],  // sage / herb — richer
  ['#F3E9DB', '#E5D5BE'],  // warm parchment
  ['#E3ECEC', '#C8DEDE'],  // muted teal
  ['#EEE8F5', '#DDD5EE'],  // soft lavender
  ['#F0EAD8', '#E2D5BD'],  // honey / oat
];

const FALLBACK_GRADIENTS_DARK: [string, string][] = [
  ['#243028', '#1A241D'],  // dark sage
  ['#2E2820', '#221E16'],  // dark parchment
  ['#1E2828', '#161E1E'],  // dark teal
  ['#28222E', '#1E1A24'],  // dark lavender
  ['#2A2418', '#1E1A10'],  // dark honey
];

// Deterministic gradient picker from recipe id
function getFallbackGradientLight(id: string): [string, string] {
  const numeric = parseInt(id.replace(/\D/g, ''), 10) || 0;
  return FALLBACK_GRADIENTS_LIGHT[numeric % FALLBACK_GRADIENTS_LIGHT.length];
}

function getFallbackGradientDark(id: string): [string, string] {
  const numeric = parseInt(id.replace(/\D/g, ''), 10) || 0;
  return FALLBACK_GRADIENTS_DARK[numeric % FALLBACK_GRADIENTS_DARK.length];
}

// Premium fallback used when imageUrl is missing or fails to load
function FallbackCard({ recipe, isDark }: { recipe: Recipe; isDark: boolean }) {
  const [lightStart, lightEnd] = getFallbackGradientLight(recipe.id);
  const [darkStart, darkEnd] = getFallbackGradientDark(recipe.id);
  const startColor = isDark ? darkStart : lightStart;
  const endColor = isDark ? darkEnd : lightEnd;

  // Icon tint is slightly different per variant so each card feels distinct
  const numeric = parseInt(recipe.id.replace(/\D/g, ''), 10) || 0;
  const foodIcons = ['utensils', 'carrot', 'fish', 'drumstick-bite', 'seedling'] as const;
  const iconName = foodIcons[numeric % foodIcons.length];

  const circleAlpha = isDark ? '0.08' : '0.20';
  const iconBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.50)';
  const iconBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.70)';

  return (
    <LinearGradient
      colors={[startColor, endColor]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ position: 'absolute', width: '100%', height: '100%' }}
    >
      {/* Large ambient circle — top-right */}
      <View
        style={{
          position: 'absolute',
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: `rgba(255,255,255,${circleAlpha})`,
          top: -70,
          right: -70,
        }}
      />
      {/* Medium circle — bottom-left */}
      <View
        style={{
          position: 'absolute',
          width: 140,
          height: 140,
          borderRadius: 70,
          backgroundColor: `rgba(255,255,255,${circleAlpha})`,
          bottom: -30,
          left: -40,
        }}
      />
      {/* Small accent circle — mid-left */}
      <View
        style={{
          position: 'absolute',
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: `rgba(157,205,139,${isDark ? '0.10' : '0.14'})`,
          top: '38%',
          left: '12%',
        }}
      />

      {/* Centered icon badge */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: iconBg,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: iconBorder,
            shadowColor: '#000',
            shadowOpacity: isDark ? 0.3 : 0.06,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 3 },
          }}
        >
          <FontAwesome5 name={iconName} size={24} color={isDark ? '#7AB868' : '#9DCD8B'} />
        </View>
      </View>
    </LinearGradient>
  );
}

export default function RecipeCard({ recipe, slotLabel, day, slot, onPress, onSwipe }: Props) {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  // Track whether the remote image has failed so we can suppress the broken-img UI entirely
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const handleImageError = useCallback(() => setImageLoadFailed(true), []);

  // Navigate to the dedicated recipe detail page
  const handleViewRecipe = () => {
    const params = new URLSearchParams();
    if (day) params.set('day', day);
    if (slot) params.set('slot', slot);
    const query = params.toString();
    router.push(`/recipe/${recipe.id}${query ? `?${query}` : ''}` as any);
  };
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
        {/* Premium fallback — always renders first, image crossfades over it once loaded */}
        <FallbackCard recipe={recipe} isDark={isDarkMode} />

        {/* Full Bleed Image — only rendered when URL exists AND hasn't errored.
            On error, imageLoadFailed flips to true, unmounting this element
            which ensures the browser's broken-image icon is never visible. */}
        {recipe.imageUrl && !imageLoadFailed ? (
          <Image
            source={recipe.imageUrl}
            style={{ width: '100%', height: '100%', position: 'absolute' }}
            contentFit="cover"
            transition={{ duration: 500, effect: 'cross-dissolve' }}
            onError={handleImageError}
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

            <Pressable
              testID="recipe-card-view-recipe-btn"
              onPress={(e) => { e.stopPropagation(); handleViewRecipe(); }}
              className="flex-row items-center opacity-90 bg-white/15 backdrop-blur-sm px-3.5 py-2 rounded-full border border-white/20 hover:bg-white/25 active:scale-95 transition-all pointer-events-auto"
            >
              <Text className="text-white font-medium text-[13px] mr-2">View Recipe</Text>
              <FontAwesome5 name="arrow-right" size={10} color="rgba(255,255,255,0.9)" />
            </Pressable>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}
