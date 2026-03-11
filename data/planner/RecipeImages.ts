/**
 * RecipeImages.ts
 * Central registry for UNIQUE, custom-generated recipe images.
 * This ensures that image resolution is strictly keyed by recipeId.
 */

export const UNIQUE_RECIPE_IMAGES: Record<string, any> = {
  'r6': require('../../assets/images/recipes/recipe_r6.png'),
  'r51': require('../../assets/images/recipes/recipe_r51.png'),
};

/**
 * Returns the unique image for a recipe if it exists, otherwise returns the fallback.
 */
export function getRecipeImage(recipeId: string, fallbackUrl: string | any): any {
  if (UNIQUE_RECIPE_IMAGES[recipeId]) {
    return UNIQUE_RECIPE_IMAGES[recipeId];
  }
  return fallbackUrl;
}
