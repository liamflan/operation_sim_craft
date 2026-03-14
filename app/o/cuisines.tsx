import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { TOKENS } from '../../theme/tokens';
import { useActivePlan } from '../../data/ActivePlanContext';
import { CuisineId } from '../../data/planner/plannerTypes';

/**
 * OnboardingCuisines (Pass 30 - Header Spacing Refinement)
 * 
 * PASS 30 IMPROVEMENTS:
 * 1. BALANCED SPACING: Achieving even gaps between subtitle -> dots and dots -> separator.
 * 2. SLIMMER BAND: Compacted the sticky band further for a tighter, premium rhythm.
 */
export default function OnboardingCuisines() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { workspace, updateCuisinePreferences } = useActivePlan();

  const [selected, setSelected] = useState<CuisineId[]>([]);

  useEffect(() => {
    const saved = workspace.input?.payload?.preferredCuisineIds;
    if (saved && saved.length > 0) {
      setSelected(saved as CuisineId[]);
    }
  }, []);

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

  const cardWidth = (width - 48 - 16) / 2;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      
      <ScrollView 
        contentContainerStyle={{ 
          paddingBottom: insets.bottom + 60 
        }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[3]} // Branding(0), Title(1), Subtitle(2), Progress(3) sticky
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
          <Text style={styles.titleText}>Explore your tastes</Text>
        </View>

        {/* 3. SCROLLABLE SUBTITLE */}
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitleText}>Pick at least 1 cuisine you'd love to see this week.</Text>
        </View>

        {/* 4. BALANCED STICKY PROGRESS BAND (PASS 30) */}
        <View style={styles.stickyProgressBand}>
            <View style={styles.progressRow}>
                <View style={[styles.progressDot, { width: 6 }]} />
                <View style={[styles.progressDot, { width: 6 }]} />
                <View style={[styles.progressDot, { width: 32, backgroundColor: 'rgba(140, 161, 143, 0.7)' }]} />
                <View style={[styles.progressDot, { width: 6 }]} />
                <View style={[styles.progressDot, { width: 6 }]} />
            </View>
        </View>

        {/* 5. MAIN CONTENT */}
        <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
          <View style={styles.countContainer}>
            <View style={styles.countPill}>
              <Text style={styles.countText}>{selected.length} Selected</Text>
            </View>
          </View>

          <View style={styles.grid}>
            {CUISINES.map((cuisine) => {
              const isSelected = selected.includes(cuisine.id);
              return (
                <TouchableOpacity
                  key={cuisine.id}
                  activeOpacity={0.8}
                  onPress={() => toggleCuisine(cuisine.id)}
                  style={[styles.card, { width: cardWidth }, isSelected ? styles.cardActive : styles.cardInactive]}
                >
                  <View style={[styles.iconContainer, isSelected && { backgroundColor: 'transparent' }]}>
                    <FontAwesome5 
                      name={cuisine.icon} 
                      size={18} 
                      color={isSelected ? TOKENS.colors.primary : 'rgba(148, 163, 184, 0.7)'} 
                    />
                  </View>

                  <View>
                    <Text style={styles.cardTitle}>{cuisine.name}</Text>
                    <Text style={styles.cardDesc} numberOfLines={2}>{cuisine.desc}</Text>
                  </View>

                  {isSelected && (
                    <View style={styles.check}>
                      <MaterialIcons name="check" size={14} color="white" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Locked CTA wording: Continue */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleNext}
            disabled={selected.length === 0}
            style={[styles.ctaButton, { backgroundColor: selected.length > 0 ? TOKENS.colors.primary : '#cbd5e1' }]}
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
    fontSize: 14, 
    lineHeight: 20, 
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
  countContainer: { alignItems: 'center', marginBottom: 20 },
  countPill: { 
    paddingHorizontal: 12, 
    paddingVertical: 4, 
    backgroundColor: '#eff3f0', 
    borderRadius: 100, 
    borderWidth: 1, 
    borderColor: 'rgba(140, 161, 143, 0.2)' 
  },
  countText: { fontSize: 10, color: TOKENS.colors.primary, letterSpacing: 1, fontWeight: 'bold', textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16 },
  card: { 
    padding: 16, 
    borderRadius: 24, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.02, 
    shadowRadius: 6, 
    elevation: 1, 
    position: 'relative' 
  },
  cardActive: { backgroundColor: '#eff3f0', borderWidth: 2, borderColor: 'rgba(140, 161, 143, 0.4)' },
  cardInactive: { backgroundColor: 'white', borderWidth: 1, borderColor: '#f1f5f9' },
  iconContainer: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    backgroundColor: '#f8fafc', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 12 
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: TOKENS.colors.text.light.emphasis, marginBottom: 2 },
  cardDesc: { fontSize: 11, color: TOKENS.colors.text.light.muted, lineHeight: 14, fontWeight: '500' },
  check: { 
    position: 'absolute', 
    top: 12, 
    right: 12, 
    width: 20, 
    height: 20, 
    borderRadius: 10, 
    backgroundColor: TOKENS.colors.primary, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
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
