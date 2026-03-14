/**
 * evaluator.ts
 * 
 * CORE LOGIC: Validates and scores recipes against a SlotContract.
 * Used during local "Emergency Fallback" generation and by Gemini prompts.
 */

import { RecipeArchetype, NormalizedRecipe, SlotContract } from './plannerTypes';

/**
 * Score a recipe against a contract.
 * Returns a number where higher is better.
 * Any score below 0 (usually -1000000) is a hard rejection.
 */
export function evaluateRecipeForSlot(
  recipe: NormalizedRecipe,
  contract: SlotContract,
  tier: number = 4
): number {
  let score = 5000;

  // 1. Dietary Baseline (Hard Reject)
  if (contract.dietaryBaseline === 'Vegan' && recipe.archetype !== 'Vegan') {
    if (!recipe.tags?.some(t => t.toLowerCase() === 'vegan')) return -1000000;
  }
  if (contract.dietaryBaseline === 'Vegetarian' && !['Vegan', 'Vegetarian'].includes(recipe.archetype as any)) {
     if (!recipe.tags?.some(t => t.toLowerCase() === 'vegetarian' || t.toLowerCase() === 'vegan')) return -1000000;
  }

  // 2. Hard Exclusions (Allergies / Dislikes)
  if ((contract.tasteProfile?.excludedIngredientTags ?? []).length > 0) {
    const tagMatchFound = (contract.tasteProfile?.excludedIngredientTags ?? []).some(tag => 
       (recipe.ingredientTags ?? []).includes(tag) || (recipe.tags ?? []).includes(tag)
    );
    if (tagMatchFound) {
      return -1000000;
    }
  }

  if ((contract.tasteProfile?.allergies ?? []).length > 0) {
    // Basic allergen check
    const allergenMatch = (contract.tasteProfile?.allergies ?? []).some(a => 
      (recipe.title.toLowerCase().includes(a.toLowerCase()))
    );
    if (allergenMatch) return -1000000;
  }

  // 3. Slot Suitability
  // If a recipe is marked for a specific slot, respect it.
  let eligibleSlots = [...(recipe.suitableFor ?? [])];
  if (tier >= 4) {
    if ((recipe.suitableFor ?? []).includes('lunch')) {
      eligibleSlots.push('breakfast', 'dinner');
    }
    if ((recipe.suitableFor ?? []).includes('dinner')) {
      eligibleSlots.push('lunch');
    }
  }

  if (!eligibleSlots.includes(contract.slotType as any)) {
    score -= 4000; // Heavy penalty but not hard reject for emergencies
  }

  // 4. Effort Band Alignment
  if (contract.preferredEffortBands.includes(recipe.effortBand)) {
    score += 2000;
  } else {
    score -= 1000;
  }

  // 5. Macro Alignment
  const kcal = recipe.macrosPerServing.calories;
  const protein = recipe.macrosPerServing.protein;

  // Calories
  if (kcal < contract.macroTargets.calories.min) score -= 500;
  if (kcal > contract.macroTargets.calories.max) score -= 1500;
  if (kcal >= contract.macroTargets.calories.ideal * 0.9 && kcal <= contract.macroTargets.calories.ideal * 1.1) {
    score += 1500;
  }

  // Protein
  if (protein < contract.macroTargets.protein.min) score -= 1000;
  if (protein >= contract.macroTargets.protein.ideal) score += 1000;

  // 6. Cost Alignment
  const cost = recipe.estimatedCostPerServingGBP;
  if (cost <= contract.budgetEnvelopeGBP) {
    score += 1500;
  } else if (cost > contract.budgetEnvelopeGBP * 1.5) {
    score -= 2000;
  }

  // 7. Contextual Variety (Archetypes)
  if (contract.context === 'weekend' && (recipe.archetype === 'Splurge' || recipe.effortBand === 'slow')) {
    score += 1000;
  }
  if (contract.context === 'routine' && recipe.effortBand === 'quick') {
    score += 1000;
  }

  // 8. Cuisine Preferences
  if (contract.tasteProfile && (contract.tasteProfile.preferredCuisineIds ?? []).length > 0) {
    if (recipe.cuisineId && (contract.tasteProfile?.preferredCuisineIds ?? []).includes(recipe.cuisineId)) {
      score += 3000;
    }
  }

  return score;
}
