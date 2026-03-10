/**
 * dietRules.ts
 * Canonical logic for dietary baseline enforcement.
 */

import { NormalizedRecipe, DietaryBaseline } from './plannerTypes';

/**
 * Returns true if the recipe is strictly allowed for the given baseline diet.
 * logic is cumulative: Vegan implies Vegetarian.
 */
export function isRecipeAllowedForBaselineDiet(
  recipe: NormalizedRecipe, 
  baselineDiet: DietaryBaseline
): boolean {
  if (baselineDiet === 'Omnivore') return true;

  const tags = (recipe.tags || []).map(t => t.toLowerCase());
  const title = recipe.title.toLowerCase();

  // Heuristic-heavy logic as a fallback for missing allowedDiets field
  // In Phase 18C/D we should prefer explicit allowedDiets metadata.
  
  const isVeganTag = tags.includes('vegan');
  const isVegetarianTag = tags.includes('vegetarian') || isVeganTag;
  
  if (baselineDiet === 'Vegan') {
    return isVeganTag;
  }

  if (baselineDiet === 'Vegetarian') {
    return isVegetarianTag;
  }

  if (baselineDiet === 'Pescatarian') {
    if (isVegetarianTag) return true;
    const isFish = tags.includes('pescatarian') || 
                   tags.includes('fish') || 
                   tags.includes('seafood') ||
                   title.includes('salmon') || 
                   title.includes('tuna') || 
                   title.includes('prawn') ||
                   title.includes('cod') ||
                   title.includes('haddock') ||
                   title.includes('fish');
    return isFish;
  }

  return true;
}
