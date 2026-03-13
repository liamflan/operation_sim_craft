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
  FriendlyFailureCategory
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
    
    // 1. Evaluate all recipes for this slot
    // We capture the predicted score and exact variety context for every recipe 
    // to ensure near-miss reporting doesn't rely on a stale common varietyCtx object.
    const evaluationResults = recipes.map(r => {
      const perRecipeCtx: VarietyContext = {
        repeatCount: planWideState.globalRepeatRegister.get(r.id) || 0,
        archetypeDensity: planWideState.archetypeCounts[r.archetype] || 0,
        sameDayArchetypes: planWideState.dayClusters.get(contract.dayIndex) || new Set(),
        consecutiveArchetypeMatch: false,
        cuisineSaturationCount: r.cuisineId ? planWideState.cuisineSaturation[r.cuisineId] || 0 : 0 
      };

      const evalResult = evaluateCandidate(r, contract, perRecipeCtx, pantryItems);
      
      // Post-pass diagnostic score capture using unchanged scoring pipeline
      let diagnosticScore: number | undefined;
      const { scores } = scoreCandidate(r, contract, perRecipeCtx, pantryItems);
      diagnosticScore = scores.totalScore;

      return {
        recipe: r,
        result: evalResult,
        diagnosticScore
      };
    });

    const candidates = evaluationResults
      .filter(res => res.result.candidate !== null)
      .map(res => res.result.candidate!);

    const rejections = evaluationResults
      .filter(res => res.result.candidate === null);

    // 2. Decision logic (Standard selection path)
    const { action, reasons } = determineRescueAction(candidates, recipes, contract, planWideState.archetypeCounts);

    const sortedCandidates = [...candidates].sort((a, b) => b.scores.totalScore - a.scores.totalScore);
    let finalCandidate = sortedCandidates[0] || null;

    // Apply preferred selection IF it's valid
    if (preferredRecipeId) {
      const manualMatch = candidates.find(c => c.recipeId === preferredRecipeId);
      if (manualMatch) {
         finalCandidate = manualMatch;
      } else {
        // Option was not valid or not found in candidates for THIS run.
        // We do NOT override. We let the planner fail or pick someone else.
        // The ActivePlanContext will check if the result matches the request.
        console.warn(`[orchestrator] Choice ${preferredRecipeId} not among eligible candidates for ${slotId}.`);
      }
    }

    // 3. Diagnostic Aggregation
    const topFailureReasons: Partial<Record<RescueFailureReason, number>> = {};
    const friendlyFailureSummary: Partial<Record<FriendlyFailureCategory, number>> = {};
    
    rejections.forEach(rej => {
      const failures = rej.result.failureReasons;
      failures.forEach(f => {
        topFailureReasons[f] = (topFailureReasons[f] || 0) + 1;
      });
      const friendly = classifyFailure(failures);
      friendlyFailureSummary[friendly] = (friendlyFailureSummary[friendly] || 0) + 1;
    });

    // 3.1 Near-Miss Identification
    const nearMisses: NearMissCandidate[] = rejections
      .filter(rej => {
        const failures = rej.result.failureReasons;
        return failures.length <= 2 && 
               !failures.includes('not_planner_usable') && 
               !failures.includes('dietary_mismatch');
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
          failureReasons: rej.result.failureReasons,
          friendlyCategory: classifyFailure(rej.result.failureReasons),
          score: rej.diagnosticScore
        };
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 10);

    // 3.2 Assignment Explanation & Alternatives
    let assignmentExplanation: AssignmentExplanation | undefined;
    let semanticAudit: LunchDinnerSemanticAudit | undefined;
    let topAlternatives: AlternativeCandidate[] = [];

    if (finalCandidate) {
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
        isRescue: action !== 'none',
        winnerMargin
      };

      topAlternatives = sortedCandidates.slice(1, 4).map(c => {
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

      if (!planWideState.dayClusters.has(contract.dayIndex)) {
        planWideState.dayClusters.set(contract.dayIndex, new Set());
      }
      planWideState.dayClusters.get(contract.dayIndex)!.add(assignedRecipe.archetype);
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
      eligibleCount: candidates.length,
      rejectedCount: rejections.length,
      topFailureReasons,
      friendlyFailureSummary,
      nearMisses,
      topAlternatives,
      assignmentExplanation,
      semanticAudit,
      rescueTriggered: action !== 'none',
      actionTaken: action === 'none' ? 'filled_normally' : 'soft_rescue',
      assignedCandidateId: finalCandidate?.id || null,
      bestScoreAchieved: finalCandidate?.scores.totalScore || null
    });
  }

  return { assignments, diagnostics };
}
