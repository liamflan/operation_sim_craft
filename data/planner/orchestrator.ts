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
  ActorType,
  AssignmentExplanation,
  LunchDinnerSemanticAudit,
  RescueFailureReason,
  AlternativeCandidate,
  NearMissCandidate,
  FriendlyFailureCategory,
  PlannerCandidate
} from './plannerTypes';
import { evaluateCandidate, determineRescueAction, scoreCandidate } from './evaluator';
import { classifyFailure, performSemanticAudit } from './plannerDiagnostics';
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
  pantryItems: PantryItem[] = [],
  preferredRecipeId?: string
): Promise<OrchestratorOutput> {
  const assignments: PlannedMealAssignment[] = [];
  const diagnostics: SlotDiagnostic[] = [];
  
  // Track plan-wide state for variety
  const planWideState = {
    globalRepeatRegister: new Map<string, number>(),
    archetypeCounts: {} as Record<RecipeArchetype, number>,
    cuisineSaturation: {} as Record<CuisineId, number>,
    dayClustersArchetypes: new Map<number, Set<RecipeArchetype>>(), 
    dayClustersRecipeIds: new Map<number, Set<string>>(), 
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
          
          if (!planWideState.dayClustersArchetypes.has(a.dayIndex)) {
              planWideState.dayClustersArchetypes.set(a.dayIndex, new Set());
          }
          planWideState.dayClustersArchetypes.get(a.dayIndex)!.add(recipe.archetype);

          if (!planWideState.dayClustersRecipeIds.has(a.dayIndex)) {
              planWideState.dayClustersRecipeIds.set(a.dayIndex, new Set());
          }
          planWideState.dayClustersRecipeIds.get(a.dayIndex)!.add(recipe.id);
      }
      assignments.push(a);
  });

  for (const contract of contracts) {
    // Skip if we already have an assignment for this slot from preserved list
    const existing = assignments.find(a => a.dayIndex === contract.dayIndex && a.slotType === contract.slotType);
    if (existing) continue;

    const slotId = `${contract.dayIndex}_${contract.slotType}`;
    
    // GUARANTEE-FILL LADDER (Phase 22)
    // We iterate through progressive relaxation tiers until we fill the slot or exhausted safety.
    let finalCandidate: PlannerCandidate | null = null;
    let fallbackActionTaken: 'filled_normally' | 'soft_rescue' | 'hard_fallback' | 'failed_completely' = 'failed_completely';
    let activeTier: 1 | 2 | 3 | 4 = 1;

    const allRejections: { recipe: NormalizedRecipe; failures: RescueFailureReason[] }[] = [];
    let successfulTierCandidates: PlannerCandidate[] = [];

    while (activeTier <= 4 && !finalCandidate) {
      const tierResults = recipes.map(r => {
        const perRecipeCtx: VarietyContext = {
          repeatCount: planWideState.globalRepeatRegister.get(r.id) || 0,
          archetypeDensity: planWideState.archetypeCounts[r.archetype] || 0,
          sameDayArchetypes: planWideState.dayClustersArchetypes.get(contract.dayIndex) || new Set(),
          sameDayRecipeIds: planWideState.dayClustersRecipeIds.get(contract.dayIndex) || new Set(),
          consecutiveArchetypeMatch: false,
          cuisineSaturationCount: r.cuisineId ? planWideState.cuisineSaturation[r.cuisineId] || 0 : 0 
        };

        const evalResult = evaluateCandidate(r, contract, perRecipeCtx, pantryItems, activeTier);
        return { recipe: r, result: evalResult };
      });

      const candidates = tierResults
        .filter(res => res.result.candidate !== null)
        .map(res => res.result.candidate!);

      const rejections = tierResults
        .filter(res => res.result.candidate === null)
        .map(res => ({ recipe: res.recipe, failures: res.result.failureReasons }));

      if (candidates.length > 0) {
        successfulTierCandidates = candidates;
        const sorted = [...candidates].sort((a, b) => b.scores.totalScore - a.scores.totalScore);
        finalCandidate = sorted[0];
        fallbackActionTaken = activeTier === 1 ? 'filled_normally' : activeTier <= 2 ? 'soft_rescue' : 'hard_fallback';
      } else {
        // Collect rejections for diagnostics if we haven't found a candidate yet
        allRejections.push(...rejections);
        activeTier++;
      }
    }

    // Apply preferred selection IF it's valid at the best tier we found
    if (preferredRecipeId && finalCandidate) {
      const manualMatch = successfulTierCandidates.find(c => c.recipeId === preferredRecipeId);
      if (manualMatch) {
         finalCandidate = manualMatch;
      } else {
        console.warn(`[orchestrator] Choice ${preferredRecipeId} not among eligible candidates for ${slotId} even in tier ${activeTier}.`);
      }
    }

    // 3. Diagnostic Aggregation
    const topFailureReasons: Partial<Record<RescueFailureReason, number>> = {};
    const friendlyFailureSummary: Partial<Record<FriendlyFailureCategory, number>> = {};
    
    allRejections.forEach(rej => {
      rej.failures.forEach(f => {
        topFailureReasons[f] = (topFailureReasons[f] || 0) + 1;
      });
      const friendly = classifyFailure(rej.failures);
      friendlyFailureSummary[friendly] = (friendlyFailureSummary[friendly] || 0) + 1;
    });

    // 3.1 Near-Miss Identification (from all tiers)
    const nearMisses: NearMissCandidate[] = allRejections
      .filter(rej => {
        return rej.failures.length <= 2 && 
               !rej.failures.includes('not_planner_usable') && 
               !rej.failures.includes('dietary_mismatch');
      })
      .map(rej => {
        return {
          recipeId: rej.recipe.id,
          title: rej.recipe.title,
          suitableFor: rej.recipe.suitableFor,
          archetype: rej.recipe.archetype,
          cuisineId: rej.recipe.cuisineId,
          costPerServing: rej.recipe.estimatedCostPerServingGBP,
          calories: rej.recipe.macrosPerServing.calories,
          protein: rej.recipe.macrosPerServing.protein,
          plannerUsable: rej.recipe.plannerUsable,
          failureReasons: rej.failures,
          friendlyCategory: classifyFailure(rej.failures),
        };
      })
      .slice(0, 10);

    // 3.2 Assignment Explanation & Alternatives
    let assignmentExplanation: AssignmentExplanation | undefined;
    let semanticAudit: LunchDinnerSemanticAudit | undefined;
    let topAlternatives: AlternativeCandidate[] = [];

    if (finalCandidate) {
      const sortedCandidates = [...successfulTierCandidates].sort((a, b) => b.scores.totalScore - a.scores.totalScore);
      const assignedRecipe = recipes.find(r => r.id === finalCandidate!.recipeId)!;
      const nextBest = sortedCandidates[1];
      const winnerMargin = nextBest ? finalCandidate.scores.totalScore - nextBest.scores.totalScore : undefined;

      assignmentExplanation = {
        assignedRecipeId: assignedRecipe.id,
        assignedTitle: assignedRecipe.title,
        slotType: contract.slotType,
        suitableFor: assignedRecipe.suitableFor,
        archetype: assignedRecipe.archetype,
        cuisineId: assignedRecipe.cuisineId,
        scoreBreakdown: finalCandidate.scores,
        isRescue: fallbackActionTaken !== 'filled_normally',
        winnerMargin
      };

      topAlternatives = successfulTierCandidates.slice(1, 4).map(c => {
        const recipe = recipes.find(r => r.id === c.recipeId)!;
        return {
          recipeId: recipe.id,
          title: recipe.title,
          archetype: recipe.archetype,
          score: c.scores.totalScore,
          margin: finalCandidate!.scores.totalScore - c.scores.totalScore
        };
      });

      if (contract.slotType === 'lunch' || contract.slotType === 'dinner') {
        semanticAudit = performSemanticAudit(assignedRecipe, contract, finalCandidate.scores);
      }

      // 4. Update variety context state (Behaviour Neutral)
      planWideState.archetypeCounts[assignedRecipe.archetype] = (planWideState.archetypeCounts[assignedRecipe.archetype] || 0) + 1;
      if (assignedRecipe.cuisineId) {
        planWideState.cuisineSaturation[assignedRecipe.cuisineId] = (planWideState.cuisineSaturation[assignedRecipe.cuisineId] || 0) + 1;
      }
      const currentCount = planWideState.globalRepeatRegister.get(assignedRecipe.id) || 0;
      planWideState.globalRepeatRegister.set(assignedRecipe.id, currentCount + 1);

      if (!planWideState.dayClustersArchetypes.has(contract.dayIndex)) {
        planWideState.dayClustersArchetypes.set(contract.dayIndex, new Set());
      }
      planWideState.dayClustersArchetypes.get(contract.dayIndex)!.add(assignedRecipe.archetype);

      if (!planWideState.dayClustersRecipeIds.has(contract.dayIndex)) {
        planWideState.dayClustersRecipeIds.set(contract.dayIndex, new Set());
      }
      planWideState.dayClustersRecipeIds.get(contract.dayIndex)!.add(assignedRecipe.id);
    }

    // 5. Build Result objects
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
      contractAudit: { ...contract },
      totalConsidered: recipes.length,
      eligibleCount: successfulTierCandidates.length,
      rejectedCount: allRejections.length,
      topFailureReasons,
      friendlyFailureSummary,
      nearMisses,
      topAlternatives,
      assignmentExplanation,
      semanticAudit,
      rescueTriggered: fallbackActionTaken !== 'filled_normally',
      actionTaken: finalCandidate ? fallbackActionTaken : 'failed_completely',
      assignedCandidateId: finalCandidate?.id || null,
      bestScoreAchieved: finalCandidate?.scores.totalScore || null
    });
  }

  return { assignments, diagnostics };
}
