/**
 * runActivePlan.ts
 * coordinates the generation of a plan by selecting the recipe source 
 * and calling the hybrid orchestrator.
 */

import { generatePlan } from './orchestrator';
import { FULL_RECIPE_LIST } from './recipeRegistry';
import { SlotContract, PlannedMealAssignment, NormalizedRecipe, ActorType, OrchestratorOutput } from './plannerTypes';
import { PantryItem } from '../PantryContext';

/**
 * Returns the current pool of "Planner-Approved" recipes.
 * Now supports injecting a dynamic pool (e.g. from RecipeContext including imports).
 */
function getApprovedRecipes(injectedPool?: NormalizedRecipe[]): NormalizedRecipe[] {
  const pool = injectedPool || FULL_RECIPE_LIST;
  
  // Final Trust-Model Safety: Ensure only 'ready' recipes ever enter the planner
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
  
  // Log exclusions reaching the planner — diagnostic proof they are wired end-to-end
  const exclusionsInContracts = contracts[0]?.hardExclusions ?? [];
  if (exclusionsInContracts.length > 0) {
    console.log(`[runActivePlan] profileExclusions active (${exclusionsInContracts.length}):`, exclusionsInContracts);
  } else {
    console.log('[runActivePlan] profileExclusions: none set');
  }

  console.log('[runActivePlan] Input contracts:', contracts.length);
  console.log('[runActivePlan] Preserved assignments:', preservedAssignments.length);
  console.log('[runActivePlan] Eligible recipe pool size:', recipes.length);

  // Trigger the orchestrator
  const result = await generatePlan(contracts, recipes, actor, preservedAssignments, globalBudget, pantryItems);
  
  console.log('[runActivePlan] Orchestrator assignments produced:', result.assignments.length);

  return result;
}
