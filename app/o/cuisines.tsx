import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { TOKENS } from '../../theme/tokens';
import { useActivePlan } from '../../data/ActivePlanContext';
import { CuisineId } from '../../data/planner/plannerTypes';

/**
 * OnboardingCuisines
 * Page 3 of the new mobile onboarding flow (Stitch fidelity).
 * Feature: Functional wiring to ActivePlanContext.
 */
export default function OnboardingCuisines() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { workspace, updateCuisinePreferences } = useActivePlan();

  const [selected, setSelected] = useState<CuisineId[]>([]);

  // Sync with global state on mount to handle back-navigation persistence
  useEffect(() => {
    const saved = workspace.input?.payload?.preferredCuisineIds;
    if (saved && saved.length > 0) {
      setSelected(saved as CuisineId[]);
    }
  }, []);

  // Refined icon set and descriptors for a more coherent, premium feel
  const CUISINES: { id: CuisineId; name: string; desc: string; icon: string }[] = [
    { id: 'italian', name: 'Italian', desc: 'Classic pasta, pizza & herbs', icon: 'pizza-slice' },
    { id: 'french', name: 'French', desc: 'Elegant techniques & flavors', icon: 'wine-glass-alt' },
    { id: 'mexican', name: 'Mexican', desc: 'Spicy tacos & bold zest', icon: 'pepper-hot' },
    { id: 'japanese', name: 'Japanese', desc: 'Clean sushi & umami depth', icon: 'fish' },
    { id: 'chinese', name: 'Chinese', desc: 'Aromatic stir-fry & grains', icon: 'utensils' },
    { id: 'indian', name: 'Indian', desc: 'Rich spices & fragrant rice', icon: 'mortar-pestle' },
    { id: 'mediterranean', name: 'Mediterranean', desc: 'Fresh oils, fish & greens', icon: 'lemon' },
    { id: 'middle_eastern', name: 'Middle Eastern', desc: 'Grains, herbs & flatbreads', icon: 'mountain' },
    { id: 'korean', name: 'Korean', desc: 'Fermented tang & BBQ zest', icon: 'fire-alt' },
    { id: 'south_east_asian', name: 'South East Asian', desc: 'Vibrant herbs & tropical heat', icon: 'tint' }
  ];

  const toggleCuisine = (id: CuisineId) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(item => item !== id));
    } else {
      setSelected([...selected, id]);
    }
  };

  const handleNext = () => {
    if (selected.length === 0) return;
    updateCuisinePreferences(selected);
    router.push('/o/targets');
  };

  const handleBack = () => {
    router.back();
  };

  const isShortScreen = height < 700;
  const cardWidth = (width - 48 - 16) / 2; // 48 padding (24 * 2) - 16 gap

  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: TOKENS.colors.background.light,
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
      paddingLeft: insets.left,
      paddingRight: insets.right
    }}>
      
      {/* 1. STICKY TOP FRAMING */}
      <View style={{ backgroundColor: TOKENS.colors.background.light }}>
        {/* Header */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'center',
          paddingHorizontal: 20,
          height: 64,
          position: 'relative'
        }}>
          <TouchableOpacity 
            onPress={handleBack} 
            style={{ position: 'absolute', left: 20, zIndex: 10 }}
            className="p-2"
          >
            <Ionicons name="arrow-back" size={24} color={TOKENS.colors.text.light.emphasis} />
          </TouchableOpacity>
          
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <FontAwesome5 name="leaf" size={14} color={TOKENS.colors.primary} style={{ marginRight: 8 }} />
            <Text style={{ 
              fontFamily: TOKENS.typography.fontFamily,
              fontSize: 14,
              letterSpacing: 4,
              color: TOKENS.colors.text.light.emphasis
            }} className="font-extrabold uppercase">
              Provision
            </Text>
          </View>
        </View>

        {/* Progress (Step 3 of 5) */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'center',
          paddingVertical: 12,
          gap: 12 
        }}>
          <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: 'rgba(203, 213, 225, 0.5)' }} />
          <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: 'rgba(203, 213, 225, 0.5)' }} />
          <View style={{ height: 6, width: 32, borderRadius: 3, backgroundColor: 'rgba(140, 161, 143, 0.6)' }} />
          <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: 'rgba(203, 213, 225, 0.5)' }} />
          <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: 'rgba(203, 213, 225, 0.5)' }} />
        </View>

        {/* Heading Block */}
        <View style={{ 
          paddingHorizontal: 24, 
          paddingTop: isShortScreen ? 12 : 20, 
          paddingBottom: 16, 
          alignItems: 'center' 
        }}>
          <Text style={{ 
            fontFamily: TOKENS.typography.fontFamily,
            fontSize: 28,
            lineHeight: 34,
            color: TOKENS.colors.text.light.emphasis,
            marginBottom: 6,
            textAlign: 'center'
          }} className="font-bold tracking-tight">
            Explore your tastes
          </Text>
          <Text style={{ 
            fontSize: 14,
            lineHeight: 20,
            color: TOKENS.colors.text.light.muted,
            textAlign: 'center',
            paddingHorizontal: 20,
            marginBottom: 12
          }} className="font-medium">
            Pick at least 1 cuisine you'd love to see this week.
          </Text>

          {/* Count Pill */}
          <View style={{ 
            paddingHorizontal: 12, 
            paddingVertical: 4, 
            backgroundColor: '#eff3f0', 
            borderRadius: 100,
            borderWidth: 1,
            borderColor: 'rgba(140, 161, 143, 0.2)'
          }}>
            <Text style={{ 
              fontSize: 10, 
              color: TOKENS.colors.primary, 
              letterSpacing: 1,
              fontWeight: 'bold' 
            }} className="uppercase">
              {selected.length} Selected
            </Text>
          </View>
        </View>
      </View>

      {/* 2. SCROLLABLE GRID CONTENT */}
      <ScrollView 
        contentContainerStyle={{ 
          paddingHorizontal: 24, 
          paddingTop: 8, 
          paddingBottom: 160 
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ 
          flexDirection: 'row', 
          flexWrap: 'wrap', 
          justifyContent: 'space-between',
          gap: 16
        }}>
          {CUISINES.map((cuisine) => {
            const isSelected = selected.includes(cuisine.id);
            return (
              <TouchableOpacity
                key={cuisine.id}
                activeOpacity={0.8}
                onPress={() => toggleCuisine(cuisine.id)}
                style={{ 
                  width: cardWidth,
                  padding: 16,
                  borderRadius: 24,
                  backgroundColor: isSelected ? '#eff3f0' : 'white',
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? 'rgba(140, 161, 143, 0.4)' : '#f1f5f9',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isSelected ? 0.04 : 0.02,
                  shadowRadius: 6,
                  elevation: isSelected ? 2 : 1,
                  position: 'relative'
                }}
              >
                {/* Icon Container */}
                <View style={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: 12, 
                  backgroundColor: isSelected ? 'transparent' : '#f8fafc',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12
                }}>
                  <FontAwesome5 
                    name={cuisine.icon} 
                    size={18} 
                    color={isSelected ? TOKENS.colors.primary : 'rgba(148, 163, 184, 0.7)'} 
                  />
                </View>

                {/* Info */}
                <View>
                  <Text style={{ 
                    fontSize: 16, 
                    fontWeight: 'bold', 
                    color: TOKENS.colors.text.light.emphasis,
                    marginBottom: 2
                  }}>
                    {cuisine.name}
                  </Text>
                  <Text 
                    style={{ fontSize: 11, color: TOKENS.colors.text.light.muted, lineHeight: 14 }}
                    numberOfLines={2}
                    className="font-medium"
                  >
                    {cuisine.desc}
                  </Text>
                </View>

                {/* Mini Check Indicator */}
                {isSelected && (
                  <View style={{ 
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    width: 20, 
                    height: 20, 
                    borderRadius: 10, 
                    backgroundColor: TOKENS.colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <MaterialIcons name="check" size={14} color="white" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* 3. STICKY BOTTOM NAVIGATION */}
      <View style={{ 
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 32,
        paddingBottom: Math.max(insets.bottom, 32),
        paddingTop: 24,
        backgroundColor: TOKENS.colors.background.light
      }}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleNext}
          disabled={selected.length === 0}
          style={{ 
            height: 64, 
            borderRadius: 18,
            backgroundColor: selected.length > 0 ? TOKENS.colors.primary : '#cbd5e1',
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: selected.length > 0 ? 1 : 0.8
          }}
          className="shadow-lg shadow-primary/30"
        >
          <Text 
            style={{ fontSize: 18, color: 'white' }}
            className="font-bold tracking-wide uppercase"
          >
            Next
          </Text>
          <MaterialIcons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
      
    </View>
  );
}
