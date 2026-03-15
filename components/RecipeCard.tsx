import React, { useRef, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, Animated, PanResponder, Dimensions, Platform, ActivityIndicator, TouchableOpacity, GestureResponderEvent, Image as RNImage } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
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
  isLocked?: boolean;
  isGenerating?: boolean;
  pantryTransferStatus?: 'transferred' | null;
  variant?: 'desktop' | 'mobile';
  onPress?: () => void;
  onSwipe?: () => void;
  onSkip?: () => void;
  onSkipAndKeep?: () => void;
  onUnskip?: () => void;
  onReplace?: () => void;
  onLock?: () => void;
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

const TOKENS = {
  colors: {
    primary: '#8ca18f',
  }
};

// Helper to normalize image sources for native stability
const getSafeSource = (imageUrl: any) => {
  if (!imageUrl) return null;
  if (typeof imageUrl === 'string' && imageUrl.trim().startsWith('http')) {
    return { uri: imageUrl };
  }
  if (typeof imageUrl === 'number') {
    return imageUrl; // Local require()
  }
  return null;
};

export default function RecipeCard({ 
  recipe, slotLabel, day, slot, isSkipped, isLocked, isGenerating, pantryTransferStatus, 
  variant = 'desktop', onPress, onSwipe, onSkip, onSkipAndKeep, onUnskip, onReplace, onLock 
}: Props) {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const handleImageError = useCallback(() => setImageLoadFailed(true), []);

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

  // STRICT IMAGE NORMALIZATION for both paths
  const safeImageSource = useMemo(() => getSafeSource((recipe as any).imageUrl), [(recipe as any).imageUrl]);

  // HARD RUNTIME FIX: MOBILE VARIANT (Robust Image + No Unsafe Transforms)
  if (variant === 'mobile') {
    const calories = recipe.calories ?? (recipe as NormalizedRecipe).macrosPerServing?.calories ?? (recipe as Recipe).macros?.calories ?? 0;
    const minutes = (recipe as any).totalTimeMinutes || (recipe as any).totalMinutes || 30;
    const archetype = (recipe as any).archetype || 'Healthy';
    
    // Header Style Mapping (Primary Identification)
    const slotColors: Record<string, string> = {
      'BREAKFAST': '#fef3c7', // amber-100
      'LUNCH': '#dcfce7',     // green-100
      'DINNER': '#e0f2fe',    // sky-100
    };
    const slotTextColors: Record<string, string> = {
      'BREAKFAST': '#92400e', // amber-800
      'LUNCH': '#166534',     // green-800
      'DINNER': '#075985',    // sky-800
    };

    const displaySlot = (slotLabel || slot || 'Meal').toUpperCase();
    const headerBg = slotColors[displaySlot] || '#f1f5f9';
    const headerText = slotTextColors[displaySlot] || '#475569';

    return (
      <TouchableOpacity 
        activeOpacity={0.8}
        onPress={isSkipped || isGenerating ? undefined : handleViewRecipe}
        className={`mb-6 rounded-[24px] bg-white shadow-sm border border-slate-100 overflow-hidden ${isSkipped ? 'opacity-70 grayscale' : ''}`}
      >
        {/* Card Header - SLOT INFO */}
        <View className="px-5 py-3.5 flex-row justify-between items-center border-b border-slate-50">
          <View className="flex-row items-center gap-2.5">
            <View 
              style={{ backgroundColor: headerBg }}
              className="px-3 py-1 rounded-full"
            >
              <Text style={{ color: headerText }} className="text-[10px] font-bold tracking-[0.05em]">{displaySlot}</Text>
            </View>
            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{day}</Text>
          </View>
          
          <View className="flex-row items-center gap-2">
            {!isSkipped && (
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={(e: GestureResponderEvent) => {
                  e.stopPropagation();
                  onLock?.();
                }}
                className={`size-8 rounded-full items-center justify-center ${isLocked ? 'bg-primary' : 'bg-slate-50 border border-slate-100'}`}
              >
                <FontAwesome5 name={isLocked ? "lock" : "lock-open"} size={11} color={isLocked ? 'white' : '#94a3b8'} />
              </TouchableOpacity>
            )}
            {!isSkipped && (
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={(e: GestureResponderEvent) => {
                  e.stopPropagation();
                  onSwipe?.();
                }}
                className="size-8 rounded-full bg-slate-50 border border-slate-100 items-center justify-center"
              >
                <FontAwesome5 name="random" size={12} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>
 
        <View className="p-4 flex-row gap-4">
          {/* HARD RUNTIME FIX: Standard RN Image for Mobile Stability */}
          <View className="relative">
            <View className="size-24 rounded-[20px] bg-slate-50 overflow-hidden shadow-sm">
                {safeImageSource && !imageLoadFailed ? (
                <RNImage 
                    source={safeImageSource} 
                    className="size-full"
                    resizeMode="cover"
                    onError={handleImageError}
                />
                ) : (
                <View className="size-full items-center justify-center">
                    <FontAwesome5 name="utensils" size={24} color="#CBD5E1" />
                </View>
                )}
            </View>
            {isGenerating && (
              <View className="absolute inset-0 bg-white/70 items-center justify-center rounded-[20px]">
                <ActivityIndicator size="small" color="#8ca18f" />
              </View>
            )}
            {isLocked && !isSkipped && (
               <View className="absolute -top-1.5 -right-1.5 size-6 rounded-full bg-primary border-2 border-white items-center justify-center shadow-sm">
                 <FontAwesome5 name="lock" size={9} color="white" />
               </View>
            )}
          </View>
   
          <View className="flex-1 justify-center py-0.5">
            <View className="flex-row items-center gap-1.5 mb-1">
              <Text className="text-[10px] font-bold text-primary uppercase tracking-widest">{archetype.replace('_', ' ')}</Text>
            </View>
            <Text className="text-slate-900 text-[17px] font-bold leading-tight" numberOfLines={2}>
              {recipe.title}
            </Text>
            <Text className="text-slate-400 text-[12px] mt-1.5 font-medium">
              {Math.round(calories)} kcal • {minutes} mins
            </Text>
          </View>
        </View>
   
        {/* TRUE CTA PARITY - Aligning with Onboarding Generate Plan Button (60px height, 20px radius) */}
        <View className="px-4 pb-4 flex-row gap-3">
          {isSkipped ? (
            <>
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={(e: GestureResponderEvent) => {
                  e.stopPropagation();
                  onUnskip?.();
                }}
                className="flex-1 h-[60px] rounded-[20px] bg-white border border-slate-100 flex-row items-center justify-center gap-2"
              >
                <FontAwesome5 name="undo" size={12} color="#64748b" />
                <Text className="text-slate-600 font-bold text-[13px] uppercase tracking-wide">Undo Skip</Text>
              </TouchableOpacity>
              
              {pantryTransferStatus === 'transferred' ? (
                <View className="flex-1 h-[60px] rounded-[20px] bg-slate-50 border border-primary/20 flex-row items-center justify-center gap-2">
                  <FontAwesome5 name="check-circle" size={14} color="#8ca18f" />
                  <Text className="text-primary font-bold text-[13px] uppercase tracking-wide">Pantry Updated</Text>
                </View>
              ) : (
                <TouchableOpacity 
                  activeOpacity={0.9}
                  onPress={(e: GestureResponderEvent) => {
                    e.stopPropagation();
                    onSkipAndKeep?.();
                  }}
                  className="flex-[1.2] h-[60px] rounded-[20px] bg-primary flex-row items-center justify-center gap-2 shadow-sm"
                  style={{
                    shadowColor: '#8ca18f',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    elevation: 4
                  }}
                >
                  <FontAwesome5 name="plus" size={12} color="white" />
                  <Text className="text-white font-bold text-[15px] uppercase tracking-[0.05em]">Add Groceries</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={(e: GestureResponderEvent) => {
                  e.stopPropagation();
                  onSkip?.();
                }}
                className="flex-1 h-[60px] rounded-[20px] bg-white border border-slate-100 flex-row items-center justify-center gap-2"
              >
                <FontAwesome5 name="calendar-times" size={16} color="#94a3b8" />
                <Text className="text-slate-500 font-bold text-[13px] uppercase tracking-widest">Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                activeOpacity={0.9}
                onPress={handleViewRecipe}
                className="flex-[1.5] h-[60px] rounded-[20px] bg-primary flex-row items-center justify-center gap-3 shadow-sm"
                style={{
                  shadowColor: '#8ca18f',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 4
                }}
              >
                <Text className="text-white font-bold text-[16px] uppercase tracking-[0.1em]">View Recipe</Text>
                <FontAwesome5 name="chevron-right" size={12} color="white" />
              </TouchableOpacity>
            </>
          )}
        </View>
   
        {isSkipped && (
          <View className="absolute top-[4.5rem] right-4 bg-slate-900/10 px-3 py-1 rounded-full">
            <Text className="text-slate-900/40 text-[9px] font-black uppercase tracking-[0.2em]">Inactive</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // Desktop Variant (Preserving visuals, fixing potential transform bridge issues)
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
        onPress={isSkipped || isGenerating ? undefined : handleViewRecipe}
        className={`w-full h-56 md:h-[220px] rounded-3xl overflow-hidden relative shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-none dark:border dark:border-darksoftBorder ${isSkipped ? 'opacity-50 grayscale' : ''}`}
      >
        <FallbackCard recipe={recipe} isDark={isDarkMode} />
        {safeImageSource && !imageLoadFailed && 
         recipe.imageMetadata?.status !== 'missing' ? (
          <ExpoImage
            source={safeImageSource}
            style={{ width: '100%', height: '100%', position: 'absolute' }}
            contentFit="cover"
            transition={{ duration: 500, effect: 'cross-dissolve' }}
            onError={handleImageError}
          />
        ) : null}

        <View className="absolute top-4 left-4 right-4 z-30 flex-row justify-between items-start pointer-events-none">
          {slotLabel ? (
            <View className="bg-white/10 dark:bg-black/20 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/30 dark:border-white/10 shadow-sm">
              <Text className="text-white text-[10px] font-bold uppercase tracking-widest">{slotLabel}</Text>
            </View>
          ) : <View />}

          <View className="flex-row items-center gap-2 pointer-events-auto">
            {onSwipe && !isSkipped && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={(e) => { e.stopPropagation(); onSwipe(); }}
                className="bg-black/20 dark:bg-black/40 backdrop-blur-md px-4 h-10 rounded-full flex-row items-center border border-white/20 dark:border-white/10 shadow-sm"
              >
                <FontAwesome5 name="random" size={12} color="white" className="mr-2" />
                <Text className="text-white font-medium text-[13px] tracking-wide">Swap</Text>
              </TouchableOpacity>
            )}
            
            {!isSkipped && onLock && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={(e) => { e.stopPropagation(); onLock(); }}
                className={`${isLocked ? 'bg-primary/80' : 'bg-black/20'} backdrop-blur-md size-10 rounded-full items-center justify-center border border-white/20 shadow-sm`}
              >
                <FontAwesome5 name={isLocked ? "lock" : "lock-open"} size={12} color="white" />
              </TouchableOpacity>
            )}

            {!isSkipped && onSkip && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={(e) => { e.stopPropagation(); onSkip(); }}
                className="bg-red-500/20 backdrop-blur-md px-4 h-10 rounded-full flex-row items-center border border-white/20 shadow-sm"
              >
                <FontAwesome5 name="fast-forward" size={12} color="white" className="mr-2" />
                <Text className="text-white font-medium text-[13px] tracking-wide">Skip</Text>
              </TouchableOpacity>
            )}

            {isSkipped && (
              <>
                {onReplace && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={(e) => { e.stopPropagation(); onReplace(); }}
                    className="bg-black/20 backdrop-blur-md px-4 h-10 rounded-full flex-row items-center border border-white/20"
                  >
                    <FontAwesome5 name="random" size={12} color="white" className="mr-2" />
                    <Text className="text-white font-medium text-[13px] tracking-wide">Replace</Text>
                  </TouchableOpacity>
                )}
                {onUnskip && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={(e) => { e.stopPropagation(); onUnskip(); }}
                    className="bg-primary/20 backdrop-blur-md px-4 h-10 rounded-full flex-row items-center border border-white/20"
                  >
                    <FontAwesome5 name="undo" size={12} color="white" className="mr-2" />
                    <Text className="text-white font-medium text-[13px] tracking-wide">Restore</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>

        {isSkipped && (
          <View className="absolute top-16 right-4 bg-red-500/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/30 shadow-sm flex-row items-center">
             <FontAwesome5 name="ban" size={10} color="white" className="mr-2" />
             <Text className="text-white font-bold text-[11px] uppercase tracking-widest">Skipped</Text>
          </View>
        )}

        <Animated.View
          style={{ opacity: swipeOverlayOpacity }}
          className="absolute inset-0 bg-[#F4F7F2]/80 dark:bg-[#181C1A]/80 justify-center items-center z-20 pointer-events-none backdrop-blur-sm"
        >
          <View className="bg-white dark:bg-darksurface rounded-full px-6 py-4 flex-row items-center shadow-lg border border-softBorder/50">
            <FontAwesome5 name="random" size={18} color="#9DCD8B" />
            <Text className="text-textMain dark:text-darktextMain font-bold text-[16px] ml-3 tracking-widest uppercase">Swap Meal</Text>
          </View>
        </Animated.View>

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
              <View className="bg-white/20 backdrop-blur-md px-3.5 py-1.5 rounded-full flex-row items-center border border-white/20">
                <FontAwesome5 name="clock" size={10} color="white" />
                <Text className="text-white text-[12px] font-medium ml-2">{recipe.prepTimeMinutes || (recipe as any).totalMinutes || 30} Mins</Text>
              </View>

              <View className="bg-white/20 backdrop-blur-md px-3.5 py-1.5 rounded-full flex-row items-center border border-white/20">
                <FontAwesome5 name="fire" size={10} color="white" />
                <Text className="text-white text-[12px] font-medium ml-2">
                  {recipe.calories ?? (recipe as NormalizedRecipe).macrosPerServing?.calories ?? (recipe as Recipe).macros?.calories ?? 0} kcal
                </Text>
              </View>
            </View>

            {!isSkipped && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={(e) => { e.stopPropagation(); handleViewRecipe(); }}
                className="flex-row items-center opacity-90 bg-white/15 backdrop-blur-sm px-3.5 py-2 rounded-full border border-white/20"
              >
                <Text className="text-white font-medium text-[13px] mr-2">View Recipe</Text>
                <FontAwesome5 name="arrow-right" size={10} color="rgba(255,255,255,0.9)" />
              </TouchableOpacity>
            )}
            
            {isSkipped && pantryTransferStatus !== 'transferred' && onSkipAndKeep && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={(e) => { e.stopPropagation(); onSkipAndKeep(); }}
                className="flex-row items-center opacity-90 bg-sageTint/20 backdrop-blur-sm px-4 py-2 rounded-full border border-sageTint/40"
              >
                <FontAwesome5 name="box-open" size={10} color="#9DCD8B" className="mr-2" />
                <Text className="text-[#9DCD8B] font-medium text-[13px]">Add Groceries</Text>
              </TouchableOpacity>
            )}

            {isSkipped && pantryTransferStatus === 'transferred' && (
              <View
                className="flex-row items-center opacity-90 bg-[#9DCD8B] backdrop-blur-sm px-4 py-2 rounded-full border border-[#9DCD8B]"
              >
                <FontAwesome5 name="check" size={10} color="#1A1F1B" className="mr-2" />
                <Text className="text-[#1A1F1B] font-bold text-[13px]">Pantry Updated</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}
