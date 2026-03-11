/**
 * ActivePlanContext.tsx
 * The definitive source of truth for the currently active generated meal plan.
 * Handles persistence, loading states, and coordination of the hybrid orchestrator.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  const { routine } = useWeeklyRoutine();
  const { addSkippedIngredients } = usePantry();
  const { updateDebugData } = useDebug();

  // ─── Debug Sync ──────────────────────────────────────────────────────────────
  useEffect(() => {
    updateDebugData({
      actionSource: workspace.actionSource || 'initial_state',
      selectedOnboardingDiet: workspace.selectedOnboardingDiet || null,
      persistedWorkspaceDiet: workspace.userDiet,
      plannerInputDiet: workspace.input?.payload?.diet || workspace.userDiet,
      executionMeta: workspace.output?.executionMeta,
    });
  }, [
    workspace.output?.executionMeta, 
    workspace.actionSource, 
    workspace.selectedOnboardingDiet, 
    workspace.userDiet, 
    workspace.input?.payload?.diet,
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

    try {
      // 1. Diagnostic Alignment Check
      const workspaceDiet = workspace.userDiet;
      const payloadDiet = payload.diet;
      
      console.log(`[ActivePlanContext] ONBOARDING FLOW DIAGNOSTIC:`);
      console.log(` - Onboarding (Payload) Diet: ${payloadDiet || 'Not Provided'}`);
      console.log(` - Workspace (DB) Diet: ${workspaceDiet}`);
      
      // We prioritize the payload diet during calibration as it's the most recent user intent
      // But we ensure it's synced to the workspace diet for the actual generation
      // If none provided, we fall back to workspace diet first, then Omnivore
      const finalDiet = payloadDiet || workspaceDiet || 'Omnivore';
      console.log(` - Planner Input (Final) Diet: ${finalDiet}`);

      // 1. Build the setup (Contracts + Initial Vibe Assignments)
      console.log('[ActivePlanContext] Regenerating with routine:', Object.keys(routine));
      const { planId, contracts, vibeAssignments } = buildPlannerSetup(routine, {
        ...payload,
        diet: finalDiet
      });
      console.log('[ActivePlanContext] Contracts built:', contracts.length, 'Example diet:', contracts[0]?.dietaryBaseline);

      // 2. Run the plan execution
      const output = await runActivePlan(contracts, vibeAssignments, 'planner_autofill', payload.budgetWeekly ?? 50.00);

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
        userDiet: finalDiet, // Explicitly sync to ensure persistence
        actionSource: 'onboarding_initial_generate'
      }));
      console.log('[ActivePlanContext] Generation Complete. State userDiet:', workspace.userDiet); // Note: still might show stale in this log
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
        ingredientId: ing.canonicalIngredientId || ing.name, // Fallback to name if ID is missing
        amount: ing.amount,
        unit: ing.unit
      })));
    }
  };

  const replaceSlot = async (dayIndex: number, slotType: SlotType) => {
    if (workspace.status === 'generating') return;
    if (!workspace.output || !workspace.input) return;

    const previousWorkspace = { ...workspace };

    setWorkspace(prev => {
      if (!prev.output) return prev;
      return {
        ...prev,
        status: 'generating', // In-flight interaction guard
        output: {
          ...prev.output,
          assignments: prev.output.assignments.map((a: PlannedMealAssignment) => 
            (a.dayIndex === dayIndex && a.slotType === slotType) 
              ? { ...a, state: 'generating' } 
              : a
          )
        }
      };
    });

    try {
      const { routine, payload } = workspace.input;
      const contracts = buildSlotContracts(workspace.id!, routine, payload);
      
      const preservedAssignments = previousWorkspace.output!.assignments.filter(
        (a: PlannedMealAssignment) => !(a.dayIndex === dayIndex && a.slotType === slotType)
      );

      const output = await runActivePlan(contracts, preservedAssignments, 'swap_request', payload.budgetWeekly ?? 50.00);

      const collapseCount = output.assignments.filter(a => a.state === 'pool_collapse').length;
      if (collapseCount > 0) {
        console.warn('[ActivePlanContext] replaceSlot: pool_collapse detected on', collapseCount, 'slot(s)');
      }

      setWorkspace(prev => ({
        ...prev,
        status: 'ready',
        output,
        generatedAt: new Date().toISOString(),
        actionSource: 'swap_request'
      }));

    } catch (err) {
      console.error('[ActivePlanContext] Replace failed, rolling back.', err);
      setWorkspace(previousWorkspace);
    }
  };

  const regenerateDay = async (dayIndex: number) => {
    if (workspace.status === 'generating') return;
    if (!workspace.output || !workspace.input) return;

    const runId = `regen_day_${dayIndex}_${Date.now()}`;
    console.log(`[${runId}] REGEN_DAY_START - target day: ${dayIndex}`);

    const previousWorkspace = { ...workspace };

    setWorkspace(prev => {
      if (!prev.output) return prev;
      return {
        ...prev,
        status: 'generating',
        output: {
          ...prev.output,
          assignments: prev.output.assignments.map((a: PlannedMealAssignment) => 
            (a.dayIndex === dayIndex && a.state !== 'locked' && a.state !== 'skipped') 
              ? { ...a, state: 'generating' } 
              : a
          )
        }
      };
    });

    const timeoutId = setTimeout(() => {
      console.error(`[${runId}] error: TIMEOUT EXCEEDED (15s). Forcing clear loading state.`);
      setWorkspace(prev => prev.status === 'generating' ? previousWorkspace : prev);
    }, 15000);

    try {
      const { routine, payload } = workspace.input;
      const contracts = buildSlotContracts(workspace.id!, routine, payload);
      
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
        return;
      }

      console.log(`[${runId}] planner_started`);
      const plannerStartTime = Date.now();

      const output = await runActivePlan(contracts, preservedAssignments, 'regenerate_request', payload.budgetWeekly ?? 50.00);

      const plannerDuration = Date.now() - plannerStartTime;
      console.log(`[${runId}] planner_returned. Duration: ${plannerDuration}ms`, {
        enginePath: output.executionMeta?.enginePath,
        planningMode: output.executionMeta?.planningMode
      });

      console.log(`[${runId}] validation_started`);
      // Validation currently intrinsic to orchestrator (hybrid approach)
      console.log(`[${runId}] validation_returned. Details: See orchestrator diagnostics.`);

      console.log(`[${runId}] persist_started`);
      const persistStartTime = Date.now();

      setWorkspace(prev => ({
        ...prev,
        status: 'ready',
        output,
        generatedAt: new Date().toISOString(),
        actionSource: 'regenerate_day'
      }));

      const persistDuration = Date.now() - persistStartTime;
      console.log(`[${runId}] persist_returned. Duration: ${persistDuration}ms`);

    } catch (err) {
      console.error(`[${runId}] error:`, err);
      setWorkspace(previousWorkspace);
    } finally {
      clearTimeout(timeoutId);
      console.log(`[${runId}] loading_cleared`);
    }
  };

  const regenerateWeek = async () => {
    if (workspace.status === 'generating') return;
    if (!workspace.output || !workspace.input) return;

    const previousWorkspace = { ...workspace };

    setWorkspace(prev => {
      if (!prev.output) return prev;
      return {
        ...prev,
        status: 'generating',
        output: {
          ...prev.output,
          assignments: prev.output.assignments.map((a: PlannedMealAssignment) => 
            (a.state !== 'locked' && a.state !== 'skipped') 
              ? { ...a, state: 'generating' } 
              : a
          )
        }
      };
    });

    try {
      const { routine, payload } = workspace.input;
      const contracts = buildSlotContracts(workspace.id!, routine, payload);
      
      const preservedAssignments = previousWorkspace.output!.assignments.filter(
        (a: PlannedMealAssignment) => a.state === 'locked' || a.state === 'skipped'
      );

      const output = await runActivePlan(contracts, preservedAssignments, 'regenerate_request', payload.budgetWeekly ?? 50.00);

      const collapseCount = output.assignments.filter((a: PlannedMealAssignment) => a.state === 'pool_collapse').length;
      if (collapseCount > 0) {
        console.warn(`[ActivePlanContext] regenerateWeek: pool_collapse on ${collapseCount} slot(s). Total budget: £${payload.budgetWeekly ?? 50}. Fixed slots committed cost unavailable in this context.`);
      }

      setWorkspace(prev => ({
        ...prev,
        status: 'ready',
        output,
        generatedAt: new Date().toISOString(),
        actionSource: 'regenerate_week'
      }));

    } catch (err) {
      console.error('[ActivePlanContext] Regenerate week failed, rolling back.', err);
      setWorkspace(previousWorkspace);
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
      regenerateWeek
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
