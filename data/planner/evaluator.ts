/**
 * evaluator.ts
 * The core intelligence engine. Pure functions to score, reject, and rescue planner assignments.
 */

import {
  NormalizedRecipe,
  SlotContract,
  PlannerCandidate,
  InsightMetadata,
  RescueFailureReason,
  VarietyContext,
  CUISINE_PROFILES
} from './plannerTypes';
import { isRecipeAllowedForBaselineDiet } from './dietRules';
import { PantryItem } from '../PantryContext';

const PANTRY_STOPLIST = ['salt', 'pepper', 'water', 'oil', 'olive oil', 'vegetable oil', 'black pepper', 'sea salt'];

/**
 * Validates if a recipe passes hard, non-negotiable eligibility constraints for a slot.
 * Supports tiered relaxation levels to ensure a "Guarantee-Fill" policy.
 */
export function checkHardEligibility(
  recipe: NormalizedRecipe, 
  contract: SlotContract,
  varietyCtx: VarietyContext,
  tier: 1 | 2 | 3 | 4 = 1
): RescueFailureReason[] {
  const failures: RescueFailureReason[] = [];

  // 0. Profile Exclusions / Ingredient Exclusions (HARD - NEVER RELAXED)
  if (contract.hardExclusions && contract.hardExclusions.length > 0) {
    const exclusionMatchFound = contract.hardExclusions.some(exclusion => {
      const pattern = new RegExp(`(?:^|[^a-z])${exclusion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^a-z]|$)`, 'i');
      return recipe.ingredients.some(ingredient => {
        const normalizedIngredient = ingredient.name.toLowerCase().trim();
        return pattern.test(normalizedIngredient);
      });
    });
    if (exclusionMatchFound) {
      failures.push('exclusion_ingredient_match');
    }
  }

  // Phase 21: excludedIngredientTags (HARD - NEVER RELAXED)
  if (contract.tasteProfile?.excludedIngredientTags && contract.tasteProfile.excludedIngredientTags.length > 0) {
    const tagMatchFound = contract.tasteProfile.excludedIngredientTags.some(tag => 
       recipe.ingredientTags.includes(tag) || recipe.tags.includes(tag)
    );
    if (tagMatchFound) {
       failures.push('exclusion_ingredient_match');
    }
  }

  // 1. Dietary Baseline Enforcement (HARD - NEVER RELAXED)
  if (!isRecipeAllowedForBaselineDiet(recipe, contract.dietaryBaseline)) {
    failures.push('dietary_mismatch');
  }

  // 2. Usability check (HARD - NEVER RELAXED)
  if (!recipe.plannerUsable) {
    failures.push('not_planner_usable');
  }

  // Slot Suitability (Relaxed only in Tier 4 for Breakfast/Lunch overlap)
  let eligibleSlots = [...recipe.suitableFor];
  if (tier >= 4) {
    // If we are desperate, allow lunch recipes to fill breakfast/dinner and vice versa
    // but only if it's not a complete mismatch (e.g. snack vs dinner)
    if (recipe.suitableFor.includes('lunch')) {
      eligibleSlots.push('breakfast', 'dinner');
    }
  }

  if (!eligibleSlots.includes(contract.slotType as any)) {
    failures.push('no_slot_match');
  }

  // Budget (Progressive Relaxation)
  let budgetMultiplier = 1.5; 
  if (tier === 3) budgetMultiplier = 2.0;
  if (tier >= 4) budgetMultiplier = 3.0; // Desperate budget expansion

  const budgetTolerance = contract.budgetEnvelopeGBP * budgetMultiplier; 
  if (recipe.estimatedCostPerServingGBP > budgetTolerance) {
    failures.push('budget_delta_exceeded');
  }
  
  // Macros (Strict Limits -> Progressive Relaxation)
  let proteinMin = contract.macroTargets.protein.min;
  let calorieMax = contract.macroTargets.calories.max;
  let calorieMin = contract.macroTargets.calories.min * 0.75;

  if (tier === 3) {
    proteinMin *= 0.8; // Relax protein target by 20%
    calorieMax *= 1.2; // Relax calorie max by 20%
  }
  if (tier >= 4) {
    proteinMin = 5; // Absolute floor for protein
    calorieMax *= 1.5; // High calorie ceiling
    calorieMin = 100; // Low calorie floor
  }

  if (recipe.macrosPerServing.protein < proteinMin) {
    failures.push('protein_minimum_failed');
  }
  if (recipe.macrosPerServing.calories > calorieMax) {
    failures.push('calorie_maximum_exceeded');
  }
  if (recipe.macrosPerServing.calories < calorieMin) {
    failures.push('calorie_minimum_failed');
  }

  // Archetype & Repeat Caps (Relaxed in Tier 2+)
  if (tier === 1) {
    const cap = contract.archetypeCaps[recipe.archetype];
    if (cap !== undefined && varietyCtx.archetypeDensity >= cap) {
      failures.push('archetype_cap_exhausted');
    }
    if (varietyCtx.repeatCount >= contract.repeatCap) {
      failures.push('repeat_cap_exhausted');
    }
  }
  // Even in rescue, we still block same-day duplicates
  if (varietyCtx.sameDayArchetypes.has(recipe.id)) {
    failures.push('same_day_duplicate');
  }

  // Leftovers / Batch Cook Rules (Relaxed in Tier 2+)
  if (tier === 1) {
    if (contract.leftoverPreference === 'require_leftover' && !recipe.yieldsLeftovers) {
      failures.push('leftover_mismatch');
    }
    
    if (contract.batchCookPreference === 'required' && recipe.archetype !== 'Batch_Cook') {
      failures.push('batch_cook_mismatch');
    } else if (contract.batchCookPreference === 'discouraged' && recipe.archetype === 'Batch_Cook') {
      failures.push('batch_cook_mismatch');
    }
  }

  // Effort Band enforcement (Hard Gates -> Relaxed in Tier 3+)
  if (tier < 3) {
    if (contract.context === 'routine' && recipe.effortBand === 'slow') {
      failures.push('effort_mismatch');
    }
    if (contract.preferredEffortBands && contract.preferredEffortBands.length > 0) {
      if (contract.slotType !== 'dinner' && recipe.effortBand === 'slow') {
          failures.push('effort_mismatch');
      }
    }
  }

  return failures;
}

/**
 * Generates discrete dimension scores for an eligible candidate.
 */
export function scoreCandidate(
  recipe: NormalizedRecipe, 
  contract: SlotContract,
  varietyCtx: VarietyContext,
  pantryItems: PantryItem[] = [],
  tier: 1 | 2 | 3 | 4 = 1
): { scores: PlannerCandidate['scores']; penalties: PlannerCandidate['penalties'] } {
  
  // Macro Fit
  const pDelta = Math.abs(recipe.macrosPerServing.protein - contract.macroTargets.protein.ideal);
  const pScore = Math.max(0, 100 - (pDelta / contract.macroTargets.protein.ideal) * 100);
  
  const cDelta = Math.abs(recipe.macrosPerServing.calories - contract.macroTargets.calories.ideal);
  const cScore = Math.max(0, 100 - (cDelta / contract.macroTargets.calories.ideal) * 100);
  const macroFitScore = Math.round((pScore + cScore) / 2);

  // Budget Fit
  const budgetFitScore = Math.round(Math.max(0, 100 - (recipe.estimatedCostPerServingGBP / contract.budgetEnvelopeGBP) * 50));

  // Cuisine-Led Taste Scoring (Strict Replacement)
  let tasteFitScore = 50; 
  
  if (contract.tasteProfile && contract.tasteProfile.preferredCuisineIds.length > 0) {
    let cuisinePoints = 0;
    
    // 1. Direct Cuisine Match (High Reward)
    if (recipe.cuisineId && contract.tasteProfile.preferredCuisineIds.includes(recipe.cuisineId)) {
        cuisinePoints += 40;
    }

    // 2. Characteristic Overlaps (Flavor / Style / Bias)
    contract.tasteProfile.preferredCuisineIds.forEach(prefId => {
        const profile = CUISINE_PROFILES[prefId];
        if (!profile) return;

        // Flavour overlap (Medium)
        const matchedFlavours = (recipe.flavourIds || []).filter(f => profile.flavourTags.includes(f));
        cuisinePoints += matchedFlavours.length * 15;

        // Style overlap (Medium)
        const matchedStyles = (recipe.styleIds || []).filter(s => profile.styleTags.includes(s));
        cuisinePoints += matchedStyles.length * 15;

        // Ingredient bias overlap (Light)
        const matchedBias = (recipe.ingredientTags || []).filter(i => profile.ingredientBiasTags.includes(i));
        cuisinePoints += matchedBias.length * 5;
    });

    tasteFitScore = Math.min(100, Math.max(0, 40 + cuisinePoints));
  }

  // Phase 22: Relax taste preferences if we are in rescue tiers (Tier 2+)
  if (tier >= 2) {
    tasteFitScore = 50; // Neutralize taste for rescue
  }

  // Pantry Scoring
  const meaningfulIngredients = recipe.ingredients.filter(ing => {
    const normalized = ing.name.toLowerCase().trim();
    return !PANTRY_STOPLIST.some(stop => normalized.includes(stop));
  });

  const pantryMetrics = {
    matches: 0,
    weightedScore: 0,
    totalMeaningful: meaningfulIngredients.length || 1
  };

  meaningfulIngredients.forEach(ing => {
    const normalizedName = ing.name.toLowerCase().trim();
    const matches = pantryItems.filter(p => 
      (ing.canonicalIngredientId && p.id === ing.canonicalIngredientId) ||
      p.name.toLowerCase().trim() === normalizedName
    );

    if (matches.length > 0) {
      const bestMatch = matches.reduce((best, curr) => {
        const scores = { in_stock: 1.0, low: 0.5, out: 0.0, need_checking: 0.0 };
        return (scores[curr.state] || 0) > (scores[best.state] || 0) ? curr : best;
      });

      if (bestMatch.state === 'in_stock') {
        pantryMetrics.weightedScore += 1.0;
        pantryMetrics.matches++;
      } else if (bestMatch.state === 'low') {
        pantryMetrics.weightedScore += 0.5;
        pantryMetrics.matches++;
      }
    }
  });

  const pantryFitScore = Math.round(Math.min(100, (pantryMetrics.weightedScore / pantryMetrics.totalMeaningful) * 100));
  
  // Effort / Difficulty Characteristics (Contextual Logic)
  let slotFitScore = 70;
  
  // Effort Band Scoring
  if (contract.preferredEffortBands && contract.preferredEffortBands.length > 0) {
    if (contract.preferredEffortBands.includes(recipe.effortBand)) {
      slotFitScore += 20;
    } else {
      // Penalty for non-preferred effort band (if it passed hard gate)
      slotFitScore -= 30;
    }
  }

  // Bonus for quick fixes or easy breakfast/lunch
  if (recipe.difficulty === 'Easy' && (contract.slotType === 'breakfast' || contract.slotType === 'lunch')) {
    slotFitScore += 10;
  }
  if (recipe.archetype === 'Quick_Fix') slotFitScore += 10;
  
  // High effort / slow recipes in 'routine' context are ALREADY blocked by hard gate,
  // but we keep a penalty here just in case of future rescue overrides.
  if (contract.context === 'routine' && recipe.effortBand === 'slow') {
    slotFitScore -= 50;
  }
  
  const leftoverFitScore = recipe.yieldsLeftovers && contract.leftoverPreference === 'prefer_fresh' ? 30 : 100;

  // Variety Scoring
  let varietyScore = 100;
  varietyScore -= (varietyCtx.repeatCount * 20);
  varietyScore -= (varietyCtx.archetypeDensity * 5);
  if (varietyCtx.sameDayArchetypes.has(recipe.archetype)) varietyScore -= 20;
  if (varietyCtx.consecutiveArchetypeMatch) varietyScore -= 15;
  const varietyFitScore = Math.max(0, varietyScore);

  // Penalties
  const repeatPenalty = varietyCtx.repeatCount * 15; 
  const archetypePenalty = varietyCtx.archetypeDensity * 5; 
  const cuisineSaturationPenalty = (varietyCtx.cuisineSaturationCount || 0) * 12;

  const baseTotalScore = (
    macroFitScore * 0.30 +
    budgetFitScore * 0.20 +
    varietyFitScore * 0.25 +
    slotFitScore * 0.10 +
    tasteFitScore * 0.10 +
    pantryFitScore * 0.05
  );

  const totalScore = Math.max(0, Math.round(baseTotalScore - repeatPenalty - archetypePenalty - cuisineSaturationPenalty));

  return {
    scores: { totalScore, slotFitScore, macroFitScore, budgetFitScore, tasteFitScore, varietyFitScore, pantryFitScore, leftoverFitScore },
    penalties: { archetypePenalty, repeatPenalty, cuisineSaturationPenalty }
  };
}

/**
 * Translates dimension scores into human-readable UI insights.
 */
export function generateInsights(scores: PlannerCandidate['scores'], recipe: NormalizedRecipe, contract: SlotContract, isRescue: boolean, varietyCtx: VarietyContext): InsightMetadata[] {
  const insights: InsightMetadata[] = [];

  if (isRescue) {
    insights.push({
      type: 'rescue_action', score: 1.0, icon: 'life-ring',
      label: 'Budget Rescue', detail: `Created to fit your strict £${contract.budgetEnvelopeGBP.toFixed(2)} remaining budget.`
    });
  } else if (scores.budgetFitScore > 80) {
    insights.push({
      type: 'budget_fit', score: scores.budgetFitScore / 100, icon: 'pound-sign',
      label: 'Budget Friendly', detail: `£${recipe.estimatedCostPerServingGBP.toFixed(2)} per serving.`
    });
  }

  if (scores.macroFitScore > 85) {
    insights.push({
      type: 'macro_fit', score: scores.macroFitScore / 100, icon: 'bullseye',
      label: 'Hits Protein Target', detail: `${recipe.macrosPerServing.protein}g aligns with goals.`
    });
  }
  
  if (scores.pantryFitScore > 90) {
    insights.push({
      type: 'pantry_match', score: scores.pantryFitScore / 100, icon: 'box-open',
      label: 'Pantry Staple', detail: `Uses ingredients you likely have.`
    });
  }

  if (scores.tasteFitScore > 85) {
     const cuisineLabel = recipe.cuisineId ? CUISINE_PROFILES[recipe.cuisineId]?.label : 'profile';
     insights.push({
        type: 'taste_match', score: scores.tasteFitScore / 100, icon: 'heart',
        label: `${cuisineLabel} favourite`, detail: `Matches your preferred cuisine and style.`
     });
  }

  return insights;
}

export function evaluateCandidate(
  recipe: NormalizedRecipe, 
  contract: SlotContract,
  varietyCtx: VarietyContext,
  pantryItems: PantryItem[] = [],
  tier: 1 | 2 | 3 | 4 = 1
): { candidate: PlannerCandidate | null, failureReasons: RescueFailureReason[] } {
  
  const failures = checkHardEligibility(recipe, contract, varietyCtx, tier);
  if (failures.length > 0) return { candidate: null, failureReasons: failures };

  const { scores, penalties } = scoreCandidate(recipe, contract, varietyCtx, pantryItems, tier);

  const candidate: PlannerCandidate = {
    id: `cand_${recipe.id}_${contract.dayIndex}_${contract.slotType}`,
    recipeId: recipe.id,
    slotContractRef: { planId: contract.planId, dayIndex: contract.dayIndex, slotType: contract.slotType },
    scores,
    penalties,
    rescueEligible: scores.totalScore >= (contract.rescueThresholdScore - 15),
    insights: generateInsights(scores, recipe, contract, false, varietyCtx)
  };

  return { candidate, failureReasons: [] };
}

export function analyzePoolCollapse(
  recipes: NormalizedRecipe[], 
  contract: SlotContract,
  currentArchetypeCounts: Record<string, number>
): RescueFailureReason[] {
  const failureCounts: Partial<Record<RescueFailureReason, number>> = {};
  
  recipes.forEach(r => {
    const failures = checkHardEligibility(r, contract, {
      repeatCount: 0,
      archetypeDensity: currentArchetypeCounts[r.archetype] || 0,
      sameDayArchetypes: new Set(),
      consecutiveArchetypeMatch: false,
      cuisineSaturationCount: 0
    }); 
    failures.forEach(f => {
      failureCounts[f] = (failureCounts[f] || 0) + 1;
    });
  });

  const total = recipes.length;
  if (total === 0) return ['candidate_pool_empty'];

  const universalFailures = Object.entries(failureCounts)
    .filter(([_, count]) => count === total)
    .map(([reason]) => reason as RescueFailureReason);

  if (universalFailures.length > 0) return universalFailures;
  
  return ['candidate_pool_empty'];
}

export function determineRescueAction(
  candidates: PlannerCandidate[], 
  recipes: NormalizedRecipe[], 
  contract: SlotContract, 
  currentArchetypeCounts: Record<string, number>
) {
  const sortedCandidates = [...candidates].sort((a, b) => b.scores.totalScore - a.scores.totalScore);
  const bestCandidate = sortedCandidates[0];
  
  if (bestCandidate && bestCandidate.scores.totalScore < contract.rescueThresholdScore) {
    return { action: 'soft_rescue_needed', reasons: ['taste_pool_collapse'] as RescueFailureReason[] };
  }

  if (candidates.length === 0) {
    const rootCauses = analyzePoolCollapse(recipes, contract, currentArchetypeCounts);
    return { action: 'gemini_generation_needed', reasons: rootCauses };
  }

  return { action: 'none', reasons: [] };
}
