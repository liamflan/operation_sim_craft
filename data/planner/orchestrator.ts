/**
 * orchestrator.ts
 * High-level planning logic. Manages dependencies across slots and handles plan-wide constraints.
 */

import {
  NormalizedRecipe,
  SlotContract,
  PlannedMealAssignment,
  OrchestratorOutput,
  SlotDiagnostic,
  VarietyContext,
  RecipeArchetype,
  CuisineId,
  ActorType
} from './plannerTypes';
import { evaluateCandidate, determineRescueAction } from './evaluator';
import { PantryItem } from '../PantryContext';

/**
 * Core plan generation engine.
 */
export async function generatePlan(
  contracts: SlotContract[],
  recipes: NormalizedRecipe[],
  actor: ActorType = 'planner_autofill',
  preservedAssignments: PlannedMealAssignment[] = [],
  globalBudget: number = 50.00,
  pantryItems: PantryItem[] = []
): Promise<OrchestratorOutput> {
  const assignments: PlannedMealAssignment[] = [];
  const diagnostics: SlotDiagnostic[] = [];
  
  // Track plan-wide state for variety
  const planWideState = {
    globalRepeatRegister: new Map<string, number>(),
    archetypeCounts: {} as Record<RecipeArchetype, number>,
    cuisineSaturation: {} as Record<CuisineId, number>,
    dayClusters: new Map<number, Set<string>>(), 
  };

  // Pre-fill state with preserved assignments to maintain variety context
  preservedAssignments.forEach(a => {
      const recipe = recipes.find(r => r.id === a.recipeId);
      if (recipe) {
          planWideState.archetypeCounts[recipe.archetype] = (planWideState.archetypeCounts[recipe.archetype] || 0) + 1;
          if (recipe.cuisineId) {
              planWideState.cuisineSaturation[recipe.cuisineId] = (planWideState.cuisineSaturation[recipe.cuisineId] || 0) + 1;
          }
          const currentCount = planWideState.globalRepeatRegister.get(recipe.id) || 0;
          planWideState.globalRepeatRegister.set(recipe.id, currentCount + 1);
          
          if (!planWideState.dayClusters.has(a.dayIndex)) {
              planWideState.dayClusters.set(a.dayIndex, new Set());
          }
          planWideState.dayClusters.get(a.dayIndex)!.add(recipe.archetype);
      }
      assignments.push(a);
  });

  for (const contract of contracts) {
    // Skip if we already have an assignment for this slot from preserved list
    const existing = assignments.find(a => a.dayIndex === contract.dayIndex && a.slotType === contract.slotType);
    if (existing) continue;

    const slotId = `${contract.dayIndex}_${contract.slotType}`;
    
    // Build context for this specific slot
    const varietyCtx: VarietyContext = {
      repeatCount: 0, // Will be updated per candidate
      archetypeDensity: 0, // Will be updated per candidate
      sameDayArchetypes: planWideState.dayClusters.get(contract.dayIndex) || new Set(),
      consecutiveArchetypeMatch: false,
      cuisineSaturationCount: 0 
    };

    // 1. Evaluate all candidates for this slot
    const candidates = recipes
      .map(r => {
        varietyCtx.repeatCount = planWideState.globalRepeatRegister.get(r.id) || 0;
        varietyCtx.archetypeDensity = planWideState.archetypeCounts[r.archetype] || 0;
        if (r.cuisineId) {
            varietyCtx.cuisineSaturationCount = planWideState.cuisineSaturation[r.cuisineId] || 0;
        }
        return evaluateCandidate(r, contract, varietyCtx, pantryItems);
      })
      .filter(res => res.candidate !== null)
      .map(res => res.candidate!);

    // 2. Decision logic
    const { action, reasons } = determineRescueAction(candidates, recipes, contract, planWideState.archetypeCounts);

    let finalCandidate = candidates.sort((a, b) => b.scores.totalScore - a.scores.totalScore)[0] || null;

    // 3. Update plan-wide variety state if assignment made
    if (finalCandidate) {
      const assignedRecipe = recipes.find(r => r.id === finalCandidate!.recipeId)!;
      
      planWideState.archetypeCounts[assignedRecipe.archetype] = (planWideState.archetypeCounts[assignedRecipe.archetype] || 0) + 1;
      
      if (assignedRecipe.cuisineId) {
        planWideState.cuisineSaturation[assignedRecipe.cuisineId] = (planWideState.cuisineSaturation[assignedRecipe.cuisineId] || 0) + 1;
      }

      const currentCount = planWideState.globalRepeatRegister.get(assignedRecipe.id) || 0;
      planWideState.globalRepeatRegister.set(assignedRecipe.id, currentCount + 1);

      if (!planWideState.dayClusters.has(contract.dayIndex)) {
        planWideState.dayClusters.set(contract.dayIndex, new Set());
      }
      planWideState.dayClusters.get(contract.dayIndex)!.add(assignedRecipe.archetype);
    }

    // 4. Record outputs
    assignments.push({
      id: `assign_${slotId}`,
      planId: contract.planId,
      dayIndex: contract.dayIndex,
      date: contract.date,
      slotType: contract.slotType,
      state: finalCandidate ? 'proposed' : 'pool_collapse',
      candidateId: finalCandidate?.id || null,
      recipeId: finalCandidate?.recipeId || null,
      isBatchCookOrigin: false,
      metrics: { swappedCount: 0, autoFilledBy: actor },
      decisionSnapshot: finalCandidate ? {
        scores: finalCandidate.scores,
        insights: finalCandidate.insights,
        budgetConstraintAtTimeOfDecision: contract.budgetEnvelopeGBP,
        proteinTargetAtTimeOfDecision: contract.macroTargets.protein.ideal
      } : undefined
    });

    diagnostics.push({
      slotId,
      totalConsidered: recipes.length,
      eligibleCount: candidates.length,
      rejectedCount: recipes.length - candidates.length,
      topFailureReasons: {}, 
      rescueTriggered: action !== 'none',
      actionTaken: action === 'none' ? 'filled_normally' : 'soft_rescue',
      assignedCandidateId: finalCandidate?.id || null,
      bestScoreAchieved: finalCandidate?.scores.totalScore || null
    });
  }

  // Sort assignments by day and slot for consistency
  const slotOrder = { breakfast: 0, lunch: 1, dinner: 2 };
  assignments.sort((a, b) => {
      if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
      return slotOrder[a.slotType as keyof typeof slotOrder] - slotOrder[b.slotType as keyof typeof slotOrder];
  });

  return { assignments, diagnostics };
}
