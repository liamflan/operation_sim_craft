/**
 * RecipeImages.ts
 * Central registry for UNIQUE, custom-generated recipe images.
 * This ensures that image resolution is strictly keyed by recipeId.
 */

export const UNIQUE_RECIPE_IMAGES: Record<string, any> = {
  // Strategic overrides for curated identity logic
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
