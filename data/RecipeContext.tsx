import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { StorageService } from './storage';
import { 
  NormalizedRecipe, 
  CuisineId, 
  RecipeValidationStatus,
  CUISINE_PROFILES
} from './planner/plannerTypes';
import { FULL_RECIPE_LIST } from './planner/recipeRegistry';

export type SortOption = 'protein' | 'calories' | 'time' | 'newest';

interface RecipeContextType {
  allRecipes: NormalizedRecipe[];
  curatedRecipes: NormalizedRecipe[];
  importedRecipes: NormalizedRecipe[];
  plannerEligibleRecipes: NormalizedRecipe[];
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeCuisine: CuisineId | 'all';
  setActiveCuisine: (cuisine: CuisineId | 'all') => void;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  filteredRecipes: NormalizedRecipe[];
  resolveCuisineId: (recipe: NormalizedRecipe) => CuisineId | undefined;
  importRecipe: (recipeData: Partial<NormalizedRecipe>) => Promise<void>;
  updateRecipe: (recipeId: string, updates: Partial<NormalizedRecipe>) => Promise<void>;
  deleteRecipe: (recipeId: string) => Promise<void>;
}

const STORAGE_KEY = 'provision_imported_recipes_v1';

const RecipeContext = createContext<RecipeContextType | undefined>(undefined);

export function RecipeProvider({ children }: { children: React.ReactNode }) {
  const [importedRecipes, setImportedRecipes] = useState<NormalizedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCuisine, setActiveCuisine] = useState<CuisineId | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Hydrate imported recipes on mount
  useEffect(() => {
    const hydrate = async () => {
      try {
        const saved = await StorageService.getItem(STORAGE_KEY);
        if (saved) {
          setImportedRecipes(JSON.parse(saved));
        }
      } catch (err) {
        console.error('[RecipeContext] Failed to hydrate imported recipes:', err);
      } finally {
        setIsLoading(false);
      }
    };
    hydrate();
  }, []);

  // Persist imported recipes whenever they change
  useEffect(() => {
    if (!isLoading) {
      StorageService.setItem(STORAGE_KEY, JSON.stringify(importedRecipes)).catch(err => {
        console.error('[RecipeContext] Failed to save imported recipes:', err);
      });
    }
  }, [importedRecipes, isLoading]);

  // UNIFICATION: Curated recipes come from the real Registry
  const curatedRecipes = useMemo(() => {
    return FULL_RECIPE_LIST.map(r => ({
      ...r,
      // Ensure library-consistent metadata for curated set
      status: 'ready' as RecipeValidationStatus,
      plannerUsable: true,
      libraryVisible: r.libraryVisible ?? true,
      sourceId: r.sourceId || `curated_${r.id}`
    }));
  }, []);

  const allRecipes = useMemo(() => {
    return [...curatedRecipes, ...importedRecipes];
  }, [curatedRecipes, importedRecipes]);

  // TRUST MODEL: Recipes eligible for the planner (status === 'ready')
  const plannerEligibleRecipes = useMemo(() => {
    return allRecipes.filter(r => r.status === 'ready');
  }, [allRecipes]);

  // Phase 21: Robust Cuisine Resolution
  const resolveCuisineId = useMemo(() => (recipe: NormalizedRecipe): CuisineId | undefined => {
    if (recipe.cuisineId) return recipe.cuisineId;
    
    // Fallback: Map legacy tags to canonical IDs
    const tags = (recipe.tags || []).map(t => t.toLowerCase());
    
    if (tags.some(t => t.includes('italian'))) return 'italian';
    if (tags.some(t => t.includes('mexican'))) return 'mexican';
    if (tags.some(t => t.includes('japanese'))) return 'japanese';
    if (tags.some(t => t.includes('chinese'))) return 'chinese';
    if (tags.some(t => t.includes('indian'))) return 'indian';
    if (tags.some(t => t.includes('mediterranean'))) return 'mediterranean';
    if (tags.some(t => t.includes('middle eastern'))) return 'middle_eastern';
    if (tags.some(t => t.includes('korean'))) return 'korean';
    if (tags.some(t => t.includes('french'))) return 'french';
    if (tags.some(t => t.includes('thai') || t.includes('vietamese') || t.includes('south east asian'))) return 'south_east_asian';
    
    return undefined;
  }, []);

  const filteredRecipes = useMemo(() => {
    let result = [...allRecipes];

    // 1. Search Query with Defensive Guards
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => {
        const title = r.title || '';
        const desc = r.description || '';
        const tags = Array.isArray(r.tags) ? r.tags : [];
        const cuisine = r.cuisineId || '';
        
        return title.toLowerCase().includes(q) || 
               desc.toLowerCase().includes(q) ||
               tags.some(t => typeof t === 'string' && t.toLowerCase().includes(q)) ||
               cuisine.toLowerCase().includes(q);
      });
    }

    // 2. Cuisine Filter
    if (activeCuisine !== 'all') {
      result = result.filter(r => resolveCuisineId(r) === activeCuisine);
    }

    // 3. Sorting with Defensive Fallbacks
    result.sort((a, b) => {
      if (sortBy === 'protein') {
        const aP = a.macrosPerServing?.protein ?? 0;
        const bP = b.macrosPerServing?.protein ?? 0;
        return bP - aP;
      }
      if (sortBy === 'calories') {
        const aC = a.macrosPerServing?.calories ?? 0;
        const bC = b.macrosPerServing?.calories ?? 0;
        return aC - bC; // Lower calories first
      }
      if (sortBy === 'time') {
        const aT = a.totalMinutes ?? 0;
        const bT = b.totalMinutes ?? 0;
        return aT - bT; // Faster first
      }
      // 'newest' (imported first, then by internal order)
      const isAImported = a.sourceId === 'imported_user';
      const isBImported = b.sourceId === 'imported_user';
      if (isAImported && !isBImported) return -1;
      if (!isAImported && isBImported) return 1;
      return 0;
    });

    return result;
  }, [allRecipes, searchQuery, activeCuisine, sortBy]);

  const importRecipe = async (recipeData: Partial<NormalizedRecipe>) => {
    const newRecipe: NormalizedRecipe = {
      // Defaults for a newly imported recipe
      id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sourceId: 'imported_user',
      status: 'needs_review', 
      plannerUsable: false, 
      libraryVisible: true,
      macroConfidence: 0.5,
      costConfidence: 0.5,
      ingredientMappingConfidence: 0.5,
      servingConfidence: 1.0,
      normalizationWarnings: [],
      title: 'Untitled Imported Recipe',
      description: '',
      activePrepMinutes: 10,
      totalMinutes: 30,
      complexityScore: 3,
      servings: 1,
      estimatedCostTotalGBP: 0,
      estimatedCostPerServingGBP: 0,
      macrosTotal: { calories: 0, protein: 0, carbs: 0, fats: 0 },
      macrosPerServing: { calories: 0, protein: 0, carbs: 0, fats: 0 },
      ingredients: [],
      method: [],
      tags: ['New Import'],
      ingredientTags: [],
      flavourIds: [],
      styleIds: [],
      archetype: 'Staple',
      freezerFriendly: false,
      reheatsWell: true,
      yieldsLeftovers: false,
      suitableFor: ['dinner'],
      ...recipeData,
    };

    // Override plannerUsable based on status for total safety on creation
    newRecipe.plannerUsable = newRecipe.status === 'ready';

    setImportedRecipes(prev => [newRecipe, ...prev]);
  };

  const updateRecipe = async (recipeId: string, updates: Partial<NormalizedRecipe>) => {
    setImportedRecipes(prev => prev.map(r => {
      if (r.id === recipeId) {
        const next = { ...r, ...updates };
        // Enforce Trust Model: planner eligibility strictly follows status
        next.plannerUsable = next.status === 'ready';
        return next;
      }
      return r;
    }));
  };

  const deleteRecipe = async (recipeId: string) => {
    setImportedRecipes(prev => prev.filter(r => r.id !== recipeId));
  };

  return (
    <RecipeContext.Provider value={{
      allRecipes,
      curatedRecipes,
      importedRecipes,
      plannerEligibleRecipes,
      isLoading,
      searchQuery,
      setSearchQuery,
      activeCuisine,
      setActiveCuisine,
      sortBy,
      setSortBy,
      filteredRecipes,
      resolveCuisineId,
      importRecipe,
      updateRecipe,
      deleteRecipe
    }}>
      {children}
    </RecipeContext.Provider>
  );
}

export function useRecipes() {
  const context = useContext(RecipeContext);
  if (context === undefined) {
    throw new Error('useRecipes must be used within a RecipeProvider');
  }
  return context;
}
