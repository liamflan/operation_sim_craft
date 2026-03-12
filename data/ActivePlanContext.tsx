/**
 * ActivePlanContext.tsx
 * The definitive source of truth for the currently active generated meal plan.
 * Handles persistence, loading states, and coordination of the hybrid orchestrator.
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { buildPlannerSetup, buildSlotContracts, CalibrationPayload } from './planner/buildPlannerInput';
import { runActivePlan } from './planner/runActivePlan';
import { useWeeklyRoutine } from './WeeklyRoutineContext';
import { usePantry } from './PantryContext';
import { NormalizedRecipe, SlotType, DietaryBaseline, OrchestratorOutput, PlannedMealAssignment, CuisineId } from './planner/plannerTypes';
import { useDebug } from './DebugContext';
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

export type PlannerActionResult = {
  ok: boolean;
  changed: boolean;
  reason?: 'no_better_candidate' | 'budget_delta_exceeded' | 'pool_collapse' | 'same_best_result' | 'zero_target_day_candidates' | 'action_ignored' | 'error';
  message?: string;
  runId?: string;
  targetDay?: number;
  targetSlot?: SlotType | null;
};

interface ActivePlanContextType {
  workspace: ActiveWorkspace;
  regenerateWorkspace: (payload: CalibrationPayload) => Promise<void>;
  updateUserDiet: (diet: DietaryBaseline) => void;
  updateBudget: (budget: number) => void;
  updateCalories: (calories: number) => void;
  updateProtein: (protein: number) => void;
  updateCuisinePreferences: (cuisines: CuisineId[]) => void;
  updateExclusions: (exclusions: string[]) => void;
  clearWorkspace: () => void;
  skipAssignment: (assignmentId: string) => void;
  unskipAssignment: (assignmentId: string) => void;
  skipAndKeepIngredients: (assignmentId: string, recipe: NormalizedRecipe) => void;
  replaceSlot: (dayIndex: number, slotType: SlotType) => Promise<PlannerActionResult>;
  regenerateDay: (dayIndex: number) => Promise<PlannerActionResult>;
  regenerateWeek: () => Promise<PlannerActionResult>;
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

  const updateCalories = (calories: number) => {
    setWorkspace(prev => {
      const { payload: latestPayload, routineValue } = buildLatestEffectivePlannerInput();
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

  const replaceSlot = async (dayIndex: number, slotType: SlotType) => {
    const slotKey = `${dayIndex}_${slotType}`;
    const runId = `swap_${slotKey}_${Date.now()}`;

    if (slotLoading[slotKey]) return { ok: true, changed: false, reason: 'action_ignored', runId } as PlannerActionResult;

    setSlotLoading(prev => ({ ...prev, [slotKey]: true }));
    const previousWorkspace = { ...workspaceRef.current };

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
      const preservedAssignments = previousWorkspace.output?.assignments.filter(
        (a: PlannedMealAssignment) => !(a.dayIndex === dayIndex && a.slotType === slotType)
      ) || [];

      // Integrate unified recipe pool
      const output = await runActivePlan(
        contracts, 
        preservedAssignments, 
        'swap_request', 
        latestPayload.budgetWeekly ?? 50.00, 
        pantryItems,
        plannerEligibleRecipes
      );

      const originalRecipeId = previousWorkspace.output?.assignments.find(a => a.dayIndex === dayIndex && a.slotType === slotType)?.recipeId;
      const newRecipeId = output.assignments.find(a => a.dayIndex === dayIndex && a.slotType === slotType)?.recipeId;

      if (originalRecipeId === newRecipeId) {
        setWorkspace(previousWorkspace);
        return { ok: true, changed: false, reason: 'no_better_candidate' as const, runId };
      }

      setWorkspace(prev => ({
        ...prev,
        status: 'ready',
        output,
        generatedAt: new Date().toISOString(),
        actionSource: 'swap_request'
      }));

      return { ok: true, changed: true, runId } as PlannerActionResult;
      
    } catch (err) {
      setWorkspace(previousWorkspace);
      return { ok: false, changed: false, reason: 'error', runId } as PlannerActionResult;
    } finally {
      setSlotLoading(prev => { const next = { ...prev }; delete next[slotKey]; return next; });
    }
  };

  const regenerateDay = async (dayIndex: number) => {
    const runId = `regen_day_${dayIndex}_${Date.now()}`;
    if (dayLoading[dayIndex]) return { ok: true, changed: false, reason: 'action_ignored', runId } as PlannerActionResult;

    setDayLoading(prev => ({ ...prev, [dayIndex]: true }));
    const previousWorkspace = { ...workspaceRef.current };

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
      const preservedAssignments = previousWorkspace.output?.assignments.filter(
        (a: PlannedMealAssignment) => !(a.dayIndex === dayIndex && a.state !== 'locked' && a.state !== 'skipped')
      ) || [];

      // Integrate unified recipe pool
      const output = await runActivePlan(
        contracts, 
        preservedAssignments, 
        'regenerate_request', 
        latestPayload.budgetWeekly ?? 50.00, 
        pantryItems,
        plannerEligibleRecipes
      );

      setWorkspace(prev => ({
        ...prev,
        status: 'ready',
        output,
        generatedAt: new Date().toISOString(),
        actionSource: 'regenerate_day'
      }));

      return { ok: true, changed: true, runId } as PlannerActionResult;
    } catch (err) {
      setWorkspace(previousWorkspace);
      return { ok: false, changed: false, reason: 'error', runId } as PlannerActionResult;
    } finally {
      setDayLoading(prev => { const next = { ...prev }; delete next[dayIndex]; return next; });
    }
  };

  const regenerateWeek = async () => {
    const runId = `regen_week_${Date.now()}`;
    if (weekLoading) return { ok: true, changed: false, reason: 'action_ignored', runId } as PlannerActionResult;

    setWeekLoading(true);
    const previousWorkspace = { ...workspaceRef.current };

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
      const preservedAssignments = previousWorkspace.output?.assignments.filter(
        (a: PlannedMealAssignment) => (a.state === 'locked' || a.state === 'skipped' || a.state === 'cooked')
      ) || [];

      // Integrate unified recipe pool
      const output = await runActivePlan(
        contracts, 
        preservedAssignments, 
        'regenerate_week_request', 
        latestPayload.budgetWeekly ?? 50.00, 
        pantryItems,
        plannerEligibleRecipes
      );

      setWorkspace(prev => ({
        ...prev,
        status: 'ready',
        output,
        generatedAt: new Date().toISOString(),
        actionSource: 'regenerate_week'
      }));

      return { ok: true, changed: true, runId } as PlannerActionResult;
    } catch (err) {
      setWorkspace(previousWorkspace);
      return { ok: false, changed: false, reason: 'error', runId } as PlannerActionResult;
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
