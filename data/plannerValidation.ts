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
    const s = c.suitableFor;
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
// Computes best-case achievable budget / calories / protein for the current
// candidate pool under effective repeat caps, before calling Gemini.

export interface FeasibilityBounds {
  /** True if all three targets are jointly achievable under current pool + caps */
  feasible: boolean;
  /** Lowest-cost weekly plan achievable (greedy: cheapest eligible per slot) */
  minWeeklyCostGBP: number;
  /** Best achievable weekly calories (greedy: highest-cal eligible per slot) */
  maxWeeklyCalories: number;
  /** Best achievable weekly protein (greedy: highest-protein eligible per slot) */
  maxWeeklyProteinG: number;
  /** Priority order used when goals conflict */
  priorityOrder: string[];
  warnings: string[];
}

export function computeFeasibilityBounds(
  input: PlannerInput,
  effectiveCaps: Record<PlannerSlot, number>,
): FeasibilityBounds {
  const { slotsToFill, candidates, profile } = input;
  const warnings: string[] = [];

  // The deterministic priority order when goals conflict
  const priorityOrder = ['budget', 'calories', 'protein', 'variety'];

  if (slotsToFill.length === 0) {
    return { feasible: true, minWeeklyCostGBP: 0, maxWeeklyCalories: 0, maxWeeklyProteinG: 0, priorityOrder, warnings };
  }

  // For each slot, greedily compute best achievable metrics using repeat caps
  // We simulate assigning meals: repeat counts are shared across the week
  const repeatCounts = new Map<string, number>();

  let minCost = 0;
  let maxCals = 0;
  let maxProt = 0;

  // Helper: pick the best candidate for the slot under the given metric + repeat caps
  function pickBest(slot: PlannerSlot, metric: 'cost' | 'cal' | 'prot', cap: number): PlannerCandidate | null {
    const eligible = candidates.filter(c =>
      c.suitableFor.includes(slot) &&
      (repeatCounts.get(c.id) ?? 0) < cap
    );
    if (!eligible.length) return null;

    return eligible.reduce((best, c) => {
      if (metric === 'cost') return c.estimatedCostGBP < best.estimatedCostGBP ? c : best;
      if (metric === 'cal') return c.macros.calories > best.macros.calories ? c : best;
      return c.macros.protein > best.macros.protein ? c : best;
    });
  }

  // Min-cost pass — pick cheapest per slot
  const repCostMin = new Map<string, number>();
  for (const { slot } of slotsToFill) {
    const cap = effectiveCaps[slot];
    const eligible = candidates
      .filter(c => c.suitableFor.includes(slot) && (repCostMin.get(c.id) ?? 0) < cap)
      .sort((a, b) => a.estimatedCostGBP - b.estimatedCostGBP);
    const pick = eligible[0];
    if (pick) {
      minCost += pick.estimatedCostGBP;
      repCostMin.set(pick.id, (repCostMin.get(pick.id) ?? 0) + 1);
    } else {
      // No eligible candidate — use cheapest available regardless of cap
      const fallback = candidates
        .filter(c => c.suitableFor.includes(slot))
        .sort((a, b) => a.estimatedCostGBP - b.estimatedCostGBP)[0];
      if (fallback) minCost += fallback.estimatedCostGBP;
    }
  }

  // Max-calorie pass — pick highest cal per slot
  const repCalMax = new Map<string, number>();
  for (const { slot } of slotsToFill) {
    const cap = effectiveCaps[slot];
    const eligible = candidates
      .filter(c => c.suitableFor.includes(slot) && (repCalMax.get(c.id) ?? 0) < cap)
      .sort((a, b) => b.macros.calories - a.macros.calories);
    const pick = eligible[0];
    if (pick) {
      maxCals += pick.macros.calories;
      repCalMax.set(pick.id, (repCalMax.get(pick.id) ?? 0) + 1);
    } else {
      const fallback = candidates
        .filter(c => c.suitableFor.includes(slot))
        .sort((a, b) => b.macros.calories - a.macros.calories)[0];
      if (fallback) maxCals += fallback.macros.calories;
    }
  }

  // Max-protein pass — pick highest protein per slot
  const repProtMax = new Map<string, number>();
  for (const { slot } of slotsToFill) {
    const cap = effectiveCaps[slot];
    const eligible = candidates
      .filter(c => c.suitableFor.includes(slot) && (repProtMax.get(c.id) ?? 0) < cap)
      .sort((a, b) => b.macros.protein - a.macros.protein);
    const pick = eligible[0];
    if (pick) {
      maxProt += pick.macros.protein;
      repProtMax.set(pick.id, (repProtMax.get(pick.id) ?? 0) + 1);
    } else {
      const fallback = candidates
        .filter(c => c.suitableFor.includes(slot))
        .sort((a, b) => b.macros.protein - a.macros.protein)[0];
      if (fallback) maxProt += fallback.macros.protein;
    }
  }

  // Compare against targets
  const targetWeeklyCals = profile.targetCalories * 7;
  const targetWeeklyProt = profile.targetProteinG * 7;
  const budget = profile.weeklyBudgetGBP;

  const canAfford = minCost <= budget;
  const canHitCals = maxCals >= targetWeeklyCals;
  const canHitProt = maxProt >= targetWeeklyProt;
  const feasible = canAfford && canHitCals && canHitProt;

  if (!canAfford) {
    warnings.push(
      `[FEASIBILITY WARNING] Even the cheapest possible plan costs £${minCost.toFixed(2)}, exceeding the £${budget.toFixed(2)} weekly budget. Add cheaper recipes or increase budget.`
    );
  }

  if (!canHitCals) {
    const bestDailyAvg = Math.round(maxCals / 7);
    warnings.push(
      `[FEASIBILITY WARNING] Best achievable daily calories from current pool is ~${bestDailyAvg} kcal/day vs ${profile.targetCalories} kcal target. Add higher-calorie recipes.`
    );
  }

  if (!canHitProt) {
    const bestDailyProt = Math.round(maxProt / 7);
    warnings.push(
      `[FEASIBILITY WARNING] Best achievable protein from current pool is ~${bestDailyProt}g/day vs ${profile.targetProteinG}g target. Add higher-protein recipes.`
    );
  }

  // Budget-calorie specific tension: can we hit calories within budget?
  if (canAfford && canHitCals) {
    // Check if the cheapest HIGH-cal plan is affordable
    const cheapHighCalCost = slotsToFill.reduce((sum, { slot }) => {
      const cap = effectiveCaps[slot];
      const affordable = candidates
        .filter(c => c.suitableFor.includes(slot) && c.estimatedCostGBP <= budget / slotsToFill.length * 1.5)
        .sort((a, b) => b.macros.calories - a.macros.calories);
      return sum + (affordable[0]?.estimatedCostGBP ?? 0);
    }, 0);

    if (cheapHighCalCost > budget) {
      warnings.push(
        `[FEASIBILITY WARNING] Hitting the ${profile.targetCalories} kcal/day target within £${budget.toFixed(2)}/week is marginally tight. The planner will prioritise budget over calorie density.`
      );
    }
  }

  return {
    feasible,
    minWeeklyCostGBP: Math.round(minCost * 100) / 100,
    maxWeeklyCalories: maxCals,
    maxWeeklyProteinG: maxProt,
    priorityOrder,
    warnings,
  };
}

// ─── Stage A: Runtime Schema Validation ──────────────────────────────────────

export function runtimeValidateSchema(raw: unknown): raw is PlannerRawOutput {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.assignments)) return false;

  for (const item of obj.assignments) {
    if (!item || typeof item !== 'object')               return false;
    const a = item as Record<string, unknown>;
    if (typeof a.day !== 'string')                       return false;
    if (!VALID_DAYS.has(a.day as PlannerDay))            return false;
    if (typeof a.slot !== 'string')                      return false;
    if (!VALID_SLOTS.has(a.slot as PlannerSlot))         return false;
    if (typeof a.recipeId !== 'string' || !a.recipeId)   return false;
  }

  // summary is entirely optional — validate types only if present
  if (obj.summary !== undefined) {
    const s = obj.summary as Record<string, unknown>;
    if (s.estimatedPlannedCostGBP   !== undefined && typeof s.estimatedPlannedCostGBP   !== 'number') return false;
    if (s.estimatedPlannedCalories  !== undefined && typeof s.estimatedPlannedCalories  !== 'number') return false;
    if (s.estimatedPlannedProteinG  !== undefined && typeof s.estimatedPlannedProteinG  !== 'number') return false;
    if (s.plannerNote               !== undefined && typeof s.plannerNote               !== 'string') return false;
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

  // 1. Parse & Tally (Identify valid vs over-cap vs variety-breakers)
  for (const a of raw.assignments) {
    const slotKey = `${a.day}:${a.slot}`;
    const isRequestedSlot = input.slotsToFill.some(s => s.day === a.day && s.slot === a.slot);

    if (!isRequestedSlot) {
      warnings.push(`Extra assignment ignored: ${a.day} ${a.slot} → ${a.recipeId}`);
      continue;
    }

    if (filledSlots.has(slotKey)) continue; // Gemini emitted duplicate slots

    const candidate = candidateMap.get(a.recipeId);
    if (!candidate) {
      warnings.push(`Invalid recipeId "${a.recipeId}" for ${a.day} ${a.slot}`);
      toReassign.push({ day: a.day, slot: a.slot, originalId: a.recipeId });
      filledSlots.add(slotKey);
      continue;
    }

    // Variety Check (Same Day Duplicate)
    if (assignedIdsByDay[a.day].has(a.recipeId)) {
      warnings.push(`Variety violation: "${candidate.title}" assigned twice on ${a.day}`);
      toReassign.push({ day: a.day, slot: a.slot, originalId: a.recipeId });
      filledSlots.add(slotKey);
      continue;
    }

    const currentCount = repeatCounts.get(a.recipeId) ?? 0;
    const allowedRepeats = input.preferences.maxRecipeRepeatsPerWeek;
    if (currentCount >= allowedRepeats) {
      warnings.push(`"${candidate.title}" exceeded hard recipe limit for ${a.day} ${a.slot}`);
      toReassign.push({ day: a.day, slot: a.slot, originalId: a.recipeId });
      filledSlots.add(slotKey);
      continue;
    }

    const arch = candidate.archetype;
    const archCount = archetypeCounts.get(arch) ?? 0;
    const allowedArchRepeats = input.composition.archetypeRepeatCaps[arch] ?? 99;
    
    if (archCount >= allowedArchRepeats) {
      warnings.push(`"${candidate.title}" exceeded archetype [${arch}] cap for ${a.day} ${a.slot}`);
      toReassign.push({ day: a.day, slot: a.slot, originalId: a.recipeId });
      filledSlots.add(slotKey);
      continue;
    }

    // Completely valid assignment
    validAssignments.push(a);
    repeatCounts.set(a.recipeId, currentCount + 1);
    archetypeCounts.set(arch, archCount + 1);
    assignedIdsByDay[a.day].add(a.recipeId);
    filledSlots.add(slotKey);
  }

  // 2. Identify entirely missing slots
  for (const { day, slot } of input.slotsToFill) {
    const slotKey = `${day}:${slot}`;
    if (!filledSlots.has(slotKey)) {
      warnings.push(`Missing assignment for ${day} ${slot}`);
      toReassign.push({ day, slot });
      filledSlots.add(slotKey);
    }
  }

  // 3. Global Reassignment
  // Sort missing slots: constraint priority (breakfast often most constrained)
  toReassign.sort((a, b) => {
    const order = { breakfast: 1, lunch: 2, dinner: 3 };
    return order[a.slot] - order[b.slot];
  });

  for (const r of toReassign) {
    const dayAssignments = validAssignments.filter(a => a.day === r.day);
    const currentCals = dayAssignments.reduce((sum, a) => sum + (candidateMap.get(a.recipeId)?.macros.calories ?? 0), 0);
    const currentProt = dayAssignments.reduce((sum, a) => sum + (candidateMap.get(a.recipeId)?.macros.protein ?? 0), 0);
    
    // Phase 12B: Compute current running plan cost for budget-aware scoring
    const currentPlanCost = validAssignments.reduce((sum, a) => sum + (candidateMap.get(a.recipeId)?.estimatedCostGBP ?? 0), 0);
    
    const repairedId = globalRepair(
      r.day, 
      r.slot, 
      input, 
      repeatCounts,
      archetypeCounts,
      currentCals, 
      currentProt, 
      r.originalId,
      candidateMap,
      currentPlanCost,
      assignedIdsByDay[r.day],
    );

    if (repairedId) {
      // Phase 12: Parse EMERGENCY_FALLBACK tag from the returned id
      const isEmergencyFallback = repairedId.endsWith('::EMERGENCY_FALLBACK');
      // Phase 12D: Parse LUNCH_RESCUE / DINNER_RESCUE tags
      const isLunchRescue = repairedId.endsWith('::LUNCH_RESCUE');
      const isDinnerRescue = repairedId.endsWith('::DINNER_RESCUE');
      const hasRescueTag = isLunchRescue || isDinnerRescue;

      const cleanRepairedId = repairedId
        .replace('::EMERGENCY_FALLBACK', '')
        .replace('::LUNCH_RESCUE', '')
        .replace('::DINNER_RESCUE', '');

      validAssignments.push({ day: r.day, slot: r.slot, recipeId: cleanRepairedId });
      repeatCounts.set(cleanRepairedId, (repeatCounts.get(cleanRepairedId) ?? 0) + 1);
      const repArch = candidateMap.get(cleanRepairedId)!.archetype;
      archetypeCounts.set(repArch, (archetypeCounts.get(repArch) ?? 0) + 1);
      assignedIdsByDay[r.day].add(cleanRepairedId);
      
      if (r.originalId) {
        const orig = candidateMap.get(r.originalId);
        const rep = candidateMap.get(cleanRepairedId);
        if (orig && rep) {
          const costDelta = (rep.estimatedCostGBP - orig.estimatedCostGBP).toFixed(2);
          const sign = rep.estimatedCostGBP >= orig.estimatedCostGBP ? '+' : '';
          const calDelta = rep.macros.calories - orig.macros.calories;
          const calSign = calDelta >= 0 ? '+' : '';
          const proDelta = rep.macros.protein - orig.macros.protein;
          const proSign = proDelta >= 0 ? '+' : '';
          const emergencyTag = isEmergencyFallback ? ' [EMERGENCY FALLBACK]' : '';
          
          // Phase 12B: Budget classification tag
          const netCostDelta = rep.estimatedCostGBP - orig.estimatedCostGBP;
          const projectedAfter = currentPlanCost + rep.estimatedCostGBP;
          const budgetTag = netCostDelta < -0.01
            ? ` [BUDGET SAVING] [Proj: £${projectedAfter.toFixed(2)}]`
            : netCostDelta > 0.01
              ? ` [BUDGET ESCALATION] [Proj: £${projectedAfter.toFixed(2)}]`
              : ` [BUDGET NEUTRAL] [Proj: £${projectedAfter.toFixed(2)}]`;
          
          // Phase 12C/12D: Premium escalation flag for any slot repair costing more than £1.00 extra
          const premiumEscalationTag = netCostDelta > 1.00 ? ' [PREMIUM ESCALATION]' : '';

          // Phase 12D: Pool-collapse rescue diagnostic tag
          const rescueTag = isLunchRescue ? ' [LUNCH RESCUE]' : isDinnerRescue ? ' [DINNER RESCUE]' : '';

          warnings.push(
            `Repaired ${r.day} ${r.slot} to "${rep.title}" ` +
            `(was "${orig.title}") [Cost: ${sign}£${costDelta}] [Cals: ${calSign}${calDelta}] [Protein: ${proSign}${proDelta}g]${emergencyTag}${premiumEscalationTag}${rescueTag}${budgetTag}`
          );
        } else {
          warnings.push(`Repaired ${r.day} ${r.slot} to "${candidateMap.get(cleanRepairedId)?.title}"`);
        }
      } else {
        warnings.push(`Filled missing ${r.day} ${r.slot} with "${candidateMap.get(cleanRepairedId)?.title}"`);
      }
    } else {
      // If we couldn't repair, but we have an over-cap original ID that actually exists, accept it to avoid breaking the plan
      if (r.originalId && candidateMap.has(r.originalId)) {
        warnings.push(`Could not find global alternative for ${r.day} ${r.slot} — accepting over-cap recipe "${candidateMap.get(r.originalId)?.title}"`);
        validAssignments.push({ day: r.day, slot: r.slot, recipeId: r.originalId });
        repeatCounts.set(r.originalId, (repeatCounts.get(r.originalId) ?? 0) + 1);
        const origArch = candidateMap.get(r.originalId)!.archetype;
        archetypeCounts.set(origArch, (archetypeCounts.get(origArch) ?? 0) + 1);
      } else {
        warnings.push(`Could not fill ${r.day} ${r.slot} — no eligible candidate`);
      }
    }
  }

  // 4. Calculate Final Compliance
  let totalCost = 0;
  let totalCals = 0;
  let totalProt = 0;
  
  const finalRepeatCounts = new Map<string, number>();
  const finalVarietyPassed = Array.from(VALID_DAYS).every(d => assignedIdsByDay[d as PlannerDay].size === validAssignments.filter(a => a.day === d).length);
  
  for (const a of validAssignments) {
    const c = candidateMap.get(a.recipeId);
    if (c) {
      totalCost += c.estimatedCostGBP;
      totalCals += c.macros.calories;
      totalProt += c.macros.protein;
      finalRepeatCounts.set(a.recipeId, (finalRepeatCounts.get(a.recipeId) ?? 0) + 1);
    }
  }

  const targetCalsTotal = input.profile.targetCalories * 7;
  const targetProtTotal = input.profile.targetProteinG * 7;

  const isStructurallyValid = validAssignments.length === input.slotsToFill.length;
  const sameDayVarietyPassed = finalVarietyPassed;
  
  let effectiveRepeatCapsPassed = true;
  let nominalRepeatCapsPassed = true;

  const sufficiency = checkCandidateSufficiency(input);
  const effectiveCap = sufficiency.effectiveCaps;
  const nominalCap = input.preferences.maxRecipeRepeatsPerWeek;

  for (const [id, count] of finalRepeatCounts.entries()) {
    if (count > nominalCap) nominalRepeatCapsPassed = false;
    const representativeSlot = validAssignments.find(a => a.recipeId === id)?.slot || 'lunch';
    if (count > (effectiveCap[representativeSlot] ?? 99)) effectiveRepeatCapsPassed = false;
  }

  const dietCompliancePassed = validAssignments.every(a => {
    const c = candidateMap.get(a.recipeId);
    return c && isRecipeAllowedForBaselineDiet(c as any, input.profile.dietaryPreference as any);
  });

  const allergenCompliancePassed = validAssignments.every(a => {
    const c = candidateMap.get(a.recipeId);
    if (!c) return false;
    return !input.profile.allergies.some(allergen => 
      c.title.toLowerCase().includes(allergen.toLowerCase()) || 
      c.tags.some(t => t.toLowerCase().includes(allergen.toLowerCase()))
    );
  });

  const isTargetFeasible = (totalCals >= (targetCalsTotal * CALORIE_COMPLIANCE_THRESHOLD)) && 
                           (totalProt >= (targetProtTotal * PROTEIN_COMPLIANCE_THRESHOLD));

  const isHardRuleValid = isStructurallyValid && sameDayVarietyPassed && effectiveRepeatCapsPassed && dietCompliancePassed && allergenCompliancePassed;

  const compliance: PlannerCompliance = {
    isStructurallyValid,
    sameDayVarietyPassed,
    effectiveRepeatCapsPassed,
    nominalRepeatCapsPassed,
    meetsTargetCalories: totalCals >= (targetCalsTotal * CALORIE_COMPLIANCE_THRESHOLD),
    meetsTargetProtein: totalProt >= (targetProtTotal * PROTEIN_COMPLIANCE_THRESHOLD),
    isHardRuleValid,
    isTargetFeasible,
    dietCompliancePassed,
    allergenCompliancePassed,
  };

  const valid = isHardRuleValid;

  const summary = postProcessSummary(raw.summary, totalCost, totalCals, totalProt, input, validAssignments.length);

  if (totalCost > input.profile.weeklyBudgetGBP) {
    warnings.push(`[BUDGET WARNING] Estimated plan cost (£${totalCost.toFixed(2)}) exceeds weekly budget (£${input.profile.weeklyBudgetGBP.toFixed(2)})`);
  }

  checkCalorieBalance(validAssignments, input, candidateMap, warnings);

  return {
    valid,
    plan: { assignments: validAssignments, summary },
    warnings,
    compliance,
  };
}

// ─── Deterministic Global Repair ──────────────────────────────────────────────

const ARCHETYPE_FAMILIES: Record<string, string[]> = {
  cheap:   ['budget_breakfast', 'budget_workhorse_lunch', 'budget_workhorse_dinner', 'quick_default'],
  protein: ['protein_breakfast', 'high_protein_anchor'],
  premium: ['variety_anchor', 'premium_meal', 'calorie_dense'],
};

function getArchetypeFamily(arch: string): string | null {
  if (ARCHETYPE_FAMILIES.cheap.includes(arch)) return 'cheap';
  if (ARCHETYPE_FAMILIES.protein.includes(arch)) return 'protein';
  if (ARCHETYPE_FAMILIES.premium.includes(arch)) return 'premium';
  return null;
}

// ─── Phase 12: Lunch Quality Classification ──────────────────────────────────
// strong_lunch:     protein >= 35g OR calories >= 600  (original threshold before flagging)
// substantial_lunch: protein >= 30g AND calories >= 500  (acceptable replacement)
// filler_lunch:     anything below substantial

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
): string | null {
  const { candidates, preferences, profile } = input;

  // 1. Filter to correct slot type and within caps AND respect same-day variety
  let pool = candidates.filter(c =>
    c.suitableFor.includes(slot) &&
    c.id !== excludeId &&
    !assignedRecipeIdsToday.has(c.id) &&
    (repeatCounts.get(c.id) ?? 0) < preferences.maxRecipeRepeatsPerWeek &&
    (archetypeCounts.get(c.archetype) ?? 0) < (input.composition.archetypeRepeatCaps[c.archetype] ?? 99)
  );

  // Phase 12: Viable-Alternative Gate
  // Before allowing a filler lunch to replace a strong lunch, check if ANY
  // substantial alternative exists in the current cap-compliant pool.
  const excludeRecipe = (excludeId && candidateMap) ? candidateMap.get(excludeId) : null;
  let fillerOnlyMode = false;
  if (slot === 'lunch' && excludeRecipe && isStrongLunch(excludeRecipe)) {
    const hasSubstantialAlternative = pool.some(c => isSubstantialLunch(c));
    if (!hasSubstantialAlternative) {
      // No substantial lunches left in cap-compliant pool — emergency fallback mode
      fillerOnlyMode = true;
    } else {
      // Substantial alternatives exist: HARD-BLOCK filler candidates from this pass
      const substantialPool = pool.filter(c => isSubstantialLunch(c));
      pool = substantialPool; // Only allow substantial replacements
    }
  }

  // Phase 12C: Budget-Safe Lunch Pool Pre-Filter
  // If any substantial lunch keeps projected plan within budget, remove breach candidates.
  if (slot === 'lunch' && excludeRecipe && currentPlanCost !== undefined) {
    const weeklyBudgetRef = input.profile.weeklyBudgetGBP;
    const hasBudgetSafeSubstantial = pool.some(c =>
      isSubstantialLunch(c) && (currentPlanCost + c.estimatedCostGBP) <= weeklyBudgetRef
    );
    if (hasBudgetSafeSubstantial) {
      const budgetSafePool = pool.filter(c =>
        (currentPlanCost + c.estimatedCostGBP) <= weeklyBudgetRef
      );
      if (budgetSafePool.length > 0) pool = budgetSafePool;
    }
  }

  // Phase 12C/12D: Slot-Agnostic Pool-Collapse Rescue Pass
  // 
  // Triggers when the cap-compliant pool has FULLY COLLAPSED to only expensive options,
  // meaning all remaining candidates cost more than the original by a significant margin.
  //
  // Root cause: budget_workhorse_{lunch|dinner} archetype caps exhaust, leaving only
  // premium/anchor candidates (e.g. Miso Glazed Salmon £5.50, Chicken Parmesan £4.80)
  // as the "cheapest" cap-compliant option — which silently causes budget escalation.
  //
  // Fix: temporarily ignore archetype caps to find cheaper valid alternatives — but
  // still enforce: slot suitability, repeat caps, budget safety.
  let poolCollapseRescueTag: string | null = null;
  if (
    excludeRecipe &&
    currentPlanCost !== undefined &&
    pool.length > 0 &&
    pool.every(c => c.estimatedCostGBP > excludeRecipe.estimatedCostGBP + 0.50)
  ) {
    const weeklyBudgetRef = input.profile.weeklyBudgetGBP;
    const rescueCandidates = candidates.filter(c =>
      c.suitableFor.includes(slot) &&
      c.id !== excludeId &&
      !assignedRecipeIdsToday.has(c.id) &&
      c.estimatedCostGBP <= excludeRecipe.estimatedCostGBP + 0.50 && // cheaper or similar cost
      (repeatCounts.get(c.id) ?? 0) < preferences.maxRecipeRepeatsPerWeek && // repeat cap enforced
      (currentPlanCost + c.estimatedCostGBP) <= weeklyBudgetRef // budget-safe
    );
    if (rescueCandidates.length > 0) {
      pool = rescueCandidates;
      poolCollapseRescueTag = slot === 'lunch' ? 'LUNCH_RESCUE' : 'DINNER_RESCUE';
    }
  }

  if (!pool.length) {
    // Relax caps as last resort to guarantee a meal — BUT still respect same-day variety
    pool = candidates.filter(c => c.suitableFor.includes(slot) && c.id !== excludeId && !assignedRecipeIdsToday.has(c.id));
    if (slot === 'lunch' && excludeRecipe && isStrongLunch(excludeRecipe)) {
      fillerOnlyMode = true; // Still in emergency mode since cap-relaxed pool may not have substantial
    }
  }
  if (!pool.length) return null;

  // 2. Score candidates to find the globally optimal replacement
  const targetCals = profile.targetCalories;
  const targetProt = profile.targetProteinG;
  const weeklyBudget = profile.weeklyBudgetGBP;

  let bestId = pool[0].id;
  let bestScore = -Infinity;

  // Composition logic: boost archetypes that are under target
  const compTargets = input.composition.archetypeCounts as Record<string, number>;
  const excludeFamily = excludeRecipe ? getArchetypeFamily(excludeRecipe.archetype) : null;

  // Phase 12: Count how many substantial lunches remain after this pick
  const substantialLunchesRemaining = (slot === 'lunch')
    ? pool.filter(c => isSubstantialLunch(c)).length
    : 0;

  for (const c of pool) {
    const calGap = targetCals - (currentDayCals + c.macros.calories);
    const protGap = targetProt - (currentDayProt + c.macros.protein);
    
    const calScore = calGap > 0
      ? -calGap
      : -Math.abs(calGap) * 0.5;
    
    let score = calScore - Math.abs(protGap * 15);
    
    // ─── Phase 10, 11 & 12: Explicit Priority Tiers & Guardrails ───
    if (excludeRecipe) {
      const isCheaperOrEqual = c.estimatedCostGBP <= excludeRecipe.estimatedCostGBP;
      const isSameArchetype = c.archetype === excludeRecipe.archetype;
      const family = getArchetypeFamily(c.archetype);
      const isSameFamily = family !== null && family === excludeFamily;

      const calDelta = c.macros.calories - excludeRecipe.macros.calories;
      const protDelta = c.macros.protein - excludeRecipe.macros.protein;
      const similarMacros = Math.abs(calDelta) <= 100 && Math.abs(protDelta) <= 15;
      const majorMacroLoss = calDelta <= -150 || protDelta <= -20;
      // Phase 12C: tightened to £1.00 max — stops Salmon-tier replacements winning via tier bonuses
      const slightCostIncrease = c.estimatedCostGBP > excludeRecipe.estimatedCostGBP && c.estimatedCostGBP <= excludeRecipe.estimatedCostGBP + 1.00;

      // Phase 12C: Lunch-specific Tier 1L — substantial + equal/cheaper cost
      // This must outrank everything else to prevent premium escalation being chosen
      // over a cheaper quality-preserving alternative.
      if (slot === 'lunch' && isSubstantialLunch(c) && isCheaperOrEqual) {
        score += 28000;
      }
      // Tier 1: Same slot + same archetype + equal/lower cost
      else if (isSameArchetype && isCheaperOrEqual) {
        score += 25000;
      }
      // Tier 2: Same slot + same family + equal/lower cost
      else if (isSameFamily && isCheaperOrEqual) {
        score += 20000;
      }
      // Tier 3: Same slot + similar macro profile + equal/lower cost
      else if (similarMacros && isCheaperOrEqual) {
        score += 15000;
      }
      // Tier 4a: (Lunch-specific) Substantial lunch + small cost increase ONLY if budget-safe
      else if (
        slot === 'lunch' && isSubstantialLunch(c) && slightCostIncrease &&
        (currentPlanCost === undefined || (currentPlanCost + c.estimatedCostGBP) <= input.profile.weeklyBudgetGBP)
      ) {
        score += 12000;
      }
      // Tier 4b: Same slot + slight cost increase if it avoids major macro loss
      else if (slightCostIncrease && !majorMacroLoss) {
        score += 10000;
      }
      // Tier 5: Same family + slight cost increase
      else if (isSameFamily && slightCostIncrease) {
        score += 5000;
      }
      // Tier 6: Filler fallback (only reached if fillerOnlyMode or no substantial pool found)

      // Strict Escalation Penalty: Punish upward cost movement unless necessary
      if (!isCheaperOrEqual) {
        const costDiff = c.estimatedCostGBP - excludeRecipe.estimatedCostGBP;
        score -= (costDiff * 5000);
      }

      // Global Macro-Loss Guardrails
      if (calDelta <= -150 && protDelta <= -20) {
        score -= 20000; // Very major penalty
      } else if (calDelta <= -150 || protDelta <= -20) {
        score -= 10000; // Major penalty
      }

      // Phase 12: Reinforce filler penalty hard — only in fillerOnlyMode should filler score positively
      if (slot === 'lunch' && isStrongLunch(excludeRecipe) && isFillerLunch(c)) {
        score -= 50000; // Massive penalty — this should never win unless fillerOnlyMode forced it in
      }
    } else {
      // General cost penalty if no baseline to compare against
      const costFraction = weeklyBudget > 0 ? c.estimatedCostGBP / weeklyBudget : 0;
      score -= costFraction * 1600;
    }

    // ─── Phase 12B: Projected Budget Scoring ───
    if (currentPlanCost !== undefined && excludeRecipe) {
      const costDelta12b = c.estimatedCostGBP - excludeRecipe.estimatedCostGBP;
      const projectedCost = currentPlanCost + c.estimatedCostGBP; // currentPlanCost excludes the slot being repaired
      const planIsOverBudget = currentPlanCost > weeklyBudget;
      const projectedOverBudget = projectedCost > weeklyBudget;
      const nearBudgetEdge = currentPlanCost >= weeklyBudget - 2.00; // within £2

      // 1. Very strong penalty if this swap causes a budget breach
      if (!planIsOverBudget && projectedOverBudget) {
        score -= 30000;
      }
      // 2. Even stronger penalty if plan is already over budget and swap increases cost more
      if (planIsOverBudget && costDelta12b > 0) {
        score -= 40000 + (costDelta12b * 10000);
      }
      // 3. Bonus if swap helps bring over-budget plan back under budget
      if (planIsOverBudget && !projectedOverBudget) {
        score += 25000;
      } else if (planIsOverBudget && costDelta12b < 0) {
        // Partial recovery bonus — reducing cost even if not fully fixed
        score += Math.abs(costDelta12b) * 5000;
      }
      // 4. Near-budget protection: block positive-cost repairs unless major nutrition improvement
      if (nearBudgetEdge && costDelta12b > 0) {
        const calDeltaForBudget = c.macros.calories - excludeRecipe.macros.calories;
        const protDeltaForBudget = c.macros.protein - excludeRecipe.macros.protein;
        const isMajorNutritionImprovement = calDeltaForBudget >= 150 || protDeltaForBudget >= 12;
        if (!isMajorNutritionImprovement) {
          score -= 35000; // Block near-budget cost escalation unless genuinely needed
        }
      }
    }

    // Phase 11: Early-Week Substantial Lunch Preservation
    if (slot === 'lunch' && ['Mon', 'Tue', 'Wed', 'Thu'].includes(day)) {
      if (isSubstantialLunch(c)) {
        const hitsRecipeCap = (repeatCounts.get(c.id) ?? 0) + 1 >= preferences.maxRecipeRepeatsPerWeek;
        const hitsArchCap = (archetypeCounts.get(c.archetype) ?? 0) + 1 >= (input.composition.archetypeRepeatCaps[c.archetype] ?? 99);
        
        if (hitsRecipeCap || hitsArchCap) {
           score -= 3000; // Small penalty for burning the last charge early
        }
      }
    }

    // Phase 12: Future-Slot Preservation Bonus
    if (slot === 'lunch' && isSubstantialLunch(c)) {
      // Bonus for keeping some substantial options alive for future slots
      if (substantialLunchesRemaining <= 2) {
        score -= 2000; // Gentle nudge to preserve the last few
      }
    }
    
    // Goal & Pantry tie-breakers
    if (preferences.prioritisePantry && c.pantryIngredients.length > 0) score += 500;
    if (profile.goalTags.some(tag => c.tags.includes(tag))) score += 300;

    // Bonus for fulfilling a needed archetype
    const currentArchCount = archetypeCounts.get(c.archetype) ?? 0;
    const targetArchCount = compTargets[c.archetype] ?? 0;
    const compTargetBonus = currentArchCount < targetArchCount ? 5000 : 0;
    score += compTargetBonus;

    if (score > bestScore) {
      bestScore = score;
      bestId = c.id;
    }
  }

  // Phase 12: Tag the result with emergency fallback if we're in filler mode
  if (fillerOnlyMode && bestId) {
    const winner = candidates.find(c => c.id === bestId);
    if (winner && isFillerLunch(winner)) {
      // Attach marker to the id so the warning-emit code can detect it
      return `${bestId}::EMERGENCY_FALLBACK`;
    }
  }

  // Phase 12D: Tag the result with rescue flag if pool-collapse rescue activated
  if (poolCollapseRescueTag && bestId) {
    return `${bestId}::${poolCollapseRescueTag}`;
  }

  return bestId;
}

// ─── Local Planner Note Generator ─────────────────────────────────────────────

function generateLocalPlannerNote(
  totalCost: number,
  totalCals: number,
  totalProt: number,
  input: PlannerInput,
  assignmentCount: number,
): string {
  const budget = input.profile.weeklyBudgetGBP;
  const targetCals = input.profile.targetCalories * 7; // weekly target
  const parts: string[] = [];

  if (totalCost > budget) {
    parts.push(`Plan is £${(totalCost - budget).toFixed(2)} over budget.`);
  } else {
    parts.push(`Plan comes in at £${totalCost.toFixed(2)} — within the £${budget.toFixed(2)} budget.`);
  }

  const calPerDay = assignmentCount > 0 ? Math.round(totalCals / 7) : 0;
  if (calPerDay < input.profile.targetCalories * 0.8) {
    parts.push(`Daily average ~${calPerDay} kcal — below the ${input.profile.targetCalories} kcal target.`);
  } else {
    parts.push(`Daily average ~${calPerDay} kcal / ${Math.round(totalProt / 7)}g protein.`);
  }

  return parts.join(' ');
}

// ─── Summary Post-processing ──────────────────────────────────────────────────

function postProcessSummary(
  _geminiSummary: PlannerRawOutput['summary'],
  computedCost: number,
  computedCals: number,
  computedProt: number,
  input: PlannerInput,
  assignmentCount: number,
): PlannerRawOutput['summary'] {
  const localNote = generateLocalPlannerNote(computedCost, computedCals, computedProt, input, assignmentCount);
  return {
    estimatedPlannedCostGBP: computedCost,
    estimatedPlannedCalories: computedCals,
    estimatedPlannedProteinG: computedProt,
    pantryIngredientsUsed: _geminiSummary?.pantryIngredientsUsed ?? [],
    plannerNote: localNote,
  };
}

// ─── Soft Calorie Heuristic ───────────────────────────────────────────────────

function checkCalorieBalance(
  assignments: PlannerAssignment[],
  input: PlannerInput,
  candidateMap: Map<string, PlannerCandidate>,
  warnings: string[],
) {
  const byDay = new Map<PlannerDay, PlannerAssignment[]>();
  for (const a of assignments) {
    if (!byDay.has(a.day)) byDay.set(a.day, []);
    byDay.get(a.day)!.push(a);
  }

  for (const [day, dayAssignments] of byDay) {
    const plannedCount = dayAssignments.length;
    if (!plannedCount) continue;
    const totalCals = dayAssignments.reduce((sum, a) => {
      return sum + (candidateMap.get(a.recipeId)?.macros.calories ?? 0);
    }, 0);
    // Slot-weighted expected calorie target (Breakfast: 25%, Lunch: 35%, Dinner: 40%)
    const targetCals = input.profile.targetCalories;
    let expected = 0;
    for (const a of dayAssignments) {
      if (a.slot === 'breakfast') expected += targetCals * 0.25;
      else if (a.slot === 'lunch') expected += targetCals * 0.35;
      else if (a.slot === 'dinner') expected += targetCals * 0.40;
    }
    
    if (expected === 0) continue;
    
    const deviationRatio = Math.abs(totalCals - expected) / expected;

    if (deviationRatio > 0.40) {
      warnings.push(
        `[MAJOR WARNING] Severe calorie deviation on ${day}: planned slots total ~${Math.round(totalCals)} kcal ` +
        `(expected ~${Math.round(expected)} kcal for ${plannedCount} slots)`
      );
    } else if (deviationRatio > 0.20) {
      warnings.push(
        `Soft calorie note: ${day} total is ~${Math.round(totalCals)} kcal ` +
        `(expected ~${Math.round(expected)} kcal for ${plannedCount} slots)`
      );
    }
  }
}
