import { MOCK_RECIPES } from './seed';
import { DailyMealPlan, MacroTarget, UserProfile, Recipe } from './schema';
import { WeeklyRoutine, DAYS, isPlanned } from './weeklyRoutine';
import { buildPlannerInput } from './plannerInputBuilder';
import { callGeminiPlanner, PLANNER_MODEL_VERSION } from './geminiPlanner';
import { runtimeValidateSchema, validatePlannerOutput, checkCandidateSufficiency, computeFeasibilityBounds, FeasibilityBounds } from './plannerValidation';
import { isRecipeAllowedForBaselineDiet } from './planner/dietRules';
import {
  ResolvedWeeklyPlan,
  ResolvedDayPlan,
  PlanMetadata,
  PlannerDay,
} from './plannerSchema';

// ─── Routine merge ─────────────────────────────────────────────────────────────

function mergePlanWithRoutine(
  assignments: { day: PlannerDay; slot: 'breakfast' | 'lunch' | 'dinner'; recipeId: string }[],
  routine: WeeklyRoutine,
  meta: PlanMetadata,
  summary?: ResolvedWeeklyPlan['summary'],
): ResolvedWeeklyPlan {
  const assignMap = new Map(assignments.map(a => [`${a.day}:${a.slot}`, a.recipeId]));

  const days: ResolvedDayPlan[] = DAYS.map(day => {
    const dr = routine[day];
    return {
      day: day as PlannerDay,
      breakfast: assignMap.has(`${day}:breakfast`)
        ? { recipeId: assignMap.get(`${day}:breakfast`)! }
        : { mode: dr.breakfast as 'skip' | 'quick' },
      lunch: assignMap.has(`${day}:lunch`)
        ? { recipeId: assignMap.get(`${day}:lunch`)! }
        : { mode: dr.lunch as 'skip' | 'leftovers' | 'out' },
      dinner: assignMap.has(`${day}:dinner`)
        ? { recipeId: assignMap.get(`${day}:dinner`)! }
        : { mode: dr.dinner as 'quick' | 'takeaway' | 'out' },
    };
  });

  if (process.env.NODE_ENV === 'development') {
    for (const a of assignments) {
      const dayPlan = days.find(d => d.day === a.day);
      const finalizedSlot = dayPlan?.[a.slot];
      if (!finalizedSlot || typeof finalizedSlot !== 'object' || !('recipeId' in finalizedSlot) || finalizedSlot.recipeId !== a.recipeId) {
        console.error(`[Merge Integrity Error] Original assignment ${a.day} ${a.slot} -> ${a.recipeId} was lost in merge!`);
      }
    }
  }

  return { days, summary, meta };
}

// ─── Mock fallback (deterministic) ────────────────────────────────────────────

export function mockFallbackPlan(
  user: UserProfile,
  routine: WeeklyRoutine,
  warnings: string[],
): ResolvedWeeklyPlan {
  let pool = MOCK_RECIPES.filter(r => isRecipeAllowedForBaselineDiet(r as any, user.dietaryPreference as any));
  if (!pool.length) pool = MOCK_RECIPES;

  const assignments: { day: PlannerDay; slot: 'breakfast' | 'lunch' | 'dinner'; recipeId: string }[] = [];
  
  for (const day of [...DAYS] as PlannerDay[]) {
    const dr = routine[day];
    const usedToday = new Set<string>();
    
    const slots: ('breakfast' | 'lunch' | 'dinner')[] = ['breakfast', 'lunch', 'dinner'];
    for (const slot of slots) {
      if (isPlanned(dr[slot])) {
        // Find first candidate for slot not already used on this day
        const match = pool.find(r => r.suitableFor.includes(slot) && !usedToday.has(r.id));
        const pick = match || pool[0]; // Hard fallback to pool[0] if pool is extremely small
        assignments.push({ day, slot, recipeId: pick.id });
        usedToday.add(pick.id);
      }
    }
  }

  const meta: PlanMetadata = {
    generatedAt: new Date().toISOString(),
    plannerVersion: 'mock',
    source: 'fallback_mock',
    warnings,
    planningMode: 'fallback_mock',
  };

  return mergePlanWithRoutine(assignments, routine, meta);
}

// ─── Diagnostic type (for dev screen) ─────────────────────────────────────────

export type PlannerDiagnostics = {
  plannerInput: ReturnType<typeof buildPlannerInput>;
  rawOutput: unknown;
  stageAResult: boolean;
  suffResult: ReturnType<typeof checkCandidateSufficiency> | null;
  feasBounds: FeasibilityBounds | null;
  stageBResult: ReturnType<typeof validatePlannerOutput> | null;
  resolvedPlan: ResolvedWeeklyPlan;
  errorMsg: string | null;
};

export async function planWeekWithDiagnostics(
  user: Parameters<typeof planWeek>[0],
  routine: Parameters<typeof planWeek>[1],
  pantry: Parameters<typeof planWeek>[2] = {},
): Promise<PlannerDiagnostics> {
  const warnings: string[] = [];
  const input = buildPlannerInput(user, routine, pantry ?? {});

  try {
    const suffResult = checkCandidateSufficiency(input);
    warnings.push(...suffResult.warnings);

    const feasBounds = computeFeasibilityBounds(input, suffResult.effectiveCaps);
    warnings.push(...feasBounds.warnings);

    if (input.slotsToFill.length === 0) {
      const meta: PlanMetadata = {
        generatedAt: new Date().toISOString(),
        plannerVersion: PLANNER_MODEL_VERSION,
        source: 'gemini_clean',
        warnings: ['No plan slots in routine — skipped Gemini call'],
      };
      const resolvedPlan = mergePlanWithRoutine([], routine, meta);
      return { plannerInput: input, rawOutput: null, stageAResult: true, suffResult, feasBounds, stageBResult: null, resolvedPlan, errorMsg: null };
    }

    const raw = await callGeminiPlanner(input);
    const stageAResult = runtimeValidateSchema(raw);

    if (!stageAResult) {
      warnings.push('Stage A: schema validation failed');
      const meta: PlanMetadata = { generatedAt: new Date().toISOString(), plannerVersion: PLANNER_MODEL_VERSION, source: 'fallback_mock', warnings };
      const resolvedPlan = mockFallbackPlan(user, routine, warnings);
      return { plannerInput: input, rawOutput: raw, stageAResult: false, suffResult, feasBounds, stageBResult: null, resolvedPlan, errorMsg: null };
    }

    const stageBResult = validatePlannerOutput(raw, input);
    const allWarnings = [...warnings, ...stageBResult.warnings];
    // Distinguish: repaired (assignments changed), warned (only notes/warnings), clean (nothing)
    const wasRepaired = stageBResult.warnings.some(w =>
      w.startsWith('Repaired') || w.startsWith('Filled missing') || w.startsWith('Could not')
    );
    const source: PlanMetadata['source'] = wasRepaired
      ? 'gemini_repaired'
      : allWarnings.length > 0
        ? 'gemini_warned'
        : 'gemini_clean';

    const meta: PlanMetadata = {
      generatedAt: new Date().toISOString(),
      plannerVersion: PLANNER_MODEL_VERSION,
      source,
      warnings: allWarnings,
      compliance: stageBResult.compliance,
      planningMode: stageBResult.compliance?.meetsTargetProtein ? 'standard' : 'degraded_due_to_infeasible_protein_target',
    };

    const resolvedPlan = mergePlanWithRoutine(stageBResult.plan.assignments, routine, meta, stageBResult.plan.summary);
    return { plannerInput: input, rawOutput: raw, stageAResult, suffResult, feasBounds, stageBResult, resolvedPlan, errorMsg: null };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const resolvedPlan = mockFallbackPlan(user, routine, [...warnings, `Error: ${msg}`]);
    return { plannerInput: input, rawOutput: null, stageAResult: false, suffResult: null, feasBounds: null, stageBResult: null, resolvedPlan, errorMsg: msg };
  }
}

// ─── Main planner entry point ─────────────────────────────────────────────────

export async function planWeek(
  user: UserProfile,
  routine: WeeklyRoutine,
  pantry: Record<string, number> = {},
  previousPlan?: ResolvedWeeklyPlan,
): Promise<ResolvedWeeklyPlan> {
  const warnings: string[] = [];

  try {
    const input = buildPlannerInput(user, routine, pantry);

    const sufficiency = checkCandidateSufficiency(input);
    warnings.push(...sufficiency.warnings);

    // No plan slots — skip the Gemini call entirely
    if (input.slotsToFill.length === 0) {
      const meta: PlanMetadata = {
        generatedAt: new Date().toISOString(),
        plannerVersion: PLANNER_MODEL_VERSION,
        source: 'gemini_clean',
        warnings: ['No plan slots in routine — skipped Gemini call'],
      };
      return mergePlanWithRoutine([], routine, meta);
    }

    const raw = await callGeminiPlanner(input);

    // Stage A: runtime schema check
    if (!runtimeValidateSchema(raw)) {
      warnings.push('Stage A: schema validation failed');
      return previousPlan
        ? { ...previousPlan, meta: { ...previousPlan.meta, source: 'previous', warnings } }
        : mockFallbackPlan(user, routine, warnings);
    }

    // Stage B: business validation + deterministic repair
    const result = validatePlannerOutput(raw, input);
    const allWarnings = [...warnings, ...result.warnings];
    const wasRepaired = result.warnings.some(w =>
      w.startsWith('Repaired') || w.startsWith('Filled missing') || w.startsWith('Could not')
    );
    const source: PlanMetadata['source'] = wasRepaired
      ? 'gemini_repaired'
      : allWarnings.length > 0
        ? 'gemini_warned'
        : 'gemini_clean';

    const meta: PlanMetadata = {
      generatedAt: new Date().toISOString(),
      plannerVersion: PLANNER_MODEL_VERSION,
      source,
      warnings: allWarnings,
      compliance: result.compliance,
      planningMode: result.compliance?.meetsTargetProtein ? 'standard' : 'degraded_due_to_infeasible_protein_target',
    };

    // We no longer abort the plan if some slots were unresolvable.
    // The good assignments are preserved; only completely failed ones fall back to their default routine mode inline.
    return mergePlanWithRoutine(result.plan.assignments, routine, meta, result.plan.summary);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`Gemini call failed: ${msg}`);
    return previousPlan
      ? { ...previousPlan, meta: { ...previousPlan.meta, source: 'previous', warnings } }
      : mockFallbackPlan(user, routine, warnings);
  }
}

// ─── Macro calculator (unchanged, used across the app) ────────────────────────

export function calculateDailyMacros(plan: DailyMealPlan, recipes: Recipe[]): MacroTarget {
  const total: MacroTarget = { calories: 0, protein: 0, carbs: 0, fats: 0 };
  [plan.breakfast, plan.lunch, plan.dinner].forEach(recipeId => {
    if (!recipeId) return;
    const recipe = recipes.find(r => r.id === recipeId);
    if (recipe) {
      total.calories += recipe.macros.calories;
      total.protein  += recipe.macros.protein;
      total.carbs    += recipe.macros.carbs;
      total.fats     += recipe.macros.fats;
    }
  });
  return total;
}
