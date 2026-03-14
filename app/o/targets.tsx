import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { TOKENS } from '../../theme/tokens';
import { useActivePlan } from '../../data/ActivePlanContext';

/**
 * OnboardingTargets
 * Page 4 of the new mobile onboarding flow (Stitch fidelity).
 * Feature: Functional wiring to ActivePlanContext.
 */
export default function OnboardingTargets() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { 
    workspace, 
    updateBudget, 
    updateCalories, 
    updateProtein, 
    updateExclusions 
  } = useActivePlan();

  // State mapping for future persistence
  const [budget, setBudget] = useState('£40');
  const [activity, setActivity] = useState('moderate');
  const [proteinLevel, setProteinLevel] = useState('standard');
  const [avoidances, setAvoidances] = useState(['Mushrooms', 'Cilantro']);
  const [customAvoidance, setCustomAvoidance] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  const BUDGETS = ['£30', '£40', '£50', '£60', '£70+'];
  
  const ACTIVITIES = [
    { id: 'light', name: 'Light', icon: 'leaf', kcal: '1,800' },
    { id: 'moderate', name: 'Moderate', icon: 'walking', kcal: '2,400' },
    { id: 'active', name: 'Active', icon: 'running', kcal: '2,800' },
    { id: 'high', name: 'High', icon: 'fire-alt', kcal: '3,200' }
  ];

  const PROTEIN_LEVELS = [
    { id: 'basic', name: 'Basic', grams: 110, desc: 'Balanced' },
    { id: 'standard', name: 'Standard', grams: 140, desc: 'Optimal' },
    { id: 'athlete', name: 'Athlete', grams: 180, desc: 'High' }
  ];

  // Sync with global state on mount to handle back-navigation persistence
  useEffect(() => {
    const p = workspace.input?.payload;
    if (p) {
      if (p.budgetWeekly) setBudget(`£${p.budgetWeekly}${p.budgetWeekly === 70 ? '+' : ''}`);
      if (p.caloriePreset) {
        setActivity(p.caloriePreset);
      } else if (p.targetCalories) {
        const act = ACTIVITIES.find(a => parseInt(a.kcal.replace(',', '')) === p.targetCalories);
        if (act) setActivity(act.id);
      }
      if (p.targetProtein) {
        const prot = PROTEIN_LEVELS.find(pl => pl.grams === p.targetProtein);
        if (prot) setProteinLevel(prot.id);
      }
      if (p.excludedIngredientTags) setAvoidances(p.excludedIngredientTags);
    }
  }, []);

  const handleNext = () => {
    const selectedProtein = PROTEIN_LEVELS.find(p => p.id === proteinLevel)?.grams || 140;
    const currentKcal = ACTIVITIES.find(a => a.id === activity)?.kcal || '2,400';
    const numericBudget = parseInt(budget.replace('£', '').replace('+', ''));

    // Commit to global state
    updateBudget(numericBudget);
    updateCalories(parseInt(currentKcal.replace(',', '')), activity);
    updateProtein(selectedProtein);
    updateExclusions(avoidances);

    router.push('/o/verification' as any);
  };

  const handleBack = () => {
    router.back();
  };

  const isShortScreen = height < 700;
  const cardWidth = (width - 48 - 12) / 2; // slightly tighter gap (12)

  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: TOKENS.colors.background.light,
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
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

        {/* Progress (Step 4 of 5) */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'center',
          paddingVertical: 12,
          gap: 12 
        }}>
          <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: 'rgba(203, 213, 225, 0.4)' }} />
          <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: 'rgba(203, 213, 225, 0.4)' }} />
          <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: 'rgba(203, 213, 225, 0.4)' }} />
          <View style={{ height: 6, width: 32, borderRadius: 3, backgroundColor: 'rgba(140, 161, 143, 0.7)' }} />
          <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: 'rgba(203, 213, 225, 0.4)' }} />
        </View>

        {/* Heading Block */}
        <View style={{ 
          paddingHorizontal: 24, 
          paddingTop: isShortScreen ? 8 : 16, 
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
            Set your targets
          </Text>
          <Text style={{ 
            fontSize: 14,
            lineHeight: 20,
            color: TOKENS.colors.text.light.muted,
            textAlign: 'center',
            paddingHorizontal: 24
          }} className="font-medium">
            Help us tailor your meal plans to your lifestyle and budget.
          </Text>
        </View>
      </View>

      {/* 2. SCROLLABLE CONTENT AREA */}
      <ScrollView 
        contentContainerStyle={{ 
          paddingHorizontal: 24, 
          paddingTop: 8, 
          paddingBottom: 200 
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 36 }}>
          
          {/* Section A: Weekly Food Budget */}
          <View>
            <Text style={{ 
              fontSize: 10, 
              fontWeight: '900', 
              color: 'rgba(148, 163, 184, 0.6)', 
              letterSpacing: 2,
              marginBottom: 14
            }} className="uppercase">
              Weekly Food Budget
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {BUDGETS.map(val => {
                const isSelected = budget === val;
                return (
                  <TouchableOpacity
                    key={val}
                    onPress={() => setBudget(val)}
                    activeOpacity={0.8}
                    style={{ 
                      paddingHorizontal: 16, 
                      paddingVertical: 9,
                      borderRadius: 100,
                      backgroundColor: isSelected ? TOKENS.colors.primary : 'white',
                      borderWidth: 1,
                      borderColor: isSelected ? TOKENS.colors.primary : '#f1f5f9',
                    }}
                    className={isSelected ? "shadow-sm" : ""}
                  >
                    <Text style={{ 
                      fontSize: 12, 
                      fontWeight: 'bold', 
                      color: isSelected ? 'white' : TOKENS.colors.text.light.muted
                    }}>
                      {val}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section B: Activity Level / Daily Calorie */}
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
              <Text style={{ 
                fontSize: 10, 
                fontWeight: '900', 
                color: 'rgba(148, 163, 184, 0.6)', 
                letterSpacing: 2
              }} className="uppercase">
                Activity Level
              </Text>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: TOKENS.colors.primary }}>
                {ACTIVITIES.find(a => a.id === activity)?.kcal} kcal
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
              {ACTIVITIES.map(opt => {
                const isSelected = activity === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => setActivity(opt.id)}
                    activeOpacity={0.8}
                    style={{ 
                      width: cardWidth,
                      paddingVertical: 18,
                      paddingHorizontal: 16,
                      borderRadius: 24,
                      backgroundColor: isSelected ? '#eff3f0' : 'white',
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? 'rgba(140, 161, 143, 0.4)' : '#f1f5f9',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      position: 'relative'
                    }}
                  >
                    <FontAwesome5 
                      name={opt.icon} 
                      size={20} 
                      color={isSelected ? TOKENS.colors.primary : 'rgba(148, 163, 184, 0.3)'} 
                    />
                    <Text style={{ 
                      fontSize: 10, 
                      fontWeight: '900', 
                      color: isSelected ? TOKENS.colors.primary : TOKENS.colors.text.light.muted,
                      letterSpacing: 1.5
                    }} className="uppercase">
                      {opt.name}
                    </Text>
                    {isSelected && (
                      <View style={{ 
                        position: 'absolute', 
                        top: 10, 
                        right: 10, 
                        width: 14, 
                        height: 14, 
                        borderRadius: 7, 
                        backgroundColor: TOKENS.colors.primary, 
                        alignItems: 'center', 
                        justifyContent: 'center' 
                      }}>
                        <MaterialIcons name="check" size={10} color="white" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section C: Daily Protein Goal (Stepped Selector) */}
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
              <Text style={{ 
                fontSize: 10, 
                fontWeight: '900', 
                color: 'rgba(148, 163, 184, 0.6)', 
                letterSpacing: 2
              }} className="uppercase">
                Protein Target
              </Text>
              <View style={{ 
                backgroundColor: '#eff3f0', 
                paddingHorizontal: 10, 
                paddingVertical: 2, 
                borderRadius: 100 
              }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: TOKENS.colors.primary }}>
                  {PROTEIN_LEVELS.find(p => p.id === proteinLevel)?.grams}g
                </Text>
              </View>
            </View>
            
            <View style={{ 
              flexDirection: 'row', 
              backgroundColor: 'white', 
              padding: 4, 
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#f1f5f9',
              justifyContent: 'space-between'
            }}>
              {PROTEIN_LEVELS.map(level => {
                const isSelected = proteinLevel === level.id;
                return (
                  <TouchableOpacity
                    key={level.id}
                    onPress={() => setProteinLevel(level.id)}
                    activeOpacity={0.8}
                    style={{ 
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 16,
                      backgroundColor: isSelected ? TOKENS.colors.primary : 'transparent',
                      alignItems: 'center'
                    }}
                  >
                    <Text style={{ 
                      fontSize: 11, 
                      fontWeight: 'bold', 
                      color: isSelected ? 'white' : 'rgba(148, 163, 184, 0.8)'
                    }}>
                      {level.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={{ 
              fontSize: 10, 
              textAlign: 'center', 
              marginTop: 10, 
              color: 'rgba(148, 163, 184, 0.6)',
              fontWeight: '500'
            }}>
              {PROTEIN_LEVELS.find(p => p.id === proteinLevel)?.desc} intensity for your lifestyle
            </Text>
          </View>

          {/* Section D: Avoidances (Chips + Input) */}
          <View>
            <Text style={{ 
              fontSize: 10, 
              fontWeight: '900', 
              color: 'rgba(148, 163, 184, 0.6)', 
              letterSpacing: 2,
              marginBottom: 14
            }} className="uppercase">
              Anything to avoid?
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {avoidances.map(item => (
                <TouchableOpacity
                  key={item}
                  onPress={() => setAvoidances(avoidances.filter(a => a !== item))}
                  style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    gap: 6, 
                    backgroundColor: '#f8fafc', 
                    paddingLeft: 12, 
                    paddingRight: 8, 
                    paddingVertical: 7, 
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: '#f1f5f9'
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: TOKENS.colors.text.light.muted }}>{item}</Text>
                  <Ionicons name="close-circle" size={14} color="rgba(148, 163, 184, 0.4)" />
                </TouchableOpacity>
              ))}
              
              {!isAddingCustom ? (
                <TouchableOpacity
                  onPress={() => setIsAddingCustom(true)}
                  style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    gap: 6, 
                    paddingHorizontal: 12, 
                    paddingVertical: 6.5, 
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    borderColor: 'rgba(203, 213, 225, 0.6)'
                  }}
                >
                  <Ionicons name="add" size={16} color="rgba(148, 163, 184, 0.6)" />
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: 'rgba(148, 163, 184, 0.6)' }}>Add Custom</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  gap: 8, 
                  backgroundColor: 'white', 
                  paddingLeft: 14, 
                  paddingRight: 4, 
                  paddingVertical: 4, 
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: TOKENS.colors.primary,
                  minWidth: 130
                }}>
                  <TextInput
                    autoFocus
                    placeholder="E.g. Cilantro"
                    placeholderTextColor="rgba(148, 163, 184, 0.4)"
                    style={{ flex: 1, fontSize: 13, fontWeight: 'bold', color: TOKENS.colors.text.light.emphasis, padding: 0 }}
                    value={customAvoidance}
                    onChangeText={setCustomAvoidance}
                    onSubmitEditing={() => {
                      if (customAvoidance.trim()) {
                        setAvoidances([...avoidances, customAvoidance.trim()]);
                        setCustomAvoidance('');
                        setIsAddingCustom(false);
                      }
                    }}
                  />
                  <TouchableOpacity 
                    onPress={() => {
                        if (customAvoidance.trim()) {
                           setAvoidances([...avoidances, customAvoidance.trim()]);
                           setCustomAvoidance('');
                           setIsAddingCustom(false);
                        } else {
                           setIsAddingCustom(false);
                        }
                    }} 
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="checkmark-circle" size={22} color={TOKENS.colors.primary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

        </View>
      </ScrollView>

      {/* 3. STICKY FOOTER CTA */}
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
          style={{ 
            height: 60, 
            borderRadius: 18,
            backgroundColor: TOKENS.colors.primary,
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          className="shadow-md shadow-primary/20"
        >
          <Text 
            style={{ fontSize: 16, color: 'white' }}
            className="font-bold tracking-wide uppercase"
          >
            Continue
          </Text>
          <MaterialIcons name="arrow-forward" size={18} color="white" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
        <Text style={{ 
          fontSize: 10, 
          color: 'rgba(148, 163, 184, 0.5)', 
          textAlign: 'center', 
          marginTop: 14,
          fontWeight: '700',
          letterSpacing: 0.5
        }} className="uppercase">
          Settings can be modified in profile later.
        </Text>
      </View>
      
    </View>
  );
}
