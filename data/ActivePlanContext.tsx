/**
 * ActivePlanContext.tsx
 * The definitive source of truth for the currently active generated meal plan.
 * Handles persistence, loading states, and coordination of the hybrid orchestrator.
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
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
  actionSource?: string;
  error: string | null;
}

interface ActivePlanContextType {
  workspace: ActiveWorkspace;
  regenerateWorkspace: (payload: CalibrationPayload) => Promise<void>;
  updateUserDiet: (diet: DietaryBaseline) => void;
  updateBudget: (budget: number) => void;
  updateCalories: (calories: number) => void;
  clearWorkspace: () => void;
  skipAssignment: (assignmentId: string) => void;
  unskipAssignment: (assignmentId: string) => void;
  skipAndKeepIngredients: (assignmentId: string, recipe: NormalizedRecipe) => void;
  replaceSlot: (dayIndex: number, slotType: SlotType) => Promise<void>;
  regenerateDay: (dayIndex: number) => Promise<void>;
  regenerateWeek: () => Promise<void>;
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
  const { addSkippedIngredients } = usePantry();
  const { updateDebugData } = useDebug();

  // Stable ref to prevent stale closure reads in async handlers
  const workspaceRef = useRef(workspace);
  useEffect(() => { workspaceRef.current = workspace; }, [workspace]);

  // ─── Debug Sync ──────────────────────────────────────────────────────────────
  useEffect(() => {
    updateDebugData({
      actionSource: workspace.actionSource || 'initial_state',
      selectedOnboardingDiet: workspace.selectedOnboardingDiet || null,
      persistedWorkspaceDiet: workspace.userDiet,
      plannerInputDiet: workspace.input?.payload?.diet || workspace.userDiet,
      executionMeta: workspace.output?.executionMeta,
      persistedWorkspaceBudget: workspace.input?.payload?.budgetWeekly ?? null,
    });
  }, [
    workspace.output?.executionMeta, 
    workspace.actionSource, 
    workspace.selectedOnboardingDiet, 
    workspace.userDiet, 
    workspace.input?.payload?.diet,
    workspace.input?.payload?.budgetWeekly,
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
        actionSource: 'onboarding_initial_generate'
      }));

      // Sync persisted budget into debug
      updateDebugData({
        persistedWorkspaceBudget: finalBudget,
        selectedOnboardingBudget: payload.budgetWeekly ?? null,
        plannerInputBudget: finalBudget,
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
    setWorkspace(prev => ({
      ...prev,
      userDiet: diet
    }));
  };

  const updateBudget = (budget: number) => {
    setWorkspace(prev => ({
      ...prev,
      input: prev.input ? {
        ...prev.input,
        payload: { ...prev.input.payload, budgetWeekly: budget }
      } : prev.input
    }));
  };

  const updateCalories = (calories: number) => {
    setWorkspace(prev => ({
      ...prev,
      input: prev.input ? {
        ...prev.input,
        payload: { ...prev.input.payload, targetCalories: calories }
      } : prev.input
    }));
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
      return;
    }

    if (!workspaceRef.current.output || !workspaceRef.current.input) {
      const ignoredReason = 'no_workspace_output';
      console.log(`[${runId}] ACTION_IGNORED: ${ignoredReason}`);
      updateDebugData({
        lastActionPhase: 'action_ignored',
        actionIgnoredReason: ignoredReason,
        unchangedReason: 'action_ignored',
      });
      return;
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
      const { routine, payload } = workspaceRef.current.input!;
      const contracts = buildSlotContracts(workspaceRef.current.id!, routine, payload);
      
      const preservedAssignments = previousWorkspace.output!.assignments.filter(
        (a: PlannedMealAssignment) => !(a.dayIndex === dayIndex && a.slotType === slotType)
      );

      const plannerStartAt = new Date().toISOString();
      updateDebugData({
        lastActionPhase: 'planner_running',
        lastPlannerStartAt: plannerStartAt,
        lastPlannerExecutionSource: 'swap_request',
      });

      console.log(`[${runId}] planner_started`);
      const plannerStartTime = Date.now();
      const output = await runActivePlan(contracts, preservedAssignments, 'swap_request', payload.budgetWeekly ?? 50.00);
      const plannerDuration = Date.now() - plannerStartTime;
      const plannerEndAt = new Date().toISOString();

      const newAssignment = output.assignments.find(a => a.dayIndex === dayIndex && a.slotType === slotType);
      const newRecipeId = newAssignment?.recipeId ?? null;
      const newState = newAssignment?.state ?? null;
      const isUnchanged = originalRecipeId === newRecipeId;

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
    } catch (err) {
      console.error(`[${runId}] error:`, err);
      setWorkspace(previousWorkspace);
      updateDebugData({ lastActionPhase: 'error' });
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
      return;
    }
    if (!workspaceRef.current.output || !workspaceRef.current.input) {
      const ignoredReason = 'no_workspace_output';
      console.log(`[${runId}] ACTION_IGNORED: ${ignoredReason}`);
      updateDebugData({
        lastActionPhase: 'action_ignored',
        actionIgnoredReason: ignoredReason,
        unchangedReason: 'action_ignored',
      });
      return;
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
      const { routine, payload } = workspaceRef.current.input!;
      const contracts = buildSlotContracts(workspaceRef.current.id!, routine, payload);
      
      const preservedAssignments = previousWorkspace.output!.assignments.filter(
        (a: PlannedMealAssignment) => !(a.dayIndex === dayIndex && a.state !== 'locked' && a.state !== 'skipped')
      );

      const rerollSlotsCount = previousWorkspace.output!.assignments.length - preservedAssignments.length;
      console.log(`[${runId}] built_target_slots`, { 
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
        });
        return;
      }

      const plannerStartAt = new Date().toISOString();
      updateDebugData({
        lastActionPhase: 'planner_running',
        lastPlannerStartAt: plannerStartAt,
        lastPlannerExecutionSource: 'regenerate_request',
      });

      console.log(`[${runId}] planner_started`);
      const plannerStartTime = Date.now();
      const output = await runActivePlan(contracts, preservedAssignments, 'regenerate_request', payload.budgetWeekly ?? 50.00);
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

      const persistDuration = Date.now() - persistStartTime;
      const persistEndAt = new Date().toISOString();
      console.log(`[${runId}] persist_returned. Duration: ${persistDuration}ms`);

      updateDebugData({
        lastPersistEndAt: persistEndAt,
        lastActionPhase: 'complete',
        resultChanged: true, // Day regen always intends to produce new results
      });

    } catch (err) {
      console.error(`[${runId}] error:`, err);
      setWorkspace(previousWorkspace);
      updateDebugData({ lastActionPhase: 'error' });
    } finally {
      clearTimeout(timeoutId);
      setDayLoading(prev => { const next = { ...prev }; delete next[dayIndex]; return next; });
      updateDebugData({ loadingCleared: true });
      console.log(`[${runId}] loading_cleared`);
    }
  };

  const regenerateWeek = async () => {
    const runId = `regen_week_${Date.now()}`;

    // ── Week-level guard ─────────────────────────────────────────────────────
    if (weekLoading) {
      console.log(`[${runId}] ACTION_IGNORED: week_already_loading`);
      return;
    }
    if (!workspaceRef.current.output || !workspaceRef.current.input) {
      console.log(`[${runId}] ACTION_IGNORED: No workspace output or input available.`);
      return;
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
      const { routine, payload } = workspaceRef.current.input!;
      const contracts = buildSlotContracts(workspaceRef.current.id!, routine, payload);
      
      const preservedAssignments = previousWorkspace.output!.assignments.filter(
        (a: PlannedMealAssignment) => a.state === 'locked' || a.state === 'skipped'
      );

      console.log(`[${runId}] planner_started`);
      const plannerStartTime = Date.now();
      const output = await runActivePlan(contracts, preservedAssignments, 'regenerate_request', payload.budgetWeekly ?? 50.00);
      const plannerDuration = Date.now() - plannerStartTime;

      console.log(`[${runId}] planner_returned. Duration: ${plannerDuration}ms`, {
        enginePath: output.executionMeta?.enginePath,
        planningMode: output.executionMeta?.planningMode
      });

      setWorkspace(prev => ({
        ...prev,
        status: 'ready',
        output,
        generatedAt: new Date().toISOString(),
        actionSource: 'regenerate_week'
      }));

      console.log(`[${runId}] persist_returned`);
    } catch (err) {
      console.error(`[${runId}] error:`, err);
      setWorkspace(previousWorkspace);
    } finally {
      clearTimeout(timeoutId);
      setWeekLoading(false);
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
