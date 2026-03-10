/**
 * selectors.ts
 * Deep, UI-ready payload transformers mapping the engine state to the View Layer.
 */

import {
  PlannedMealAssignment,
  NormalizedRecipe,
  InsightMetadata
} from './plannerTypes';

export interface MealCardViewModel {
  assignmentId: string;
  slotType: string;
  state: PlannedMealAssignment['state'];
  
  recipeId: string | null;
  title: string | null;
  timeLabel: string | null;
  calories: number | null;
  tags: string[];
  archetype: string | null;
  
  // Support for richer insight strips
  insights: InsightMetadata[];
  
  // States
  isLocked: boolean;
  isRescue: boolean;
  isGenerating: boolean;
  isSkipped: boolean;
  
  // Rescue / Autofill Diagnostics
  autofillActor: string | null;
  rescueTiersTriggered: number | null; 
}

export function getMealCardViewModel(
  assignment: PlannedMealAssignment,
  recipe?: NormalizedRecipe
): MealCardViewModel {
  
  const isGenerating = assignment.state === 'generating';
  
  // Deep rescue check based on the new rigorous metadata
  const isRescue = !!assignment.rescueData && assignment.rescueData.tierTriggered > 1;

  return {
    assignmentId: assignment.id,
    slotType: assignment.slotType,
    state: assignment.state,
    
    recipeId: recipe ? recipe.id : assignment.recipeId,
    title: recipe ? recipe.title : null,
    timeLabel: recipe ? `${recipe.totalTimeMinutes}m` : null,
    calories: recipe ? recipe.macrosPerServing.calories : null,
    tags: recipe ? recipe.tags : [],
    archetype: recipe ? recipe.archetype : null,
    
    // We pass the full insights array, not just the single best label anymore
    insights: assignment.decisionSnapshot?.insights || [],
    
    isLocked: assignment.state === 'locked',
    isRescue,
    isGenerating,
    isSkipped: assignment.state === 'skipped',
    
    autofillActor: assignment.metrics.autoFilledBy || null,
    rescueTiersTriggered: assignment.rescueData?.tierTriggered || null
  };
}

export function getAssignmentsForDay(
  assignments: PlannedMealAssignment[],
  planId: string, 
  dayIndex: number
): PlannedMealAssignment[] {
  // Use loose equality or explicit cast to handle potential serialization quirks (string vs number)
  return assignments.filter(a => Number(a.dayIndex) === Number(dayIndex));
}

export function getWeeklyMetrics(
  assignments: PlannedMealAssignment[],
  planId: string,
  recipes: Record<string, NormalizedRecipe>
) {
  let estimatedTotalCostGBP = 0;
  let totalCalories = 0;
  let totalProtein = 0;
  let populatedSlots = 0;

  const weekAssignments = assignments;

  weekAssignments.forEach(a => {
    if (a.state === 'skipped') return; // Ignore skipped meals completely
    
    if (a.recipeId && recipes[a.recipeId]) {
      populatedSlots++;
      const recipe = recipes[a.recipeId];
      // Note: Assuming 1 portion consumed for UI weekly metric summary
      estimatedTotalCostGBP += recipe.estimatedCostPerServingGBP;
      totalCalories += recipe.macrosPerServing.calories;
      totalProtein += recipe.macrosPerServing.protein;
    }
  });

  return {
    populatedSlots,
    totalSlots: weekAssignments.length,
    estimatedTotalCostGBP,
    totalCalories,
    totalProtein
  };
}
