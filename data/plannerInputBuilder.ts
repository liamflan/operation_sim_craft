// ─── Planner Input Builder ────────────────────────────────────────────────────
//
// Assembles a clean, safe PlannerInput from current Provision state.
// All hard constraints (allergies, dietary type) are enforced HERE before anything
// is sent to Gemini. The candidate pool that reaches Gemini is already fully safe.

import { MOCK_RECIPES, MOCK_INGREDIENTS } from './seed';
import { UserProfile } from './schema';
import { WeeklyRoutine, DAYS, isPlanned } from './weeklyRoutine';
import { PlannerInput, PlannerCandidate, PlannerDay, PlannerSlot } from './plannerSchema';
import { buildWeeklyCompositionTarget, deriveArchetype } from './plannerStrategy';
import { isRecipeAllowedForBaselineDiet } from './planner/dietRules';
import { DietaryBaseline } from './planner/plannerTypes';

// ─── Dietary exclusion logic ──────────────────────────────────────────────────

const MEAT_TAGS = ['Beef', 'Chicken', 'Pork', 'Turkey', 'Lamb'];
const FISH_TAGS = ['Fish', 'Salmon', 'Seafood', 'Omega-3'];

function isSafeForDiet(recipe: typeof MOCK_RECIPES[number], diet: UserProfile['dietaryPreference']): boolean {
  return isRecipeAllowedForBaselineDiet(recipe as any, diet as DietaryBaseline);
}

function containsAllergen(recipe: typeof MOCK_RECIPES[number], allergies: string[]): boolean {
  if (!allergies.length) return false;
  // Check ingredients against allergen list by ingredient name
  return recipe.ingredients.some(ri => {
    const ing = MOCK_INGREDIENTS.find(i => i.id === ri.ingredientId);
    return ing ? allergies.some(a => ing.name.toLowerCase().includes(a.toLowerCase())) : false;
  });
}

// ─── Pantry signal builder ────────────────────────────────────────────────────

type PantryState = Record<string, number>;

function buildPantrySignals(pantry: PantryState): PlannerInput['pantrySignals'] {
  return MOCK_INGREDIENTS
    .filter(i => i.isPantryTracked)
    .map(i => {
      const stock = pantry[i.id] ?? 0;
      const status =
        stock === 0 ? 'out' :
        stock < (i.purchaseSize ?? 1) * 0.25 ? 'low' :
        'well_stocked';
      return { ingredientId: i.id, name: i.name, status };
    });
}

// ─── Candidate builder ────────────────────────────────────────────────────────

function buildCandidates(
  user: UserProfile,
  pantry: PantryState,
  routine: WeeklyRoutine,
): PlannerCandidate[] {
  const wellStockedIds = new Set(
    MOCK_INGREDIENTS
      .filter(i => i.isPantryTracked && (pantry[i.id] ?? 0) >= (i.purchaseSize ?? 1) * 0.25)
      .map(i => i.id)
  );

  return MOCK_RECIPES
    .filter(r => !containsAllergen(r, user.allergies))
    .filter(r => isSafeForDiet(r, user.dietaryPreference))
    .map(r => ({
      id: r.id,
      title: r.title,
      suitableFor: r.suitableFor,
      prepTimeMinutes: r.prepTimeMinutes,
      macros: r.macros,
      tags: r.tags,
      archetype: r.archetype ?? deriveArchetype(r.estimatedCostGBP, r.macros.calories, r.macros.protein, r.suitableFor, user.budgetWeekly / defaultSlotCount(routine)),
      pantryIngredients: r.ingredients
        .filter(ri => wellStockedIds.has(ri.ingredientId))
        .map(ri => ri.ingredientId),
      estimatedCostGBP: r.estimatedCostGBP,
    }));
}

function defaultSlotCount(routine: WeeklyRoutine) {
  return DAYS.reduce((acc, day) => 
    acc + (isPlanned(routine[day].breakfast) ? 1 : 0) + 
          (isPlanned(routine[day].lunch) ? 1 : 0) + 
          (isPlanned(routine[day].dinner) ? 1 : 0), 0);
}

// ─── Slots to fill ────────────────────────────────────────────────────────────

function buildSlotsToFill(routine: WeeklyRoutine): PlannerInput['slotsToFill'] {
  const slots: PlannerInput['slotsToFill'] = [];
  for (const day of DAYS) {
    const dayRoutine = routine[day];
    if (isPlanned(dayRoutine.breakfast)) slots.push({ day: day as PlannerDay, slot: 'breakfast' });
    if (isPlanned(dayRoutine.lunch))     slots.push({ day: day as PlannerDay, slot: 'lunch' });
    if (isPlanned(dayRoutine.dinner))    slots.push({ day: day as PlannerDay, slot: 'dinner' });
  }
  return slots;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function buildPlannerInput(
  user: UserProfile,
  routine: WeeklyRoutine,
  pantry: PantryState = {},
): PlannerInput {
  const baseInput: Omit<PlannerInput, 'composition'> = {
    profile: {
      dietaryPreference: user.dietaryPreference,
      allergies: user.allergies,
      targetCalories: user.targetMacros.calories,
      targetProteinG: user.targetMacros.protein,
      goalTags: [], // TODO: source from TasteProfile context
      weeklyBudgetGBP: user.budgetWeekly,
    },
    slotsToFill: buildSlotsToFill(routine),
    pantrySignals: buildPantrySignals(pantry),
    candidates: buildCandidates(user, pantry, routine),
    preferences: {
      prioritisePantry: true,
      preferVariety: true,
      maxRecipeRepeatsPerWeek: 2,
    },
  };

  const composition = buildWeeklyCompositionTarget(baseInput as PlannerInput);
  
  return {
    ...baseInput,
    composition,
  };
}
