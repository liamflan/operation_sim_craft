/**
 * ActivePlanContext.tsx
 * The definitive source of truth for the currently active generated meal plan.
 * Handles persistence, loading states, and coordination of the hybrid orchestrator.
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { PlannerInput } from './plannerSchema';
import { buildPlannerSetup, buildSlotContracts, CalibrationPayload } from './planner/buildPlannerInput';
import { runActivePlan } from './planner/runActivePlan';
import { useWeeklyRoutine } from './WeeklyRoutineContext';
import { usePantry } from './PantryContext';
import { NormalizedRecipe, SlotType, DietaryBaseline, OrchestratorOutput, PlannedMealAssignment } from './planner/plannerTypes';
import { useDebug } from './DebugContext';

export interface ActiveWorkspace {
  id: string | null;
  input: { routine: any, payload: CalibrationPayload } | null;
  output: OrchestratorOutput | null;
  status: 'idle' | 'generating' | 'ready' | 'error';
  generatedAt: string | null;
  version: string | null;
  userDiet: DietaryBaseline;
  selectedOnboardingDiet?: DietaryBaseline | null;
  profileVersion: number;
  actionSource?: string;
  error: string | null;
}

export type PlannerActionResult = {
  ok: boolean;
  changed: boolean;
  reason?: 'no_better_candidate' | 'budget_delta_exceeded' | 'pool_collapse' | 'same_best_result' | 'zero_target_day_candidates' | 'action_ignored' | 'error';
  message?: string;
  runId?: string;
  targetDay?: number;
  targetSlot?: SlotType | null;
  changeSummary?: {
    changedSlotCount: number;
    changedDayIndexes: number[];
    firstChangedDayIndex: number | null;
  };
};

interface ActivePlanContextType {
  workspace: ActiveWorkspace;
  regenerateWorkspace: (payload: CalibrationPayload) => Promise<void>;
  updateUserDiet: (diet: DietaryBaseline) => void;
  updateBudget: (budget: number) => void;
  updateCalories: (calories: number) => void;
  updateProtein: (protein: number) => void;
  updateVibes: (vibes: string[]) => void;
  updateExclusions: (exclusions: string[]) => void;
  clearWorkspace: () => void;
  skipAssignment: (assignmentId: string) => void;
  unskipAssignment: (assignmentId: string) => void;
  skipAndKeepIngredients: (assignmentId: string, recipe: NormalizedRecipe) => void;
  replaceSlot: (dayIndex: number, slotType: SlotType) => Promise<PlannerActionResult>;
  regenerateDay: (dayIndex: number) => Promise<PlannerActionResult>;
  regenerateWeek: () => Promise<PlannerActionResult>;
  /** Per-slot in-flight guard: key = "dayIndex_slotType" */
  slotLoading: Record<string, boolean>;
  /** Per-day in-flight guard: key = dayIndex */
  dayLoading: Record<number, boolean>;
  /** Week-level in-flight guard */
  weekLoading: boolean;
}

const STORAGE_KEY = 'provision_active_workspace_v1';
const PLANNER_VERSION = '1.0.0-hybrid';

const INITIAL_WORKSPACE: ActiveWorkspace = {
  id: null,
  input: null,
  output: null,
  status: 'idle',
  error: null,
  generatedAt: null,
  version: PLANNER_VERSION,
  userDiet: 'Omnivore',
  selectedOnboardingDiet: null,
  profileVersion: 1,
  actionSource: 'initial_state',
};

const ActivePlanContext = createContext<ActivePlanContextType | undefined>(undefined);

export function ActivePlanProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<ActiveWorkspace>(INITIAL_WORKSPACE);
  // Per-slot / per-day / week in-flight guards (finer-grained than global status)
  const [slotLoading, setSlotLoading] = useState<Record<string, boolean>>({});
  const [dayLoading, setDayLoading] = useState<Record<number, boolean>>({});
  const [weekLoading, setWeekLoading] = useState(false);

  const { routine } = useWeeklyRoutine();
  const { pantryItems, addSkippedIngredients } = usePantry();
  const { updateDebugData } = useDebug();

  // Stable ref to prevent stale closure reads in async handlers
  const workspaceRef = useRef(workspace);
  useEffect(() => { workspaceRef.current = workspace; }, [workspace]);

  const calculatePlanDiff = (oldOutput: OrchestratorOutput | null, newOutput: OrchestratorOutput | null) => {
    if (!oldOutput || !newOutput) return { changedSlotCount: 0, changedDayIndexes: [], firstChangedDayIndex: null };
    
    const changedAssignments = newOutput.assignments.filter(newA => {
      const oldA = oldOutput.assignments.find(oa => oa.dayIndex === newA.dayIndex && oa.slotType === newA.slotType);
      // Compare by recipeId. If one is null and other isn't, it's a change.
      return oldA?.recipeId !== newA.recipeId;
    });

    const changedDayIndexes = Array.from(new Set(changedAssignments.map(a => Number(a.dayIndex)))).sort((a,b) => a - b);

    return {
      changedSlotCount: changedAssignments.length,
      changedDayIndexes,
      firstChangedDayIndex: changedDayIndexes.length > 0 ? changedDayIndexes[0] : null
    };
  };

  /**
   * CENTRALIZED TRUTH HELPER
   * Builds the latest effective planner input from the workspace truth.
   * Priority:
   * 1. Latest workspace profile fields (userDiet, etc.)
   * 2. Existing input payload if present
   * 3. Safe defaults for anything still missing
   */
  const buildLatestEffectivePlannerInput = useCallback(() => {
    const ws = workspaceRef.current;
    
    const defaultedFields: string[] = [];
    let source: 'latest_workspace' | 'workspace_plus_defaults' | 'existing_input_snapshot' = 'existing_input_snapshot';

    // 1. Safe Defaults
    const DEFAULT_DIET: DietaryBaseline = 'Omnivore';
    const DEFAULT_VIBES: string[] = [];
    const DEFAULT_EXCLUSIONS: string[] = [];
    const DEFAULT_BUDGET = 50.00;
    const DEFAULT_CALORIES = 2000;
    const DEFAULT_PROTEIN = 160;

    // 2. Base from Existing Payload
    const base = ws.input?.payload;

    if (!base) {
      source = 'workspace_plus_defaults';
      defaultedFields.push('input_snapshot_missing');
    }

    // 3. Merge Truth
    // a) Diet is always in ws.userDiet
    const diet = ws.userDiet || base?.diet || DEFAULT_DIET;
    if (!ws.userDiet && !base?.diet) defaultedFields.push('diet');

    // b) Vibes
    const selectedVibes = base?.selectedVibes || DEFAULT_VIBES;
    if (!base?.selectedVibes) defaultedFields.push('selectedVibes');

    // c) Exclusions
    const profileExclusions = base?.profileExclusions || DEFAULT_EXCLUSIONS;
    if (!base?.profileExclusions) defaultedFields.push('profileExclusions');

    // d) Targets (Budget, Cals, Protein)
    const budgetWeekly = base?.budgetWeekly ?? DEFAULT_BUDGET;
    if (base?.budgetWeekly === undefined) defaultedFields.push('budgetWeekly');

    const targetCalories = base?.targetCalories ?? DEFAULT_CALORIES;
    if (base?.targetCalories === undefined) defaultedFields.push('targetCalories');
    
    const targetProtein = base?.targetProtein ?? DEFAULT_PROTEIN;
    if (base?.targetProtein === undefined) defaultedFields.push('targetProtein');

    // If source started as snapshot but diet (our main truth) changed, mark as latest_workspace
    if (source === 'existing_input_snapshot' && ws.userDiet !== base?.diet) {
        source = 'latest_workspace';
    }

    const latestPayload: CalibrationPayload = {
      diet,
      selectedVibes,
      profileExclusions,
      budgetWeekly,
      targetCalories,
      targetProtein
    };

    return {
      payload: latestPayload,
      routineValue: ws.input?.routine || routine, // fallback to current context routine if workspace is empty
      source,
      usedDefaults: defaultedFields.length > 0,
      defaultedFields
    };
  }, [routine]);

  // ─── Debug Sync ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const inputPayload = workspace.input?.payload;

    updateDebugData({
      actionSource: workspace.actionSource || 'initial_state',
      selectedOnboardingDiet: workspace.selectedOnboardingDiet || null,
      persistedWorkspaceDiet: workspace.userDiet,
      plannerInputDiet: inputPayload?.diet || workspace.userDiet,
      executionMeta: workspace.output?.executionMeta,
      persistedWorkspaceBudget: inputPayload?.budgetWeekly ?? null,
      
      // Freshness Trace fields
      debugCurrentUserDiet: workspace.userDiet,
      debugCurrentSelectedVibes: inputPayload?.selectedVibes || [],
      debugCurrentProfileExclusions: inputPayload?.profileExclusions || [],
      debugCurrentBudgetWeekly: inputPayload?.budgetWeekly || 50.00,
      debugCurrentTargetCalories: inputPayload?.targetCalories || 2400,
      debugCurrentTargetProteinG: inputPayload?.targetProtein || 160,
      debugProfileVersion: workspace.profileVersion,
    });
  }, [
    workspace.output?.executionMeta, 
    workspace.actionSource, 
    workspace.selectedOnboardingDiet, 
    workspace.userDiet, 
    workspace.input?.payload,
    workspace.profileVersion,
    updateDebugData
  ]);

  // ─── Hydration ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const hydrate = async () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          
          // CRITICAL: Hydration Guard
          // If version is missing or mismatched, we discard to prevent runtime crashes
          if (parsed.version !== PLANNER_VERSION) {
            console.warn(`[ActivePlanContext] Version mismatch: expected ${PLANNER_VERSION}, found ${parsed.version}. Clearing.`);
            clearWorkspace();
            return;
          }

          setWorkspace({ ...parsed, status: 'ready' });
        }
      } catch (e) {
        console.error('[ActivePlanContext] Hydration failed - likely corrupt JSON. Resetting.', e);
        clearWorkspace();
      }
    };
    hydrate();
  }, []);

  // ─── Persist ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (workspace.status === 'ready' || workspace.status === 'idle') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    }
  }, [workspace]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const regenerateWorkspace = async (payload: CalibrationPayload) => {
    setWorkspace(prev => ({ ...prev, status: 'generating', error: null }));

    // Emit budget trace before planner starts
    updateDebugData({
      selectedOnboardingBudget: payload.budgetWeekly ?? null,
      plannerInputBudget: payload.budgetWeekly ?? null,
    });

    try {
      // 1. Diagnostic Alignment Check
      const workspaceDiet = workspaceRef.current.userDiet;
      const payloadDiet = payload.diet;
      
      console.log(`[ActivePlanContext] ONBOARDING FLOW DIAGNOSTIC:`);
      console.log(` - Onboarding (Payload) Diet: ${payloadDiet || 'Not Provided'}`);
      console.log(` - Workspace (DB) Diet: ${workspaceDiet}`);
      
      const finalDiet = payloadDiet || workspaceDiet || 'Omnivore';
      const finalBudget = payload.budgetWeekly ?? 50.00;
      console.log(` - Planner Input (Final) Diet: ${finalDiet}`);
      console.log(` - Planner Input (Final) Budget: £${finalBudget}`);

      // 1. Build the setup (Contracts + Initial Vibe Assignments)
      console.log('[ActivePlanContext] Regenerating with routine:', Object.keys(routine));
      const { planId, contracts, vibeAssignments } = buildPlannerSetup(routine, {
        ...payload,
        diet: finalDiet
      });
      console.log('[ActivePlanContext] Contracts built:', contracts.length, 'Example diet:', contracts[0]?.dietaryBaseline);

      // 2. Run the plan execution
      const output = await runActivePlan(contracts, vibeAssignments, 'planner_autofill', finalBudget);

      // 3. Update status
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

      // Sync persisted budget + exclusions into debug
      const activeExclusions = (payload.profileExclusions ?? []).map(e => e.toLowerCase().trim()).filter(Boolean);
      updateDebugData({
        persistedWorkspaceBudget: finalBudget,
        selectedOnboardingBudget: payload.budgetWeekly ?? null,
        plannerInputBudget: finalBudget,
        hardExclusionsActive: activeExclusions.length,
        hardExclusionValues: activeExclusions.length > 0 ? activeExclusions : null,
      });

      console.log('[ActivePlanContext] Generation Complete. State userDiet:', finalDiet);
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
      if (prev.userDiet === diet) return prev;
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
      if (latestPayload.budgetWeekly === budget) return prev;
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

  const updateCalories = (calories: number) => {
    setWorkspace(prev => {
      const { payload: latestPayload, routineValue } = buildLatestEffectivePlannerInput();
      if (latestPayload.targetCalories === calories) return prev;
      return {
        ...prev,
        profileVersion: prev.profileVersion + 1,
        input: {
          routine: routineValue,
          payload: { ...latestPayload, targetCalories: calories }
        }
      };
    });
  };

  const updateProtein = (protein: number) => {
    setWorkspace(prev => {
      const { payload: latestPayload, routineValue } = buildLatestEffectivePlannerInput();
      if (latestPayload.targetProtein === protein) return prev;
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

  const updateVibes = (vibes: string[]) => {
    setWorkspace(prev => {
      const { payload: latestPayload, routineValue } = buildLatestEffectivePlannerInput();
      const currentVibes = latestPayload.selectedVibes || [];
      if (currentVibes.length === vibes.length && currentVibes.every((v, i) => v === vibes[i])) return prev;
      
      return {
        ...prev,
        profileVersion: prev.profileVersion + 1,
        input: {
          routine: routineValue,
          payload: { ...latestPayload, selectedVibes: vibes }
        }
      };
    });
  };

  const updateExclusions = (exclusions: string[]) => {
    setWorkspace(prev => {
      const { payload: latestPayload, routineValue } = buildLatestEffectivePlannerInput();
      const currentExclusions = latestPayload.profileExclusions || [];
      if (currentExclusions.length === exclusions.length && currentExclusions.every((v, i) => v === exclusions[i])) return prev;

      return {
        ...prev,
        profileVersion: prev.profileVersion + 1,
        input: {
          routine: routineValue,
          payload: { ...latestPayload, profileExclusions: exclusions }
        }
      };
    });
  };

  const clearWorkspace = () => {
    setWorkspace(INITIAL_WORKSPACE);
    localStorage.removeItem(STORAGE_KEY);
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
    // 1. Mark assignment as skipped and note the transfer
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
    
    // 2. Transfer ingredients to pantry
    if (recipe && recipe.ingredients) {
      addSkippedIngredients(recipe.ingredients.map(ing => ({
        ingredientId: ing.canonicalIngredientId || ing.name,
        amount: ing.amount,
        unit: ing.unit
      })));
    }
  };

  const replaceSlot = async (dayIndex: number, slotType: SlotType) => {
    const slotKey = `${dayIndex}_${slotType}`;
    const runId = `swap_${slotKey}_${Date.now()}`;
    const clickAt = new Date().toISOString();

    // Read current slot assignment for before-state
    const currentAssignment = workspaceRef.current.output?.assignments.find(
      a => a.dayIndex === dayIndex && a.slotType === slotType
    );
    const originalRecipeId = currentAssignment?.recipeId ?? null;
    const cardStateBefore = currentAssignment?.state ?? null;

    // ── Phase: click_received — always emit even if we will ignore ──────────
    updateDebugData({
      lastActionIntent: 'swap_request',
      lastActionRunId: runId,
      lastActionPhase: 'click_received',
      lastClickAt: clickAt,
      actionIgnoredReason: null,
      lastSwapTargetDay: dayIndex,
      lastSwapTargetSlot: slotType,
      lastSwapCurrentRecipeId: originalRecipeId,
      cardStateBefore: String(cardStateBefore),
      cardStateAfter: null,
      resultChanged: null,
      unchangedReason: null,
      loadingCleared: null,
      collapseContext: null,
    });

    // ── Per-slot in-flight guard (finer than global status) ──────────────────
    if (slotLoading[slotKey]) {
      const ignoredReason = 'slot_already_loading';
      console.log(`[${runId}] ACTION_IGNORED: ${ignoredReason}`);
      updateDebugData({
        lastActionPhase: 'action_ignored',
        actionIgnoredReason: ignoredReason,
        unchangedReason: 'action_ignored',
      });
      return { ok: true, changed: false, reason: 'action_ignored', runId } as PlannerActionResult;
    }

    if (!workspaceRef.current.input && !workspaceRef.current.userDiet) {
      const ignoredReason = 'no_input_context';
      console.log(`[${runId}] ACTION_IGNORED: ${ignoredReason}`);
      updateDebugData({
        lastActionPhase: 'action_ignored',
        actionIgnoredReason: ignoredReason,
        unchangedReason: 'action_ignored',
      });
      return { ok: false, changed: false, reason: 'error', message: 'Internal error: no profile data to build plan.', runId } as PlannerActionResult;
    }

    // Lock this slot
    setSlotLoading(prev => ({ ...prev, [slotKey]: true }));

    console.log(`[${runId}] SWAP_START - target: day ${dayIndex}, slot ${slotType}`);
    const previousWorkspace = { ...workspaceRef.current };

    setWorkspace(prev => ({
      ...prev,
      output: prev.output ? {
        ...prev.output,
        assignments: prev.output.assignments.map((a: PlannedMealAssignment) => 
          (a.dayIndex === dayIndex && a.slotType === slotType) 
            ? { ...a, state: 'generating' } 
            : a
        )
      } : null
    }));

    const timeoutId = setTimeout(() => {
      console.error(`[${runId}] error: TIMEOUT EXCEEDED (15s). Forcing restore.`);
      setWorkspace(workspaceRef.current.status === 'generating' ? previousWorkspace : workspaceRef.current);
      setSlotLoading(prev => { const next = { ...prev }; delete next[slotKey]; return next; });
      updateDebugData({ lastActionPhase: 'error', loadingCleared: true });
    }, 15000);

    try {
      // ── REBUID INPUT FROM CENTRALIZED HELPER ──
      const { payload: latestPayload, routineValue, source, usedDefaults, defaultedFields } = buildLatestEffectivePlannerInput();

      const contracts = buildSlotContracts(workspaceRef.current.id || 'temp_swap', routineValue, latestPayload);
      
      const preservedAssignments = previousWorkspace.output?.assignments.filter(
        (a: PlannedMealAssignment) => !(a.dayIndex === dayIndex && a.slotType === slotType)
      ) || [];

      const activeExclusions = (latestPayload.profileExclusions ?? []).map((e: string) => e.toLowerCase().trim()).filter(Boolean);
      const plannerStartAt = new Date().toISOString();
      updateDebugData({
        lastActionPhase: 'planner_running',
        lastPlannerStartAt: plannerStartAt,
        lastPlannerExecutionSource: 'swap_request',
        hardExclusionsActive: activeExclusions.length,
        hardExclusionValues: activeExclusions.length > 0 ? activeExclusions : null,

        // Final Truth telemetry
        debugPlannerInputDiet: latestPayload.diet,
        debugPlannerInputSelectedVibes: latestPayload.selectedVibes,
        debugPlannerInputExclusions: latestPayload.profileExclusions,
        debugPlannerInputBudgetWeekly: latestPayload.budgetWeekly,
        debugPlannerInputTargetCalories: latestPayload.targetCalories,
        debugPlannerInputTargetProteinG: latestPayload.targetProtein,
        debugPlannerInputProfileVersion: workspaceRef.current.profileVersion,
        debugUsedLatestProfileForRun: true,
        debugPlannerInputSource: source,
        debugUsedDefaultsForRun: usedDefaults,
        debugDefaultedFields: defaultedFields,
      });

      console.log(`[${runId}] planner_started`);
      const plannerStartTime = Date.now();
      const output = await runActivePlan(contracts, preservedAssignments, 'swap_request', latestPayload.budgetWeekly ?? 50.00, pantryItems);
      const plannerDuration = Date.now() - plannerStartTime;
      const plannerEndAt = new Date().toISOString();

      const newAssignment = output.assignments.find(a => a.dayIndex === dayIndex && a.slotType === slotType);
      const newRecipeId = newAssignment?.recipeId ?? null;
      const newState = newAssignment?.state ?? null;
      const isUnchanged = originalRecipeId === newRecipeId;

      const diff = calculatePlanDiff(previousWorkspace.output, output);

      // Determine unchanged reason from planner output
      let unchangedReason: import('./DebugContext').UnchangedReason | null = null;
      if (isUnchanged) {
        if (newState === 'pool_collapse') {
          unchangedReason = 'pool_collapse';
        } else if (newRecipeId === originalRecipeId) {
          unchangedReason = 'same_best_result';
        } else {
          unchangedReason = 'no_better_candidate';
        }
      }

      // Extract collapse context if present
      const collapseCtx = newAssignment?.collapseContext;

      console.log(`[${runId}] planner_returned. Duration: ${plannerDuration}ms`, {
        enginePath: output.executionMeta?.enginePath,
        isUnchanged,
        newRecipeId,
        unchangedReason,
      });

      updateDebugData({
        lastPlannerEndAt: plannerEndAt,
        lastActionPhase: 'persist_started',
        cardStateAfter: String(newState),
        resultChanged: !isUnchanged,
        unchangedReason,
        collapseContext: collapseCtx ? {
          reason: collapseCtx.reasons?.join(', ') ?? 'unknown',
          candidateCount: collapseCtx.availableCandidatesBeforeCollapse,
          committedCost: collapseCtx.committedBudgetGBP,
          remainingBudget: collapseCtx.remainingBudgetEnvelopeGBP,
          userMessage: collapseCtx.userMessage,
        } : null,
      });

      if (isUnchanged || newState === 'pool_collapse') {
        // NON-DESTRUCTIVE FALLBACK UX: Roll back to previous workspace.
        console.log(`[${runId}] Swap failed/unchanged (reason: ${unchangedReason}). Reverting to preserve original meal.`);
        setWorkspace(previousWorkspace);
        
        const persistEndAt = new Date().toISOString();
        updateDebugData({
          lastPersistEndAt: persistEndAt,
          lastActionPhase: 'complete',
          earlyReturn: true,
          earlyReturnReason: unchangedReason as any, 
        });
        
        let msg = "No alternative found within the remaining weekly budget.";
        if (unchangedReason === 'pool_collapse') msg = "No valid alternative found under current constraints.";
        if (unchangedReason === 'same_best_result') msg = "The current meal is already the best available option.";
        if (unchangedReason === 'no_better_candidate') msg = "No better alternative found right now.";
        if (unchangedReason === 'budget_delta_exceeded' as any) msg = "No alternative found within the remaining weekly budget."; // explicit override if it was named this

        return { 
          ok: true, 
          changed: false, 
          reason: (unchangedReason as PlannerActionResult['reason']) || 'no_better_candidate', 
          message: msg, 
          runId, 
          targetDay: dayIndex, 
          targetSlot: slotType 
        };
      }

      // Successful update
      setWorkspace(prev => ({
        ...prev,
        status: 'ready',
        output,
        generatedAt: new Date().toISOString(),
        actionSource: 'swap_request'
      }));

      const persistEndAt = new Date().toISOString();
      updateDebugData({
        lastPersistEndAt: persistEndAt,
        lastActionPhase: 'complete',
      });

      console.log(`[${runId}] persist_returned`);
      return { ok: true, changed: true, runId, targetDay: dayIndex, targetSlot: slotType } as PlannerActionResult;
      
    } catch (err) {
      console.error(`[${runId}] error:`, err);
      setWorkspace(previousWorkspace);
      updateDebugData({ lastActionPhase: 'error' });
      return { ok: false, changed: false, reason: 'error', message: 'An unexpected error occurred during swapping.', runId } as PlannerActionResult;
    } finally {
      clearTimeout(timeoutId);
      setSlotLoading(prev => { const next = { ...prev }; delete next[slotKey]; return next; });
      updateDebugData({ loadingCleared: true });
      console.log(`[${runId}] loading_cleared`);
    }
  };

  const regenerateDay = async (dayIndex: number) => {
    const runId = `regen_day_${dayIndex}_${Date.now()}`;
    const clickAt = new Date().toISOString();

    // ── Phase: click_received — always emit ─────────────────────────────────
    updateDebugData({
      lastActionIntent: 'regenerate_day',
      lastActionRunId: runId,
      lastActionPhase: 'click_received',
      lastClickAt: clickAt,
      actionIgnoredReason: null,
      lastSwapTargetDay: dayIndex,
      lastSwapTargetSlot: null,
      loadingCleared: null,
      resultChanged: null,
      unchangedReason: null,
      earlyReturn: null,
      earlyReturnReason: null,
      targetDayNoopReason: null,
      targetDayCandidateCounts: null,
    });

    // ── Per-day in-flight guard ───────────────────────────────────────────────
    if (dayLoading[dayIndex]) {
      const ignoredReason = 'day_already_loading';
      console.log(`[${runId}] ACTION_IGNORED: ${ignoredReason}`);
      updateDebugData({
        lastActionPhase: 'action_ignored',
        actionIgnoredReason: ignoredReason,
        unchangedReason: 'action_ignored',
      });
      return { ok: true, changed: false, reason: 'action_ignored', runId } as PlannerActionResult;
    }
    if (!workspaceRef.current.input && !workspaceRef.current.userDiet) {
      const ignoredReason = 'no_input_context';
      console.log(`[${runId}] ACTION_IGNORED: ${ignoredReason}`);
      updateDebugData({
        lastActionPhase: 'action_ignored',
        actionIgnoredReason: ignoredReason,
        unchangedReason: 'action_ignored',
      });
      return { ok: false, changed: false, reason: 'error', message: 'Internal error: no profile data available.', runId } as PlannerActionResult;
    }

    // Lock this day
    setDayLoading(prev => ({ ...prev, [dayIndex]: true }));

    console.log(`[${runId}] REGEN_DAY_START - target day: ${dayIndex}`);
    const previousWorkspace = { ...workspaceRef.current };

    setWorkspace(prev => ({
      ...prev,
      status: 'generating',
      output: prev.output ? {
        ...prev.output,
        assignments: prev.output.assignments.map((a: PlannedMealAssignment) => 
          (a.dayIndex === dayIndex && a.state !== 'locked' && a.state !== 'skipped') 
            ? { ...a, state: 'generating' } 
            : a
        )
      } : null
    }));

    const timeoutId = setTimeout(() => {
      console.error(`[${runId}] error: TIMEOUT EXCEEDED (15s). Forcing restore.`);
      setWorkspace(workspaceRef.current.status === 'generating' ? previousWorkspace : workspaceRef.current);
      setDayLoading(prev => { const next = { ...prev }; delete next[dayIndex]; return next; });
      updateDebugData({ lastActionPhase: 'error', loadingCleared: true });
    }, 15000);

    try {
      // ── REBUID INPUT FROM CENTRALIZED HELPER ──
      const { payload: latestPayload, routineValue, source, usedDefaults, defaultedFields } = buildLatestEffectivePlannerInput();

      const contracts = buildSlotContracts(workspaceRef.current.id || 'temp_regen_day', routineValue, latestPayload);
      
      const preservedAssignments = previousWorkspace.output?.assignments.filter(
        (a: PlannedMealAssignment) => !(a.dayIndex === dayIndex && a.state !== 'locked' && a.state !== 'skipped')
      ) || [];

      const rerollSlotsCount = previousWorkspace.output!.assignments.length - preservedAssignments.length;
      console.log(`[${runId}] built_target_slots. Version: ${workspaceRef.current.profileVersion}`, { 
        fixedSlotsCount: preservedAssignments.length, 
        rerollSlotsCount,
        remainingBudgetContext: contracts[0]?.budgetEnvelopeGBP ?? 0
      });

      if (rerollSlotsCount === 0) {
        console.log(`[${runId}] No slots available to reroll. Exiting early.`);
        setWorkspace(previousWorkspace);
        updateDebugData({
          lastActionPhase: 'complete',
          resultChanged: false,
          unchangedReason: 'no_better_candidate',
          earlyReturn: true,
          earlyReturnReason: 'zero_target_day_candidates',
          targetDayNoopReason: 'zero_target_day_candidates',
          targetDayCandidateCounts: {},
        });
        return { ok: true, changed: false, reason: 'zero_target_day_candidates', message: "No better day alternative found under current constraints.", runId, targetDay: dayIndex } as PlannerActionResult;
      }

      const plannerStartAt = new Date().toISOString();
      updateDebugData({
        lastActionPhase: 'planner_running',
        lastPlannerStartAt: plannerStartAt,
        lastPlannerExecutionSource: 'regenerate_request',

        // Final Truth telemetry
        debugPlannerInputDiet: latestPayload.diet,
        debugPlannerInputSelectedVibes: latestPayload.selectedVibes,
        debugPlannerInputExclusions: latestPayload.profileExclusions,
        debugPlannerInputBudgetWeekly: latestPayload.budgetWeekly,
        debugPlannerInputTargetCalories: latestPayload.targetCalories,
        debugPlannerInputTargetProteinG: latestPayload.targetProtein,
        debugPlannerInputProfileVersion: workspaceRef.current.profileVersion,
        debugUsedLatestProfileForRun: true,
        debugPlannerInputSource: source,
        debugUsedDefaultsForRun: usedDefaults,
        debugDefaultedFields: defaultedFields,
      });

      console.log(`[${runId}] planner_started`);
      const plannerStartTime = Date.now();
      const output = await runActivePlan(contracts, preservedAssignments, 'regenerate_request', latestPayload.budgetWeekly ?? 50.00, pantryItems);
      const plannerDuration = Date.now() - plannerStartTime;
      const plannerEndAt = new Date().toISOString();

      console.log(`[${runId}] planner_returned. Duration: ${plannerDuration}ms`, {
        enginePath: output.executionMeta?.enginePath,
        planningMode: output.executionMeta?.planningMode
      });

      updateDebugData({
        lastPlannerEndAt: plannerEndAt,
        lastActionPhase: 'persist_started',
      });

      const persistStartTime = Date.now();
      setWorkspace(prev => ({
        ...prev,
        status: 'ready',
        output,
        generatedAt: new Date().toISOString(),
        actionSource: 'regenerate_day'
      }));

      // Determine if result actually changed
      // Simple heuristic: collect previously assigned recipe IDs for this day versus new ones.
      const previousDayIds = previousWorkspace.output!.assignments
        .filter(a => a.dayIndex === dayIndex).map(a => a.recipeId).sort().join(',');
      const newDayIds = output.assignments
        .filter(a => a.dayIndex === dayIndex).map(a => a.recipeId).sort().join(',');
        
      const isUnchanged = previousDayIds === newDayIds;
      
      const hasCollapse = output.assignments.some(a => a.dayIndex === dayIndex && a.state === 'pool_collapse');
      let explicitCollapseMessage = null;
      if (hasCollapse) {
        const collapsedSlot = output.assignments.find(a => a.dayIndex === dayIndex && a.state === 'pool_collapse');
        explicitCollapseMessage = collapsedSlot?.collapseContext?.userMessage || "No suitable replacement found under current constraints.";
      }
      
      const persistEndAt = new Date().toISOString();

      const diff = calculatePlanDiff(previousWorkspace.output, output);

      updateDebugData({
        lastPersistEndAt: persistEndAt,
        lastActionPhase: 'complete',
        resultChanged: hasCollapse ? false : !isUnchanged,
        unchangedReason: hasCollapse ? 'pool_collapse' : isUnchanged ? 'no_better_candidate' : null,
        earlyReturn: hasCollapse || isUnchanged,
        earlyReturnReason: hasCollapse ? 'pool_collapse' : isUnchanged ? 'no_better_candidate' : null,
        targetDayCandidateCounts: output.executionMeta?.candidateCountsBySlot ?? null,
        targetDayNoopReason: hasCollapse ? 'pool_collapse' : isUnchanged ? 'no_better_candidates_than_current' : null,
        debugPlannerInputPantryCount: pantryItems.length
      });
      
      if (hasCollapse) {
        console.log(`[${runId}] Day regeneration returned a pool collapse. Reverting to preserve original UI state.`);
        setWorkspace(previousWorkspace);
        return { ok: true, changed: false, reason: 'pool_collapse', message: explicitCollapseMessage || "Could not regenerate — remaining weekly budget is too tight for this day.", runId, targetDay: dayIndex } as PlannerActionResult;
      }

      if (isUnchanged) {
        console.log(`[${runId}] Day regeneration returned identical recipes. Reverting to preserve original UI state if it had locked items.`);
        setWorkspace(previousWorkspace);
        return { ok: true, changed: false, reason: 'no_better_candidate', message: "No better day alternative found under current constraints.", runId, targetDay: dayIndex } as PlannerActionResult;
      }

      return { ok: true, changed: true, runId, targetDay: dayIndex, changeSummary: diff } as PlannerActionResult;

    } catch (err) {
      console.error(`[${runId}] error:`, err);
      setWorkspace(previousWorkspace);
      updateDebugData({ lastActionPhase: 'error' });
      return { ok: false, changed: false, reason: 'error', message: 'An unexpected error occurred during Day Regeneration.', runId, targetDay: dayIndex } as PlannerActionResult;
    } finally {
      clearTimeout(timeoutId);
      setDayLoading(prev => { const next = { ...prev }; delete next[dayIndex]; return next; });
      updateDebugData({ loadingCleared: true });
      console.log(`[${runId}] loading_cleared`);
    }
  };

  const regenerateWeek = async (): Promise<PlannerActionResult> => {
    const runId = `regen_week_${Date.now()}`;
    const clickAt = new Date().toISOString();
    
    // ── Phase: click_received — always emit ─────────────────────────────────
    updateDebugData({
      lastActionIntent: 'regenerate_week',
      lastActionRunId: runId,
      lastActionPhase: 'click_received',
      lastClickAt: clickAt,
      actionIgnoredReason: null,
      lastSwapTargetDay: null,
      lastSwapTargetSlot: null,
      loadingCleared: null,
      resultChanged: null,
      unchangedReason: null,
      earlyReturn: null,
      earlyReturnReason: null,
      targetDayNoopReason: null,
      targetDayCandidateCounts: null,
    });

    // ── Week-level guard ─────────────────────────────────────────────────────
    if (weekLoading) {
      console.log(`[${runId}] ACTION_IGNORED: week_already_loading`);
      updateDebugData({
        lastActionPhase: 'action_ignored',
        actionIgnoredReason: 'week_already_loading',
        unchangedReason: 'action_ignored',
      });
      return { ok: true, changed: false, reason: 'action_ignored', runId };
    }
    if (!workspaceRef.current.input && !workspaceRef.current.userDiet) {
      console.log(`[${runId}] ACTION_IGNORED: No profile input available.`);
      updateDebugData({
        lastActionPhase: 'action_ignored',
        actionIgnoredReason: 'no_input_context',
        unchangedReason: 'action_ignored',
      });
      return { ok: false, changed: false, reason: 'error', message: 'Internal error: no profile data available.', runId };
    }

    setWeekLoading(true);

    console.log(`[${runId}] REGEN_WEEK_START`);
    const previousWorkspace = { ...workspaceRef.current };

    setWorkspace(prev => ({
      ...prev,
      status: 'generating',
      output: prev.output ? {
        ...prev.output,
        assignments: prev.output.assignments.map((a: PlannedMealAssignment) => 
          (a.state !== 'locked' && a.state !== 'skipped') 
            ? { ...a, state: 'generating' } 
            : a
        )
      } : null
    }));

    const timeoutId = setTimeout(() => {
      console.error(`[${runId}] error: TIMEOUT EXCEEDED (15s). Forcing restore.`);
      setWorkspace(workspaceRef.current.status === 'generating' ? previousWorkspace : workspaceRef.current);
      setWeekLoading(false);
    }, 15000);

    try {
      // ── REBUID INPUT FROM CENTRALIZED HELPER ──
      const { payload: latestPayload, routineValue, source, usedDefaults, defaultedFields } = buildLatestEffectivePlannerInput();

      const contracts = buildSlotContracts(workspaceRef.current.id || 'temp_regen_week', routineValue, latestPayload);
      
      const preservedAssignments = previousWorkspace.output?.assignments.filter(
        (a: PlannedMealAssignment) => a.state === 'locked' || a.state === 'skipped'
      ) || [];

      console.log(`[${runId}] planner_started. Using profile version: ${workspaceRef.current.profileVersion}`);
      const plannerStartTime = Date.now();
      
      const plannerStartAt = new Date().toISOString();
      updateDebugData({
        lastActionPhase: 'planner_running',
        lastPlannerStartAt: plannerStartAt,
        lastPlannerExecutionSource: 'regenerate_week_request',
        
        // Final Truth telemetry
        debugPlannerInputDiet: latestPayload.diet,
        debugPlannerInputSelectedVibes: latestPayload.selectedVibes,
        debugPlannerInputExclusions: latestPayload.profileExclusions,
        debugPlannerInputBudgetWeekly: latestPayload.budgetWeekly,
        debugPlannerInputTargetCalories: latestPayload.targetCalories,
        debugPlannerInputTargetProteinG: latestPayload.targetProtein,
        debugPlannerInputProfileVersion: workspaceRef.current.profileVersion,
        debugUsedLatestProfileForRun: true,
        debugPlannerInputSource: source,
        debugUsedDefaultsForRun: usedDefaults,
        debugDefaultedFields: defaultedFields,
        debugProfileMismatchReasons: latestPayload.diet !== workspaceRef.current.userDiet ? ['diet_mismatch'] : null,
      });
      
      const output = await runActivePlan(contracts, preservedAssignments, 'regenerate_week_request', latestPayload.budgetWeekly ?? 50.00, pantryItems);
      const plannerDuration = Date.now() - plannerStartTime;
      const plannerEndAt = new Date().toISOString();

      console.log(`[${runId}] planner_returned. Duration: ${plannerDuration}ms`, {
        enginePath: output.executionMeta?.enginePath,
        planningMode: output.executionMeta?.planningMode
      });
      
      updateDebugData({
        lastPlannerEndAt: plannerEndAt,
        lastActionPhase: 'persist_started',
      });
      
      // Determine explicit unchanged or collapse states for the week
      const previousWeekIds = previousWorkspace.output?.assignments.map(a => `${a.dayIndex}_${a.slotType}_${a.recipeId}`).sort().join(',') || '';
      const newWeekIds = output.assignments.map(a => `${a.dayIndex}_${a.slotType}_${a.recipeId}`).sort().join(',');
      const isUnchanged = previousWeekIds === newWeekIds;
      
      const hasCollapse = output.assignments.some(a => a.state === 'pool_collapse');
      let explicitCollapseMessage = null;
      if (hasCollapse) {
         const collapsedSlot = output.assignments.find(a => a.state === 'pool_collapse');
         explicitCollapseMessage = collapsedSlot?.collapseContext?.userMessage || "No suitable alternative found under current constraints.";
      }

      const persistEndAt = new Date().toISOString();
      
      const diff = calculatePlanDiff(previousWorkspace.output, output);

      updateDebugData({
        lastPersistEndAt: persistEndAt,
        lastActionPhase: 'complete',
        resultChanged: hasCollapse ? false : !isUnchanged,
        unchangedReason: hasCollapse ? 'pool_collapse' : isUnchanged ? 'no_better_candidate' : null,
        earlyReturn: hasCollapse || isUnchanged,
        earlyReturnReason: hasCollapse ? 'pool_collapse' : isUnchanged ? 'no_better_candidate' : null,
        debugPlannerInputPantryCount: pantryItems.length
      });

      if (hasCollapse) {
         console.log(`[${runId}] Week regeneration returned a pool collapse. Reverting to preserve original UI state.`);
         setWorkspace(previousWorkspace);
         return { ok: true, changed: false, reason: 'pool_collapse', message: explicitCollapseMessage || "Could not regenerate — remaining weekly budget is too tight.", runId };
      }

      if (isUnchanged) {
         console.log(`[${runId}] Week regeneration returned identical recipes. Reverting to preserve original UI state.`);
         setWorkspace(previousWorkspace);
         return { ok: true, changed: false, reason: 'no_better_candidate', message: "No better full-week alternative found under current constraints.", runId };
      }

      setWorkspace(prev => ({
        ...prev,
        status: 'ready',
        output,
        generatedAt: new Date().toISOString(),
        actionSource: 'regenerate_week'
      }));

      console.log(`[${runId}] persist_returned`);
      return { ok: true, changed: true, runId, changeSummary: diff };
      
    } catch (err) {
      console.error(`[${runId}] error:`, err);
      setWorkspace(previousWorkspace);
      updateDebugData({ lastActionPhase: 'error' });
      return { ok: false, changed: false, reason: 'error', message: 'An unexpected error occurred during Week Regeneration.', runId };
    } finally {
      clearTimeout(timeoutId);
      setWeekLoading(false);
      updateDebugData({ loadingCleared: true });
      console.log(`[${runId}] loading_cleared`);
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
      updateVibes,
      updateExclusions,
      clearWorkspace,
      skipAssignment,
      unskipAssignment,
      skipAndKeepIngredients,
      replaceSlot,
      regenerateDay,
      regenerateWeek,
      slotLoading,
      dayLoading,
      weekLoading,
    }}>
      {children}
    </ActivePlanContext.Provider>
  );
}

export function useActivePlan() {
  const context = useContext(ActivePlanContext);
  if (context === undefined) {
    throw new Error('useActivePlan must be used within an ActivePlanProvider');
  }
  return context;
}
