import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { TOKENS } from '../../theme/tokens';
import { DietaryBaseline } from '../../data/planner/plannerTypes';
import { useActivePlan } from '../../data/ActivePlanContext';

/**
 * OnboardingDietary (Pass 30 - Header Spacing Refinement)
 * 
 * PASS 30 IMPROVEMENTS:
 * 1. BALANCED SPACING: Achieving even gaps between subtitle -> dots and dots -> separator.
 * 2. SLIMMER BAND: Compacted the sticky band further for a tighter, premium rhythm.
 */
export default function OnboardingDietary() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { workspace, updateUserDiet } = useActivePlan();

  const [selected, setSelected] = useState<DietaryBaseline | null>(null);

  useEffect(() => {
    if (workspace.userDiet) {
      setSelected(workspace.userDiet);
    }
  }, []);

  const OPTIONS: { id: DietaryBaseline; title: string; description: string; icon: string }[] = [
    { id: 'Omnivore', title: 'Omnivore', description: 'Everything, including meat and dairy', icon: 'utensils' },
    { id: 'Pescatarian', title: 'Pescatarian', description: 'Vegetarian plus seafood', icon: 'fish' },
    { id: 'Vegetarian', title: 'Vegetarian', description: 'No meat, but includes dairy and eggs', icon: 'seedling' },
    { id: 'Vegan', title: 'Vegan', description: 'Strictly plant-based diet', icon: 'leaf' }
  ];

  const handleNext = () => {
    if (!selected) return;
    updateUserDiet(selected);
    router.push('/o/cuisines');
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      
      <ScrollView 
        contentContainerStyle={{ 
          paddingBottom: insets.bottom + 60 
        }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[3]} // Index 0: Brand Row, 1: Title, 2: Subtitle, 3: Progress (Sticky)
      >
        {/* 1. SCROLLABLE BRAND ROW */}
        <View style={styles.brandingRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtnInline}>
            <Ionicons name="arrow-back" size={22} color={TOKENS.colors.text.light.emphasis} />
          </TouchableOpacity>
          
          <View style={styles.brandWordmarkRow}>
            <FontAwesome5 name="leaf" size={12} color={TOKENS.colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.brandText}>Provision</Text>
          </View>
          
          <View style={{ width: 40 }} />
        </View>

        {/* 2. SCROLLABLE TITLE */}
        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>How do you eat?</Text>
        </View>

        {/* 3. SCROLLABLE SUBTITLE */}
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitleText}>Select the dietary profile that best matches your lifestyle.</Text>
        </View>

        {/* 4. BALANCED STICKY PROGRESS BAND (PASS 30) */}
        <View style={styles.stickyProgressBand}>
            <View style={styles.progressRow}>
                <View style={[styles.progressDot, { width: 6 }]} />
                <View style={[styles.progressDot, { width: 32, backgroundColor: 'rgba(140, 161, 143, 0.7)' }]} />
                <View style={[styles.progressDot, { width: 6 }]} />
                <View style={[styles.progressDot, { width: 6 }]} />
                <View style={[styles.progressDot, { width: 6 }]} />
            </View>
        </View>

        {/* 5. MAIN CONTENT */}
        <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
          <View style={{ gap: 16 }}>
            {OPTIONS.map((option) => {
              const isSelected = selected === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  activeOpacity={0.9}
                  onPress={() => setSelected(option.id)}
                  style={[styles.card, isSelected ? styles.cardActive : styles.cardInactive]}
                >
                  <View style={[styles.iconContainer, isSelected && { backgroundColor: 'transparent' }]}>
                    <FontAwesome5 
                      name={option.icon} 
                      size={22} 
                      color={isSelected ? TOKENS.colors.primary : 'rgba(148, 163, 184, 0.7)'} 
                    />
                  </View>

                  <View style={{ flex: 1, marginRight: 16 }}>
                    <Text style={styles.cardTitle}>{option.title}</Text>
                    <Text style={styles.cardDesc}>{option.description}</Text>
                  </View>

                  <View style={[styles.radio, isSelected ? styles.radioActive : styles.radioInactive]}>
                    {isSelected && <MaterialIcons name="check" size={16} color="white" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Locked CTA wording: Continue */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleNext}
            disabled={!selected}
            style={[styles.ctaButton, { backgroundColor: selected ? TOKENS.colors.primary : '#cbd5e1' }]}
          >
            <Text style={styles.ctaText}>Continue</Text>
            <MaterialIcons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TOKENS.colors.background.light },
  brandingRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 24, 
    paddingVertical: 12 
  },
  backBtnInline: { 
    width: 40, 
    height: 40, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#f8fafc', 
    borderRadius: 12 
  },
  brandWordmarkRow: { flexDirection: 'row', alignItems: 'center' },
  brandText: { 
    fontSize: 12, 
    fontWeight: '900', 
    color: TOKENS.colors.text.light.emphasis, 
    textTransform: 'uppercase', 
    letterSpacing: 1.5 
  },
  titleContainer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 6 },
  titleText: { 
    fontSize: 28, 
    color: TOKENS.colors.text.light.emphasis, 
    fontWeight: 'bold', 
    letterSpacing: -0.5, 
    textAlign: 'center' 
  },
  subtitleContainer: { paddingHorizontal: 40, paddingBottom: 10 },
  subtitleText: { 
    fontSize: 15, 
    lineHeight: 22, 
    color: TOKENS.colors.text.light.muted, 
    textAlign: 'center', 
    fontWeight: '500' 
  },
  stickyProgressBand: { 
    backgroundColor: TOKENS.colors.background.light, 
    paddingTop: 10, 
    paddingBottom: 10, 
    alignItems: 'center', 
    justifyContent: 'center', 
    zIndex: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(0,0,0,0.02)' 
  },
  progressRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 12 
  },
  progressDot: { height: 6, borderRadius: 3, backgroundColor: 'rgba(203, 213, 225, 0.5)' },
  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20, 
    borderRadius: 24, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.03, 
    shadowRadius: 6, 
    elevation: 1 
  },
  cardActive: { backgroundColor: '#eff3f0', borderWidth: 2, borderColor: 'rgba(140, 161, 143, 0.4)' },
  cardInactive: { backgroundColor: 'white', borderWidth: 1, borderColor: '#f1f5f9' },
  iconContainer: { 
    width: 56, 
    height: 56, 
    borderRadius: 14, 
    backgroundColor: '#f8fafc', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 16 
  },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: TOKENS.colors.text.light.emphasis, marginBottom: 2 },
  cardDesc: { fontSize: 14, color: TOKENS.colors.text.light.muted, lineHeight: 18, fontWeight: '500' },
  radio: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  radioActive: { backgroundColor: TOKENS.colors.primary },
  radioInactive: { borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: 'transparent' },
  ctaButton: { 
    height: 64, 
    borderRadius: 18, 
    width: '100%', 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 40, 
    shadowColor: TOKENS.colors.primary, 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 10, 
    elevation: 4 
  },
  ctaText: { fontSize: 18, color: 'white', fontWeight: 'bold', letterSpacing: 0.5, textTransform: 'uppercase' }
});
