import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { 
  PlannerAssignment, 
  PlannerInput, 
  PlannerRawOutput, 
  ValidationResult,
  PlannerCompliance
} from './plannerSchema';
import { 
  DietaryBaseline, 
  CuisineId, 
  NormalizedRecipe 
} from './planner/plannerTypes';
import { useWeeklyRoutine } from './WeeklyRoutineContext';
import { usePantry } from './PantryContext';
import { useDebug } from './DebugContext';
import { useRecipes } from './RecipeContext';
import { CalibrationPayload, buildPlannerSetup } from './planner/buildPlannerInput';
import { runtimeValidateSchema, validatePlannerOutput } from './plannerValidation';
import { StorageService } from './storage';

// --- CONFIG ---
const PLANNER_VERSION = '20d.mb.final'; // Match Phase 20 Mobile Baseline

export interface ActiveWorkspace {
  status: 'idle' | 'generating' | 'ready' | 'error' | 'verifying';
  planId: string | null;
  input: {
    routine: any;
    payload: CalibrationPayload;
  } | null;
  output: PlannerRawOutput | null;
  compliance: PlannerCompliance | null;
  error: string | null;
  warnings: string[];
  generatedAt: string | null;
  version: string;
  userDiet: DietaryBaseline;
  profileVersion: number;
  actionSource: string;
}

interface ActivePlanContextType {
  workspace: ActiveWorkspace;
  setWorkspace: React.Dispatch<React.SetStateAction<ActiveWorkspace>>;
  regenerateWorkspace: (payload: CalibrationPayload) => Promise<void>;
  updateUserDiet: (diet: DietaryBaseline) => void;
  updateBudget: (budget: number) => void;
  updateCalories: (calories: number, preset?: string) => void;
  updateProtein: (protein: number) => void;
  updateCuisinePreferences: (cuisines: CuisineId[]) => void;
  updateExclusions: (exclusions: string[]) => void;
  applyManualAdjustment: (day: number, slot: string, recipeId: string) => void;
  clearWorkspace: () => void;
}

const INITIAL_WORKSPACE: ActiveWorkspace = {
  status: 'idle',
  planId: null,
  input: null,
  output: null,
  compliance: null,
  error: null,
  warnings: [],
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
    
    // Normalize current state with defaults for the transformation boundary
    const existingPayload = ws.input?.payload || {} as CalibrationPayload;
    
    // Non-destructive rebuild: Preserve full existing payload first, then overlay defaults
    const latestPayload: CalibrationPayload = {
      ...existingPayload,
      diet: ws.userDiet || existingPayload.diet || 'Omnivore',
      budgetWeekly: existingPayload.budgetWeekly ?? 50.00,
      targetCalories: existingPayload.targetCalories ?? 2000,
      targetProtein: existingPayload.targetProtein ?? 160,
      preferredCuisineIds: existingPayload.preferredCuisineIds ?? [],
      excludedIngredientTags: existingPayload.excludedIngredientTags ?? [],
      goalTags: existingPayload.goalTags ?? [],
      allergies: existingPayload.allergies ?? [],
      preferredFlavourIds: existingPayload.preferredFlavourIds ?? [],
      preferredStyleIds: existingPayload.preferredStyleIds ?? []
    };

    return {
      payload: latestPayload,
      routineValue: ws.input?.routine || routine
    };
  }, [routine]);

  useEffect(() => {
    const loadPersisted = async () => {
      const saved = await StorageService.getItem('active_workspace_' + PLANNER_VERSION);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setWorkspace({ ...parsed, status: 'idle' });
        } catch (e) {
          console.warn('[ActivePlanContext] Failed to parse saved workspace', e);
        }
      }
    };
    loadPersisted();
  }, []);

  const clearWorkspace = useCallback(() => {
    setWorkspace(INITIAL_WORKSPACE);
    StorageService.removeItem('active_workspace_' + PLANNER_VERSION);
  }, []);

  const regenerateWorkspace = async (payload: CalibrationPayload) => {
    setWorkspace(prev => ({ ...prev, status: 'generating', error: null, warnings: [] }));
    
    try {
      const setup = buildPlannerSetup(routine, payload);
      
      const input: PlannerInput = {
        slotsToFill: setup.contracts.map(c => ({
          day: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][c.dayIndex] as any,
          slot: c.slotType as any,
        })),
        candidates: plannerEligibleRecipes.map(r => ({
          id: r.id,
          recipeId: r.id,
          title: r.title,
          estimatedCostGBP: r.estimatedCostPerServingGBP,
          prepTimeMinutes: r.totalMinutes || 30,
          macros: {
            calories: r.macrosPerServing.calories,
            protein: r.macrosPerServing.protein,
            carbs: r.macrosPerServing.carbs,
            fats: r.macrosPerServing.fats,
          },
          suitableFor: (r.suitableFor ?? []).filter(s => ['breakfast', 'lunch', 'dinner'].includes(s)) as any,
          archetype: (r.archetype === 'Staple' ? 'budget_workhorse_dinner' : 'quick_default') as any,
          tags: r.tags || [],
          pantryIngredients: [], // Resolved by orchestrator
        })),
        pantrySignals: [],
        preferences: {
          maxRecipeRepeatsPerWeek: 2,
          prioritisePantry: true,
          preferVariety: true,
        },
        profile: {
          dietaryPreference: payload.diet,
          weeklyBudgetGBP: payload.budgetWeekly ?? 50,
          targetCalories: payload.targetCalories ?? 2000,
          targetProteinG: payload.targetProtein ?? 160,
          allergies: payload.allergies ?? [],
          goalTags: payload.goalTags ?? []
        },
        composition: {
          archetypeCounts: { 'budget_workhorse_dinner': 7 } as any,
          archetypeRepeatCaps: { 'budget_workhorse_dinner': 7, 'quick_default': 7 } as any,
        }
      };

      // Mock generation delay for mobile feedback flow
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Trigger local business validation (Real boundary cleanup)
      // Since we don't have Gemini in this local context, we'll simulate a perfect output
      // that fits the requested slots.
      const mockAssignments = input.slotsToFill.map(s => {
        const eligible = input.candidates.filter(c => (c.suitableFor as any[]).includes(s.slot));
        const pick = eligible[Math.floor(Math.random() * eligible.length)] || input.candidates[0];
        return {
          day: s.day,
          slot: s.slot,
          recipeId: pick.id
        };
      });

      const rawOutput: PlannerRawOutput = {
        assignments: mockAssignments,
        summary: {
          estimatedPlannedCostGBP: 48.50,
          estimatedPlannedCalories: 14200,
          estimatedPlannedProteinG: 1100,
          pantryIngredientsUsed: [],
          plannerNote: "Your custom mobile-optimized plan is ready."
        }
      };

      const result = validatePlannerOutput(rawOutput, input);

      setWorkspace(prev => {
        const next = {
          ...prev,
          status: 'ready' as const,
          planId: setup.planId,
          input: {
            routine,
            payload
          },
          output: result.plan,
          compliance: result.compliance || null,
          warnings: result.warnings,
          generatedAt: new Date().toISOString(),
          actionSource: 'regenerateWorkspace'
        };
        StorageService.setItem('active_workspace_' + PLANNER_VERSION, JSON.stringify(next));
        return next;
      });

    } catch (err: any) {
      setWorkspace(prev => ({ 
        ...prev, 
        status: 'error', 
        error: err.message || 'Mobile generation failed' 
      }));
    }
  };

  const updateUserDiet = (diet: DietaryBaseline) => {
    setWorkspace(prev => {
      const { routineValue } = buildLatestEffectivePlannerInput();
      return {
        ...prev,
        userDiet: diet,
        profileVersion: prev.profileVersion + 1,
        input: {
          routine: routineValue,
          payload: { ...prev.input?.payload as CalibrationPayload, diet }
        }
      };
    });
  };

  const updateBudget = (budget: number) => {
    setWorkspace(prev => {
      const { routineValue } = buildLatestEffectivePlannerInput();
      return {
        ...prev,
        profileVersion: prev.profileVersion + 1,
        input: {
          routine: routineValue,
          payload: { ...prev.input?.payload as CalibrationPayload, budgetWeekly: budget }
        }
      };
    });
  };

  const updateCalories = (calories: number, preset?: string) => {
    setWorkspace(prev => {
      const { routineValue } = buildLatestEffectivePlannerInput();
      return {
        ...prev,
        profileVersion: prev.profileVersion + 1,
        input: {
          routine: routineValue,
          payload: { ...prev.input?.payload as CalibrationPayload, targetCalories: calories, caloriePreset: preset }
        }
      };
    });
  };

  const updateProtein = (protein: number) => {
    setWorkspace(prev => {
      const { routineValue } = buildLatestEffectivePlannerInput();
      return {
        ...prev,
        profileVersion: prev.profileVersion + 1,
        input: {
          routine: routineValue,
          payload: { ...prev.input?.payload as CalibrationPayload, targetProtein: protein }
        }
      };
    });
  };

  const updateCuisinePreferences = (cuisines: CuisineId[]) => {
    setWorkspace(prev => {
      const { routineValue } = buildLatestEffectivePlannerInput();
      return {
        ...prev,
        profileVersion: prev.profileVersion + 1,
        input: {
          routine: routineValue,
          payload: { ...prev.input?.payload as CalibrationPayload, preferredCuisineIds: cuisines }
        }
      };
    });
  };

  const updateExclusions = (exclusions: string[]) => {
    setWorkspace(prev => {
      const { routineValue } = buildLatestEffectivePlannerInput();
      return {
        ...prev,
        profileVersion: prev.profileVersion + 1,
        input: {
          routine: routineValue,
          payload: { ...prev.input?.payload as CalibrationPayload, excludedIngredientTags: exclusions }
        }
      };
    });
  };

  const applyManualAdjustment = (day: number, slot: string, recipeId: string) => {
    setWorkspace(prev => {
      if (!prev.output) return prev;
      
      const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      const targetDay = dayNames[day];
      
      const newAssignments = prev.output.assignments.map(a => {
        if (a.day === targetDay && a.slot === slot) {
          return { ...a, recipeId };
        }
        return a;
      });

      return {
        ...prev,
        output: {
          ...prev.output,
          assignments: newAssignments
        },
        actionSource: 'applyManualAdjustment',
        profileVersion: prev.profileVersion + 1
      };
    });
  };

  return (
    <ActivePlanContext.Provider value={{
      workspace,
      setWorkspace,
      regenerateWorkspace,
      updateUserDiet,
      updateBudget,
      updateCalories,
      updateProtein,
      updateCuisinePreferences,
      updateExclusions,
      applyManualAdjustment,
      clearWorkspace
    }}>
      {children}
    </ActivePlanContext.Provider>
  );
}

export const useActivePlan = () => {
  const context = useContext(ActivePlanContext);
  if (!context) throw new Error('useActivePlan must be used within an ActivePlanProvider');
  return context;
};
