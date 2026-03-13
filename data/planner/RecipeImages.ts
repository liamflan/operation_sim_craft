/**
 * RecipeImages.ts
 *
 * ROLE: STRATEGIC OVERRIDE LAYER
 * Provides a recipeId-keyed mapping for reviewed, manual, or local image replacements.
 *
 * RESOLUTION PATH:
 * Recipe Definition (imageUrl) -> Registry Assembly -> Strategic Override (getRecipeImage) -> Final Runtime Image
 *
 * ⚠️ INTENT GUIDANCE:
 * - This is NOT the authoring location for recipe content.
 * - Components should consume the resolved image path via getRecipeImage() or the central registry.
 * - This file ensures that image resolution is strictly keyed by recipeId.
 */

export const UNIQUE_RECIPE_IMAGES: Record<string, any> = {
  // Strategic overrides for curated identity logic
  'rec_wave1_tuna_bean_salad_01': require('../../assets/images/recipes/recipe_rec_wave1_tuna_bean_salad_01.webp'),
  'rec_wave1_chickpea_curry_01': require('../../assets/images/recipes/recipe_rec_wave1_chickpea_curry_01.webp'),
  'w2_r1_lamb': require('../../assets/images/recipes/recipe_w2_r1_lamb.webp'),
  'w2_r2_risotto': require('../../assets/images/recipes/recipe_w2_r2_risotto.webp'),
  'w2_r3_sausage_tray': require('../../assets/images/recipes/recipe_w2_r3_sausage_tray.webp'),
  'w2_r4_caprese_chicken': require('../../assets/images/recipes/recipe_w2_r4_caprese_chicken.webp'),
  'w2_r5_lentil_stew': require('../../assets/images/recipes/recipe_w2_r5_lentil_stew.webp'),
  'w2_r6_black_bean_quinoa': require('../../assets/images/recipes/recipe_w2_r6_black_bean_quinoa.webp'),
  'w2_r7_chickpea_sandwich': require('../../assets/images/recipes/recipe_w2_r7_chickpea_sandwich.webp'),
  'w2_r8_egg_salad_wrap': require('../../assets/images/recipes/recipe_w2_r8_egg_salad_wrap.webp'),
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
