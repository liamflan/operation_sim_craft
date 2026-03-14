/**
 * ActivePlanContext.tsx
 * The definitive source of truth for the currently active generated meal plan.
 * Handles persistence, loading states, and coordination of the hybrid orchestrator.
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { buildPlannerSetup, buildSlotContracts, CalibrationPayload } from './planner/buildPlannerInput';
import { evaluateCandidate, scoreCandidate, checkHardSafetyOnly } from './planner/evaluator';
import { runActivePlan } from './planner/runActivePlan';
import { FULL_RECIPE_CATALOG } from './planner/recipeRegistry';
import { useWeeklyRoutine } from './WeeklyRoutineContext';
import { usePantry } from './PantryContext';
import { NormalizedRecipe, SlotType, DietaryBaseline, OrchestratorOutput, PlannedMealAssignment, CuisineId } from './planner/plannerTypes';
import { useDebug, UnchangedReason } from './DebugContext';
import { StorageService } from './storage';
import { useRecipes } from './RecipeContext';

export interface ActiveWorkspace {
  id: string | null;
  input: { routine: any, payload: CalibrationPayload } | null;
  output: OrchestratorOutput | null;
  status: 'idle' | 'generating' | 'ready' | 'error';
  generatedAt: string | null;
  version: string | null;
  userDiet: DietaryBaseline;
  profileVersion: number;
  actionSource?: string;
  error: string | null;
}

export type PlannerActionStatus = 
  | 'success_changed' 
  | 'success_unchanged' 
  | 'failed_no_candidates'
  | 'failed_safe_regen'
  | 'failed_budget' 
  | 'failed_constraints' 
  | 'failed_locked_state' 
  | 'failed_error' 
  | 'action_ignored';

export type PlannerActionResult = {
  ok: boolean;
  changed: boolean;
  status: PlannerActionStatus;
  reason?: UnchangedReason | 'error';
  rawReason?: any;
  message?: string;
  runId?: string;
  targetDay?: number;
  targetSlot?: SlotType | null;
  changedSlots?: number;
};

/**
 * Maps technical/internal reasons to short friendly user-facing reasons.
 */
export const getFriendlyReason = (status: PlannerActionStatus, reason?: string) => {
  if (status === 'failed_safe_regen') return 'could not improve the plan while keeping it safe; previous plan kept';
  if (status === 'failed_locked_state' || reason === 'all_meals_locked' || reason === 'no_eligible_slots') return 'all meals are locked';
  if (status === 'failed_budget' || reason === 'budget_delta_exceeded') return 'budget is too tight';
  if (status === 'failed_constraints') return 'current constraints are too strict';
  if (status === 'failed_no_candidates' || reason === 'pool_collapse' || reason === 'no_better_candidate') return 'no suitable alternatives found';
  if (status === 'success_unchanged') return 'no better option was available';
  return 'no suitable alternatives found'; // Default fallback
};

interface ActivePlanContextType {
  workspace: ActiveWorkspace;
  regenerateWorkspace: (payload: CalibrationPayload) => Promise<void>;
  updateUserDiet: (diet: DietaryBaseline) => void;
  updateBudget: (budget: number) => void;
  updateCalories: (calories: number, preset?: string) => void;
  updateProtein: (protein: number) => void;
  updateCuisinePreferences: (cuisines: CuisineId[]) => void;
  updateExclusions: (exclusions: string[]) => void;
  clearWorkspace: () => void;
  skipAssignment: (assignmentId: string) => void;
  unskipAssignment: (assignmentId: string) => void;
  skipAndKeepIngredients: (assignmentId: string, recipe: NormalizedRecipe) => void;
  replaceSlot: (dayIndex: number, slotType: SlotType, selectedRecipeId?: string) => Promise<PlannerActionResult>;
  regenerateDay: (dayIndex: number) => Promise<PlannerActionResult>;
  regenerateWeek: () => Promise<PlannerActionResult>;
  getSwapCandidates: (dayIndex: number, slotType: SlotType) => Promise<any[]>;
  slotLoading: Record<string, boolean>;
  dayLoading: Record<number, boolean>;
  weekLoading: boolean;
}

const STORAGE_KEY = 'provision_active_workspace_v1_cuisines';
const PLANNER_VERSION = '1.1.0-clean-cuisine-final';

const INITIAL_WORKSPACE: ActiveWorkspace = {
  id: null,
  input: null,
  output: null,
  status: 'idle',
  error: null,
  generatedAt: null,
  version: PLANNER_VERSION,
  userDiet: 'Omnivore',
  profileVersion: 1,
  actionSource: 'initial_state',
};

const ActivePlanContext = createContext<ActivePlanContextType | undefined>(undefined);

export function ActivePlanProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<ActiveWorkspace>(INITIAL_WORKSPACE);
  const [slotLoading, setSlotLoading] = useState<Record<string, boolean>>({});
  const [dayLoading, setDayLoading] = useState<Record<number, boolean>>({});
  const [weekLoading, setWeekLoading] = useState(false);

  const { routine } = useWeeklyRoutine();
  const { pantryItems, addSkippedIngredients } = usePantry();
  const { updateDebugData } = useDebug();
  const { plannerEligibleRecipes } = useRecipes();

  const workspaceRef = useRef(workspace);
  useEffect(() => { workspaceRef.current = workspace; }, [workspace]);

  const buildLatestEffectivePlannerInput = useCallback(() => {
    const ws = workspaceRef.current;
    
    const DEFAULT_DIET: DietaryBaseline = 'Omnivore';
    const DEFAULT_CUISINES: CuisineId[] = [];
    const DEFAULT_EXCLUSIONS: string[] = [];
    const DEFAULT_BUDGET = 50.00;
    const DEFAULT_CALORIES = 2000;
    const DEFAULT_PROTEIN = 160;

    const base = ws.input?.payload;

    const diet = ws.userDiet || base?.diet || DEFAULT_DIET;
    const preferredCuisineIds = base?.preferredCuisineIds || DEFAULT_CUISINES;
    const excludedIngredientTags = base?.excludedIngredientTags || DEFAULT_EXCLUSIONS;
    const budgetWeekly = base?.budgetWeekly ?? DEFAULT_BUDGET;
    const targetCalories = base?.targetCalories ?? DEFAULT_CALORIES;
    const targetProtein = base?.targetProtein ?? DEFAULT_PROTEIN;

    const latestPayload: CalibrationPayload = {
      diet,
      preferredCuisineIds,
      excludedIngredientTags,
      budgetWeekly,
      targetCalories,
      targetProtein
    };

    return {
      payload: latestPayload,
      routineValue: ws.input?.routine || routine
    };
  }, [routine]);

  useEffect(() => {
    const inputPayload = workspace.input?.payload;

    updateDebugData({
      actionSource: workspace.actionSource || 'initial_state',
      persistedWorkspaceDiet: workspace.userDiet,
      executionMeta: workspace.output?.executionMeta,
      debugCurrentUserDiet: workspace.userDiet,
      debugCurrentSelectedCuisines: inputPayload?.preferredCuisineIds || [],
      debugCurrentProfileExclusions: inputPayload?.excludedIngredientTags || [],
      debugProfileVersion: workspace.profileVersion,
    });
  }, [workspace, updateDebugData]);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const saved = await StorageService.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.version !== PLANNER_VERSION) {
            clearWorkspace();
            return;
          }
          setWorkspace({ ...parsed, status: 'ready' });
        }
      } catch (e) {
        clearWorkspace();
      }
    };
    hydrate();
  }, []);

  useEffect(() => {
    if (workspace.status === 'ready' || workspace.status === 'idle') {
      StorageService.setItem(STORAGE_KEY, JSON.stringify(workspace)).catch(console.error);
    }
  }, [workspace]);

  const regenerateWorkspace = async (payload: CalibrationPayload) => {
    setWorkspace(prev => ({ ...prev, status: 'generating', error: null }));

    try {
      const finalDiet = payload.diet || workspaceRef.current.userDiet || 'Omnivore';
      const finalBudget = payload.budgetWeekly ?? 50.00;

      const { planId, contracts, preSelectedAssignments } = buildPlannerSetup(routine, {
        ...payload,
        diet: finalDiet
      });

      // Integrate unified recipe pool
      const output = await runActivePlan(
        contracts, 
        preSelectedAssignments, 
        'planner_autofill', 
        finalBudget, 
        pantryItems,
        plannerEligibleRecipes
      );

      setWorkspace(prev => ({
        ...prev,
        id: planId,
        input: { routine, payload: { ...payload, diet: finalDiet } },
        output,
        status: 'ready',
        error: null,
        generatedAt: new Date().toISOString(),
        version: PLANNER_VERSION,
        userDiet: finalDiet,
        profileVersion: prev.profileVersion + 1,
        actionSource: 'onboarding_initial_generate'
      }));

    } catch (err) {
      setWorkspace(prev => ({ 
        ...prev, 
        status: 'error', 
        error: err instanceof Error ? err.message : 'Unknown generation failure' 
      }));
    }
  };
  
  const updateUserDiet = (diet: DietaryBaseline) => {
    setWorkspace(prev => {
      const { payload: latestPayload, routineValue } = buildLatestEffectivePlannerInput();
      return {
        ...prev,
        userDiet: diet,
        profileVersion: prev.profileVersion + 1,
        input: {
          routine: routineValue,
          payload: { ...latestPayload, diet }
        }
      };
    });
  };

  const updateBudget = (budget: number) => {
    setWorkspace(prev => {
      const { payload: latestPayload, routineValue } = buildLatestEffectivePlannerInput();
      return {
        ...prev,
        profileVersion: prev.profileVersion + 1,
        input: {
          routine: routineValue,
          payload: { ...latestPayload, budgetWeekly: budget }
        }
      };
    });
  };

  const updateCalories = (calories: number, preset?: string) => {
    setWorkspace(prev => {
      const { payload: latestPayload, routineValue } = buildLatestEffectivePlannerInput();
      return {
        ...prev,
        profileVersion: prev.profileVersion + 1,
        input: {
          routine: routineValue,
          payload: { ...latestPayload, targetCalories: calories, caloriePreset: preset }
        }
      };
    });
  };

  const updateProtein = (protein: number) => {
    setWorkspace(prev => {
      const { payload: latestPayload, routineValue } = buildLatestEffectivePlannerInput();
      return {
        ...prev,
        profileVersion: prev.profileVersion + 1,
        input: {
          routine: routineValue,
          payload: { ...latestPayload, targetProtein: protein }
        }
      };
    });
  };

  const updateCuisinePreferences = (cuisines: CuisineId[]) => {
    setWorkspace(prev => {
      const { payload: latestPayload, routineValue } = buildLatestEffectivePlannerInput();
      return {
        ...prev,
        profileVersion: prev.profileVersion + 1,
        input: {
          routine: routineValue,
          payload: { ...latestPayload, preferredCuisineIds: cuisines }
        }
      };
    });
  };

  const updateExclusions = (exclusions: string[]) => {
    setWorkspace(prev => {
      const { payload: latestPayload, routineValue } = buildLatestEffectivePlannerInput();
      return {
        ...prev,
        profileVersion: prev.profileVersion + 1,
        input: {
          routine: routineValue,
          payload: { ...latestPayload, excludedIngredientTags: exclusions }
        }
      };
    });
  };

  const clearWorkspace = () => {
    setWorkspace({
      ...INITIAL_WORKSPACE,
      status: 'idle',
      error: null
    });
    StorageService.removeItem(STORAGE_KEY).catch(console.error);
  };

  const skipAssignment = (assignmentId: string) => {
    setWorkspace(prev => {
      if (!prev.output) return prev;
      return {
        ...prev,
        output: {
          ...prev.output,
          assignments: prev.output.assignments.map((a: PlannedMealAssignment) => 
            a.id === assignmentId ? { ...a, state: 'skipped' } : a
          )
        }
      };
    });
  };

  const unskipAssignment = (assignmentId: string) => {
    setWorkspace(prev => {
      if (!prev.output) return prev;
      return {
        ...prev,
        output: {
          ...prev.output,
          assignments: prev.output.assignments.map((a: PlannedMealAssignment) => 
            a.id === assignmentId ? { ...a, state: 'locked' } : a
          )
        }
      };
    });
  };

  const skipAndKeepIngredients = (assignmentId: string, recipe: NormalizedRecipe) => {
    setWorkspace(prev => {
      if (!prev.output) return prev;
      return {
        ...prev,
        output: {
          ...prev.output,
          assignments: prev.output.assignments.map((a: PlannedMealAssignment) => 
            a.id === assignmentId ? { ...a, state: 'skipped', pantryTransferStatus: 'transferred' } : a
          )
        }
      };
    });
    
    if (recipe && recipe.ingredients) {
      addSkippedIngredients(recipe.ingredients.map(ing => ({
        ingredientId: ing.canonicalIngredientId || ing.name,
        amount: ing.amount,
        unit: ing.unit
      })));
    }
  };

  /**
   * Helper to determine IF a planner run resulted in actual assignment changes.
   * Compares per-slot: recipeId, skipped state, and manual state.
   */
  const diffAssignments = useCallback((prev: PlannedMealAssignment[], next: PlannedMealAssignment[]) => {
    const prevMap = new Map(prev.map(a => [`${a.dayIndex}_${a.slotType}`, a]));
    const nextMap = new Map(next.map(a => [`${a.dayIndex}_${a.slotType}`, a]));

    const allKeys = Array.from(new Set([...prevMap.keys(), ...nextMap.keys()]));
    let changedSlots = 0;
    const details: any[] = [];

    for (const key of allKeys) {
      const p = prevMap.get(key);
      const n = nextMap.get(key);

      if (!p && !n) continue;

      const isDifferent = 
        (!p && n) || 
        (p && !n) || 
        (p?.recipeId !== n?.recipeId) ||
        (p?.state !== n?.state);

      if (isDifferent) {
        changedSlots++;
        details.push({
          slot: key,
          before: p?.recipeId || 'empty',
          after: n?.recipeId || 'empty'
        });
      }
    }

    return { changed: changedSlots > 0, changedSlots, details };
  }, []);

  const getSwapCandidates = async (dayIndex: number, slotType: SlotType): Promise<any[]> => {
    const { payload: latestPayload, routineValue } = buildLatestEffectivePlannerInput();
    const contracts = buildSlotContracts(workspaceRef.current.id || 'temp_swap', routineValue, latestPayload);
    const contract = contracts.find(c => c.dayIndex === dayIndex && c.slotType === slotType);
    
    if (!contract) return [];

    const previousAssignments = workspaceRef.current.output?.assignments || [];
    const currentAssignment = previousAssignments.find(a => a.dayIndex === dayIndex && a.slotType === slotType);
    const currentRecipeId = currentAssignment?.recipeId;

    // Calculate plan-wide state from preserved assignments
    const archetypeCounts: Record<string, number> = {};
    const globalRepeatRegister = new Map<string, number>();
    const dayArchetypes = new Set<string>();
    const dayRecipeIds = new Set<string>();

    previousAssignments.forEach((a: PlannedMealAssignment) => {
      if (a.dayIndex === dayIndex && a.slotType === slotType) return;
      if (!a.recipeId) return;
      const r = FULL_RECIPE_CATALOG[a.recipeId];
      if (r) {
        archetypeCounts[r.archetype] = (archetypeCounts[r.archetype] || 0) + 1;
        globalRepeatRegister.set(r.id, (globalRepeatRegister.get(r.id) || 0) + 1);
        if (a.dayIndex === dayIndex) {
          dayArchetypes.add(r.archetype);
          dayRecipeIds.add(r.id);
        }
      }
    });

    // Evaluate ALL eligible recipes to ensure parity with replaceSlot logic
    const candidates = plannerEligibleRecipes
      .filter(r => r.id !== currentRecipeId)
      .map(r => {
        const varietyCtx = {
          repeatCount: globalRepeatRegister.get(r.id) || 0,
          archetypeDensity: archetypeCounts[r.archetype] || 0,
          sameDayArchetypes: dayArchetypes as any,
          sameDayRecipeIds: dayRecipeIds,
          consecutiveArchetypeMatch: false,
          cuisineSaturationCount: 0 
        };
        const evalResult = evaluateCandidate(r, contract, varietyCtx, pantryItems);
        if (!evalResult.candidate) return null;
        return { 
          recipe: r, 
          candidate: evalResult.candidate,
          score: evalResult.candidate.scores.totalScore 
        };
      })
      .filter((c: any): c is { recipe: NormalizedRecipe; candidate: any; score: number } => c !== null)
      .sort((a: any, b: any) => b.score - a.score);

    return candidates.map((c: any) => {
      const recipe = c.recipe;
      const currentRecipe = currentRecipeId ? FULL_RECIPE_CATALOG[currentRecipeId] : null;
      
      const reasons: string[] = [];
      if (currentRecipe) {
        if (recipe.estimatedCostPerServingGBP < currentRecipe.estimatedCostPerServingGBP) reasons.push('Lower cost');
        if (recipe.macrosPerServing.protein > currentRecipe.macrosPerServing.protein) reasons.push('Higher protein');
        if (recipe.totalMinutes < currentRecipe.totalMinutes) reasons.push('Faster prep');
      }
      if (recipe.cuisineId && currentRecipe?.cuisineId === recipe.cuisineId) reasons.push('Similar cuisine');

      return {
        ...recipe,
        score: c.score,
        isRecommended: true, // If it's valid, it's a good candidate
        reasonLabel: reasons[0] || 'Good plan match',
        impact: {
          costDelta: recipe.estimatedCostPerServingGBP - (currentRecipe?.estimatedCostPerServingGBP || 0),
          calorieDelta: recipe.macrosPerServing.calories - (currentRecipe?.macrosPerServing.calories || 0),
          proteinDelta: recipe.macrosPerServing.protein - (currentRecipe?.macrosPerServing.protein || 0),
        }
      };
    });
  };

  const replaceSlot = async (dayIndex: number, slotType: SlotType, selectedRecipeId?: string): Promise<PlannerActionResult> => {
    const slotKey = `${dayIndex}_${slotType}`;
    const runId = `swap_${slotKey}_${Date.now()}`;

    if (slotLoading[slotKey]) return { ok: true, changed: false, status: 'action_ignored', reason: 'action_ignored', runId };

    setSlotLoading(prev => ({ ...prev, [slotKey]: true }));
    const previousWorkspace = { ...workspaceRef.current };
    const previousAssignments = previousWorkspace.output?.assignments || [];

    setWorkspace(prev => ({
      ...prev,
      output: prev.output ? {
        ...prev.output,
        assignments: prev.output.assignments.map((a: PlannedMealAssignment) => 
          (a.dayIndex === dayIndex && a.slotType === slotType) ? { ...a, state: 'generating' } : a
        )
      } : null
    }));

    try {
      const { payload: latestPayload, routineValue } = buildLatestEffectivePlannerInput();
      const contracts = buildSlotContracts(workspaceRef.current.id || 'temp_swap', routineValue, latestPayload);
      const preservedAssignments = previousAssignments.filter(
        (a: PlannedMealAssignment) => !(a.dayIndex === dayIndex && a.slotType === slotType)
      );

      const output = await runActivePlan(
        contracts, 
        preservedAssignments, 
        'swap_request', 
        latestPayload.budgetWeekly ?? 50.00, 
        pantryItems,
        plannerEligibleRecipes,
        selectedRecipeId
      );

      const assignedRecipeForTarget = output.assignments.find(a => a.dayIndex === dayIndex && a.slotType === slotType)?.recipeId;
      if (selectedRecipeId && assignedRecipeForTarget !== selectedRecipeId) {
        // Restore state if valid selection failed
        setWorkspace(previousWorkspace);
        return { ok: false, changed: false, status: 'failed_constraints', reason: 'selected_recipe_no_longer_valid' as any };
      }

      const { changed, changedSlots } = diffAssignments(previousAssignments, output.assignments);
      
      if (!changed) {
        setWorkspace(previousWorkspace);
        
        const slotDiag = output.diagnostics.find(d => d.slotId === slotKey);
        let status: PlannerActionStatus = 'success_unchanged';
        let reason: UnchangedReason = 'no_better_candidate';

        if (slotDiag?.actionTaken === 'failed_completely') {
          const topReasons = Object.keys(slotDiag.topFailureReasons || {});
          if (topReasons.includes('budget_delta_exceeded')) {
            status = 'failed_budget';
          } else if (topReasons.some(r => ['dietary_mismatch', 'exclusion_ingredient_match'].includes(r))) {
            status = 'failed_constraints';
          } else {
            status = 'failed_no_candidates';
          }
        }

        const res: PlannerActionResult = { 
          ok: status.startsWith('success_'), 
          changed: false, 
          status, 
          reason, 
          message: 'No better swap found',
          runId 
        };

        updateDebugData({
          lastActionIntent: 'swap_meal',
          lastActionRunId: runId,
          lastActionPhase: 'complete',
          status,
          changed: false,
          changedSlots: 0,
          unchangedReason: reason,
          rawReason: slotDiag?.topFailureReasons,
          lastSwapTargetDay: dayIndex,
          lastSwapTargetSlot: slotType
        });

        return res;
      }

      setWorkspace(prev => ({
        ...prev,
        status: 'ready',
        output,
        generatedAt: new Date().toISOString(),
        actionSource: 'swap_request'
      }));

      updateDebugData({
        lastActionIntent: 'swap_meal',
        lastActionRunId: runId,
        lastActionPhase: 'complete',
        status: 'success_changed',
        changed: true,
        changedSlots,
        lastSwapTargetDay: dayIndex,
        lastSwapTargetSlot: slotType
      });

      return { ok: true, changed: true, status: 'success_changed', changedSlots, runId };
      
    } catch (err) {
      setWorkspace(previousWorkspace);
      updateDebugData({ lastActionPhase: 'error', lastActionRunId: runId });
      return { ok: false, changed: false, status: 'failed_error', reason: 'error', runId };
    } finally {
      setSlotLoading(prev => { const next = { ...prev }; delete next[slotKey]; return next; });
    }
  };

  const regenerateDay = async (dayIndex: number): Promise<PlannerActionResult> => {
    const runId = `regen_day_${dayIndex}_${Date.now()}`;
    if (dayLoading[dayIndex]) return { ok: true, changed: false, status: 'action_ignored', reason: 'action_ignored', runId };

    setDayLoading(prev => ({ ...prev, [dayIndex]: true }));
    const previousWorkspace = { ...workspaceRef.current };
    const previousAssignments = previousWorkspace.output?.assignments || [];

    setWorkspace(prev => ({
      ...prev,
      status: 'generating',
      output: prev.output ? {
        ...prev.output,
        assignments: prev.output.assignments.map((a: PlannedMealAssignment) => 
          (a.dayIndex === dayIndex && a.state !== 'locked' && a.state !== 'skipped') ? { ...a, state: 'generating' } : a
        )
      } : null
    }));

    try {
      const { payload: latestPayload, routineValue } = buildLatestEffectivePlannerInput();
      const contracts = buildSlotContracts(workspaceRef.current.id || 'temp_regen_day', routineValue, latestPayload);
      
      const targetSlotsToRegen = previousAssignments.filter(
        (a: PlannedMealAssignment) => a.dayIndex === dayIndex && a.state !== 'locked' && a.state !== 'skipped' && a.state !== 'cooked'
      );

      if (targetSlotsToRegen.length === 0) {
        setWorkspace(previousWorkspace);
        return { 
          ok: false, 
          changed: false, 
          status: 'failed_locked_state', 
          reason: 'all_meals_locked',
          message: 'All meals are locked',
          runId 
        };
      }

      const preservedAssignments = previousAssignments.filter(
        (a: PlannedMealAssignment) => !(a.dayIndex === dayIndex && a.state !== 'locked' && a.state !== 'skipped' && a.state !== 'cooked')
      );

      const output = await runActivePlan(
        contracts, 
        preservedAssignments, 
        'regenerate_request', 
        latestPayload.budgetWeekly ?? 50.00, 
        pantryItems,
        plannerEligibleRecipes
      );

      // PRESERVATION LOGIC (Phase 22)
      const proposal = output.assignments;
      const patchedAssignments = proposal.map(next => {
        const prev = previousAssignments.find(p => p.dayIndex === next.dayIndex && p.slotType === next.slotType);
        if (!next.recipeId && prev?.recipeId) {
          const oldRecipe = FULL_RECIPE_CATALOG[prev.recipeId];
          const contract = contracts.find(c => c.dayIndex === next.dayIndex && c.slotType === next.slotType);
          if (oldRecipe && contract) {
            const safetyFailures = checkHardSafetyOnly(oldRecipe, contract);
            if (safetyFailures.length === 0) {
              return { ...prev, state: 'proposed' as const };
            }
          }
        }
        return next;
      });

      const refinedOutput = { ...output, assignments: patchedAssignments };

      const { changed, changedSlots } = diffAssignments(previousAssignments, refinedOutput.assignments);

      if (!changed) {
        setWorkspace(previousWorkspace);

        const dayDiags = output.diagnostics.filter(d => d.slotId.startsWith(`${dayIndex}_`));
        const failedSlot = dayDiags.find(d => d.actionTaken === 'failed_completely');
        
        let status: PlannerActionStatus = 'success_unchanged';
        let reason: UnchangedReason = 'same_best_result';

        if (failedSlot) {
          const topReasons = Object.keys(failedSlot.topFailureReasons || {});
          if (topReasons.includes('budget_delta_exceeded')) {
            status = 'failed_budget';
          } else if (topReasons.some(r => ['dietary_mismatch', 'exclusion_ingredient_match'].includes(r))) {
            status = 'failed_constraints';
          } else {
            status = 'failed_no_candidates';
          }
        }

        const res: PlannerActionResult = { 
          ok: status.startsWith('success_'), 
          changed: false, 
          status, 
          reason, 
          message: 'Day plan unchanged',
          runId 
        };

        updateDebugData({
          lastActionIntent: 'regenerate_day',
          lastActionRunId: runId,
          lastActionPhase: 'complete',
          status,
          changed: false,
          changedSlots: 0,
          unchangedReason: reason,
          rawReason: failedSlot?.topFailureReasons,
          lastSwapTargetDay: dayIndex
        });

        return res;
      }

      setWorkspace(prev => ({
        ...prev,
        status: 'ready',
        output: refinedOutput,
        generatedAt: new Date().toISOString(),
        actionSource: 'regenerate_day'
      }));

      updateDebugData({
        lastActionIntent: 'regenerate_day',
        lastActionRunId: runId,
        lastActionPhase: 'complete',
        status: 'success_changed',
        changed: true,
        changedSlots,
        lastSwapTargetDay: dayIndex
      });

      return { ok: true, changed: true, status: 'success_changed', changedSlots, runId };
    } catch (err) {
      setWorkspace(previousWorkspace);
      updateDebugData({ lastActionPhase: 'error', lastActionRunId: runId });
      return { ok: false, changed: false, status: 'failed_error', reason: 'error', runId };
    } finally {
      setDayLoading(prev => { const next = { ...prev }; delete next[dayIndex]; return next; });
    }
  };

  const regenerateWeek = async (): Promise<PlannerActionResult> => {
    const runId = `regen_week_${Date.now()}`;
    if (weekLoading) return { ok: true, changed: false, status: 'action_ignored', reason: 'action_ignored', runId };

    setWeekLoading(true);
    const previousWorkspace = { ...workspaceRef.current };
    const previousAssignments = previousWorkspace.output?.assignments || [];

    setWorkspace(prev => ({
      ...prev,
      status: 'generating',
      output: prev.output ? {
        ...prev.output,
        assignments: prev.output.assignments.map((a: PlannedMealAssignment) => 
          (a.state !== 'locked' && a.state !== 'skipped' && a.state !== 'cooked') ? { ...a, state: 'generating' } : a
        )
      } : null
    }));

    try {
      const { payload: latestPayload, routineValue } = buildLatestEffectivePlannerInput();
      const contracts = buildSlotContracts(workspaceRef.current.id || 'temp_regen_week', routineValue, latestPayload);
      
      const targetSlotsToRegen = previousAssignments.filter(
        (a: PlannedMealAssignment) => (a.state !== 'locked' && a.state !== 'skipped' && a.state !== 'cooked')
      );

      if (targetSlotsToRegen.length === 0) {
        setWorkspace(previousWorkspace);
        return { 
          ok: false, 
          changed: false, 
          status: 'failed_locked_state', 
          reason: 'all_meals_locked',
          message: 'All meals are locked',
          runId 
        };
      }

      const preservedAssignments = previousAssignments.filter(
        (a: PlannedMealAssignment) => (a.state === 'locked' || a.state === 'skipped' || a.state === 'cooked')
      );

      const output = await runActivePlan(
        contracts, 
        preservedAssignments, 
        'regenerate_week_request', 
        latestPayload.budgetWeekly ?? 50.00, 
        pantryItems,
        plannerEligibleRecipes
      );

      // TRANSACTIONAL VALIDATION & PRESERVATION (Phase 22)
      const proposal = output.assignments;
      const patchedAssignments = proposal.map(next => {
        const prev = previousAssignments.find(p => p.dayIndex === next.dayIndex && p.slotType === next.slotType);
        
        // If the new plan has a hole but the old plan had a recipe...
        if (!next.recipeId && prev?.recipeId) {
          const oldRecipe = FULL_RECIPE_CATALOG[prev.recipeId];
          const contract = contracts.find(c => c.dayIndex === next.dayIndex && c.slotType === next.slotType);
          
          if (oldRecipe && contract) {
            const safetyFailures = checkHardSafetyOnly(oldRecipe, contract);
            if (safetyFailures.length === 0) {
              // PRESERVE OLD ASSIGNMENT: It is still hard-safe
              return { ...prev, state: 'proposed' as const };
            }
          }
        }
        return next;
      });

      // Final Reliability Check: Are there any NEW holes introduced?
      const hasNewHoles = patchedAssignments.some(a => {
        if (a.recipeId) return false; 
        const prev = previousAssignments.find(p => p.dayIndex === a.dayIndex && p.slotType === a.slotType);
        return (prev?.recipeId); // True if it was previously filled but now is empty
      });

      if (hasNewHoles) {
        setWorkspace(previousWorkspace);
        const res: PlannerActionResult = { 
          ok: false, 
          changed: false, 
          status: 'failed_safe_regen', 
          message: 'Could not safely regenerate the full week under current constraints. Your previous plan has been kept.',
          runId 
        };
        updateDebugData({
          lastActionIntent: 'regenerate_week',
          lastActionRunId: runId,
          status: 'failed_safe_regen',
          changed: false
        });
        return res;
      }

      const refinedOutput = { ...output, assignments: patchedAssignments };

      const { changed, changedSlots } = diffAssignments(previousAssignments, refinedOutput.assignments);

      if (!changed) {
        setWorkspace(previousWorkspace);

        const failedSlot = output.diagnostics.find(d => d.actionTaken === 'failed_completely');
        let status: PlannerActionStatus = 'success_unchanged';
        let reason: UnchangedReason = 'same_best_result';

        if (failedSlot) {
          const topReasons = Object.keys(failedSlot.topFailureReasons || {});
          if (topReasons.includes('budget_delta_exceeded')) {
            status = 'failed_budget';
          } else if (topReasons.some(r => ['dietary_mismatch', 'exclusion_ingredient_match'].includes(r))) {
            status = 'failed_constraints';
          } else {
            status = 'failed_no_candidates';
          }
        }

        const res: PlannerActionResult = { 
          ok: status.startsWith('success_'), 
          changed: false, 
          status, 
          reason, 
          message: 'Week plan unchanged',
          runId 
        };

        updateDebugData({
          lastActionIntent: 'regenerate_week',
          lastActionRunId: runId,
          lastActionPhase: 'complete',
          status,
          changed: false,
          changedSlots: 0,
          unchangedReason: reason,
          rawReason: failedSlot?.topFailureReasons
        });

        return res;
      }

      setWorkspace(prev => ({
        ...prev,
        status: 'ready',
        output: refinedOutput,
        generatedAt: new Date().toISOString(),
        actionSource: 'regenerate_week'
      }));

      updateDebugData({
        lastActionIntent: 'regenerate_week',
        lastActionRunId: runId,
        lastActionPhase: 'complete',
        status: 'success_changed',
        changed: true,
        changedSlots,
      });

      return { ok: true, changed: true, status: 'success_changed', changedSlots, runId };
    } catch (err) {
      setWorkspace(previousWorkspace);
      updateDebugData({ lastActionPhase: 'error', lastActionRunId: runId });
      return { ok: false, changed: false, status: 'failed_error', reason: 'error', runId };
    } finally {
      setWeekLoading(false);
    }
  };

  return (
    <ActivePlanContext.Provider value={{ 
      workspace, 
      regenerateWorkspace, 
      updateUserDiet, 
      updateBudget, 
      updateCalories, 
      updateProtein, 
      updateCuisinePreferences, 
      updateExclusions, 
      clearWorkspace,
      skipAssignment,
      unskipAssignment,
      skipAndKeepIngredients,
      replaceSlot,
      regenerateDay,
      regenerateWeek,
      getSwapCandidates,
      slotLoading,
      dayLoading,
      weekLoading
    }}>
      {children}
    </ActivePlanContext.Provider>
  );
}

export const useActivePlan = () => {
  const context = useContext(ActivePlanContext);
  if (context === undefined) {
    throw new Error('useActivePlan must be used within an ActivePlanProvider');
  }
  return context;
};
