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
  pesciSalmonBagel,
} from './plannerFixtures';
import { getRecipeImage } from './RecipeImages';
import { auditRecipeImage } from './RecipeImageAuditor';
import { WAVE1_FIXTURES } from './wave1Fixtures';
import { WAVE2_FIXTURES } from './wave2Fixtures';
import { WAVE3_FIXTURES } from './wave3Fixtures';

/**
 * Converts a legacy Recipe object (from seed.ts) into the rigorous NormalizedRecipe format.
 */
export function normalizeLegacyRecipe(recipe: Recipe): NormalizedRecipe {
  const servings = recipe.servings || 1;
  const resolvedImageUrl = getRecipeImage(recipe.id, recipe.imageUrl);
  const totalMinutes = recipe.totalTimeMinutes || (recipe.prepTimeMinutes + (recipe.cookTimeMinutes || 0));

  // Determine Effort Band based on total duration
  let effortBand: NormalizedRecipe['effortBand'] = 'standard';
  if (totalMinutes <= 30) {
    effortBand = 'quick';
  } else if (totalMinutes > 60) {
    effortBand = 'slow';
  }

  // Tightened suitableFor fallback logic
  let suitableFor = recipe.suitableFor || [];
  if (suitableFor.length === 0) {
    const title = recipe.title.toLowerCase();
    const tags = (recipe.tags || []).map(t => t.toLowerCase());
    
    if (title.includes('breakfast') || tags.includes('breakfast')) {
      suitableFor = ['breakfast'];
    } else if (title.includes('lunch') || tags.includes('lunch')) {
      suitableFor = ['lunch'];
    } else if (title.includes('dinner') || tags.includes('dinner')) {
      suitableFor = ['dinner'];
    } else {
      // Conservative default based on archetype
      const arch = (recipe.archetype || 'Staple').toLowerCase();
      if (arch.includes('breakfast')) {
        suitableFor = ['breakfast'];
      } else if (arch.includes('lunch') || arch.includes('quick')) {
        suitableFor = ['lunch'];
      } else if (arch.includes('dinner') || effortBand === 'slow') {
        suitableFor = ['dinner'];
      } else {
        // Only allow both if it's a standard mid-range effort staple
        suitableFor = effortBand === 'standard' ? ['lunch', 'dinner'] : ['dinner'];
      }
    }
  }

  return {
    id: recipe.id,
    sourceId: `legacy_${recipe.id}`,
    status: 'ready' as RecipeValidationStatus,

    macroConfidence: 0.8,
    costConfidence: 0.7,
    ingredientMappingConfidence: 0.9,
    servingConfidence: 1.0,
    normalizationWarnings: [],

    imageMetadata: auditRecipeImage(recipe.title, resolvedImageUrl),

    title: recipe.title,
    description: recipe.description || '',
    imageUrl: resolvedImageUrl,

    activePrepMinutes: recipe.prepTimeMinutes,
    totalMinutes,
    complexityScore:
      recipe.difficulty === 'Hard' ? 4 : recipe.difficulty === 'Easy' ? 2 : 3,
    effortBand,

    totalTimeMinutes: totalMinutes,
    prepTimeMinutes: recipe.prepTimeMinutes,
    cookTimeMinutes: recipe.cookTimeMinutes,
    difficulty: recipe.difficulty || 'Medium',

    servings,
    estimatedCostTotalGBP: recipe.estimatedCostGBP,
    estimatedCostPerServingGBP:
      recipe.costPerServingGBP || recipe.estimatedCostGBP / servings,

    macrosTotal: {
      calories: recipe.macros.calories * servings,
      protein: recipe.macros.protein * servings,
      carbs: recipe.macros.carbs * servings,
      fats: recipe.macros.fats * servings,
    },
    macrosPerServing: recipe.macros,

    ingredients: recipe.ingredients.map((ingredient) => ({
      name: `Ingredient ${ingredient.ingredientId}`,
      amount: ingredient.amount,
      unit: ingredient.unit,
      canonicalIngredientId: ingredient.ingredientId,
    })),
    method: recipe.method ? recipe.method.map((step) => ({ step: step.step, text: step.text })) : [],
    tags: recipe.tags,

    archetype: (recipe.archetype as any) || 'Staple',
    cuisineId: (recipe as any).cuisineId,
    freezerFriendly: recipe.freezerFriendly ?? false,
    reheatsWell: recipe.reheatsWell ?? true,
    yieldsLeftovers: true,
    suitableFor,

    notes: recipe.notes,
    substitutions: recipe.substitutions,
    relatedRecipeIds: recipe.relatedRecipeIds,
    ingredientTags: (recipe as any).ingredientTags || [],
    flavourIds: (recipe as any).flavourIds || [],
    styleIds: (recipe as any).styleIds || [],

    plannerUsable: true,
    libraryVisible: true,
  };
}

const normalizedLegacy = MOCK_RECIPES.map(normalizeLegacyRecipe);

const fixtures = [
  ...WAVE1_FIXTURES,
  ...WAVE2_FIXTURES,
  ...WAVE3_FIXTURES,
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
  pesciSalmonBagel,
];

/**
 * The full unified catalog as a Record for O(1) lookups.
 */
export const FULL_RECIPE_CATALOG: Record<string, NormalizedRecipe> = {};

[...normalizedLegacy, ...fixtures].forEach((recipe) => {
  const resolvedImageUrl = getRecipeImage(recipe.id, recipe.imageUrl);

  FULL_RECIPE_CATALOG[recipe.id] = {
    ...recipe,
    imageUrl: resolvedImageUrl,
    imageMetadata: auditRecipeImage(recipe.title, resolvedImageUrl),
  };
});

/**
 * The full unified list for planner selection pools.
 */
export const FULL_RECIPE_LIST: NormalizedRecipe[] = Object.values(FULL_RECIPE_CATALOG);
