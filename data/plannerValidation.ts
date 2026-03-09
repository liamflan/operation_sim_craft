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
} from './plannerSchema';

const VALID_DAYS  = new Set<PlannerDay>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
const VALID_SLOTS = new Set<PlannerSlot>(['breakfast', 'lunch', 'dinner']);
const PLANNER_NOTE_MAX = 200;

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
  effectiveCaps: Record<PlannerSlot, number>,
): ValidationResult {
  const warnings: string[]        = [];
  const candidateMap              = new Map(input.candidates.map(c => [c.id, c]));
  const repeatCounts              = new Map<string, number>();
  const validAssignments: PlannerAssignment[] = [];
  const filledSlots               = new Set<string>();
  const toReassign: { day: PlannerDay; slot: PlannerSlot; originalId?: string }[] = [];

  // 1. Parse & Tally (Identify valid vs over-cap)
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

    const currentCount = repeatCounts.get(a.recipeId) ?? 0;
    const allowedRepeats = effectiveCaps[a.slot];
    if (currentCount >= allowedRepeats) {
      warnings.push(`"${candidate.title}" exceeded repeat cap for ${a.day} ${a.slot}`);
      toReassign.push({ day: a.day, slot: a.slot, originalId: a.recipeId });
      filledSlots.add(slotKey);
      continue;
    }

    // Completely valid assignment
    validAssignments.push(a);
    repeatCounts.set(a.recipeId, currentCount + 1);
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
    
    const repairedId = globalRepair(
      r.day, 
      r.slot, 
      input, 
      repeatCounts, 
      effectiveCaps[r.slot], 
      currentCals, 
      currentProt, 
      r.originalId
    );

    if (repairedId) {
      validAssignments.push({ day: r.day, slot: r.slot, recipeId: repairedId });
      repeatCounts.set(repairedId, (repeatCounts.get(repairedId) ?? 0) + 1);
      if (r.originalId) {
        warnings.push(`Repaired ${r.day} ${r.slot} to "${candidateMap.get(repairedId)?.title}"`);
      } else {
        warnings.push(`Filled missing ${r.day} ${r.slot} with "${candidateMap.get(repairedId)?.title}"`);
      }
    } else {
      // If we couldn't repair, but we have an over-cap original ID that actually exists, accept it to avoid breaking the plan
      if (r.originalId && candidateMap.has(r.originalId)) {
        warnings.push(`Could not find global alternative for ${r.day} ${r.slot} — accepting over-cap recipe "${candidateMap.get(r.originalId)?.title}"`);
        validAssignments.push({ day: r.day, slot: r.slot, recipeId: r.originalId });
        repeatCounts.set(r.originalId, (repeatCounts.get(r.originalId) ?? 0) + 1);
      } else {
        warnings.push(`Could not fill ${r.day} ${r.slot} — no eligible candidate`);
      }
    }
  }

  // Re-calculate summary locally (discard Gemini hallucinated numbers)
  let totalCost = 0;
  let totalCals = 0;
  let totalProt = 0;

  for (const a of validAssignments) {
    const c = candidateMap.get(a.recipeId);
    if (c) {
      totalCost += c.estimatedCostGBP;
      totalCals += c.macros.calories;
      totalProt += c.macros.protein;
    }
  }

  const summary = postProcessSummary(raw.summary, totalCost, totalCals, totalProt, input, validAssignments.length);

  if (totalCost > input.profile.weeklyBudgetGBP) {
    warnings.push(`[BUDGET WARNING] Estimated plan cost (£${totalCost.toFixed(2)}) exceeds weekly budget (£${input.profile.weeklyBudgetGBP.toFixed(2)})`);
  }

  // Soft calorie heuristic (warning only, never rejects)
  checkCalorieBalance(validAssignments, input, candidateMap, warnings);

  const valid = warnings.filter(w => w.startsWith('Could not fill')).length === 0;

  return {
    valid,
    plan: { assignments: validAssignments, summary },
    warnings,
  };
}

// ─── Deterministic Global Repair ──────────────────────────────────────────────

function globalRepair(
  day: PlannerDay,
  slot: PlannerSlot,
  input: PlannerInput,
  repeatCounts: Map<string, number>,
  slotCap: number,
  currentDayCals: number,
  currentDayProt: number,
  excludeId?: string,
): string | null {
  const { candidates, preferences, profile } = input;

  // 1. Filter to correct slot type and within caps
  let pool = candidates.filter(c =>
    c.suitableFor.includes(slot) &&
    c.id !== excludeId &&
    (repeatCounts.get(c.id) ?? 0) < slotCap
  );

  if (!pool.length) {
    // Relax repeat cap as last resort to guarantee a meal
    pool = candidates.filter(c => c.suitableFor.includes(slot) && c.id !== excludeId);
  }
  if (!pool.length) return null;

  // 2. Score candidates to find the globally optimal replacement
  // Weighted as: closeness to calorie+protein targets, with a mild cost penalty
  const targetCals = profile.targetCalories;
  const targetProt = profile.targetProteinG;
  const weeklyBudget = profile.weeklyBudgetGBP;

  let bestId = pool[0].id;
  let bestScore = -Infinity;

  for (const c of pool) {
    const calGap = targetCals - (currentDayCals + c.macros.calories);
    const protGap = targetProt - (currentDayProt + c.macros.protein);
    
    // Closer to 0 gap is better (undershoot better than overshoot for calories)
    // Weight calorie undershoot pressure: if day is still under, prefer higher-cal candidates
    const calScore = calGap > 0
      ? -calGap         // undershot: penalise by gap size (but gentler — we want to fill up)
      : -Math.abs(calGap) * 0.5;  // overshot: penalise more gently (small overshoot is OK)
    let score = calScore - Math.abs(protGap * 10);
    
    // Cost penalty: STRONGLY penalise expensive recipes.
    // £7.50 on a £60 budget = 12.5% share → 200pts penalty (4x stronger than before)
    const costFraction = weeklyBudget > 0 ? c.estimatedCostGBP / weeklyBudget : 0;
    score -= costFraction * 1600;
    
    // Goal & Pantry tie-breakers
    if (preferences.prioritisePantry && c.pantryIngredients.length > 0) score += 500;
    if (profile.goalTags.some(tag => c.tags.includes(tag))) score += 300;

    if (score > bestScore) {
      bestScore = score;
      bestId = c.id;
    }
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
