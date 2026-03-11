/**
 * recipeRegistry.ts
 * The single source of truth for all recipes in the Provision system.
 * Unifies legacy seed recipes and high-fidelity planner fixtures.
 */

import { NormalizedRecipe, RecipeValidationStatus } from './plannerTypes';
import { Recipe } from '../schema';
import { MOCK_RECIPES } from '../seed';
import { 
  curatedRoast, 
  curatedPasta, 
  generatedLentilStew,
  highProteinSeitan,
  highProteinTempeh,
  highProteinHalloumi,
  highProteinTofuScramble,
  veganTikkaMasala,
  veganMeatloaf,
  veganOvernightOats,
  veganTempehBowl,
  veganOmlette,
  veggieShells,
  veggieMutterPaneer,
  veggieFetaWrap,
  pesciSeabass,
  pesciSalmonBagel
} from './plannerFixtures';
import { auditRecipeImage } from './RecipeImageAuditor';

/**
 * Converts a legacy Recipe object (from seed.ts) into the rigorous NormalizedRecipe format.
 */
export function normalizeLegacyRecipe(recipe: Recipe): NormalizedRecipe {
  const servings = recipe.servings || 1;
  
  // Basic normalization for legacy fields
  return {
    id: recipe.id,
    sourceId: `legacy_${recipe.id}`,
    status: 'approved' as RecipeValidationStatus,
    
    macroConfidence: 0.8, // Legacy data is estimated
    costConfidence: 0.7,
    ingredientMappingConfidence: 0.9,
    servingConfidence: 1.0,
    normalizationWarnings: [],
    
    imageMetadata: auditRecipeImage(recipe.title, recipe.imageUrl),
    
    title: recipe.title,
    description: recipe.description || '',
    imageUrl: recipe.imageUrl,
    totalTimeMinutes: recipe.totalTimeMinutes || (recipe.prepTimeMinutes + (recipe.cookTimeMinutes || 0)),
    prepTimeMinutes: recipe.prepTimeMinutes,
    difficulty: recipe.difficulty || 'Medium',
    
    servings: servings,
    estimatedCostTotalGBP: recipe.estimatedCostGBP,
    estimatedCostPerServingGBP: recipe.costPerServingGBP || (recipe.estimatedCostGBP / servings),
    
    macrosTotal: {
      calories: recipe.macros.calories * servings,
      protein: recipe.macros.protein * servings,
      carbs: recipe.macros.carbs * servings,
      fats: recipe.macros.fats * servings,
    },
    macrosPerServing: recipe.macros,
    
    ingredients: recipe.ingredients.map(i => ({
      name: `Ingredient ${i.ingredientId}`, // We don't have the name mapping easily here without more imports
      amount: i.amount,
      unit: i.unit,
      canonicalIngredientId: i.ingredientId
    })),
    method: recipe.method ? recipe.method.map(m => ({ step: m.step, text: m.text })) : [],
    tags: recipe.tags,
    
    archetype: (recipe.archetype as any) || 'Staple',
    freezerFriendly: recipe.freezerFriendly || false,
    reheatsWell: recipe.reheatsWell || true,
    yieldsLeftovers: true, // Default to true for legacy recipes
    suitableFor: recipe.suitableFor || ['lunch', 'dinner'],
    
    cookTimeMinutes: recipe.cookTimeMinutes,
    notes: recipe.notes,
    substitutions: recipe.substitutions,
    relatedRecipeIds: recipe.relatedRecipeIds,
    
    plannerUsable: true,
    libraryVisible: true
  };
}

// 1. Load Legacy Recipes
const normalizedLegacy = MOCK_RECIPES.map(normalizeLegacyRecipe);

// 2. High-Fidelity Fixtures (already normalized)
const fixtures = [
  curatedRoast,
  curatedPasta,
  generatedLentilStew,
  highProteinSeitan,
  highProteinTempeh,
  highProteinHalloumi,
  highProteinTofuScramble,
  veganTikkaMasala,
  veganMeatloaf,
  veganOvernightOats,
  veganTempehBowl,
  veganOmlette,
  veggieShells,
  veggieMutterPaneer,
  veggieFetaWrap,
  pesciSeabass,
  pesciSalmonBagel
];

/**
 * The full unified catalog as a Record for O(1) lookups.
 */
export const FULL_RECIPE_CATALOG: Record<string, NormalizedRecipe> = {};

[...normalizedLegacy, ...fixtures].forEach(r => {
  FULL_RECIPE_CATALOG[r.id] = r;
});

/**
 * The full unified list for planner selection pools.
 */
export const FULL_RECIPE_LIST: NormalizedRecipe[] = Object.values(FULL_RECIPE_CATALOG);
