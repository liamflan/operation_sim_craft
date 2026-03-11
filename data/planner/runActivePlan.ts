/**
 * runActivePlan.ts
 * coordinates the generation of a plan by selecting the recipe source 
 * and calling the hybrid orchestrator.
 */

import { generatePlan } from './orchestrator';
import { FULL_RECIPE_LIST } from './recipeRegistry';
import { SlotContract, PlannedMealAssignment, NormalizedRecipe, ActorType, OrchestratorOutput } from './plannerTypes';

/**
 * Returns the current pool of "Planner-Approved" recipes.
 */
function getApprovedRecipes(): NormalizedRecipe[] {
  return FULL_RECIPE_LIST;
}

/**
 * Executes a plan generation run.
 */
export async function runActivePlan(
  contracts: SlotContract[],
  initialAssignments: PlannedMealAssignment[] = [],
  actor: ActorType = 'planner_autofill',
  globalBudget: number = 50.00
): Promise<OrchestratorOutput> {
  
  const recipes = getApprovedRecipes();
  
  // Trigger the orchestrator
  // We use the initialAssignments (vibe picks) to ensure the engine respects 
  // the user's "What sounds good" choices.
  console.log('[runActivePlan] Input contracts:', contracts.length);
  console.log('[runActivePlan] Initial assignments (vibes):', initialAssignments.length);

  // Trigger the orchestrator
  const result = generatePlan(contracts, recipes, actor, initialAssignments, globalBudget);
  
  console.log('[runActivePlan] Orchestrator assignments produced:', result.assignments.length);

  return result;
}
