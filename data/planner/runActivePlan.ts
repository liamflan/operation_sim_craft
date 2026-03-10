/**
 * runActivePlan.ts
 * coordinates the generation of a plan by selecting the recipe source 
 * and calling the hybrid orchestrator.
 */

import { generatePlan, OrchestratorOutput } from './orchestrator';
import { FULL_RECIPE_LIST } from './recipeRegistry';
import { SlotContract, PlannedMealAssignment, NormalizedRecipe } from './plannerTypes';

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
  initialAssignments: PlannedMealAssignment[] = []
): Promise<OrchestratorOutput> {
  
  const recipes = getApprovedRecipes();
  
  // Trigger the orchestrator
  // We use the initialAssignments (vibe picks) to ensure the engine respects 
  // the user's "What sounds good" choices.
  console.log('[runActivePlan] Input contracts:', contracts.length);
  console.log('[runActivePlan] Initial assignments (vibes):', initialAssignments.length);

  // Trigger the orchestrator
  const result = generatePlan(contracts, recipes, 'planner_autofill', initialAssignments);
  
  console.log('[runActivePlan] Orchestrator assignments produced:', result.assignments.length);

  const finalAssignments = [...result.assignments];
  
  // Ensure vibe picks (locked) are actually in the output
  initialAssignments.forEach(vibe => {
    // Robust comparison with Number() cast
    const idx = finalAssignments.findIndex(a => 
      Number(a.dayIndex) === Number(vibe.dayIndex) && 
      a.slotType === vibe.slotType
    );
    if (idx !== -1) {
      console.log(`[runActivePlan] Merging preservation for slot ${vibe.dayIndex}/${vibe.slotType}`);
      finalAssignments[idx] = { ...vibe, state: vibe.state ?? 'locked' };
    } else {
      console.warn(`[runActivePlan] Could not find slot for vibe ${vibe.recipeId} at day ${vibe.dayIndex} slot ${vibe.slotType}`);
      // If the engine didn't have a contract but it's a vibe, we should arguably add it anyway
      finalAssignments.push(vibe);
    }
  });

  return {
    ...result,
    assignments: finalAssignments
  };
}
