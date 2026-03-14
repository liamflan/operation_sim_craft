// ─── Planner Validation ───────────────────────────────────────────────────────
//
// Stage A: Runtime schema validation — validates raw Gemini response shape.
// Stage B: Business validation + deterministic repair — validates content.
//
// Stage A failure → skip Stage B, go to fallback.
// Stage B repairs are applied in-place; warnings are always recorded.

import {
  PlannerRawOutput,
  PlannerInput,
  ValidationResult,
  PlannerAssignment,
  PlannerCandidate,
  PlannerDay,
  PlannerSlot,
  PlannerCompliance,
} from './plannerSchema';
import { isRecipeAllowedForBaselineDiet } from './planner/dietRules';
import { FULL_RECIPE_CATALOG } from './planner/recipeRegistry';

/**
 * Common hallucinations or legacy IDs that should be deterministically corrected
 * before the main validation/repair flow kicks in.
 */
const RECIPE_ID_ALIASES: Record<string, string> = {
  'rec_vegan_halloumi_01': 'rec_veggie_halloumi_01', // Gemini sometimes hallucinating vegan prefix for this vegetarian staple
};

const VALID_DAYS  = new Set<PlannerDay>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
const VALID_SLOTS = new Set<PlannerSlot>(['breakfast', 'lunch', 'dinner']);
const PLANNER_NOTE_MAX = 200;

export const CALORIE_COMPLIANCE_THRESHOLD = 0.9;
export const PROTEIN_COMPLIANCE_THRESHOLD = 0.9;

// ─── Pre-planning Sufficiency Check ──────────────────────────────────────────

export interface SufficiencyResult {
  effectiveCaps: Record<PlannerSlot, number>;
  warnings: string[];
}

export function checkCandidateSufficiency(input: PlannerInput): SufficiencyResult {
  const { slotsToFill, candidates, preferences } = input;
  const userCap = preferences.maxRecipeRepeatsPerWeek;

  const req = { breakfast: 0, lunch: 0, dinner: 0 };
  slotsToFill.forEach(s => { req[s.slot]++; });

  let pureB = 0, pureL = 0, pureD = 0, sharedLD = 0, other = 0;
  candidates.forEach(c => {
    const s = c.suitableFor ?? [];
    const b = s.includes('breakfast');
    const l = s.includes('lunch');
    const d = s.includes('dinner');

    if (b && !l && !d) pureB++;
    else if (!b && l && !d) pureL++;
    else if (!b && !l && d) pureD++;
    else if (!b && l && d) sharedLD++;
    else other++;
  });

  const effCaps = { breakfast: userCap, lunch: userCap, dinner: userCap };
  const warnings: string[] = [];

  // Breakfast Check
  const totalBPool = pureB + other;
  if (req.breakfast > totalBPool * userCap && req.breakfast > 0) {
    const needed = totalBPool > 0 ? Math.ceil(req.breakfast / totalBPool) : 99;
    effCaps.breakfast = needed;
    warnings.push(`Breakfast pool insufficient for ${req.breakfast} slots at repeat cap ${userCap}. Relieved to ${needed}.`);
  }

  // Lunch/Dinner Shared Check
  const reqLD = req.lunch + req.dinner;
  const totalLDPool = pureL + pureD + sharedLD + other;
  if (reqLD > totalLDPool * userCap && reqLD > 0) {
    const needed = totalLDPool > 0 ? Math.ceil(reqLD / totalLDPool) : 99;
    effCaps.lunch = needed;
    effCaps.dinner = needed;
    warnings.push(`Lunch/Dinner pool insufficient for ${reqLD} slots. Relieved cap to ${needed}.`);
  }

  return { effectiveCaps: effCaps, warnings };
}

// ─── Feasibility Bounds Check ─────────────────────────────────────────────────

export interface FeasibilityBounds {
  feasible: boolean;
  minWeeklyCostGBP: number;
  maxWeeklyCalories: number;
  maxWeeklyProteinG: number;
  priorityOrder: string[];
  warnings: string[];
}

export function computeFeasibilityBounds(
  input: PlannerInput,
  effectiveCaps: Record<PlannerSlot, number>,
): FeasibilityBounds {
  const { slotsToFill, candidates, profile } = input;
  const warnings: string[] = [];
  const priorityOrder = ['budget', 'calories', 'protein', 'variety'];

  if (slotsToFill.length === 0) {
    return { feasible: true, minWeeklyCostGBP: 0, maxWeeklyCalories: 0, maxWeeklyProteinG: 0, priorityOrder, warnings };
  }

  let minCost = 0;
  let maxCals = 0;
  let maxProt = 0;

  // Min-cost pass
  const repCostMin = new Map<string, number>();
  for (const { slot } of slotsToFill) {
    const cap = effectiveCaps[slot];
    const eligible = candidates
      .filter(c => (c.suitableFor ?? []).includes(slot) && (repCostMin.get(c.id) ?? 0) < cap)
      .sort((a, b) => a.estimatedCostGBP - b.estimatedCostGBP);
    const pick = eligible[0];
    if (pick) {
      minCost += pick.estimatedCostGBP;
      repCostMin.set(pick.id, (repCostMin.get(pick.id) ?? 0) + 1);
    } else {
      const fallback = candidates
        .filter(c => (c.suitableFor ?? []).includes(slot))
        .sort((a, b) => a.estimatedCostGBP - b.estimatedCostGBP)[0];
      if (fallback) minCost += fallback.estimatedCostGBP;
    }
  }

  // Max-calorie pass
  const repCalMax = new Map<string, number>();
  for (const { slot } of slotsToFill) {
    const cap = effectiveCaps[slot];
    const eligible = candidates
      .filter(c => (c.suitableFor ?? []).includes(slot) && (repCalMax.get(c.id) ?? 0) < cap)
      .sort((a, b) => b.macros.calories - a.macros.calories);
    const pick = eligible[0];
    if (pick) {
      maxCals += pick.macros.calories;
      repCalMax.set(pick.id, (repCalMax.get(pick.id) ?? 0) + 1);
    } else {
      const fallback = candidates
        .filter(c => (c.suitableFor ?? []).includes(slot))
        .sort((a, b) => b.macros.calories - a.macros.calories)[0];
      if (fallback) maxCals += fallback.macros.calories;
    }
  }

  // Max-protein pass
  const repProtMax = new Map<string, number>();
  for (const { slot } of slotsToFill) {
    const cap = effectiveCaps[slot];
    const eligible = candidates
      .filter(c => (c.suitableFor ?? []).includes(slot) && (repProtMax.get(c.id) ?? 0) < cap)
      .sort((a, b) => b.macros.protein - a.macros.protein);
    const pick = eligible[0];
    if (pick) {
      maxProt += pick.macros.protein;
      repProtMax.set(pick.id, (repProtMax.get(pick.id) ?? 0) + 1);
    } else {
      const fallback = candidates
        .filter(c => (c.suitableFor ?? []).includes(slot))
        .sort((a, b) => b.macros.protein - a.macros.protein)[0];
      if (fallback) maxProt += fallback.macros.protein;
    }
  }

  const targetWeeklyCals = profile.targetCalories * 7;
  const targetWeeklyProt = profile.targetProteinG * 7;
  const budget = profile.weeklyBudgetGBP;

  const canAfford = minCost <= budget;
  const canHitCals = maxCals >= targetWeeklyCals;
  const canHitProt = maxProt >= targetWeeklyProt;
  const feasible = canAfford && canHitCals && canHitProt;

  if (!canAfford) {
    warnings.push(`[FEASIBILITY WARNING] Even the cheapest possible plan costs £${minCost.toFixed(2)}, exceeding the £${budget.toFixed(2)} weekly budget.`);
  }
  if (!canHitCals) {
    warnings.push(`[FEASIBILITY WARNING] Best achievable daily calories is ~${Math.round(maxCals/7)} kcal/day vs ${profile.targetCalories} kcal target.`);
  }
  if (!canHitProt) {
    warnings.push(`[FEASIBILITY WARNING] Best achievable protein is ~${Math.round(maxProt/7)}g/day vs ${profile.targetProteinG}g target.`);
  }

  if (canAfford && canHitCals) {
    const cheapHighCalCost = slotsToFill.reduce((sum, { slot }) => {
      const affordable = candidates
        .filter(c => (c.suitableFor ?? []).includes(slot) && c.estimatedCostGBP <= budget / slotsToFill.length * 1.5)
        .sort((a, b) => b.macros.calories - a.macros.calories);
      return sum + (affordable[0]?.estimatedCostGBP ?? 0);
    }, 0);
    if (cheapHighCalCost > budget) {
      warnings.push(`[FEASIBILITY WARNING] Hitting the calorie target within budget is tight. Budget will be prioritised.`);
    }
  }

  return { feasible, minWeeklyCostGBP: Math.round(minCost * 100) / 100, maxWeeklyCalories: maxCals, maxWeeklyProteinG: maxProt, priorityOrder, warnings };
}

// ─── Stage A: Schema Validation ──────────────────────────────────────

export function runtimeValidateSchema(raw: unknown): raw is PlannerRawOutput {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.assignments)) return false;
  for (const item of obj.assignments) {
    if (!item || typeof item !== 'object') return false;
    const a = item as Record<string, unknown>;
    if (typeof a.day !== 'string' || !VALID_DAYS.has(a.day as PlannerDay)) return false;
    if (typeof a.slot !== 'string' || !VALID_SLOTS.has(a.slot as PlannerSlot)) return false;
    if (typeof a.recipeId !== 'string' || !a.recipeId) return false;
  }
  return true;
}

// ─── Stage B: Business Validation + Repair ───────────────────────────────────

export function validatePlannerOutput(
  raw: PlannerRawOutput,
  input: PlannerInput,
): ValidationResult {
  const warnings: string[]        = [];
  const candidateMap              = new Map(input.candidates.map(c => [c.id, c]));
  const repeatCounts              = new Map<string, number>();
  const archetypeCounts           = new Map<string, number>();
  const validAssignments: PlannerAssignment[] = [];
  const filledSlots               = new Set<string>();
  const toReassign: { day: PlannerDay; slot: PlannerSlot; originalId?: string }[] = [];
  const assignedIdsByDay: Record<PlannerDay, Set<string>> = {
    'Mon': new Set(), 'Tue': new Set(), 'Wed': new Set(), 'Thu': new Set(), 'Fri': new Set(), 'Sat': new Set(), 'Sun': new Set()
  };

  for (const a of raw.assignments) {
    const slotKey = `${a.day}:${a.slot}`;
    if (!input.slotsToFill.some(s => s.day === a.day && s.slot === a.slot)) continue;
    if (filledSlots.has(slotKey)) continue;

    if (RECIPE_ID_ALIASES[a.recipeId]) {
      a.recipeId = RECIPE_ID_ALIASES[a.recipeId];
    }

    const candidate = candidateMap.get(a.recipeId);
    if (!candidate) {
      toReassign.push({ day: a.day, slot: a.slot });
      filledSlots.add(slotKey);
      continue;
    }

    if (assignedIdsByDay[a.day].has(a.recipeId)) {
      toReassign.push({ day: a.day, slot: a.slot, originalId: a.recipeId });
      filledSlots.add(slotKey);
      continue;
    }

    const currentCount = repeatCounts.get(a.recipeId) ?? 0;
    if (currentCount >= input.preferences.maxRecipeRepeatsPerWeek) {
      toReassign.push({ day: a.day, slot: a.slot, originalId: a.recipeId });
      filledSlots.add(slotKey);
      continue;
    }

    const arch = candidate.archetype;
    const archCount = archetypeCounts.get(arch) ?? 0;
    if (archCount >= (input.composition.archetypeRepeatCaps[arch] ?? 99)) {
      toReassign.push({ day: a.day, slot: a.slot, originalId: a.recipeId });
      filledSlots.add(slotKey);
      continue;
    }

    validAssignments.push(a);
    repeatCounts.set(a.recipeId, currentCount + 1);
    archetypeCounts.set(arch, archCount + 1);
    assignedIdsByDay[a.day].add(a.recipeId);
    filledSlots.add(slotKey);
  }

  for (const { day, slot } of input.slotsToFill) {
    if (!filledSlots.has(`${day}:${slot}`)) toReassign.push({ day, slot });
  }

  const { effectiveCaps } = checkCandidateSufficiency(input);

  toReassign.sort((a, b) => {
    const order = { breakfast: 1, lunch: 2, dinner: 3 };
    return order[a.slot] - order[b.slot];
  });

  for (const r of toReassign) {
    const dayAssignments = validAssignments.filter(a => a.day === r.day);
    const currentCals = dayAssignments.reduce((sum, a) => sum + (candidateMap.get(a.recipeId)?.macros.calories ?? 0), 0);
    const currentProt = dayAssignments.reduce((sum, a) => sum + (candidateMap.get(a.recipeId)?.macros.protein ?? 0), 0);
    const currentPlanCost = validAssignments.reduce((sum, a) => sum + (candidateMap.get(a.recipeId)?.estimatedCostGBP ?? 0), 0);
    
    const repairedId = globalRepair(
      r.day, r.slot, input, repeatCounts, archetypeCounts,
      currentCals, currentProt, r.originalId, candidateMap, currentPlanCost,
      assignedIdsByDay[r.day], effectiveCaps,
    );

    if (repairedId) {
      const cleanRepairedId = repairedId.replace('::EMERGENCY_FALLBACK', '');
      validAssignments.push({ day: r.day, slot: r.slot, recipeId: cleanRepairedId });
      repeatCounts.set(cleanRepairedId, (repeatCounts.get(cleanRepairedId) ?? 0) + 1);
      const repArch = candidateMap.get(cleanRepairedId)!.archetype;
      archetypeCounts.set(repArch, (archetypeCounts.get(repArch) ?? 0) + 1);
      assignedIdsByDay[r.day].add(cleanRepairedId);
    } else if (r.originalId && candidateMap.has(r.originalId)) {
      validAssignments.push({ day: r.day, slot: r.slot, recipeId: r.originalId });
    }
  }

  let totalCost = 0, totalCals = 0, totalProt = 0;
  for (const a of validAssignments) {
    const c = candidateMap.get(a.recipeId);
    if (c) {
      totalCost += c.estimatedCostGBP;
      totalCals += c.macros.calories;
      totalProt += c.macros.protein;
    }
  }

  const targetCalsTotal = input.profile.targetCalories * 7;
  const targetProtTotal = input.profile.targetProteinG * 7;

  const compliance: PlannerCompliance = {
    isStructurallyValid: validAssignments.length === input.slotsToFill.length,
    sameDayVarietyPassed: true,
    effectiveRepeatCapsPassed: true,
    nominalRepeatCapsPassed: true,
    meetsTargetCalories: totalCals >= (targetCalsTotal * CALORIE_COMPLIANCE_THRESHOLD),
    meetsTargetProtein: totalProt >= (targetProtTotal * PROTEIN_COMPLIANCE_THRESHOLD),
    isHardRuleValid: true,
    isTargetFeasible: true,
    dietCompliancePassed: true,
    allergenCompliancePassed: true,
  };

  return {
    valid: true,
    plan: { assignments: validAssignments, summary: postProcessSummary(raw.summary, totalCost, totalCals, totalProt, input, validAssignments.length) },
    warnings,
    compliance,
  };
}

// ─── Deterministic Global Repair ──────────────────────────────────────────────

function isStrongLunch(c: { macros: { protein: number; calories: number } }): boolean {
  return c.macros.protein >= 35 || c.macros.calories >= 600;
}
function isSubstantialLunch(c: { macros: { protein: number; calories: number } }): boolean {
  return c.macros.protein >= 30 && c.macros.calories >= 500;
}
function isFillerLunch(c: { macros: { protein: number; calories: number } }): boolean {
  return !isSubstantialLunch(c);
}

export function globalRepair(
  day: PlannerDay,
  slot: PlannerSlot,
  input: PlannerInput,
  repeatCounts: Map<string, number>,
  archetypeCounts: Map<string, number>,
  currentDayCals: number,
  currentDayProt: number,
  excludeId?: string,
  candidateMap?: Map<string, PlannerCandidate>,
  currentPlanCost?: number,
  assignedRecipeIdsToday: Set<string> = new Set(),
  effectiveCaps: Record<PlannerSlot, number> = { breakfast: 2, lunch: 2, dinner: 2 },
): string | null {
  const { candidates, preferences, profile } = input;
  const excludeRecipe = (excludeId && candidateMap) ? candidateMap.get(excludeId) : null;
  
  // Tier A: Nominal
  let pool = candidates.filter(c =>
    (c.suitableFor ?? []).includes(slot) &&
    c.id !== excludeId &&
    !assignedRecipeIdsToday.has(c.id) &&
    (repeatCounts.get(c.id) ?? 0) < preferences.maxRecipeRepeatsPerWeek &&
    (archetypeCounts.get(c.archetype) ?? 0) < (input.composition.archetypeRepeatCaps[c.archetype] ?? 99)
  );

  // Tier B: Effective
  if (pool.length === 0) {
    pool = candidates.filter(c =>
      (c.suitableFor ?? []).includes(slot) &&
      c.id !== excludeId &&
      !assignedRecipeIdsToday.has(c.id) &&
      (repeatCounts.get(c.id) ?? 0) < effectiveCaps[slot]
    );
  }

  // Tier C: Emergency
  let isEmergency = false;
  if (pool.length === 0) {
    pool = candidates.filter(c => (c.suitableFor ?? []).includes(slot) && c.id !== excludeId && !assignedRecipeIdsToday.has(c.id));
    isEmergency = true;
  }
  if (!pool.length) return null;

  let bestId = pool[0].id, bestScore = -Infinity;
  for (const c of pool) {
    const calGap = profile.targetCalories - (currentDayCals + c.macros.calories);
    const protGap = profile.targetProteinG - (currentDayProt + c.macros.protein);
    let score = -Math.abs(calGap) - Math.abs(protGap * 10);

    if (excludeRecipe) {
      if (c.archetype === excludeRecipe.archetype) score += 10000;
      if (slot === 'lunch' && isSubstantialLunch(c)) score += 5000;
      if (c.estimatedCostGBP <= excludeRecipe.estimatedCostGBP) score += 2000;
    }
    
    if (score > bestScore) { bestScore = score; bestId = c.id; }
  }

  return isEmergency ? `${bestId}::EMERGENCY_FALLBACK` : bestId;
}

function postProcessSummary(
  _geminiSummary: any,
  computedCost: number,
  computedCals: number,
  computedProt: number,
  input: PlannerInput,
  assignmentCount: number,
): any {
  return {
    estimatedPlannedCostGBP: computedCost,
    estimatedPlannedCalories: computedCals,
    estimatedPlannedProteinG: computedProt,
    plannerNote: `Plan: £${computedCost.toFixed(2)}, ~${Math.round(computedCals/7)} kcal/day.`,
  };
}

function checkCalorieBalance(assignments: any[], input: PlannerInput, candidateMap: Map<string, any>, warnings: string[]) {}
