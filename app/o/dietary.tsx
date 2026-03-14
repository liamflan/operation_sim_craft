import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { TOKENS } from '../../theme/tokens';
import { DietaryBaseline } from '../../data/planner/plannerTypes';
import { useActivePlan } from '../../data/ActivePlanContext';

/**
 * OnboardingDietary (Native-Safe Pass)
 * Page 2 of the mobile onboarding flow.
 * 
 * FIX: Removed 'className' attributes to bypass interop-driven navigation context crashes.
 */
export default function OnboardingDietary() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { workspace, updateUserDiet } = useActivePlan();

  const [selected, setSelected] = useState<DietaryBaseline | null>(null);

  // Sync with global state on mount to handle back-navigation persistence
  useEffect(() => {
    if (workspace.userDiet) {
      setSelected(workspace.userDiet);
    }
  }, []);

  const OPTIONS: { id: DietaryBaseline; title: string; description: string; icon: string }[] = [
    { 
      id: 'Omnivore', 
      title: 'Omnivore', 
      description: 'Everything, including meat and dairy', 
      icon: 'utensils'
    },
    { 
      id: 'Pescatarian', 
      title: 'Pescatarian', 
      description: 'Vegetarian plus seafood', 
      icon: 'fish'
    },
    { 
      id: 'Vegetarian', 
      title: 'Vegetarian', 
      description: 'No meat, but includes dairy and eggs', 
      icon: 'seedling'
    },
    { 
      id: 'Vegan', 
      title: 'Vegan', 
      description: 'Strictly plant-based diet', 
      icon: 'leaf'
    }
  ];

  const handleNext = () => {
    if (!selected) return;
    updateUserDiet(selected);
    router.push('/o/cuisines');
  };

  const handleBack = () => {
    router.back();
  };

  const isShortScreen = height < 700;

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
            style={{ 
                position: 'absolute', 
                left: 20, 
                zIndex: 10,
                padding: 8
            }}
          >
            <Ionicons name="arrow-back" size={24} color={TOKENS.colors.text.light.emphasis} />
          </TouchableOpacity>
          
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <FontAwesome5 name="leaf" size={14} color={TOKENS.colors.primary} style={{ marginRight: 8 }} />
            <Text style={{ 
              fontFamily: TOKENS.typography.fontFamily,
              fontSize: 14,
              letterSpacing: 4,
              color: TOKENS.colors.text.light.emphasis,
              fontWeight: '800',
              textTransform: 'uppercase'
            }}>
              Provision
            </Text>
          </View>
        </View>

        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'center',
          paddingVertical: 12,
          gap: 12 
        }}>
          <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: 'rgba(203, 213, 225, 0.5)' }} />
          <View style={{ height: 6, width: 32, borderRadius: 3, backgroundColor: 'rgba(140, 161, 143, 0.6)' }} />
          <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: 'rgba(203, 213, 225, 0.5)' }} />
          <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: 'rgba(203, 213, 225, 0.5)' }} />
          <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: 'rgba(203, 213, 225, 0.5)' }} />
        </View>

        <View style={{ 
          paddingHorizontal: 24, 
          paddingTop: isShortScreen ? 16 : 24, 
          paddingBottom: isShortScreen ? 12 : 24, 
          alignItems: 'center' 
        }}>
          <Text style={{ 
            fontFamily: TOKENS.typography.fontFamily,
            fontSize: 30,
            lineHeight: 36,
            color: TOKENS.colors.text.light.emphasis,
            marginBottom: 8,
            textAlign: 'center',
            fontWeight: 'bold',
            letterSpacing: -0.5
          }}>
            How do you eat?
          </Text>
          <Text style={{ 
            fontSize: 15,
            lineHeight: 22,
            color: TOKENS.colors.text.light.muted,
            textAlign: 'center',
            paddingHorizontal: 20,
            fontWeight: '500'
          }}>
            Select the dietary profile that best matches your lifestyle.
          </Text>
        </View>
      </View>

      {/* 2. SCROLLABLE CHOICE LIST */}
      <ScrollView 
        contentContainerStyle={{ 
          paddingHorizontal: 24, 
          paddingTop: 8, 
          paddingBottom: 140 
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 16 }}>
          {OPTIONS.map((option) => {
            const isSelected = selected === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                activeOpacity={0.9}
                onPress={() => setSelected(option.id)}
                style={{ 
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 20,
                  borderRadius: 24,
                  backgroundColor: isSelected ? '#eff3f0' : 'white',
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? 'rgba(140, 161, 143, 0.4)' : '#f1f5f9',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.03,
                  shadowRadius: 6,
                  elevation: isSelected ? 3 : 1
                }}
              >
                {/* Unified Icon Container */}
                <View style={{ 
                  width: 56, 
                  height: 56, 
                  borderRadius: 14, 
                  backgroundColor: isSelected ? 'transparent' : '#f8fafc',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16
                }}>
                  <FontAwesome5 
                    name={option.icon} 
                    size={22} 
                    color={isSelected ? TOKENS.colors.primary : 'rgba(148, 163, 184, 0.7)'} 
                  />
                </View>

                {/* Text Content */}
                <View style={{ flex: 1, marginRight: 16 }}>
                  <Text style={{ 
                    fontSize: 18, 
                    fontWeight: 'bold', 
                    color: TOKENS.colors.text.light.emphasis,
                    marginBottom: 2
                  }}>
                    {option.title}
                  </Text>
                  <Text style={{ 
                    fontSize: 14, 
                    color: TOKENS.colors.text.light.muted,
                    lineHeight: 18,
                    fontWeight: '500'
                  }}>
                    {option.description}
                  </Text>
                </View>

                {/* Unified Radio Indicator */}
                <View style={{ 
                  width: 24, 
                  height: 24, 
                  borderRadius: 12, 
                  borderWidth: isSelected ? 0 : 2, 
                  borderColor: '#e2e8f0',
                  backgroundColor: isSelected ? TOKENS.colors.primary : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {isSelected && (
                    <MaterialIcons name="check" size={16} color="white" />
                  )}
                </View>
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
          disabled={!selected}
          style={{ 
            height: 64, 
            borderRadius: 18,
            backgroundColor: selected ? TOKENS.colors.primary : '#cbd5e1',
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: selected ? 1 : 0.8,
            // Manual shadow
            shadowColor: TOKENS.colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 10,
            elevation: 4
          }}
        >
          <Text 
            style={{ 
                fontSize: 18, 
                color: 'white',
                fontWeight: 'bold',
                letterSpacing: 0.5,
                textTransform: 'uppercase'
            }}
          >
            Next
          </Text>
          <MaterialIcons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
      
    </View>
  );
}
