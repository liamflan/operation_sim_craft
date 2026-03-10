import React, { useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, Animated, PanResponder, Dimensions, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Recipe } from '../data/schema';
import { NormalizedRecipe } from '../data/planner/plannerTypes';
import { useTheme } from './ThemeContext';

/** Flexible type for UI display that handles both legacy and normalized recipes */
type DisplayRecipe = (Recipe | NormalizedRecipe) & {
  // Common overrides often passed ad-hoc
  calories?: number;
  protein?: number;
  imageMetadata?: import('../data/planner/plannerTypes').RecipeImageMetadata;
};

type Props = {
  recipe: DisplayRecipe;
  slotLabel?: string;
  /** Day string forwarded as query param, e.g. 'Monday' */
  day?: string;
  slot?: string;
  isSkipped?: boolean;
  isGenerating?: boolean;
  pantryTransferStatus?: 'transferred' | null;
  onPress?: () => void;
  onSwipe?: () => void;
  onSkip?: () => void;
  onSkipAndKeep?: () => void;
  onUnskip?: () => void;
  onReplace?: () => void;
};

const SCREEN_WIDTH = Dimensions.get('window').width;

const FALLBACK_GRADIENTS_LIGHT: [string, string][] = [
  ['#84A98C', '#52796F'], // deep sage
  ['#DDA15E', '#BC6C25'], // spicy orange
  ['#E07A5F', '#3D405B'], // terracotta & deep blue
  ['#A8DADC', '#457B9D'], // fresh blue
  ['#9C6644', '#7F4F24'], // deep coffee/mocha
];

const FALLBACK_GRADIENTS_DARK: [string, string][] = [
  ['#2A3C24', '#1A241D'], // dark green
  ['#4A3B22', '#2E1C11'], // dark amber
  ['#3A2424', '#201616'], // dark crimson
  ['#1D2E30', '#121F22'], // deep ocean
  ['#30221E', '#1A1211'], // dark wood
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
function FallbackCard({ recipe, isDark }: { recipe: DisplayRecipe; isDark: boolean }) {
  const [lightStart, lightEnd] = getFallbackGradientLight(recipe.id);
  const [darkStart, darkEnd] = getFallbackGradientDark(recipe.id);
  const startColor = isDark ? darkStart : lightStart;
  const endColor = isDark ? darkEnd : lightEnd;

  const circleAlpha = isDark ? '0.15' : '0.25';

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
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: `rgba(255,255,255,${circleAlpha})`,
          top: -100,
          right: -80,
          transform: [{ scaleY: 1.2 }],
        }}
      />
      {/* Medium circle — bottom-left */}
      <View
        style={{
          position: 'absolute',
          width: 180,
          height: 180,
          borderRadius: 90,
          backgroundColor: `rgba(0,0,0,${isDark ? '0.2' : '0.05'})`,
          bottom: -60,
          left: -60,
        }}
      />
      {/* Small accent circle — mid-left */}
      <View
        style={{
          position: 'absolute',
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: `rgba(255,255,255,${isDark ? '0.05' : '0.1'})`,
          top: '38%',
          left: '12%',
        }}
      />
    </LinearGradient>
  );
}

export default function RecipeCard({ 
  recipe, slotLabel, day, slot, isSkipped, isGenerating, pantryTransferStatus, 
  onPress, onSwipe, onSkip, onSkipAndKeep, onUnskip, onReplace 
}: Props) {
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
    >
      <Pressable
        testID="recipe-card-pressable"
        onPress={isSkipped || isGenerating ? undefined : onPress}
        className={`w-full h-56 md:h-[220px] rounded-3xl overflow-hidden transition-transform duration-300 relative shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-none dark:border dark:border-darksoftBorder ${isSkipped ? 'opacity-50 grayscale' : 'active:scale-[0.99]'} transition-all duration-300`}
      >
        {/* Premium fallback — always renders first, image crossfades over it once loaded */}
        <FallbackCard recipe={recipe} isDark={isDarkMode} />

        {/* Full Bleed Image — only rendered when URL exists AND hasn't errored.
            On error, imageLoadFailed flips to true, unmounting this element
            which ensures the browser's broken-image icon is never visible.
            
            Phase 17: We also check imageAuditStatus. 
            'missing' or 'placeholder-match' forces fallback. */}
        {(recipe as any).imageUrl && !imageLoadFailed && 
         recipe.imageMetadata?.status !== 'missing' && 
         !recipe.imageMetadata?.reasons.includes('placeholder-match') ? (
          <Image
            source={(recipe as any).imageUrl}
            style={{ width: '100%', height: '100%', position: 'absolute' }}
            contentFit="cover"
            transition={{ duration: 500, effect: 'cross-dissolve' }}
            onError={handleImageError}
          />
        ) : null}

        {recipe.imageMetadata && 
         (recipe.imageMetadata.status === 'suspect' || recipe.imageMetadata.status === 'needs-review') && (
          <View className="absolute top-20 left-4 z-40 bg-amber-500/80 backdrop-blur-md px-2 py-0.5 rounded border border-white/20">
            <Text className="text-white text-[9px] font-bold uppercase tracking-widest">Audit: {recipe.imageMetadata.status}</Text>
          </View>
        )}

        {/* Top Controls Row */}
        <View className="absolute top-4 left-4 right-4 z-30 flex-row justify-between items-start pointer-events-none">
          {slotLabel ? (
            <View className="bg-white/10 dark:bg-black/20 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/30 dark:border-white/10 shadow-sm">
              <Text className="text-white text-[10px] font-bold uppercase tracking-widest">{slotLabel}</Text>
            </View>
          ) : <View />}

          {onSwipe && !isSkipped && (
            <View className="flex-row items-center gap-2 pointer-events-auto">
              <Pressable
                testID="recipe-card-swap-desktop-btn"
                onPress={(e) => {
                  e.stopPropagation();
                  onSwipe();
                }}
                className="bg-black/20 hover:bg-black/30 dark:bg-black/40 dark:hover:bg-black/60 backdrop-blur-md px-4 h-10 rounded-full flex-row items-center border border-white/20 dark:border-white/10 shadow-sm active:scale-95 transition-all"
              >
                <FontAwesome5 name="random" size={12} color="white" className="mr-2" />
                <Text className="text-white font-medium text-[13px] tracking-wide">Swap</Text>
              </Pressable>
              
              {onSkip && (
                <Pressable
                  testID="recipe-card-skip-btn"
                  onPress={(e) => {
                    e.stopPropagation();
                    onSkip();
                  }}
                  className="bg-red-500/20 hover:bg-red-500/30 dark:bg-red-900/40 dark:hover:bg-red-900/60 backdrop-blur-md px-4 h-10 rounded-full flex-row items-center border border-white/20 dark:border-white/10 shadow-sm active:scale-95 transition-all"
                >
                  <FontAwesome5 name="fast-forward" size={12} color="white" className="mr-2" />
                  <Text className="text-white font-medium text-[13px] tracking-wide">Skip</Text>
                </Pressable>
              )}
            </View>
          )}

          {isSkipped && (
            <View className="flex-row items-center gap-2 pointer-events-auto">
              {onReplace && (
                <Pressable
                  testID="recipe-card-replace-btn"
                  onPress={(e) => {
                    e.stopPropagation();
                    onReplace();
                  }}
                  className="bg-black/20 hover:bg-black/30 dark:bg-black/40 dark:hover:bg-black/60 backdrop-blur-md px-4 h-10 rounded-full flex-row items-center border border-white/20 dark:border-white/10 shadow-sm active:scale-95 transition-all"
                >
                  <FontAwesome5 name="random" size={12} color="white" className="mr-2" />
                  <Text className="text-white font-medium text-[13px] tracking-wide">Replace</Text>
                </Pressable>
              )}
              
              {onUnskip && (
                <Pressable
                  testID="recipe-card-unskip-btn"
                  onPress={(e) => {
                    e.stopPropagation();
                    onUnskip();
                  }}
                  className="bg-primary/20 hover:bg-primary/30 dark:bg-darksageTint/40 dark:hover:bg-darksageTint/60 backdrop-blur-md px-4 h-10 rounded-full flex-row items-center border border-white/20 dark:border-white/10 shadow-sm active:scale-95 transition-all"
                >
                  <FontAwesome5 name="undo" size={12} color="white" className="mr-2" />
                  <Text className="text-white font-medium text-[13px] tracking-wide">Restore</Text>
                </Pressable>
              )}
            </View>
          )}
          
          {isSkipped && (
            <View className="absolute top-16 right-4 sm:static sm:top-auto sm:right-auto bg-red-500/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/30 shadow-sm flex-row items-center">
               <FontAwesome5 name="ban" size={10} color="white" className="mr-2" />
               <Text className="text-white font-bold text-[11px] uppercase tracking-widest">Skipped</Text>
            </View>
          )}

          {isGenerating && (
            <View className="absolute top-16 right-4 sm:static sm:top-auto sm:right-auto bg-primary/80 dark:bg-darksageTint/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/30 shadow-sm flex-row items-center">
               <FontAwesome5 name="spinner" size={10} color="white" className="mr-2 animate-spin" />
               <Text className="text-white font-bold text-[11px] uppercase tracking-widest">Generating</Text>
            </View>
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
          colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.85)']}
          locations={[0.4, 0.7, 1]}
          className="absolute inset-0 w-full h-full justify-end p-5 md:p-6 z-10"
        >
          <Text testID="recipe-card-title" className="text-white font-medium text-[26px] md:text-[28px] leading-[1.1] mb-3 tracking-tight">
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
                <Text className="text-white text-[12px] font-medium ml-2">
                  {recipe.calories ?? (recipe as NormalizedRecipe).macrosPerServing?.calories ?? (recipe as Recipe).macros?.calories ?? 0} kcal
                </Text>
              </View>

              <View className="bg-white/20 dark:bg-black/30 backdrop-blur-md px-3.5 py-1.5 rounded-full flex-row items-center border border-white/20 dark:border-white/10">
                <FontAwesome5 name="seedling" size={10} color="white" />
                <Text className="text-white text-[12px] font-medium ml-2">
                  {recipe.protein ?? (recipe as NormalizedRecipe).macrosPerServing?.protein ?? (recipe as Recipe).macros?.protein ?? 0}g Protein
                </Text>
              </View>
            </View>

            {!isSkipped && (
              <Pressable
                testID="recipe-card-view-recipe-btn"
                onPress={(e) => { e.stopPropagation(); handleViewRecipe(); }}
                className="flex-row items-center opacity-90 bg-white/15 backdrop-blur-sm px-3.5 py-2 rounded-full border border-white/20 hover:bg-white/25 active:scale-95 transition-all pointer-events-auto"
              >
                <Text className="text-white font-medium text-[13px] mr-2">View Recipe</Text>
                <FontAwesome5 name="arrow-right" size={10} color="rgba(255,255,255,0.9)" />
              </Pressable>
            )}
            
            {isSkipped && pantryTransferStatus !== 'transferred' && onSkipAndKeep && (
              <Pressable
                testID="recipe-card-keep-ingredients-btn"
                onPress={(e) => { e.stopPropagation(); onSkipAndKeep(); }}
                className="flex-row items-center opacity-90 bg-sageTint/20 backdrop-blur-sm px-4 py-2 rounded-full border border-sageTint/40 hover:bg-sageTint/30 active:scale-95 transition-all pointer-events-auto"
              >
                <FontAwesome5 name="box-open" size={10} color="#9DCD8B" className="mr-2" />
                <Text className="text-[#9DCD8B] font-medium text-[13px]">Add Groceries to Pantry</Text>
              </Pressable>
            )}

            {isSkipped && pantryTransferStatus === 'transferred' && (
              <View
                className="flex-row items-center opacity-90 bg-[#9DCD8B] backdrop-blur-sm px-4 py-2 rounded-full border border-[#9DCD8B] pointer-events-auto"
              >
                <FontAwesome5 name="check" size={10} color="#1A1F1B" className="mr-2" />
                <Text className="text-[#1A1F1B] font-bold tracking-tight text-[13px]">Pantry Updated</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}
