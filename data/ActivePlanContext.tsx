/**
 * ActivePlanContext.tsx
 * The definitive source of truth for the currently active generated meal plan.
 * Handles persistence, loading states, and coordination of the hybrid orchestrator.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { OrchestratorOutput } from './planner/orchestrator';
import { PlannerInput } from './plannerSchema';
import { buildPlannerSetup, buildSlotContracts, CalibrationPayload } from './planner/buildPlannerInput';
import { runActivePlan } from './planner/runActivePlan';
import { useWeeklyRoutine } from './WeeklyRoutineContext';
import { usePantry } from './PantryContext';
import { NormalizedRecipe, SlotType } from './planner/plannerTypes';

export interface ActiveWorkspace {
  id: string | null;
  input: any | null; // Using any for now to avoid circular deps with Schema/Types if needed
  output: OrchestratorOutput | null;
  status: 'idle' | 'generating' | 'ready' | 'error';
  error: string | null;
  generatedAt: string | null;
  version: string;
}

interface ActivePlanContextType {
  workspace: ActiveWorkspace;
  regenerateWorkspace: (payload: CalibrationPayload) => Promise<void>;
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
};

const ActivePlanContext = createContext<ActivePlanContextType | undefined>(undefined);

export function ActivePlanProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<ActiveWorkspace>(INITIAL_WORKSPACE);
  const { routine } = useWeeklyRoutine();
  const { addSkippedIngredients } = usePantry();

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
      // 1. Build the setup (Contracts + Initial Vibe Assignments)
      console.log('[ActivePlanContext] Regenerating with routine:', Object.keys(routine));
      const { planId, contracts, vibeAssignments } = buildPlannerSetup(routine, payload);
      console.log('[ActivePlanContext] Contracts built:', contracts.length);

      // 2. Run the plan execution
      const output = await runActivePlan(contracts, vibeAssignments);

      // 3. Update status
      setWorkspace({
        id: planId,
        input: { routine, payload },
        output,
        status: 'ready',
        error: null,
        generatedAt: new Date().toISOString(),
        version: PLANNER_VERSION,
      });
    } catch (err) {
      setWorkspace(prev => ({ 
        ...prev, 
        status: 'error', 
        error: err instanceof Error ? err.message : 'Unknown generation failure' 
      }));
    }
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
          assignments: prev.output.assignments.map(a => 
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
          assignments: prev.output.assignments.map(a => 
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
          assignments: prev.output.assignments.map(a => 
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
          assignments: prev.output.assignments.map(a => 
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
        a => !(a.dayIndex === dayIndex && a.slotType === slotType)
      );

      const output = await runActivePlan(contracts, preservedAssignments);

      setWorkspace(prev => ({
        ...prev,
        status: 'ready',
        output,
        generatedAt: new Date().toISOString(),
      }));

    } catch (err) {
      console.error('[ActivePlanContext] Replace failed, rolling back.', err);
      setWorkspace(previousWorkspace); // Failure recovery
    }
  };

  const regenerateDay = async (dayIndex: number) => {
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
          assignments: prev.output.assignments.map(a => 
            (a.dayIndex === dayIndex && a.state !== 'locked' && a.state !== 'skipped') 
              ? { ...a, state: 'generating' } 
              : a
          )
        }
      };
    });

    try {
      const { routine, payload } = workspace.input;
      const contracts = buildSlotContracts(workspace.id!, routine, payload);
      
      // Preserve all except non-locked/non-skipped on target day
      const preservedAssignments = previousWorkspace.output!.assignments.filter(
        a => !(a.dayIndex === dayIndex && a.state !== 'locked' && a.state !== 'skipped')
      );

      const output = await runActivePlan(contracts, preservedAssignments);

      setWorkspace(prev => ({
        ...prev,
        status: 'ready',
        output,
        generatedAt: new Date().toISOString(),
      }));

    } catch (err) {
      console.error('[ActivePlanContext] Regenerate day failed, rolling back.', err);
      setWorkspace(previousWorkspace);
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
          assignments: prev.output.assignments.map(a => 
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
        a => a.state === 'locked' || a.state === 'skipped'
      );

      const output = await runActivePlan(contracts, preservedAssignments);

      setWorkspace(prev => ({
        ...prev,
        status: 'ready',
        output,
        generatedAt: new Date().toISOString(),
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
