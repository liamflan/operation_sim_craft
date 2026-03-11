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
  VarietyContext
} from './plannerTypes';
import { isRecipeAllowedForBaselineDiet } from './dietRules';
import { PantryItem } from '../PantryContext';

const PANTRY_STOPLIST = ['salt', 'pepper', 'water', 'oil', 'olive oil', 'vegetable oil', 'black pepper', 'sea salt'];

/**
 * Validates if a recipe passes hard, non-negotiable eligibility constraints for a slot.
 * Returns an array of reasons if it fails. Returns empty array if it passes.
 */
export function checkHardEligibility(
  recipe: NormalizedRecipe, 
  contract: SlotContract,
  varietyCtx: VarietyContext
): RescueFailureReason[] {
  const failures: RescueFailureReason[] = [];

  // 0. Profile Exclusions (HARD) — must come first, user-trust gate
  // Match each exclusion term against each ingredient name using word-boundary logic
  // to avoid false positives (e.g. "salmon" should not reject a recipe with "salsa")
  if (contract.hardExclusions && contract.hardExclusions.length > 0) {
    const exclusionMatchFound = contract.hardExclusions.some(exclusion => {
      // Build a word-boundary regex: \b won't work for multi-word exclusions like "blue cheese"
      // So we use a safe substring check with surrounding non-alpha context
      const pattern = new RegExp(`(?:^|[^a-z])${exclusion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^a-z]|$)`, 'i');
      return recipe.ingredients.some(ingredient => {
        const normalizedIngredient = ingredient.name.toLowerCase().trim();
        if (pattern.test(normalizedIngredient)) {
          console.log(`[evaluator] exclusion match: "${exclusion}" in ingredient "${ingredient.name}" for recipe "${recipe.title}"`); 
          return true;
        }
        return false;
      });
    });
    if (exclusionMatchFound) {
      failures.push('exclusion_ingredient_match');
    }
  }

  // 1. Dietary Baseline Enforcement (HARD)
  if (!isRecipeAllowedForBaselineDiet(recipe, contract.dietaryBaseline)) {
    failures.push('dietary_mismatch');
  }

  // 2. Usability check
  if (!recipe.plannerUsable) {
    failures.push('not_planner_usable');
  }

  // Slot Suitability
  if (!recipe.suitableFor.includes(contract.slotType)) {
    failures.push('no_slot_match');
  }

  // Budget
  // If the envelope is completely blown. We allow a 10% tolerance for soft matching,
  // but a hard fail if it's way over. Or, per the requirements: "cap-compliant candidates exceed budget tolerance".
  const budgetTolerance = contract.budgetEnvelopeGBP * 1.1; 
  if (recipe.estimatedCostPerServingGBP > budgetTolerance) {
    failures.push('budget_delta_exceeded');
  }
  
  // Macros (Strict Limits)
  if (recipe.macrosPerServing.protein < contract.macroTargets.protein.min) {
    failures.push('protein_minimum_failed');
  }
  if (recipe.macrosPerServing.calories > contract.macroTargets.calories.max) {
    failures.push('calorie_maximum_exceeded');
  }
  if (recipe.macrosPerServing.calories < (contract.macroTargets.calories.min * 0.75)) {
    failures.push('calorie_minimum_failed'); // grossly under-caloried for the slot
  }

  // Archetype & Repeat Caps
  const cap = contract.archetypeCaps[recipe.archetype];
  if (cap !== undefined && varietyCtx.archetypeDensity >= cap) {
    failures.push('archetype_cap_exhausted');
  }
  if (varietyCtx.repeatCount >= contract.repeatCap) {
    failures.push('repeat_cap_exhausted');
  }
  if (varietyCtx.sameDayArchetypes.has(recipe.id)) { // Note: same_day_duplicate checks by recipe.id originally, keeping behavior matching old logic for the "same day duplicate"
    failures.push('same_day_duplicate');
  }

  // Leftovers / Batch Cook Rules
  if (contract.leftoverPreference === 'require_leftover' && !recipe.yieldsLeftovers) {
    failures.push('leftover_mismatch');
  }
  
  if (contract.batchCookPreference === 'required' && recipe.archetype !== 'Batch_Cook') {
    failures.push('batch_cook_mismatch');
  } else if (contract.batchCookPreference === 'discouraged' && recipe.archetype === 'Batch_Cook') {
    failures.push('batch_cook_mismatch');
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
  pantryItems: PantryItem[] = []
): { scores: PlannerCandidate['scores']; penalties: PlannerCandidate['penalties'] } {
  
  // Macro Fit: How close to the ideal target?
  const pDelta = Math.abs(recipe.macrosPerServing.protein - contract.macroTargets.protein.ideal);
  const pScore = Math.max(0, 100 - (pDelta / contract.macroTargets.protein.ideal) * 100);
  
  const cDelta = Math.abs(recipe.macrosPerServing.calories - contract.macroTargets.calories.ideal);
  const cScore = Math.max(0, 100 - (cDelta / contract.macroTargets.calories.ideal) * 100);
  const macroFitScore = Math.round((pScore + cScore) / 2);

  // Budget Fit: Cheaper is better, up to 100 if it's free. Envelopes are guaranteed by hard eligibility.
  const budgetFitScore = Math.round(Math.max(0, 100 - (recipe.estimatedCostPerServingGBP / contract.budgetEnvelopeGBP) * 50));

  // Taste Scoring (P1)
  let tasteFitScore = 50; // Neutral default
  let tagAffinity = 0;
  let archetypeAffinity = 0;
  
  if (contract.tasteProfile && contract.tasteProfile.anchorCount > 0) {
    let matchedTagWeight = 0;
    recipe.tags.forEach(tag => {
      if (contract.tasteProfile.preferredTags[tag]) {
        matchedTagWeight += contract.tasteProfile.preferredTags[tag];
      }
    });
    
    let matchedArchetypeWeight = 0;
    if (recipe.archetype && contract.tasteProfile.preferredArchetypes[recipe.archetype]) {
      matchedArchetypeWeight += contract.tasteProfile.preferredArchetypes[recipe.archetype];
    }
    
    tagAffinity = contract.tasteProfile.totalTagWeight > 0 
      ? matchedTagWeight / contract.tasteProfile.totalTagWeight 
      : 0;
      
    archetypeAffinity = contract.tasteProfile.totalArchetypeWeight > 0 
      ? matchedArchetypeWeight / contract.tasteProfile.totalArchetypeWeight 
      : 0;
      
    tasteFitScore = Math.min(100, Math.max(0, Math.round(40 + (tagAffinity * 40) + (archetypeAffinity * 20))));
  }

  // Pantry Scoring (P3)
  const meaningfulIngredients = recipe.ingredients.filter(ing => {
    const normalized = ing.name.toLowerCase().trim();
    return !PANTRY_STOPLIST.some(stop => normalized.includes(stop));
  });

  const pantryMetrics = {
    matches: 0,
    weightedScore: 0,
    totalMeaningful: meaningfulIngredients.length || 1 // Avoid div by zero
  };

  meaningfulIngredients.forEach(ing => {
    const normalizedName = ing.name.toLowerCase().trim();
    // Try to match by canonical ID first, then by name
    const matches = pantryItems.filter(p => 
      (ing.canonicalIngredientId && p.id === ing.canonicalIngredientId) ||
      p.name.toLowerCase().trim() === normalizedName
    );

    if (matches.length > 0) {
      // Use the best match state
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
  
  // Slot
  const slotFitScore = recipe.archetype === 'Quick_Fix' && contract.slotType === 'lunch' ? 100 : 70;
  const leftoverFitScore = recipe.yieldsLeftovers && contract.leftoverPreference === 'prefer_fresh' ? 30 : 100;

  // Real Variety Scoring (P2)
  let varietyScore = 100;
  varietyScore -= (varietyCtx.repeatCount * 20);
  varietyScore -= (varietyCtx.archetypeDensity * 5);
  if (varietyCtx.sameDayArchetypes.has(recipe.archetype)) varietyScore -= 20;
  if (varietyCtx.consecutiveArchetypeMatch) varietyScore -= 15;
  const varietyFitScore = Math.max(0, varietyScore);

  // Real Penalties (Absolute deductions on final score)
  const repeatPenalty = varietyCtx.repeatCount * 15; // 15 points off absolute for every time it repeats
  // Mild penalty for using up the archetype pool, to naturally encourage variety before the hard cap is hit
  const archetypePenalty = varietyCtx.archetypeDensity * 5; 

  const baseTotalScore = (
    macroFitScore * 0.30 +
    budgetFitScore * 0.25 +
    varietyFitScore * 0.25 +
    slotFitScore * 0.10 +
    tasteFitScore * 0.05 +
    pantryFitScore * 0.05
  );

  const totalScore = Math.max(0, Math.round(baseTotalScore - repeatPenalty - archetypePenalty));

  return {
    scores: { totalScore, slotFitScore, macroFitScore, budgetFitScore, tasteFitScore, varietyFitScore, pantryFitScore, leftoverFitScore },
    penalties: { archetypePenalty, repeatPenalty }
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
      label: 'Hits Protein Target', detail: `${recipe.macrosPerServing.protein}g aligns with ${contract.macroTargets.protein.ideal}g goal.`
    });
  }
  
  if (scores.pantryFitScore > 90) {
    insights.push({
      type: 'pantry_match', score: scores.pantryFitScore / 100, icon: 'box-open',
      label: 'Pantry Staple', detail: `Uses ingredients you likely have.`
    });
  }

  if (scores.totalScore > 90) {
    insights.push({
      type: 'taste_match', score: 1.0, icon: 'star',
      label: 'Top Pick', detail: `One of your highest rated matches for this slot.`
    });
  }

  // P2 Variety Insights
  if (scores.varietyFitScore >= 90) {
     insights.push({
        type: 'variety_fit', score: scores.varietyFitScore / 100, icon: 'leaf',
        label: 'Highly Varied', detail: `Brings fresh diversity to your week.`
     });
  } else if (varietyCtx.repeatCount > 0) {
     insights.push({
        type: 'variety_fit', score: scores.varietyFitScore / 100, icon: 'copy',
        label: 'Repeated Meal', detail: `You have this ${varietyCtx.repeatCount} other time(s) this week.`
     });
  } else if (varietyCtx.sameDayArchetypes.has(recipe.archetype)) {
     insights.push({
        type: 'variety_fit', score: scores.varietyFitScore / 100, icon: 'layer-group',
        label: 'Same-Day Meal Type Clash', detail: `You're already having a ${recipe.archetype.replace('_', ' ')} today.`
     });
  } else if (varietyCtx.consecutiveArchetypeMatch) {
     insights.push({
        type: 'variety_fit', score: scores.varietyFitScore / 100, icon: 'exchange-alt',
        label: 'Back-to-Back Meal Type', detail: `Follows another ${recipe.archetype.replace('_', ' ')} meal.`
     });
  } else if (varietyCtx.archetypeDensity >= 2) {
     insights.push({
        type: 'variety_fit', score: scores.varietyFitScore / 100, icon: 'chart-pie',
        label: 'Saturating Meal Type', detail: `You're having a lot of ${recipe.archetype.replace('_', ' ')}s this week.`
     });
  }

  return insights;
}

/**
 * Orchestrator: Creates a PlannerCandidate from a Recipe and a Contract.
 * Returns structured output with either the candidate or the list of failure reasons.
 */
export function evaluateCandidate(
  recipe: NormalizedRecipe, 
  contract: SlotContract,
  varietyCtx: VarietyContext,
  pantryItems: PantryItem[] = []
): { candidate: PlannerCandidate | null, failureReasons: RescueFailureReason[] } {
  
  const failures = checkHardEligibility(recipe, contract, varietyCtx);
  if (failures.length > 0) return { candidate: null, failureReasons: failures }; // Complete rejection

  const { scores, penalties } = scoreCandidate(recipe, contract, varietyCtx, pantryItems);

  const candidate: PlannerCandidate = {
    id: `cand_${recipe.id}_${contract.dayIndex}_${contract.slotType}`,
    recipeId: recipe.id,
    slotContractRef: { planId: contract.planId, dayIndex: contract.dayIndex, slotType: contract.slotType },
    scores,
    penalties,
    // Only eligible for soft rescue if it is close to the threshold (e.g. within 15 points)
    rescueEligible: scores.totalScore >= (contract.rescueThresholdScore - 15),
    insights: generateInsights(scores, recipe, contract, false, varietyCtx)
  };

  return { candidate, failureReasons: [] };
}

// ---------------------------------------------------------------------------
// RESCUE & POOL COLLAPSE DETECTION
// ---------------------------------------------------------------------------

/**
 * Aggregates failure reasons across a pool of rejected candidates to determine
 * *why* the slot is failing to fill.
 */
export function analyzePoolCollapse(
  recipes: NormalizedRecipe[], 
  contract: SlotContract,
  currentArchetypeCounts: Record<string, number>
): RescueFailureReason[] {
  const failureCounts: Partial<Record<RescueFailureReason, number>> = {};
  
  recipes.forEach(r => {
    // We pass an empty/zero variance context for today's assignments during collapse analysis because
    // it's an aggregate summary, and 'same_day_duplicate' shouldn't mask real hard failures
    const failures = checkHardEligibility(r, contract, {
      repeatCount: 0,
      archetypeDensity: currentArchetypeCounts[r.archetype] || 0,
      sameDayArchetypes: new Set(),
      consecutiveArchetypeMatch: false
    }); 
    failures.forEach(f => {
      failureCounts[f] = (failureCounts[f] || 0) + 1;
    });
  });

  const total = recipes.length;
  if (total === 0) return ['candidate_pool_empty'];

  // All recipes failed for identical reasons (universal collapse)
  const universalFailures = Object.entries(failureCounts)
    .filter(([_, count]) => count === total)
    .map(([reason]) => reason as RescueFailureReason);

  if (universalFailures.length > 0) return universalFailures;
  
  // Mixed-cause collapse. Report the top competing reasons that exhausted the pool.
  const topFailures = Object.entries(failureCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([reason]) => reason as RescueFailureReason);

  return topFailures.length > 0 ? topFailures : ['candidate_pool_empty'];
}

/**
 * Determines what action the UI/Saga should take if the candidate pool fails.
 */
export function determineRescueAction(
  candidates: PlannerCandidate[], 
  recipes: NormalizedRecipe[], 
  contract: SlotContract, 
  currentArchetypeCounts: Record<string, number>
) {
  // Safe sort (creates a new array instead of sorting in place)
  const sortedCandidates = [...candidates].sort((a, b) => b.scores.totalScore - a.scores.totalScore);
  const bestCandidate = sortedCandidates[0];
  
  if (bestCandidate && bestCandidate.scores.totalScore < contract.rescueThresholdScore) {
    // We have options, but they are bad. Soft rescue.
    return { action: 'soft_rescue_needed', reasons: ['taste_pool_collapse'] as RescueFailureReason[] };
  }

  if (candidates.length === 0) {
    // Strict eligibility wiped out the entire database. We need Gemini.
    const rootCauses = analyzePoolCollapse(recipes, contract, currentArchetypeCounts);
    return { action: 'gemini_generation_needed', reasons: rootCauses };
  }

  return { action: 'none', reasons: [] };
}
