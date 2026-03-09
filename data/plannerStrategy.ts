// ─── Planner Strategy Layer ───────────────────────────────────────────────────
//
// Computes a WeeklyCompositionTarget before Gemini is called.
// This replaces "pick 21 meals under constraints" with
// "compose a week using intentional meal roles."
//
// Priority order (when goals conflict):
//   1. budget  2. calories  3. protein  4. variety

import { PlannerInput, RecipeArchetype, WeeklyCompositionTarget } from './plannerSchema';

// ─── Default per-archetype repeat caps ───────────────────────────────────────
// These are the MAXIMUM times an archetype can be used in a week.
// Overridden up/down based on budget pressure and slot counts below.

const BASE_ARCHETYPE_CAPS: Record<RecipeArchetype, number> = {
  budget_breakfast:    7, // can repeat every day — that's fine
  protein_breakfast:   4, // allow up to 4x
  budget_workhorse_lunch:  4, // the workhorses of lunch
  budget_workhorse_dinner: 4, // the workhorses of dinner
  high_protein_anchor: 2, // 1-2 times per week max
  calorie_dense:       3, // used where daily cals are low
  variety_anchor:      2, // once or twice for interest
  premium_meal:        1, // max one luxury meal per week
  quick_default:       3, // gap filler
};

// ─── Budget headroom classifier ───────────────────────────────────────────────

function budgetTier(
  budgetGBP: number,
  slotCount: number,
): 'tight' | 'moderate' | 'comfortable' {
  const perMeal = slotCount > 0 ? budgetGBP / slotCount : 0;
  if (perMeal < 2.50) return 'tight';
  if (perMeal < 4.00) return 'moderate';
  return 'comfortable';
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function buildWeeklyCompositionTarget(input: PlannerInput): WeeklyCompositionTarget {
  const { slotsToFill, profile, candidates } = input;
  const budget = profile.weeklyBudgetGBP;
  const tier = budgetTier(budget, slotsToFill.length);

  // Count requested slots by type
  const bfCount = slotsToFill.filter(s => s.slot === 'breakfast').length;
  const ldCount  = slotsToFill.filter(s => s.slot === 'lunch' || s.slot === 'dinner').length;

  // Pool availability — do we actually have variety/premium options?
  const hasVariety  = candidates.some(c => c.archetype === 'variety_anchor');
  const hasPremium  = candidates.some(c => c.archetype === 'premium_meal');
  const hasProteinBf = candidates.some(c => c.archetype === 'protein_breakfast');

  // ─── Archetype counts (targets for the week) ─────────────────────────────
  const archetypeCounts: Partial<Record<RecipeArchetype, number>> = {};

  // --- Breakfast allocation ---
  if (bfCount > 0) {
    if (tier === 'tight') {
      // On a tight budget, mostly cheap breakfasts
      archetypeCounts.budget_breakfast = Math.min(bfCount, bfCount - 1);
      archetypeCounts.protein_breakfast = hasProteinBf ? 1 : 0;
    } else if (tier === 'moderate') {
      const proteinBf = hasProteinBf ? Math.floor(bfCount * 0.4) : 0;
      archetypeCounts.budget_breakfast = bfCount - proteinBf;
      archetypeCounts.protein_breakfast = proteinBf;
    } else {
      // Comfortable: split evenly
      const proteinBf = hasProteinBf ? Math.floor(bfCount * 0.5) : 0;
      archetypeCounts.budget_breakfast = bfCount - proteinBf;
      archetypeCounts.protein_breakfast = proteinBf;
    }
  }

  // --- Lunch/Dinner allocation ---
  if (ldCount > 0) {
    // Reserve slots for premium/variety if budget allows
    const premiumCount = (tier !== 'tight' && hasPremium) ? 1 : 0;
    const varietyCount = (tier !== 'tight' && hasVariety) ? Math.min(2, Math.floor(ldCount * 0.2)) : 0;
    const proteinAnchorCount = Math.min(2, Math.floor(ldCount * 0.25));
    const workhorseCount = ldCount - premiumCount - varietyCount - proteinAnchorCount;

    // Distribute remaining workhorse slots roughly evenly between lunch and dinner (assuming 50/50 split of the remaining slots)
    archetypeCounts.budget_workhorse_lunch  = Math.max(0, Math.ceil(workhorseCount / 2));
    archetypeCounts.budget_workhorse_dinner = Math.max(0, Math.floor(workhorseCount / 2));
    
    archetypeCounts.high_protein_anchor = proteinAnchorCount;
    archetypeCounts.variety_anchor      = varietyCount;
    archetypeCounts.premium_meal        = premiumCount;
  }

  // ─── Per-archetype repeat caps ────────────────────────────────────────────
  // On tight budget, relax workhorse caps to ensure coverage
  const caps: Record<RecipeArchetype, number> = { ...BASE_ARCHETYPE_CAPS };

  if (tier === 'tight') {
    // Allow more workhorse/budget repetition
    caps.budget_workhorse_lunch  = 5;
    caps.budget_workhorse_dinner = 5;
    caps.budget_breakfast    = 7;
    // Lock down expensive archetypes more aggressively
    caps.premium_meal        = 0; // no premium on tight budget
    caps.variety_anchor      = 1;
  } else if (tier === 'moderate') {
    caps.budget_workhorse_lunch  = 4;
    caps.budget_workhorse_dinner = 4;
    caps.premium_meal        = 1;
  }
  // On comfortable budget, use BASE_ARCHETYPE_CAPS as-is

  return { archetypeCounts, archetypeRepeatCaps: caps };
}

// ─── Utility: derive dominant archetype from a recipe's characteristics ───────
// Used in plannerInputBuilder to auto-classify recipes that don't have
// an explicit archetype set.

export function deriveArchetype(
  cost: number,
  calories: number,
  protein: number,
  slots: string[],
  perMealBudget: number,
): RecipeArchetype {
  const isBreakfast = slots.includes('breakfast') && !slots.includes('lunch') && !slots.includes('dinner');
  const isLunchDinner = !slots.includes('breakfast');

  if (isBreakfast) {
    if (protein >= 28)          return 'protein_breakfast';
    if (cost <= perMealBudget)  return 'budget_breakfast';
    return 'quick_default';
  }

  if (isLunchDinner) {
    if (cost > perMealBudget * 2.5) return 'premium_meal';
    if (protein >= 45)              return 'high_protein_anchor';
    if (calories >= 700)            return 'calorie_dense';
    if (cost <= perMealBudget) {
      return slots.includes('lunch') ? 'budget_workhorse_lunch' : 'budget_workhorse_dinner';
    }
    return 'variety_anchor';
  }

  // breakfast + lunch/dinner flexible
  if (cost <= perMealBudget)    return slots.includes('lunch') ? 'budget_workhorse_lunch' : 'budget_workhorse_dinner';
  return 'variety_anchor';
}
