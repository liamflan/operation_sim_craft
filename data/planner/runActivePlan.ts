/**
 * runActivePlan.ts
 * coordinates the generation of a plan by selecting the recipe source 
 * and calling the hybrid orchestrator.
 */

import { generatePlan } from './orchestrator';
import { printPlannerDiagnosticReport } from './plannerDiagnostics';
import { FULL_RECIPE_LIST } from './recipeRegistry';
import { SlotContract, PlannedMealAssignment, NormalizedRecipe, ActorType, OrchestratorOutput, PlannerExecutionDiagnostic } from './plannerTypes';
import { PantryItem } from '../PantryContext';

/**
 * Returns the current pool of "Planner-Approved" recipes.
 */
function getApprovedRecipes(injectedPool?: NormalizedRecipe[]): NormalizedRecipe[] {
  const pool = injectedPool || FULL_RECIPE_LIST;
  return pool.filter(r => r.status === 'ready');
}

/**
 * Executes a plan generation run.
 */
export async function runActivePlan(
  contracts: SlotContract[],
  preservedAssignments: PlannedMealAssignment[] = [],
  actor: ActorType = 'planner_autofill',
  globalBudget: number = 50.00,
  pantryItems: PantryItem[] = [],
  recipePool?: NormalizedRecipe[]
): Promise<OrchestratorOutput> {
  
  const recipes = getApprovedRecipes(recipePool);
  
  // Log exclusions reaching the planner
  const exclusionsInContracts = contracts[0]?.hardExclusions ?? [];
  if (exclusionsInContracts.length > 0) {
    console.log(`[runActivePlan] profileExclusions active (${exclusionsInContracts.length}):`, exclusionsInContracts);
  }

  console.log(`[runActivePlan] Generation triggered by ${actor}. Eligible pool: ${recipes.length}`);

  // Trigger the orchestrator
  const result = await generatePlan(contracts, recipes, actor, preservedAssignments, globalBudget, pantryItems);
  
  // Attach execution metadata for diagnostics
  const executionMeta: PlannerExecutionDiagnostic = {
    runId: `run_${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor,
    contractCount: contracts.length,
    recipeCount: recipes.length,
    preservedAssignmentCount: preservedAssignments.length,
    enginePath: 'deterministic_local',
    planningMode: 'normal',
    isHardRuleValid: true,
    isTargetFeasible: true,
    candidateCountsBySlot: {},
    topWarnings: []
  };

  result.executionMeta = executionMeta;

  // Real environment guard to prevent log spam in production
  const IS_DEV = typeof __DEV__ !== 'undefined' ? __DEV__ : (process.env.NODE_ENV !== 'production');
  
  if (IS_DEV) {
    printPlannerDiagnosticReport(result);
  } else {
    console.log('[runActivePlan] Generation complete. Diagnostic data available in result object.');
  }

  return result;
}
