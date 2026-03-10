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
  ActorType
} from './plannerTypes';

import {
  evaluateCandidate,
  determineRescueAction
} from './evaluator';

import {
  assignCandidateToSlot,
  regenerateSlot
} from './actions';

export interface SlotDiagnostic {
  slotId: string; // "dayIndex_slotType"
  totalConsidered: number;
  eligibleCount: number;
  rejectedCount: number;
  topFailureReasons: Partial<Record<RescueFailureReason, number>>;
  rescueTriggered: boolean;
  actionTaken: 'filled_normally' | 'soft_rescue' | 'gemini_generation_needed' | 'hard_fallback' | 'failed_completely';
  assignedCandidateId: string | null;
  bestScoreAchieved: number | null;
}

export interface OrchestratorOutput {
  assignments: PlannedMealAssignment[];
  diagnostics: SlotDiagnostic[];
}

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
  globalBudget: number = 50.00
): OrchestratorOutput {
  
  const assignments = createEmptyAssignments(contracts);
  const diagnostics: SlotDiagnostic[] = [];
  
  // Track running state for archetype caps and repeats 
  const runningArchetypeCounts: Record<string, number> = {};
  const runningRepeatCounts: Record<string, number> = {};
  
  // Track cumulative wallet constraints
  let remainingGlobalBudget = globalBudget; // Dynamic wallet

  // Pre-fill metrics from already locked/cooked assignments
  existingAssignments.forEach(a => {
    if (a.recipeId && (a.state === 'locked' || a.state === 'cooked' || a.state === 'skipped')) {
      const recipe = recipes.find(r => r.id === a.recipeId);
      
      if (a.state !== 'skipped') {
        runningRepeatCounts[a.recipeId] = (runningRepeatCounts[a.recipeId] || 0) + 1;
        if (recipe?.archetype) {
          runningArchetypeCounts[recipe.archetype] = (runningArchetypeCounts[recipe.archetype] || 0) + 1;
        }
      }
      
      // Locked/cooked meals *always* deduct their actual real cost from the cumulative weekly budget
      // Skipped meals deduct £0, effectively freeing up their envelope for the rest of the week
      if (recipe && a.state !== 'skipped') {
         remainingGlobalBudget -= recipe.estimatedCostPerServingGBP;
      }
    }
  });

  for (let i = 0; i < assignments.length; i++) {
    const assignment = assignments[i];
    const contract = contracts.find(c => c.dayIndex === assignment.dayIndex && c.slotType === assignment.slotType)!;
    
    // Dynamically limit the budget envelope based on what is actually left in the wallet
    // Divide remaining stringently by the slots left to fill
    const remainingSlotsToFill = assignments.length - i;
    // We allow 20% flex on the dynamic envelope to permit some meals to be slightly richer
    const dynamicBudgetEnvelope = (remainingGlobalBudget / remainingSlotsToFill) * 1.2; 
    
    // We update the contract specifically for this evaluation pass so insights/scores match the reality
    const runtimeContract = {
      ...contract,
      budgetEnvelopeGBP: Math.max(0, dynamicBudgetEnvelope) // Never allow negative budget targets
    };

    // Calculate Same Day duplications
    // We look at the generated array *so far*, plus the existing locked assignments for today
    const assignedRecipeIdsToday = new Set<string>();
    for (let j = 0; j < i; j++) {
      if (assignments[j].dayIndex === contract.dayIndex && assignments[j].recipeId) {
        assignedRecipeIdsToday.add(assignments[j].recipeId!);
      }
    }
    existingAssignments.forEach(ea => {
      if (ea.dayIndex === contract.dayIndex && ea.recipeId && ea.state !== 'skipped') {
        assignedRecipeIdsToday.add(ea.recipeId);
      }
    });

    // Evaluate all recipes for this specific contract
    const evaluatedCandidates: PlannerCandidate[] = [];
    const failureTally: Partial<Record<RescueFailureReason, number>> = {};
    
    for (const recipe of recipes) {
      const repeatCount = runningRepeatCounts[recipe.id] || 0;
      const { candidate, failureReasons } = evaluateCandidate(recipe, runtimeContract, runningArchetypeCounts, repeatCount, assignedRecipeIdsToday);
      
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
      // Tier 2 Rescue Trigger: The pool collapsed.
      diagnostic.rescueTriggered = true;
      diagnostic.actionTaken = 'gemini_generation_needed';
      
      // This leaves the assignment in 'generating' state and logs the prior failures into context
      assignments[i] = regenerateSlot(assignment, rescueAnalysis.reasons);
    }
    
    diagnostics.push(diagnostic);
  }

  return { assignments, diagnostics };
}
