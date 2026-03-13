/**
 * buildPlannerInput.ts
 * Transforms raw calibration data and user preferences into 
 * the rigorous models required by the Hybrid Orchestrator.
 */

import { 
  SlotContract, 
  SlotType, 
  PlannedMealAssignment, 
  RecipeArchetype,
  DietaryBaseline,
  TasteProfile,
  CuisineId,
  NormalizedRecipe
} from './plannerTypes';
import { WeeklyRoutine, DAYS, isPlanned } from '../weeklyRoutine';

export interface CalibrationPayload {
  preferredCuisineIds: CuisineId[];
  diet: DietaryBaseline;
  budgetWeekly?: number;
  targetProtein?: number;
  targetCalories?: number;
  excludedIngredientTags?: string[]; // Normalized (lowercase, trimmed).
}

const DEFAULT_BUDGET = 50;
const DEFAULT_PROTEIN = 160;
const DEFAULT_CALORIES = 2000;

/**
 * Builds a week of SlotContracts based on user routine and goals.
 */
export function buildSlotContracts(
  planId: string,
  routine: WeeklyRoutine,
  payload: CalibrationPayload
): SlotContract[] {
  const contracts: SlotContract[] = [];
  const budget = payload.budgetWeekly ?? DEFAULT_BUDGET;
  const protein = payload.targetProtein ?? DEFAULT_PROTEIN;
  const calories = payload.targetCalories ?? DEFAULT_CALORIES;
  const hardExclusions: string[] = (payload.excludedIngredientTags ?? [])
    .map(e => e.toLowerCase().trim())
    .filter(e => e.length > 0);

  // Build the TasteProfile from user's selected cuisines
  const tasteProfile: TasteProfile = {
    preferredCuisineIds: payload.preferredCuisineIds,
    excludedIngredientTags: hardExclusions
  };

  const today = new Date();
  const startDate = new Date(today.setDate(today.getDate() - today.getDay() + 1)); // Mon of current week

  // Count total planned slots to distribute budget accurately
  let totalPlannedSlots = 0;
  DAYS.forEach(day => {
    const dayRoutine = routine[day];
    if (isPlanned(dayRoutine.breakfast)) totalPlannedSlots++;
    if (isPlanned(dayRoutine.lunch)) totalPlannedSlots++;
    if (isPlanned(dayRoutine.dinner)) totalPlannedSlots++;
  });

  const budgetPerSlot = totalPlannedSlots > 0 ? (budget / totalPlannedSlots) : 0;

  DAYS.forEach((day, dayIndex) => {
    const dayRoutine = routine[day];
    const slots: SlotType[] = ['breakfast', 'lunch', 'dinner'];
    
    slots.forEach(slotType => {
      const mode = dayRoutine[slotType as keyof typeof dayRoutine];
      if (isPlanned(mode)) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + dayIndex);

        // Determine context: Mon-Fri is routine, Sat-Sun is weekend
        const isWeekend = dayIndex === 5 || dayIndex === 6; // 0=Mon, 5=Sat, 6=Sun
        const context = isWeekend ? 'weekend' : 'routine';

        // Determine preferred effort bands
        let preferredEffortBands: NormalizedRecipe['effortBand'][] = ['quick', 'standard'];
        if (slotType === 'breakfast') {
          preferredEffortBands = ['quick'];
        } else if (slotType === 'dinner') {
          if (dayIndex === 6) { // Sunday (weekend)
            preferredEffortBands = ['standard', 'slow'];
          } else if (dayIndex === 5) { // Saturday (weekend)
            preferredEffortBands = ['standard', 'slow'];
          } else { // Mon-Fri (routine)
            preferredEffortBands = ['quick', 'standard'];
          }
        }

        contracts.push({
          planId,
          dayIndex,
          date: date.toISOString().split('T')[0],
          slotType,
          macroTargets: {
            calories: { min: calories * 0.2, max: calories * 0.5, ideal: calories * 0.33 },
            protein: { 
              min: slotType === 'breakfast' ? protein * 0.12 : protein * 0.2, 
              ideal: slotType === 'breakfast' ? protein * 0.25 : protein * 0.33 
            }
          },
          budgetEnvelopeGBP: budgetPerSlot,
          hardExclusions,
          repeatCap: 2,
          archetypeCaps: {
            'Staple': 7,
            'Quick_Fix': 5,
            'Splurge': 2,
            'Batch_Cook': 3
          },
          leftoverPreference: 'accept_leftover',
          batchCookPreference: 'allowed',
          rescueThresholdScore: 60,
          dietaryBaseline: payload.diet,
          tasteProfile,
          context,
          preferredEffortBands
        });
      }
    });
  });

  return contracts;
}

/**
 * Source of truth for building the initial planner setup.
 */
export function buildPlannerSetup(
  routine: WeeklyRoutine,
  payload: CalibrationPayload
) {
  const planId = `plan_${Date.now()}`;
  const contracts = buildSlotContracts(planId, routine, payload);
  
  // No pre-selected assignments: fully dynamic generation.
  const preSelectedAssignments: PlannedMealAssignment[] = [];

  return {
    planId,
    contracts,
    preSelectedAssignments
  };
}
