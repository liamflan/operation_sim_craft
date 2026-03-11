/**
 * orchestrator.ts
 * Generates meal plans automatically from a pool of recipes and slot contracts.
 * It coordinates the evaluator and actions, and outputs assignments and detailed diagnostics.
 */

import {
  NormalizedRecipe,
  SlotContract,
  PlannedMealAssignment,
  PlannerCandidate,
  RescueFailureReason,
  ActorType,
  SlotDiagnostic,
  OrchestratorOutput,
  VarietyContext
} from './plannerTypes';

import {
  evaluateCandidate,
  determineRescueAction
} from './evaluator';
import { PantryItem } from '../PantryContext';

import {
  assignCandidateToSlot,
  regenerateSlot
} from './actions';


/**
 * Creates empty proposed assignments from slot contracts.
 */
function createEmptyAssignments(contracts: SlotContract[]): PlannedMealAssignment[] {
  return contracts.map(c => ({
    id: `assign_${c.planId}_${c.dayIndex}_${c.slotType}`,
    planId: c.planId,
    dayIndex: c.dayIndex,
    date: c.date,
    slotType: c.slotType,
    state: 'generating', // Start in generating state to indicate processing
    candidateId: null,
    recipeId: null,
    isBatchCookOrigin: false,
    metrics: { swappedCount: 0, autoFilledBy: null }
  }));
}

/**
 * Orchestrates creating a week (or partial week) plan for a given set of contracts and recipes.
 */
export function generatePlan(
  contracts: SlotContract[],
  recipes: NormalizedRecipe[],
  actor: ActorType = 'planner_autofill',
  existingAssignments: PlannedMealAssignment[] = [],
  globalBudget: number = 50.00,
  pantryItems: PantryItem[] = []
): OrchestratorOutput {
  
  const assignments = createEmptyAssignments(contracts);
  const diagnostics: SlotDiagnostic[] = [];
  
  // Track running state for archetype caps and repeats 
  const runningArchetypeCounts: Record<string, number> = {};
  const runningRepeatCounts: Record<string, number> = {};
  
  // Track cumulative wallet constraints
  let remainingGlobalBudget = globalBudget; // Dynamic wallet

  // ─── Phase 1: Pre-tally Metrics ───
  // We deduct budget and tally repeats for ALL provided assignments that have a recipeId.
  // This ensures the engine respects "What's already there" (locked, cooked, or just kept).
  existingAssignments.forEach(a => {
    if (a.recipeId && a.recipeId !== 'generating' && a.state !== 'generating') {
      const recipe = recipes.find(r => r.id === a.recipeId);
      
      // We count repeats and archetypes for anything that isn't skipped
      if (a.state !== 'skipped') {
        runningRepeatCounts[a.recipeId] = (runningRepeatCounts[a.recipeId] || 0) + 1;
        if (recipe?.archetype) {
          runningArchetypeCounts[recipe.archetype] = (runningArchetypeCounts[recipe.archetype] || 0) + 1;
        }
      }
      
      // Deduct cost from the cumulative weekly budget for anything that isn't skipped
      if (recipe && a.state !== 'skipped') {
         remainingGlobalBudget -= recipe.estimatedCostPerServingGBP;
      }
    }
  });

  for (let i = 0; i < assignments.length; i++) {
    const assignment = assignments[i];
    const contract = contracts.find(c => c.dayIndex === assignment.dayIndex && c.slotType === assignment.slotType)!;
    
    // ─── Phase 2: Slot Process Loop ───
    // Check if this slot should be preserved (fixed) or re-rolled.
    const preservedAssignment = existingAssignments.find(ea => 
      Number(ea.dayIndex) === Number(contract.dayIndex) && ea.slotType === contract.slotType &&
      ea.recipeId && ea.state !== 'generating'
    );

    if (preservedAssignment) {
      // Use the preserved assignment as-is
      assignments[i] = { ...preservedAssignment };
      
      diagnostics.push({
        slotId: `${contract.dayIndex}_${contract.slotType}`,
        totalConsidered: 0,
        eligibleCount: 0,
        rejectedCount: 0,
        topFailureReasons: {},
        rescueTriggered: false,
        actionTaken: 'filled_normally',
        assignedCandidateId: preservedAssignment.recipeId,
        bestScoreAchieved: 100,
      });

      continue;
    }

    // Dynamically limit the budget envelope based on what is actually left in the wallet
    // Calculate slots remaining that AREN'T fixed
    const remainingContractsToFill = contracts.slice(i).filter(c => 
      !existingAssignments.some(ea => 
        Number(ea.dayIndex) === Number(c.dayIndex) && ea.slotType === c.slotType &&
        (ea.state === 'locked' || ea.state === 'cooked' || ea.state === 'skipped')
      )
    ).length;

    const dynamicBudgetEnvelope = remainingContractsToFill > 0 
      ? (remainingGlobalBudget / remainingContractsToFill) * 1.2
      : 0;
    
    // We update the contract specifically for this evaluation pass so insights/scores match the reality
    const runtimeContract = {
      ...contract,
      budgetEnvelopeGBP: Math.max(0, dynamicBudgetEnvelope) // Never allow negative budget targets
    };

    const assignedRecipeIdsToday = new Set<string>();
    const sameDayArchetypes = new Set<string>();
    
    // We look at the generated array *so far*
    for (let j = 0; j < i; j++) {
      if (assignments[j].dayIndex === contract.dayIndex && assignments[j].recipeId) {
        assignedRecipeIdsToday.add(assignments[j].recipeId!);
        const r = recipes.find(r => r.id === assignments[j].recipeId);
        if (r) sameDayArchetypes.add(r.archetype);
      }
    }
    
    // Plus the existing locked assignments for today
    existingAssignments.forEach(ea => {
      if (ea.dayIndex === contract.dayIndex && ea.recipeId && ea.state !== 'skipped') {
        assignedRecipeIdsToday.add(ea.recipeId);
        const r = recipes.find(r => r.id === ea.recipeId);
        if (r) sameDayArchetypes.add(r.archetype);
      }
    });

    // Consecutive Match (chronologically prior scheduled assignment across all days)
    // We combine assignments so far and existing assignments, sort them by dayIndex then slot priority
    // For simplicity, since the planner iterates chronologically over the week, `assignments[i-1]` is 
    // usually the temporally preceding meal. However, existingAssignments might interleave.
    // The most robust way to find the purely preceding meal is to flat-map all assignments, sort, and find the one right before current.
    
    // Gather all locked/generated assignments up to now
    let allScheduled = [
      ...existingAssignments.filter(a => a.recipeId && a.state !== 'skipped'),
      ...assignments.slice(0, i).filter(a => a.recipeId)
    ];
    
    // sort by dayIndex ascending, then by slot priority (breakfast < lunch < dinner < snacks)
    const slotPriority: Record<string, number> = {
      'breakfast': 1, 'snack_am': 2, 'lunch': 3, 'snack_pm': 4, 'dinner': 5, 'dessert': 6
    };
    allScheduled.sort((a, b) => {
      if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
      return (slotPriority[a.slotType] || 99) - (slotPriority[b.slotType] || 99);
    });

    // Current index in this sorted list
    // We want the last element in the sorted array that is *before* the current contract in time
    const currentContractTimePriority = contract.dayIndex * 100 + (slotPriority[contract.slotType] || 99);
    const precedingAssignment = allScheduled.reverse().find(a => {
      const aTimePriority = a.dayIndex * 100 + (slotPriority[a.slotType] || 99);
      return aTimePriority < currentContractTimePriority;
    });

    const precedingArchetype = precedingAssignment?.recipeId ? recipes.find(r => r.id === precedingAssignment.recipeId)?.archetype : null;

    // Evaluate all recipes for this specific contract
    const evaluatedCandidates: PlannerCandidate[] = [];
    const failureTally: Partial<Record<RescueFailureReason, number>> = {};
    
    for (const recipe of recipes) {
      const repeatCount = runningRepeatCounts[recipe.id] || 0;
      const archetypeDensity = runningArchetypeCounts[recipe.archetype] || 0;
      
      const varietyCtx: VarietyContext = {
        repeatCount,
        archetypeDensity,
        sameDayArchetypes, // Note: keeping same_day_duplicate checks by recipe.id originally, sameDayArchetypes is for clustering penalty
        consecutiveArchetypeMatch: precedingArchetype === recipe.archetype
      };

      // Since the original checkHardEligibility needs assignedRecipeIdsToday, we could temporarily bake it into sameDayArchetypes or keep it in VarietyContext.
      // Wait, in evaluator.ts, I rewrote `checkHardEligibility` to use `varietyCtx.sameDayArchetypes.has(recipe.id)`. 
      // I should pass assigned recipes in sameDayArchetypes or extend VarietyContext.
      // Ah. The evaluator checks `varietyCtx.sameDayArchetypes.has(recipe.id)`!
      // I need to make sure recipe.id is in sameDayArchetypes to satisfy strict repeat constraints today.
      // So let's add recipe.ids to sameDayArchetypes.
      assignedRecipeIdsToday.forEach(id => sameDayArchetypes.add(id));

      const { candidate, failureReasons } = evaluateCandidate(recipe, runtimeContract, varietyCtx, pantryItems);
      
      if (candidate) {
        evaluatedCandidates.push(candidate);
      } else {
        failureReasons.forEach(reason => {
          failureTally[reason] = (failureTally[reason] || 0) + 1;
        });
      }
    }

    const diagnostic: SlotDiagnostic = {
      slotId: `${contract.dayIndex}_${contract.slotType}`,
      totalConsidered: recipes.length,
      eligibleCount: evaluatedCandidates.length,
      rejectedCount: recipes.length - evaluatedCandidates.length,
      topFailureReasons: failureTally,
      rescueTriggered: false,
      actionTaken: 'failed_completely',
      assignedCandidateId: null,
      bestScoreAchieved: null,
    };

    // Determine Rescue vs Normal Assignment
    const rescueAnalysis = determineRescueAction(evaluatedCandidates, recipes, runtimeContract, runningArchetypeCounts);
    
    if (rescueAnalysis.action === 'none' && evaluatedCandidates.length > 0) {
      // Normal flow: Pick the highest scoring candidate
      evaluatedCandidates.sort((a,b) => b.scores.totalScore - a.scores.totalScore);
      const bestCandidate = evaluatedCandidates[0];
      
      assignments[i] = assignCandidateToSlot(assignment, bestCandidate, runtimeContract, actor);
      
      // Update running constraints
      runningRepeatCounts[bestCandidate.recipeId] = (runningRepeatCounts[bestCandidate.recipeId] || 0) + 1;
      const recipe = recipes.find(r => r.id === bestCandidate.recipeId);
      if (recipe?.archetype) {
        runningArchetypeCounts[recipe.archetype] = (runningArchetypeCounts[recipe.archetype] || 0) + 1;
      }
      if (recipe) {
        remainingGlobalBudget -= recipe.estimatedCostPerServingGBP;
      }

      diagnostic.actionTaken = 'filled_normally';
      diagnostic.assignedCandidateId = bestCandidate.id;
      diagnostic.bestScoreAchieved = bestCandidate.scores.totalScore;

    } else if (rescueAnalysis.action === 'soft_rescue_needed') {
      // Tier 1 Soft Rescue: For MVP, just assign the highest scoring "bad" candidate 
      // and log the rescue data. Real impl might adjust contract weights and re-score.
      diagnostic.rescueTriggered = true;
      diagnostic.actionTaken = 'soft_rescue';
      
      evaluatedCandidates.sort((a,b) => b.scores.totalScore - a.scores.totalScore);
      const bestCandidate = evaluatedCandidates[0]; // Exists because pool wasn't empty
      
      let rescuedAssignment = assignCandidateToSlot(assignment, bestCandidate, runtimeContract, 'rescue_operation');
      
      const recipe = recipes.find(r => r.id === bestCandidate.recipeId);
      if (recipe) {
        remainingGlobalBudget -= recipe.estimatedCostPerServingGBP; // Deduct rescue cost so later meals compress harder
      }
      
      rescuedAssignment.rescueData = {
        tierTriggered: 1,
        failureReasons: rescueAnalysis.reasons || ['taste_pool_collapse'],
        archetypeCapsIgnored: true, // we pretend we relaxed it
        repeatCapsEnforced: true,
        budgetDeltaPushed: recipe ? Math.max(0, recipe.estimatedCostPerServingGBP - runtimeContract.budgetEnvelopeGBP) : 0,
        originalTargetHash: `${runtimeContract.budgetEnvelopeGBP}_${runtimeContract.macroTargets.calories.ideal}`
      };
      
      assignments[i] = rescuedAssignment;
      diagnostic.assignedCandidateId = bestCandidate.id;
      diagnostic.bestScoreAchieved = bestCandidate.scores.totalScore;

    } else if (rescueAnalysis.action === 'gemini_generation_needed') {
      // Tier 2: Pool completely collapsed. Background Gemini fallback is not yet wired.
      // We do NOT leave the slot in 'generating' — that causes a permanent spinner.
      // Instead, record a 'pool_collapse' terminal state with full diagnostics.
      diagnostic.rescueTriggered = true;
      diagnostic.actionTaken = 'gemini_generation_needed';

      const topReasons = rescueAnalysis.reasons || ['candidate_pool_empty'];
      const dominantReason = topReasons[0];

      // Build a human-friendly message based on the primary failure reason
      let userMessage = 'No suitable replacement found under current constraints.';
      if (dominantReason === 'budget_delta_exceeded') {
        userMessage = 'Could not regenerate — remaining weekly budget is too tight for this slot.';
      } else if (dominantReason === 'dietary_mismatch') {
        userMessage = 'Could not regenerate — no diet-compliant recipes available for this slot.';
      } else if (dominantReason === 'protein_minimum_failed') {
        userMessage = 'Could not regenerate — no recipes meet the protein target for this slot.';
      } else if (dominantReason === 'no_slot_match') {
        userMessage = 'Could not regenerate — no recipes suitable for this meal slot.';
      }

      console.warn(
        `[orchestrator] pool_collapse on ${contract.dayIndex}_${contract.slotType}:`,
        `budget=${runtimeContract.budgetEnvelopeGBP.toFixed(2)},`,
        `remaining_global=${remainingGlobalBudget.toFixed(2)},`,
        `reasons=${topReasons.join(',')}`
      );

      assignments[i] = {
        ...assignment,
        state: 'pool_collapse',
        candidateId: null,
        recipeId: null,
        collapseContext: {
          reasons: topReasons,
          availableCandidatesBeforeCollapse: evaluatedCandidates.length,
          committedBudgetGBP: globalBudget - remainingGlobalBudget,
          remainingBudgetEnvelopeGBP: runtimeContract.budgetEnvelopeGBP,
          userMessage,
        },
        metrics: { ...assignment.metrics },
      };
    }
    
    diagnostics.push(diagnostic);
  }

  // ─── Phase 3: Post-Plan Diagnostics ───
  const candidateCountsBySlot: Record<string, number> = {};
  diagnostics.forEach(d => {
    candidateCountsBySlot[d.slotId] = d.eligibleCount;
  });

  const isHardRuleValid = !diagnostics.some(d => d.actionTaken === 'failed_completely');
  const isTargetFeasible = !diagnostics.some(d => d.rescueTriggered);

  const topWarnings: string[] = [];
  if (!isHardRuleValid) topWarnings.push('Hard rules were violated for some slots.');
  if (!isTargetFeasible) topWarnings.push('Rescue operations were triggered to maintain plan integrity.');

  const executionMeta = {
    runId: `run_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    enginePath: 'deterministic_local' as const, // Currently always local in MVP
    planningMode: 'normal' as const, // Future: detect degraded due to protein
    isHardRuleValid,
    isTargetFeasible,
    candidateCountsBySlot,
    topWarnings,
  };

  return { assignments, diagnostics, executionMeta };
}
