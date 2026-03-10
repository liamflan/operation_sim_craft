/**
 * evaluator.ts
 * The core intelligence engine. Pure functions to score, reject, and rescue planner assignments.
 */

import {
  NormalizedRecipe,
  SlotContract,
  PlannerCandidate,
  InsightMetadata,
  RescueFailureReason
} from './plannerTypes';
import { isRecipeAllowedForBaselineDiet } from './dietRules';

/**
 * Validates if a recipe passes hard, non-negotiable eligibility constraints for a slot.
 * Returns an array of reasons if it fails. Returns empty array if it passes.
 */
export function checkHardEligibility(
  recipe: NormalizedRecipe, 
  contract: SlotContract,
  currentArchetypeCounts: Record<string, number>,
  repeatCount: number,
  assignedRecipeIdsToday: Set<string> = new Set()
): RescueFailureReason[] {
  const failures: RescueFailureReason[] = [];

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
  if (cap !== undefined && (currentArchetypeCounts[recipe.archetype] || 0) >= cap) {
    failures.push('archetype_cap_exhausted');
  }
  if (repeatCount >= contract.repeatCap) {
    failures.push('repeat_cap_exhausted');
  }
  if (assignedRecipeIdsToday.has(recipe.id)) {
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
  currentArchetypeCounts: Record<string, number>,
  repeatCount: number
): { scores: PlannerCandidate['scores']; penalties: PlannerCandidate['penalties'] } {
  
  // Macro Fit: How close to the ideal target?
  const pDelta = Math.abs(recipe.macrosPerServing.protein - contract.macroTargets.protein.ideal);
  const pScore = Math.max(0, 100 - (pDelta / contract.macroTargets.protein.ideal) * 100);
  
  const cDelta = Math.abs(recipe.macrosPerServing.calories - contract.macroTargets.calories.ideal);
  const cScore = Math.max(0, 100 - (cDelta / contract.macroTargets.calories.ideal) * 100);
  const macroFitScore = Math.round((pScore + cScore) / 2);

  // Budget Fit: Cheaper is better, up to 100 if it's free. Envelopes are guaranteed by hard eligibility.
  const budgetFitScore = Math.round(Math.max(0, 100 - (recipe.estimatedCostPerServingGBP / contract.budgetEnvelopeGBP) * 50));

  // Taste & Pantry (Mocked external dimension hooks for now)
  const tasteFitScore = 85; 
  const pantryFitScore = recipe.archetype === 'Staple' ? 95 : 40;
  
  // Slot & Variety
  const slotFitScore = recipe.archetype === 'Quick_Fix' && contract.slotType === 'lunch' ? 100 : 70;
  const varietyFitScore = 90; // Mocked distance from recent meals
  const leftoverFitScore = recipe.yieldsLeftovers && contract.leftoverPreference === 'prefer_fresh' ? 30 : 100;

  // Real Penalties
  const repeatPenalty = repeatCount * 15; // 15 points off for every time it repeats
  const archetypeDensity = currentArchetypeCounts[recipe.archetype] || 0;
  // Mild penalty for using up the archetype pool, to naturally encourage variety before the hard cap is hit
  const archetypePenalty = archetypeDensity * 5; 

  const baseTotalScore = (
    macroFitScore * 0.30 +
    budgetFitScore * 0.25 +
    tasteFitScore * 0.20 +
    pantryFitScore * 0.15 +
    slotFitScore * 0.10
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
export function generateInsights(scores: PlannerCandidate['scores'], recipe: NormalizedRecipe, contract: SlotContract, isRescue: boolean): InsightMetadata[] {
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

  return insights;
}

/**
 * Orchestrator: Creates a PlannerCandidate from a Recipe and a Contract.
 * Returns structured output with either the candidate or the list of failure reasons.
 */
export function evaluateCandidate(
  recipe: NormalizedRecipe, 
  contract: SlotContract,
  currentArchetypeCounts: Record<string, number> = {},
  repeatCount: number = 0,
  assignedRecipeIdsToday: Set<string> = new Set()
): { candidate: PlannerCandidate | null, failureReasons: RescueFailureReason[] } {
  
  const failures = checkHardEligibility(recipe, contract, currentArchetypeCounts, repeatCount, assignedRecipeIdsToday);
  if (failures.length > 0) return { candidate: null, failureReasons: failures }; // Complete rejection

  const { scores, penalties } = scoreCandidate(recipe, contract, currentArchetypeCounts, repeatCount);

  const candidate: PlannerCandidate = {
    id: `cand_${recipe.id}_${contract.dayIndex}_${contract.slotType}`,
    recipeId: recipe.id,
    slotContractRef: { planId: contract.planId, dayIndex: contract.dayIndex, slotType: contract.slotType },
    scores,
    penalties,
    // Only eligible for soft rescue if it is close to the threshold (e.g. within 15 points)
    rescueEligible: scores.totalScore >= (contract.rescueThresholdScore - 15),
    insights: generateInsights(scores, recipe, contract, false)
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
    // We pass an empty set for today's assignments during collapse analysis because
    // it's an aggregate summary, and 'same_day_duplicate' shouldn't mask real hard failures
    const failures = checkHardEligibility(r, contract, currentArchetypeCounts, 0, new Set()); // Repeat count simplified for pool analysis
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
