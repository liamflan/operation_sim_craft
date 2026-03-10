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
  ActorType,
  DietaryBaseline
} from './plannerTypes';
import { WeeklyRoutine, DAYS, isPlanned } from '../weeklyRoutine';

export interface CalibrationPayload {
  selectedVibes: string[]; // Recipe IDs
  diet: DietaryBaseline;
  budgetWeekly?: number;
  targetProtein?: number;
  targetCalories?: number;
}

const DEFAULT_BUDGET = 50;
const DEFAULT_PROTEIN = 160;
const DEFAULT_CALORIES = 2000;

/**
 * Heuristic: Maps the "Vibe Picks" from onboarding to the earliest possible 
 * meal slots (Mon/Tue) and locks them.
 */
function buildVibeAssignments(
  planId: string,
  selectedVibes: string[],
  contracts: SlotContract[]
): PlannedMealAssignment[] {
  const assignments: PlannedMealAssignment[] = [];
  
  // We only fill up to the number of vibes picked
  for (let i = 0; i < selectedVibes.length; i++) {
    const contract = contracts[i];
    if (!contract) break;

    assignments.push({
      id: `assign_${planId}_${contract.dayIndex}_${contract.slotType}`,
      planId,
      dayIndex: contract.dayIndex,
      date: contract.date,
      slotType: contract.slotType,
      state: 'locked', // Vibe picks are "The Plan" so we lock them
      candidateId: `vibe_${selectedVibes[i]}`,
      recipeId: selectedVibes[i],
      isBatchCookOrigin: false,
      metrics: {
        swappedCount: 0,
        autoFilledBy: 'user_manual' as ActorType
      }
    });
  }

  return assignments;
}

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

        contracts.push({
          planId,
          dayIndex,
          date: date.toISOString().split('T')[0],
          slotType,
          macroTargets: {
            calories: { min: calories * 0.2, max: calories * 0.5, ideal: calories * 0.33 },
            protein: { min: protein * 0.2, ideal: protein * 0.33 }
          },
          budgetEnvelopeGBP: budgetPerSlot,
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
          dietaryBaseline: payload.diet
        });
      }
    });
  });

  return contracts;
}

export function buildPlannerSetup(
  routine: WeeklyRoutine,
  payload: CalibrationPayload
) {
  const planId = `plan_${Date.now()}`;
  const contracts = buildSlotContracts(planId, routine, payload);
  const vibeAssignments = buildVibeAssignments(planId, payload.selectedVibes, contracts);

  return {
    planId,
    contracts,
    vibeAssignments
  };
}
