import React, { useEffect, useState, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  Animated, 
  Dimensions, 
  Platform, 
  ActivityIndicator,
  Pressable,
  Easing,
  Image as RNImage
} from 'react-native';
import { Image } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { useActivePlan } from '../data/ActivePlanContext';
import { SlotType } from '../data/planner/plannerTypes';
import { FULL_RECIPE_CATALOG } from '../data/planner/recipeRegistry';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Platform.OS === 'web' ? 620 : SCREEN_WIDTH;

interface SwapDrawerProps {
  isVisible: boolean;
  onClose: () => void;
  dayIndex: number;
  slotType: SlotType;
  currentRecipeId: string | null;
}

type FilterType = 'best' | 'cost' | 'protein' | 'speed' | 'budget';

export default function SwapDrawer({ isVisible, onClose, dayIndex, slotType, currentRecipeId }: SwapDrawerProps) {
  const { getSwapCandidates, replaceSlot } = useActivePlan();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [shouldRender, setShouldRender] = useState(isVisible);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('best');

  const slideAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Measure footer height for scroll padding
  const FOOTER_HEIGHT = 300; 

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setLoading(true);
      setErrorMsg(null);
      getSwapCandidates(dayIndex, slotType)
        .then(setCandidates)
        .finally(() => setLoading(false));

      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 450,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: DRAWER_WIDTH,
          duration: 400,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShouldRender(false);
        setSelectedId(null);
        setErrorMsg(null);
        setActiveFilter('best');
      });
    }
  }, [isVisible, dayIndex, slotType]);

  const sortedCandidates = useMemo(() => {
    const list = [...candidates];
    switch (activeFilter) {
      case 'cost':
        return list.sort((a, b) => a.estimatedCostPerServingGBP - b.estimatedCostPerServingGBP);
      case 'protein':
        return list.sort((a, b) => (b.macrosPerServing?.protein || 0) - (a.macrosPerServing?.protein || 0));
      case 'speed':
        return list.sort((a, b) => a.totalMinutes - b.totalMinutes);
      case 'budget':
        return list.filter(c => (c.impact?.costDelta || 0) <= 0);
      default:
        return list;
    }
  }, [candidates, activeFilter]);

  const handleConfirm = async () => {
    if (!selectedId) return;
    setConfirming(true);
    setErrorMsg(null);
    const result = await replaceSlot(dayIndex, slotType, selectedId);
    setConfirming(false);
    
    if (result.status === 'failed_constraints' && result.reason === 'selected_recipe_no_longer_valid' as any) {
      setErrorMsg('This choice is no longer valid under your latest settings.');
    } else if (result.status === 'failed_constraints' || result.status === 'failed_error') {
      setErrorMsg('Unable to complete swap. Please try another selection.');
    } else {
      onClose();
    }
  };

  if (!shouldRender) return null;

  const currentRecipe = currentRecipeId ? FULL_RECIPE_CATALOG[currentRecipeId] : null;
  const selectedCandidate = candidates.find(c => c.id === selectedId);

  const filters: { id: FilterType; label: string; icon: string }[] = [
    { id: 'best', label: 'Best match', icon: 'magic' },
    { id: 'cost', label: 'Lower cost', icon: 'arrow-down' },
    { id: 'protein', label: 'Higher protein', icon: 'dumbbell' },
    { id: 'speed', label: 'Faster prep', icon: 'clock' },
  ];

  return (
    <View style={{ position: 'absolute', inset: 0, zIndex: 9999, elevation: 20 }}>
      {/* Backdrop */}
      <Animated.View 
        style={{ 
          position: 'absolute', 
          inset: 0, 
          backgroundColor: '#161C19', 
          opacity: Animated.multiply(fadeAnim, 0.18) 
        }} 
      >
        <Pressable onPress={onClose} style={{ flex: 1 }} />
      </Animated.View>

      {/* Drawer Panel */}
      <Animated.View 
        style={{ 
          position: 'absolute', 
          top: 0, 
          bottom: 0, 
          right: 0, 
          width: DRAWER_WIDTH, 
          backgroundColor: '#F7F8F6', 
          transform: [{ translateX: slideAnim }],
          borderLeftWidth: 1,
          borderLeftColor: 'rgba(0,0,0,0.06)',
          shadowColor: '#1A2421',
          shadowOffset: { width: -40, height: 0 },
          shadowOpacity: 0.04,
          shadowRadius: 60,
        }} 
      >
        <View className="flex-1">
          {/* ZONE 1: HEADER - Compressed 2-row layout */}
          <View className="px-10 pt-8 pb-6 flex-row justify-between items-center bg-white/60 backdrop-blur-3xl border-b border-black/[0.02]">
            <View className="flex-1 pr-6">
              <Text className="text-textMain text-[24px] font-medium tracking-tight mb-0.5">Swap Meal</Text>
              <Text className="text-textMain text-[12px] font-medium opacity-60" numberOfLines={1}>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][dayIndex]} • {slotType} • Currently: {currentRecipe?.title || 'Unfilled Slot'}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={onClose} 
              className="w-8 h-8 items-center justify-center opacity-40 hover:opacity-100 transition-opacity"
            >
              <FontAwesome5 name="times" size={16} color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            className="flex-1" 
            contentContainerStyle={{ paddingHorizontal: 32, paddingTop: 24, paddingBottom: FOOTER_HEIGHT }} 
            showsVerticalScrollIndicator={false}
          >
            {/* ZONE 2: CURRENT CHOICE - Re-styled to match alternative visual system */}
            <View className="mb-10">
              <Text className="text-textMain text-[10px] font-bold uppercase tracking-[0.15em] mb-4 opacity-40 px-1">Your current choice</Text>
              {currentRecipe ? (
                <View className="bg-white rounded-[20px] p-3 border border-black/[0.03] shadow-[0_2px_12px_rgba(0,0,0,0.01)] flex-row items-center">
                  {Platform.OS === 'web' ? (
                    <Image 
                      source={currentRecipe.imageUrl} 
                      style={{ width: 72, height: 72, borderRadius: 14 }} 
                      contentFit="cover"
                    />
                  ) : (() => {
                    const val = currentRecipe.imageUrl;
                    const src = typeof val === 'string' && val.trim().startsWith('http') ? { uri: val } : typeof val === 'number' ? val : null;
                    return src ? (
                      <RNImage source={src} style={{ width: 72, height: 72, borderRadius: 14 }} resizeMode="cover" />
                    ) : (
                      <View style={{ width: 72, height: 72, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesome5 name="utensils" size={20} color="#CBD5E1" />
                      </View>
                    );
                  })()}
                  <View className="flex-1 ml-4 justify-center py-1">
                    <View className="flex-row justify-between items-start mb-2 pr-2">
                      <Text className="flex-1 text-textMain text-[16px] font-medium leading-[1.25] mr-4" numberOfLines={2}>{currentRecipe.title}</Text>
                      <View className="items-end">
                        <Text className="text-textMain text-[14px] font-extrabold pt-0.5">£{currentRecipe.estimatedCostPerServingGBP.toFixed(2)}</Text>
                        <Text className="text-textMain text-[9px] font-bold opacity-30 uppercase">per unit</Text>
                      </View>
                    </View>
                    
                    <View className="flex-row items-center gap-x-3 opacity-60">
                      <View className="bg-black/[0.03] px-1.5 py-0.5 rounded border border-black/[0.02]">
                        <Text className="text-textMain text-[9px] font-bold uppercase tracking-widest leading-none">{currentRecipe.totalMinutes}m</Text>
                      </View>
                      <View className="w-[1px] h-2.5 bg-black/5" />
                      <Text className="text-textMain text-[10px] font-bold opacity-70">{currentRecipe.macrosPerServing.calories} kcal</Text>
                      <View className="w-[1px] h-2.5 bg-black/5" />
                      <Text className="text-textMain text-[10px] font-bold opacity-70">{currentRecipe.macrosPerServing.protein}g pro</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View className="bg-white/40 rounded-[24px] py-10 border border-dashed border-black/[0.1] items-center">
                  <Text className="text-textMain text-[13px] font-medium opacity-50 italic">No meal currently assigned</Text>
                  <Text className="text-textMain text-[11px] opacity-30 mt-1">Select an alternative below to fill this slot</Text>
                </View>
              )}
            </View>

            {/* ZONE 3: SMART FILTERS - Polished & Resolved Rail */}
            <View className="mb-10 -mx-8">
              <View className="flex-row gap-x-3 px-8">
                {filters.map(filter => {
                  const isActive = activeFilter === filter.id;
                  return (
                    <TouchableOpacity 
                      key={filter.id}
                      onPress={() => setActiveFilter(filter.id)}
                      activeOpacity={0.7}
                      style={{ flexShrink: 0 }}
                      className={`flex-row items-center px-4 py-2 rounded-xl border ${
                        isActive 
                          ? 'bg-primary/5 border-primary/20 shadow-sm' 
                          : 'bg-white border-black/[0.04]'
                      }`}
                    >
                      <FontAwesome5 
                        name={filter.icon} 
                        size={10} 
                        color={isActive ? '#7BA96A' : '#A3B0A7'} 
                        style={{ marginRight: 8 }}
                      />
                      <Text className={`text-[12px] font-bold ${isActive ? 'text-primary' : 'text-textMain opacity-50'}`}>
                        {filter.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ZONE 4: ALTERNATIVES - Professional & Dense */}
            <View>
              <View className="flex-row justify-between items-baseline mb-5 px-1">
                <Text className="text-textMain text-[10px] font-bold uppercase tracking-[0.15em] opacity-40">Relevant alternatives</Text>
                <Text className="text-textMain text-[11px] font-medium opacity-40">Chosen for your plan</Text>
              </View>
              
              {loading ? (
                <View className="py-24 items-center justify-center">
                  <ActivityIndicator color="#C3D1C8" size="small" />
                  <Text className="text-textMain text-[11px] mt-4 font-bold uppercase tracking-widest opacity-25">Searching pool...</Text>
                </View>
              ) : sortedCandidates.length === 0 ? (
                <View className="py-20 items-center justify-center bg-white rounded-[24px] border border-black/[0.03] px-10">
                  <Text className="text-textMain text-[14px] font-medium mb-1.5 text-center opacity-60">No specific matches</Text>
                  <Text className="text-textMain text-[12px] text-center leading-relaxed opacity-30 font-medium">
                    Try relaxing your budget to see more options.
                  </Text>
                </View>
              ) : (
                <View className="gap-y-3">
                  {sortedCandidates.map((item) => {
                    const isSelected = selectedId === item.id;
                    return (
                      <TouchableOpacity 
                        key={item.id}
                        onPress={() => setSelectedId(item.id)}
                        activeOpacity={0.94}
                        className={`bg-white rounded-[20px] border overflow-hidden ${
                          isSelected 
                            ? 'border-primary/30 bg-[#F6F8F5] shadow-[0_4px_16px_rgba(0,0,0,0.02)]' 
                            : 'border-black/[0.03] hover:border-black/[0.06]'
                        }`}
                      >
                        <View className="flex-row p-3 items-center">
                          {Platform.OS === 'web' ? (
                            <Image 
                              source={item.imageUrl} 
                              style={{ width: 72, height: 72, borderRadius: 14 }} 
                              contentFit="cover"
                            />
                          ) : (() => {
                            const val = item.imageUrl;
                            const src = typeof val === 'string' && val.trim().startsWith('http') ? { uri: val } : typeof val === 'number' ? val : null;
                            return src ? (
                              <RNImage source={src} style={{ width: 72, height: 72, borderRadius: 14 }} resizeMode="cover" />
                            ) : (
                              <View style={{ width: 72, height: 72, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                                <FontAwesome5 name="utensils" size={20} color="#CBD5E1" />
                              </View>
                            );
                          })()}
                          <View className="flex-1 ml-4 justify-center py-1">
                            <View className="flex-row justify-between items-start mb-2 pr-2">
                              <Text className="flex-1 text-textMain text-[16px] font-medium leading-[1.25] mr-4" numberOfLines={2}>{item.title}</Text>
                              <View className="items-end">
                                <Text className="text-textMain text-[14px] font-extrabold pt-0.5">£{item.estimatedCostPerServingGBP.toFixed(2)}</Text>
                                <Text className="text-textMain text-[9px] font-bold opacity-30 uppercase">per unit</Text>
                              </View>
                            </View>
                            
                            <View className="flex-row items-center gap-x-3 mb-2.5 opacity-60">
                              <View className="bg-black/[0.03] px-1.5 py-0.5 rounded border border-black/[0.02]">
                                <Text className="text-textMain text-[9px] font-bold uppercase tracking-widest leading-none">{item.totalMinutes}m</Text>
                              </View>
                              <View className="w-[1px] h-2.5 bg-black/5" />
                              <Text className="text-textMain text-[10px] font-bold opacity-70">{item.macrosPerServing.calories} kcal</Text>
                              <View className="w-[1px] h-2.5 bg-black/5" />
                              <Text className="text-textMain text-[10px] font-bold opacity-70">{item.macrosPerServing.protein}g pro</Text>
                            </View>

                            <View className="flex-row items-center justify-between pr-2">
                              <View className="flex-row items-center">
                                <View className="bg-black/[0.02] px-2 py-0.5 rounded border border-black/[0.01] mr-2.5">
                                  <Text className="text-textMain text-[9px] font-bold uppercase tracking-widest opacity-40">
                                     {(item as any).cuisineId || 'Global'}
                                  </Text>
                                </View>
                                <View className="flex-row items-center">
                                   <FontAwesome5 name="medal" size={8} color="#7BA96A" className="mr-1.5" />
                                   <Text className="text-[10px] font-bold text-primary tracking-tight">{item.reasonLabel}</Text>
                                </View>
                              </View>
                              {isSelected && (
                                <View className="bg-primary/10 px-2 py-1 rounded-lg border border-primary/20">
                                   <Text className="text-primary text-[9px] font-bold uppercase tracking-widest">Selected</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>

          {/* ZONE 5: IMPACT ANALYSIS footer - Opaque & Deliberate */}
          {!loading && candidates.length > 0 && (
            <View 
              style={{ bottom: 0, left: 0, right: 0 }}
              className="absolute bg-white px-10 pt-7 pb-12 border-t border-black/[0.04] shadow-[0_-15px_60px_rgba(0,0,0,0.06)]"
            >
              {errorMsg && (
                <View className="mb-6 bg-[#FEF9F0] p-4 rounded-xl flex-row items-center border border-[#FDE3B6]">
                  <FontAwesome5 name="exclamation-circle" size={12} color="#D4A373" className="mr-3.5" />
                  <Text className="text-[#966838] text-[13px] font-medium flex-1 tracking-tight leading-snug">{errorMsg}</Text>
                </View>
              )}

              {/* Impact Analysis Area */}
              <View className="mb-9">
                <Text className="text-textMain text-[10px] font-bold uppercase tracking-[0.2em] opacity-30 mb-5 text-center">Impact on weekly targets</Text>
                {selectedCandidate ? (
                  <View className="flex-row bg-[#F9FAF7] rounded-[24px] border border-black/[0.02] px-4 py-5 gap-x-8 items-center justify-center">
                    <View className="items-center px-2">
                       <Text className={`text-[19px] font-bold mb-1 ${selectedCandidate.impact?.costDelta > 0 ? 'text-[#D4A373]' : 'text-primary'}`}>
                         {selectedCandidate.impact?.costDelta > 0 ? '+' : '−'}£{Math.abs(selectedCandidate.impact?.costDelta).toFixed(2)}
                       </Text>
                       <Text className="text-[9px] text-textMain uppercase font-extrabold tracking-widest opacity-25">Budget</Text>
                    </View>
                    <View className="w-[1px] h-8 bg-black/[0.05]" />
                    <View className="items-center px-2">
                       <Text className="text-[19px] font-bold text-textMain mb-1">
                         {selectedCandidate.impact?.calorieDelta > 0 ? '+' : '−'}{Math.abs(Math.round(selectedCandidate.impact?.calorieDelta))}
                       </Text>
                       <Text className="text-[9px] text-textMain uppercase font-extrabold tracking-widest opacity-25">Energy</Text>
                    </View>
                    <View className="w-[1px] h-8 bg-black/[0.05]" />
                    <View className="items-center px-2">
                       <Text className={`text-[19px] font-bold mb-1 ${selectedCandidate.impact?.proteinDelta > 0 ? 'text-primary' : 'text-textMain'}`}>
                         {selectedCandidate.impact?.proteinDelta > 0 ? '+' : '−'}{Math.abs(Math.round(selectedCandidate.impact?.proteinDelta))}g
                       </Text>
                       <Text className="text-[9px] text-textMain uppercase font-extrabold tracking-widest opacity-25">Protein</Text>
                    </View>
                  </View>
                ) : (
                  <View className="bg-[#F9FAF7]/50 rounded-[20px] border border-dashed border-black/[0.06] py-6 items-center">
                    <Text className="text-textMain text-[13px] font-medium italic opacity-15">Select a meal to analyze impact</Text>
                  </View>
                )}
              </View>

              {/* PROVISION ACTION BUTTONS - Product Integrated */}
              <View className="flex-row gap-4">
                <TouchableOpacity 
                  onPress={onClose}
                  activeOpacity={0.7}
                  className="flex-1 py-4.5 rounded-xl border border-black/[0.05] items-center justify-center bg-white"
                >
                  <Text className="text-textMain font-bold text-[14px]">Keep Current</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  disabled={!selectedId || confirming}
                  onPress={handleConfirm}
                  activeOpacity={0.8}
                  className={`flex-[1.6] py-4.5 rounded-xl items-center justify-center border ${
                    !selectedId || confirming 
                      ? 'bg-black/[0.01] border-black/[0.03] opacity-20' 
                      : 'bg-[#F4F7F4] border-primary/10'
                  }`}
                >
                  {confirming ? (
                    <ActivityIndicator color="#7BA96A" size="small" />
                  ) : (
                    <Text className={`font-bold text-[14px] ${!selectedId ? 'text-textMain' : 'text-primary'}`}>Confirm Swap</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}
