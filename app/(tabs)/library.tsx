import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useRecipes, SortOption } from '../../data/RecipeContext';
import { FontAwesome5 } from '@expo/vector-icons';
import { NormalizedRecipe, CuisineId } from '../../data/planner/plannerTypes';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import ImportRecipeModal from '../../components/ImportRecipeModal';

const CUISINES: { id: CuisineId | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'italian', label: 'Italian' },
  { id: 'mexican', label: 'Mexican' },
  { id: 'japanese', label: 'Japanese' },
  { id: 'mediterranean', label: 'Mediterranean' },
];

const SORT_OPTIONS: { id: SortOption; label: string; icon: string }[] = [
  { id: 'newest', label: 'Newest', icon: 'clock' },
  { id: 'protein', label: 'Protein', icon: 'dumbbell' },
  { id: 'calories', label: 'Calories', icon: 'leaf' },
  { id: 'time', label: 'Faster', icon: 'bolt' },
];

export default function RecipeLibrary() {
  const { 
    filteredRecipes, 
    searchQuery, 
    setSearchQuery, 
    activeCuisine, 
    setActiveCuisine,
    sortBy,
    setSortBy
  } = useRecipes();
  const { width } = useWindowDimensions();
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  const isDesktop = width >= 768;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Recipe Library</Text>
            <Text style={styles.subtitle}>
              Browse Provision classics and your imported collection.
            </Text>
          </View>
          
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => setImportModalVisible(true)}
            style={styles.importBtn}
          >
            <FontAwesome5 name="plus" size={10} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.importBtnText}>Import Recipe</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar - Refined Utility Input */}
        <View style={styles.searchRow}>
          <View style={[
            styles.searchContainer,
            isSearchFocused && styles.searchContainerFocused
          ]}>
            <View style={styles.searchIcon}>
              <FontAwesome5 name="search" size={12} color={isSearchFocused ? '#9DCD8B' : '#A3B3A9'} />
            </View>
            <TextInput
              placeholder="Search recipes, cuisines, tags..."
              placeholderTextColor="#A3B3A9"
              style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                <FontAwesome5 name="times-circle" size={14} color="#BBB" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter & Sort Bar - Softened Rhythm */}
        <View style={styles.filterSortRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {CUISINES.map(c => (
              <TouchableOpacity 
                key={c.id} 
                onPress={() => setActiveCuisine(c.id)}
                style={[
                  styles.filterChip, 
                  activeCuisine === c.id && styles.filterChipActive
                ]}
              >
                <Text style={[
                  styles.filterChipText, 
                  activeCuisine === c.id && styles.filterChipTextActive
                ]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.divider} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortScroll}>
            {SORT_OPTIONS.map(s => (
              <TouchableOpacity 
                key={s.id} 
                onPress={() => setSortBy(s.id)}
                style={[
                  styles.sortChip, 
                  sortBy === s.id && styles.sortChipActive
                ]}
              >
                <FontAwesome5 
                  name={s.icon} 
                  size={10} 
                  color={sortBy === s.id ? '#24332D' : '#6A766E'} 
                  style={{ marginRight: 6 }} 
                />
                <Text style={[
                  styles.sortChipText, 
                  sortBy === s.id && styles.sortChipTextActive
                ]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Recipe Grid */}
        <View style={styles.grid}>
          {filteredRecipes.length > 0 ? (
            filteredRecipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} isDesktop={isDesktop} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <FontAwesome5 name="search" size={24} color="#A3B3A9" />
              </View>
              <Text style={styles.emptyText}>No recipes found</Text>
              <Text style={styles.emptySubtext}>Try adjusting your search or filters.</Text>
              <TouchableOpacity 
                onPress={() => {
                  setSearchQuery('');
                  setActiveCuisine('all');
                }}
                style={styles.resetBtn}
              >
                <Text style={styles.resetBtnText}>Clear all</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <ImportRecipeModal
        visible={importModalVisible}
        onClose={() => setImportModalVisible(false)}
      />
    </View>
  );
}

function RecipeCard({ recipe, isDesktop }: { recipe: NormalizedRecipe, isDesktop: boolean }) {
  const router = useRouter();

  // Defensive values
  const title = recipe.title || 'Untitled Recipe';
  const totalMinutes = recipe.totalMinutes ?? 0;
  const protein = recipe.macrosPerServing?.protein ?? 0;
  const cuisine = recipe.cuisineId ? recipe.cuisineId.charAt(0).toUpperCase() + recipe.cuisineId.slice(1) : null;
  const status = recipe.status || 'needs_review';
  const isImported = recipe.sourceId?.startsWith('imported_') || recipe.sourceId === 'imported_user';

  return (
    <TouchableOpacity 
      activeOpacity={0.94}
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      style={[
        styles.card, 
        { width: isDesktop ? '31%' : '100%' }
      ]}
    >
      <View style={styles.imageContainer}>
        {recipe.imageUrl ? (
          <Image source={recipe.imageUrl} style={styles.image} contentFit="cover" transition={200} />
        ) : (
          <View style={styles.placeholderContainer}>
             <View style={styles.placeholderAccent} />
             <View style={styles.placeholderContent}>
                <View style={styles.placeholderIconContainer}>
                   <FontAwesome5 name="utensils" size={24} color="#9DCD8B" />
                </View>
                <Text style={styles.placeholderText}>Provision Recipe</Text>
                <Text style={styles.placeholderSubtext}>
                  {protein >= 35 ? 'High Protein' : (cuisine || 'Nutritious')} • {recipe.tags?.[0] || 'Fresh'}
                </Text>
             </View>
          </View>
        )}
        
        {/* Badges - Subtle Provision/Import Labels */}
        <View style={styles.badgeRow}>
          <View style={[styles.sourceBadge, isImported ? styles.sourceImported : styles.sourceCurated]}>
            <Text style={[styles.sourceBadgeText, isImported && { color: '#FFF' }]}>
              {isImported ? 'Imported' : 'Provision'}
            </Text>
          </View>
          
          {status !== 'ready' && (
            <View style={[styles.statusBadge, status === 'draft' && styles.statusDraft]}>
              <Text style={styles.statusBadgeText}>
                {status === 'draft' ? 'Draft' : 'Review'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.cardInfo}>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {title}
        </Text>
        
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <FontAwesome5 name="clock" size={10} color="#A3B3A9" style={{ marginRight: 4 }} />
            <Text style={styles.metaText}>{totalMinutes}m</Text>
          </View>
          <View className="w-[1px] h-2 bg-black/[0.05]" />
          {cuisine && (
            <View style={styles.metaItem}>
              <Text style={styles.metaText}>{cuisine}</Text>
            </View>
          )}
          {cuisine && <View className="w-[1px] h-2 bg-black/[0.05]" />}
          <View style={styles.metaItem}>
            <Text style={styles.metaText}>{protein}g protein</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBFCF8' },
  scrollContent: { paddingHorizontal: 32, paddingBottom: 100, paddingTop: 32 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 24 
  },
  title: { fontSize: 28, fontWeight: '500', color: '#1B251F', letterSpacing: -0.8 },
  subtitle: { fontSize: 15, color: '#6A766E', marginTop: 2, fontWeight: '400' },
  
  importBtn: {
    backgroundColor: '#7BA96A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  importBtnText: { color: 'white', fontWeight: '700', fontSize: 12 },

  searchRow: {
    marginBottom: 20,
    flexDirection: 'row',
  },
  searchContainer: { 
    flex: 1,
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: 'rgba(0,0,0,0.02)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.01,
    shadowRadius: 4,
    height: 44,
    maxWidth: 600,
    transitionProperty: 'border-color, box-shadow',
    transitionDuration: '200ms',
  } as any,
  searchContainerFocused: {
    borderColor: '#9DCD8B',
    shadowOpacity: 0.03,
    shadowRadius: 8,
  },
  searchIcon: { paddingLeft: 14, paddingRight: 8 },
  searchInput: { 
    flex: 1, 
    height: '100%', 
    fontSize: 14, 
    fontWeight: '400',
    color: '#1B251F'
  },
  clearBtn: { paddingRight: 14 },

  filterSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    gap: 12
  },
  filterScroll: { gap: 6 },
  sortScroll: { gap: 6 },
  divider: { width: 1, height: 16, backgroundColor: 'rgba(0,0,0,0.06)', marginHorizontal: 2 },

  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)'
  },
  filterChipActive: { backgroundColor: '#F0F7ED', borderColor: '#9DCD8B' },
  filterChipText: { fontSize: 12, fontWeight: '500', color: '#6A766E' },
  filterChipTextActive: { color: '#24332D', fontWeight: '600' },

  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)'
  },
  sortChipActive: { backgroundColor: '#F0F7ED', borderColor: '#9DCD8B' },
  sortChipText: { fontSize: 11, fontWeight: '600', color: '#6A766E', letterSpacing: 0.1 },
  sortChipTextActive: { color: '#24332D' },
  
  grid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 20,
    justifyContent: 'flex-start'
  },
  card: { 
    backgroundColor: '#FFF', 
    borderRadius: 24, 
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
    marginBottom: 4
  },
  imageContainer: { height: 180, backgroundColor: '#F0F7ED', position: 'relative' },
  image: { width: '100%', height: '100%' },

  placeholderContainer: { flex: 1, overflow: 'hidden' },
  placeholderAccent: { position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.4)' },
  placeholderContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderIconContainer: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    backgroundColor: '#FFF', 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    marginBottom: 12
  },
  placeholderText: { fontSize: 14, fontWeight: '700', color: '#24332D', opacity: 0.8 },
  placeholderSubtext: { fontSize: 10, fontWeight: '600', color: '#6A766E', opacity: 0.6, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  badgeRow: { 
    position: 'absolute', 
    top: 12, 
    left: 12, 
    right: 12, 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sourceBadge: { 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6, 
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)'
  },
  sourceImported: { backgroundColor: '#7BA96A', borderColor: '#7BA96A' },
  sourceCurated: { backgroundColor: 'rgba(255, 255, 255, 0.96)' },
  sourceBadgeText: { fontSize: 10, fontWeight: '700', color: '#1B251F' },
  
  statusBadge: { 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6, 
    backgroundColor: '#E8B07A',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)'
  },
  statusDraft: {
    backgroundColor: '#F0F2ED',
    borderColor: 'rgba(0,0,0,0.05)',
  },
  statusBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  
  cardInfo: { padding: 16 },
  cardTitle: { fontSize: 17, fontWeight: '500', color: '#1B251F', marginBottom: 8, letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 12, color: '#6A766E', fontWeight: '500' },
  
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 100, width: '100%' },
  emptyIconContainer: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FBFCF8', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
  emptyText: { fontSize: 17, fontWeight: '600', color: '#1B251F', marginBottom: 4 },
  emptySubtext: { fontSize: 14, color: '#6A766E', marginBottom: 16, textAlign: 'center' },
  resetBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.03)' },
  resetBtnText: { color: '#6A766E', fontWeight: '600', fontSize: 12 }
});
