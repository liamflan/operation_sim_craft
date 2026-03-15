import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import {
  PlannerInput,
  PlannerCompliance,
} from './plannerSchema';
import {
  DietaryBaseline,
  CuisineId,
  NormalizedRecipe,
  SlotType,
  PlannedMealAssignment,
  AssignmentState,
  ActorType,
} from './planner/plannerTypes';
import { useWeeklyRoutine } from './WeeklyRoutineContext';
import { usePantry } from './PantryContext';
import { useDebug } from './DebugContext';
import { useRecipes } from './RecipeContext';
import { CalibrationPayload, buildPlannerSetup } from './planner/buildPlannerInput';
import { validatePlannerOutput } from './plannerValidation';
import { StorageService } from './storage';
import { DAYS, WeeklyRoutine } from './weeklyRoutine';
import { FULL_RECIPE_CATALOG } from './planner/recipeRegistry';

const PLANNER_VERSION = '20d.mb.final';
const STORAGE_KEY = 'active_workspace_' + PLANNER_VERSION;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

type DashboardAssignmentState = Extract<AssignmentState, 'proposed' | 'locked' | 'cooked' | 'skipped' | 'generating' | 'pool_collapse'>;

export type PlannerActionStatus =
  | 'success_changed'
  | 'success_unchanged'
  | 'failed_precondition'
  | 'failed_constraints'
  | 'failed_error';

export interface PlannerActionResult {
  status: PlannerActionStatus;
  reason?: string;
}

export interface DashboardAssignment extends PlannedMealAssignment {
  day: typeof DAYS[number];
  slot: SlotType;
}

export interface ActiveWorkspaceOutput {
  assignments: DashboardAssignment[];
  summary?: {
    estimatedPlannedCostGBP?: number;
    estimatedPlannedCalories?: number;
    estimatedPlannedProteinG?: number;
    pantryIngredientsUsed?: string[];
    plannerNote?: string;
  };
}

export interface ActiveWorkspace {
  status: 'idle' | 'generating' | 'ready' | 'error' | 'verifying';
  planId: string | null;
  input: {
    routine: WeeklyRoutine;
    payload: CalibrationPayload;
  } | null;
  output: ActiveWorkspaceOutput | null;
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
  slotLoading: Record<string, boolean>;
  dayLoading: Record<number, boolean>;
  weekLoading: boolean;
  getSwapCandidates: (dayIndex: number, slotType: SlotType) => Promise<any[]>;
  replaceSlot: (dayIndex: number, slotType: SlotType, recipeId: string) => Promise<PlannerActionResult>;
  skipAssignment: (assignmentId: string) => void;
  unskipAssignment: (assignmentId: string) => void;
  skipAndKeepIngredients: (assignmentId: string, recipe: NormalizedRecipe) => void;
  regenerateDay: (dayIndex: number) => Promise<PlannerActionResult>;
  regenerateWeek: () => Promise<PlannerActionResult>;
  updateFullOnboardingPayload: (payload: Partial<CalibrationPayload>) => Promise<void>;
  toggleLock: (assignmentId: string) => void;
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

function mondayOfCurrentWeek(): Date {
  const today = new Date();
  const jsDay = today.getDay();
  const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getDateForDayIndex(dayIndex: number): string {
  const monday = mondayOfCurrentWeek();
  const date = new Date(monday);
  date.setDate(monday.getDate() + dayIndex);
  return date.toISOString().split('T')[0];
}

function cloneAssignments(assignments: DashboardAssignment[]): DashboardAssignment[] {
  return assignments.map(a => ({
    ...a,
    metrics: { ...a.metrics },
    decisionSnapshot: a.decisionSnapshot ? { ...a.decisionSnapshot } : undefined,
    rescueData: a.rescueData ? { ...a.rescueData } : undefined,
    collapseContext: a.collapseContext ? { ...a.collapseContext } : undefined,
  }));
}

function normalizeAssignments(
  planId: string,
  rawAssignments: Array<{ day: typeof DAYS[number]; slot: SlotType; recipeId: string }>,
  previousAssignments: DashboardAssignment[] = []
): DashboardAssignment[] {
  const previousBySlotKey = new Map(previousAssignments.map(a => [`${a.dayIndex}_${a.slotType}`, a]));

  return rawAssignments.map((assignment, index) => {
    const dayIndex = DAYS.indexOf(assignment.day);
    const slotKey = `${dayIndex}_${assignment.slot}`;
    const previous = previousBySlotKey.get(slotKey);

    return {
      id: previous?.id ?? `${planId}_${dayIndex}_${assignment.slot}_${index}`,
      planId,
      day: assignment.day,
      dayIndex,
      date: previous?.date ?? getDateForDayIndex(dayIndex),
      slot: assignment.slot,
      slotType: assignment.slot,
      state: previous?.state === 'skipped' ? 'skipped' : 'proposed',
      candidateId: assignment.recipeId,
      recipeId: previous?.state === 'skipped' ? previous.recipeId : assignment.recipeId,
      isBatchCookOrigin: false,
      metrics: {
        swappedCount: previous?.metrics?.swappedCount ?? 0,
        autoFilledBy: (previous?.metrics?.autoFilledBy ?? 'planner_autofill') as ActorType,
        priorFailedCandidateCounts: previous?.metrics?.priorFailedCandidateCounts,
      },
      decisionSnapshot: previous?.decisionSnapshot,
      rescueData: previous?.rescueData,
      pantryTransferStatus: previous?.pantryTransferStatus,
      collapseContext: previous?.collapseContext,
      consumesLeftoverFromAssignmentId: previous?.consumesLeftoverFromAssignmentId,
    };
  });
}


function isDashboardAssignment(value: any): value is DashboardAssignment {
  return !!value && typeof value === 'object' && typeof value.dayIndex === 'number' && typeof value.slotType === 'string';
}

function normalizePersistedWorkspace(parsed: ActiveWorkspace): ActiveWorkspace {
  if (!parsed.output?.assignments || parsed.output.assignments.length === 0) {
    return parsed;
  }

  const assignments = parsed.output.assignments as any[];
  if (assignments.every(isDashboardAssignment)) {
    return parsed;
  }

  const planId = parsed.planId ?? `plan_${Date.now()}`;
  const normalized = normalizeAssignments(planId, assignments as Array<{ day: typeof DAYS[number]; slot: SlotType; recipeId: string }>);

  return {
    ...parsed,
    planId,
    output: {
      ...parsed.output,
      assignments: normalized,
    },
  };
}

function compareWeek(assignmentsA: DashboardAssignment[], assignmentsB: DashboardAssignment[]): boolean {
  if (assignmentsA.length !== assignmentsB.length) return false;
  for (let i = 0; i < assignmentsA.length; i += 1) {
    const a = assignmentsA[i];
    const b = assignmentsB[i];
    if (!a || !b) return false;
    if (a.dayIndex !== b.dayIndex || a.slotType !== b.slotType || a.recipeId !== b.recipeId || a.state !== b.state) {
      return false;
    }
  }
  return true;
}

export function getFriendlyReason(status: PlannerActionStatus, reason?: string): string {
  if (status === 'failed_precondition') {
    switch (reason) {
      case 'no_active_plan':
        return 'there is no active plan yet';
      case 'missing_payload':
        return 'your planner settings are missing';
      case 'assignment_not_found':
        return 'that meal slot could not be found';
      default:
        return 'the planner is not ready yet';
    }
  }

  if (status === 'failed_constraints') {
    switch (reason) {
      case 'selected_recipe_no_longer_valid':
        return 'that recipe no longer matches the slot';
      case 'no_candidates_for_slot':
        return 'there are no valid recipes for that slot';
      default:
        return 'the current constraints blocked the change';
    }
  }

  return 'something went wrong';
}

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
  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  const persistWorkspace = useCallback(async (next: ActiveWorkspace) => {
    try {
      await StorageService.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('[ActivePlanContext] Failed to persist workspace', error);
    }
  }, []);

  const buildLatestEffectivePlannerInput = useCallback(() => {
    const ws = workspaceRef.current;
    const existingPayload = (ws.input?.payload || {}) as CalibrationPayload;

    const latestPayload: CalibrationPayload = {
      ...existingPayload,
      diet: ws.userDiet || existingPayload.diet || 'Omnivore',
      budgetWeekly: existingPayload.budgetWeekly ?? 50.0,
      targetCalories: existingPayload.targetCalories ?? 2000,
      targetProtein: existingPayload.targetProtein ?? 160,
      preferredCuisineIds: existingPayload.preferredCuisineIds ?? [],
      excludedIngredientTags: existingPayload.excludedIngredientTags ?? [],
      goalTags: existingPayload.goalTags ?? [],
      allergies: existingPayload.allergies ?? [],
      preferredFlavourIds: existingPayload.preferredFlavourIds ?? [],
      preferredStyleIds: existingPayload.preferredStyleIds ?? [],
    };

    return {
      payload: latestPayload,
      routineValue: ws.input?.routine || routine,
    };
  }, [routine]);

  useEffect(() => {
    const loadPersisted = async () => {
      const saved = await StorageService.getItem(STORAGE_KEY);
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved) as ActiveWorkspace;
        const normalized = normalizePersistedWorkspace(parsed);
        setWorkspace({ ...normalized, status: 'idle' });
      } catch (error) {
        console.warn('[ActivePlanContext] Failed to parse saved workspace', error);
      }
    };
    loadPersisted();
  }, []);

  const buildPlannerInput = useCallback((payload: CalibrationPayload, routineValue: WeeklyRoutine) => {
    const setup = buildPlannerSetup(routineValue, payload);

    const input: PlannerInput = {
      slotsToFill: setup.contracts.map(contract => ({
        day: DAYS[contract.dayIndex],
        slot: contract.slotType as PlannerInput['slotsToFill'][number]['slot'],
      })),
      candidates: plannerEligibleRecipes.map(recipe => ({
        id: recipe.id,
        recipeId: recipe.id,
        title: recipe.title,
        estimatedCostGBP: recipe.estimatedCostPerServingGBP,
        prepTimeMinutes: recipe.totalMinutes || recipe.totalTimeMinutes || 30,
        macros: {
          calories: recipe.macrosPerServing.calories,
          protein: recipe.macrosPerServing.protein,
          carbs: recipe.macrosPerServing.carbs,
          fats: recipe.macrosPerServing.fats,
        },
        suitableFor: (recipe.suitableFor ?? []).filter(slot => ['breakfast', 'lunch', 'dinner'].includes(slot)) as any,
        archetype: recipe.archetype === 'Staple' ? 'budget_workhorse_dinner' : 'quick_default',
        tags: recipe.tags || [],
        pantryIngredients: [],
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
        goalTags: payload.goalTags ?? [],
      },
      composition: {
        archetypeCounts: { budget_workhorse_dinner: 7 } as any,
        archetypeRepeatCaps: { budget_workhorse_dinner: 7, quick_default: 7 } as any,
      },
    };

    return { setup, input };
  }, [plannerEligibleRecipes]);

  const pickCandidateForSlot = useCallback((
    slot: SlotType,
    usedRecipeIds: Set<string>,
    cycleOffset: number,
  ) => {
    const suitable = plannerEligibleRecipes.filter(recipe => (recipe.suitableFor ?? []).includes(slot) && recipe.plannerUsable !== false);
    if (suitable.length === 0) return null;

    const unUsed = suitable.filter(recipe => !usedRecipeIds.has(recipe.id));
    const pool = unUsed.length > 0 ? unUsed : suitable;
    const selected = pool[cycleOffset % pool.length] ?? pool[0];
    return selected ?? null;
  }, [plannerEligibleRecipes]);

  const generateWorkspaceOutput = useCallback((
    payload: CalibrationPayload,
    routineValue: WeeklyRoutine,
    previousAssignments: DashboardAssignment[] = [],
    cycleSeed = Date.now(),
  ) => {
    const { setup, input } = buildPlannerInput(payload, routineValue);
    const usedRecipeIds = new Set<string>();

    const rawAssignments = input.slotsToFill.map((slotRef, index) => {
      const candidate = pickCandidateForSlot(slotRef.slot as SlotType, usedRecipeIds, cycleSeed + index);
      const recipeId = candidate?.id ?? plannerEligibleRecipes[0]?.id ?? '';
      if (recipeId) usedRecipeIds.add(recipeId);
      return {
        day: slotRef.day,
        slot: slotRef.slot as SlotType,
        recipeId,
      };
    }).filter(assignment => !!assignment.recipeId);

    const rawOutput = {
      assignments: rawAssignments,
      summary: {
        estimatedPlannedCostGBP: 48.5,
        estimatedPlannedCalories: 14200,
        estimatedPlannedProteinG: 1100,
        pantryIngredientsUsed: [],
        plannerNote: 'Your custom plan is ready.',
      },
    };

    const validated = validatePlannerOutput(rawOutput as any, input);
    const normalizedAssignments = normalizeAssignments(
      setup.planId,
      validated.plan.assignments as Array<{ day: typeof DAYS[number]; slot: SlotType; recipeId: string }>,
      previousAssignments,
    );

    return {
      planId: setup.planId,
      output: {
        assignments: normalizedAssignments,
        summary: validated.plan.summary,
      } as ActiveWorkspaceOutput,
      compliance: validated.compliance || null,
      warnings: validated.warnings,
      routineValue,
      payload,
    };
  }, [buildPlannerInput, pickCandidateForSlot, plannerEligibleRecipes]);

  const clearWorkspace = useCallback(() => {
    setWorkspace(INITIAL_WORKSPACE);
    StorageService.removeItem(STORAGE_KEY);
  }, []);

  const regenerateWorkspace = useCallback(async (payload: CalibrationPayload) => {
    setWorkspace(prev => ({ ...prev, status: 'generating', error: null, warnings: [] }));

    try {
      const nextGenerated = generateWorkspaceOutput(payload, routine, [], Date.now());
      const nextWorkspace: ActiveWorkspace = {
        ...workspaceRef.current,
        status: 'ready',
        planId: nextGenerated.planId,
        input: {
          routine: nextGenerated.routineValue,
          payload: nextGenerated.payload,
        },
        output: nextGenerated.output,
        compliance: nextGenerated.compliance,
        warnings: nextGenerated.warnings,
        generatedAt: new Date().toISOString(),
        error: null,
        actionSource: 'regenerateWorkspace',
      };

      setWorkspace(nextWorkspace);
      await persistWorkspace(nextWorkspace);
    } catch (error: any) {
      setWorkspace(prev => ({
        ...prev,
        status: 'error',
        error: error?.message || 'Generation failed',
      }));
    }
  }, [generateWorkspaceOutput, persistWorkspace, routine]);

  const updateUserDiet = useCallback((diet: DietaryBaseline) => {
    setWorkspace(prev => {
      const { routineValue } = buildLatestEffectivePlannerInput();
      return {
        ...prev,
        userDiet: diet,
        profileVersion: prev.profileVersion + 1,
        input: {
          routine: routineValue,
          payload: { ...(prev.input?.payload as CalibrationPayload), diet },
        },
      };
    });
  }, [buildLatestEffectivePlannerInput]);

  const updateBudget = useCallback((budget: number) => {
    setWorkspace(prev => {
      const { routineValue } = buildLatestEffectivePlannerInput();
      return {
        ...prev,
        profileVersion: prev.profileVersion + 1,
        input: {
          routine: routineValue,
          payload: { ...(prev.input?.payload as CalibrationPayload), budgetWeekly: budget },
        },
      };
    });
  }, [buildLatestEffectivePlannerInput]);

  const updateCalories = useCallback((calories: number, preset?: string) => {
    setWorkspace(prev => {
      const { routineValue } = buildLatestEffectivePlannerInput();
      return {
        ...prev,
        profileVersion: prev.profileVersion + 1,
        input: {
          routine: routineValue,
          payload: { ...(prev.input?.payload as CalibrationPayload), targetCalories: calories, caloriePreset: preset },
        },
      };
    });
  }, [buildLatestEffectivePlannerInput]);

  const updateProtein = useCallback((protein: number) => {
    setWorkspace(prev => {
      const { routineValue } = buildLatestEffectivePlannerInput();
      return {
        ...prev,
        profileVersion: prev.profileVersion + 1,
        input: {
          routine: routineValue,
          payload: { ...(prev.input?.payload as CalibrationPayload), targetProtein: protein },
        },
      };
    });
  }, [buildLatestEffectivePlannerInput]);

  const updateCuisinePreferences = useCallback((cuisines: CuisineId[]) => {
    setWorkspace(prev => {
      const { routineValue } = buildLatestEffectivePlannerInput();
      return {
        ...prev,
        profileVersion: prev.profileVersion + 1,
        input: {
          routine: routineValue,
          payload: { ...(prev.input?.payload as CalibrationPayload), preferredCuisineIds: cuisines },
        },
      };
    });
  }, [buildLatestEffectivePlannerInput]);

  const updateExclusions = useCallback((exclusions: string[]) => {
    setWorkspace(prev => {
      const { routineValue } = buildLatestEffectivePlannerInput();
      return {
        ...prev,
        profileVersion: prev.profileVersion + 1,
        input: {
          routine: routineValue,
          payload: { ...(prev.input?.payload as CalibrationPayload), excludedIngredientTags: exclusions },
        },
      };
    });
  }, [buildLatestEffectivePlannerInput]);

  const applyManualAdjustment = useCallback((day: number, slot: string, recipeId: string) => {
    setWorkspace(prev => {
      if (!prev.output) return prev;

      const nextAssignments = cloneAssignments(prev.output.assignments).map(assignment => {
        if (assignment.dayIndex === day && assignment.slotType === slot) {
          return {
            ...assignment,
            recipeId,
            candidateId: recipeId,
            state: 'locked' as DashboardAssignmentState,
            metrics: {
              ...assignment.metrics,
              swappedCount: (assignment.metrics.swappedCount || 0) + 1,
            },
          };
        }
        return assignment;
      });

      return {
        ...prev,
        output: {
          ...prev.output,
          assignments: nextAssignments,
        },
        actionSource: 'applyManualAdjustment',
        profileVersion: prev.profileVersion + 1,
      };
    });
  }, []);

  const getSwapCandidates = useCallback(async (dayIndex: number, slotType: SlotType) => {
    const currentAssignments = workspaceRef.current.output?.assignments ?? [];
    const current = currentAssignments.find(a => a.dayIndex === dayIndex && a.slotType === slotType);
    const currentRecipe = current?.recipeId ? FULL_RECIPE_CATALOG[current.recipeId] : null;
    const currentCost = currentRecipe?.estimatedCostPerServingGBP ?? 0;

    return Object.values(FULL_RECIPE_CATALOG)
      .filter(recipe => (recipe.suitableFor ?? []).includes(slotType) && recipe.plannerUsable !== false)
      .map(recipe => ({
        ...recipe,
        impact: {
          costDelta: recipe.estimatedCostPerServingGBP - currentCost,
        },
      }));
  }, []);

  const replaceSlot = useCallback(async (dayIndex: number, slotType: SlotType, recipeId: string): Promise<PlannerActionResult> => {
    const slotKey = `${dayIndex}_${slotType}`;
    setSlotLoading(prev => ({ ...prev, [slotKey]: true }));

    try {
      const ws = workspaceRef.current;
      if (!ws.output) return { status: 'failed_precondition', reason: 'no_active_plan' };

      const targetRecipe = FULL_RECIPE_CATALOG[recipeId];
      if (!targetRecipe || !(targetRecipe.suitableFor ?? []).includes(slotType)) {
        return { status: 'failed_constraints', reason: 'selected_recipe_no_longer_valid' };
      }

      const targetIndex = ws.output.assignments.findIndex(a => a.dayIndex === dayIndex && a.slotType === slotType);
      if (targetIndex < 0) return { status: 'failed_precondition', reason: 'assignment_not_found' };

      const current = ws.output.assignments[targetIndex];
      if (current.recipeId === recipeId && current.state !== 'skipped') {
        return { status: 'success_unchanged' };
      }

      const nextAssignments = cloneAssignments(ws.output.assignments);
      nextAssignments[targetIndex] = {
        ...current,
        recipeId,
        candidateId: recipeId,
        state: 'locked',
        metrics: {
          ...current.metrics,
          swappedCount: (current.metrics.swappedCount || 0) + 1,
          autoFilledBy: 'swap_request',
        },
      };

      const nextWorkspace: ActiveWorkspace = {
        ...ws,
        output: {
          ...ws.output,
          assignments: nextAssignments,
        },
        generatedAt: new Date().toISOString(),
        actionSource: 'replaceSlot',
      };

      setWorkspace(nextWorkspace);
      await persistWorkspace(nextWorkspace);
      return { status: 'success_changed' };
    } catch (error) {
      console.error('[ActivePlanContext] replaceSlot failed', error);
      return { status: 'failed_error' };
    } finally {
      setSlotLoading(prev => ({ ...prev, [slotKey]: false }));
    }
  }, [persistWorkspace]);

  const updateAssignmentState = useCallback(async (assignmentId: string, nextState: DashboardAssignmentState) => {
    const ws = workspaceRef.current;
    if (!ws.output) return;

    const nextAssignments = cloneAssignments(ws.output.assignments).map(assignment => {
      if (assignment.id !== assignmentId) return assignment;
      return {
        ...assignment,
        state: nextState,
      };
    });

    const nextWorkspace: ActiveWorkspace = {
      ...ws,
      output: {
        ...ws.output,
        assignments: nextAssignments,
      },
      generatedAt: new Date().toISOString(),
      actionSource: nextState === 'skipped' ? 'skipAssignment' : 'unskipAssignment',
    };

    setWorkspace(nextWorkspace);
    await persistWorkspace(nextWorkspace);
  }, [persistWorkspace]);

  const skipAssignment = useCallback((assignmentId: string) => {
    void updateAssignmentState(assignmentId, 'skipped');
  }, [updateAssignmentState]);

  const unskipAssignment = useCallback((assignmentId: string) => {
    void updateAssignmentState(assignmentId, 'proposed');
  }, [updateAssignmentState]);

  const skipAndKeepIngredients = useCallback((assignmentId: string, recipe: NormalizedRecipe) => {
    const ingredientsToTransfer = (recipe.ingredients ?? [])
      .filter(ingredient => !!ingredient.canonicalIngredientId)
      .map(ingredient => ({
        ingredientId: ingredient.canonicalIngredientId as string,
        amount: ingredient.amount,
        unit: ingredient.unit,
      }));

    if (ingredientsToTransfer.length > 0) {
      addSkippedIngredients(ingredientsToTransfer);
    }

    void updateAssignmentState(assignmentId, 'skipped');
  }, [addSkippedIngredients, updateAssignmentState]);

  const regenerateDay = useCallback(async (dayIndex: number): Promise<PlannerActionResult> => {
    setDayLoading(prev => ({ ...prev, [dayIndex]: true }));
    try {
      const ws = workspaceRef.current;
      const payload = ws.input?.payload;
      const routineValue = ws.input?.routine ?? routine;

      if (!payload) {
        return { status: 'failed_precondition', reason: 'missing_payload' };
      }

      const existingAssignments = ws.output?.assignments ?? [];
      const generated = generateWorkspaceOutput(payload, routineValue, existingAssignments, Date.now() + dayIndex + 17);
      const nextAssignments = cloneAssignments(existingAssignments);
      const regeneratedForDay = generated.output.assignments.filter(a => a.dayIndex === dayIndex);

      if (nextAssignments.length === 0) {
        const nextWorkspace: ActiveWorkspace = {
          ...ws,
          status: 'ready',
          planId: generated.planId,
          input: { routine: generated.routineValue, payload: generated.payload },
          output: generated.output,
          compliance: generated.compliance,
          warnings: generated.warnings,
          generatedAt: new Date().toISOString(),
          error: null,
          actionSource: 'regenerateDay',
        };
        setWorkspace(nextWorkspace);
        await persistWorkspace(nextWorkspace);
        return { status: 'success_changed' };
      }

      const assignmentMap = new Map(nextAssignments.map(a => [`${a.dayIndex}_${a.slotType}`, a]));
      regeneratedForDay.forEach(assignment => {
        const key = `${assignment.dayIndex}_${assignment.slotType}`;
        const existing = assignmentMap.get(key);
        assignmentMap.set(key, {
          ...(existing ?? assignment),
          ...assignment,
          id: existing?.id ?? assignment.id,
          state: existing?.state === 'skipped' ? 'skipped' : 'proposed',
          metrics: {
            ...assignment.metrics,
            swappedCount: existing?.metrics?.swappedCount ?? 0,
            autoFilledBy: 'regenerate_request',
            priorFailedCandidateCounts: existing?.metrics?.priorFailedCandidateCounts,
          },
        });
      });

      const mergedAssignments = Array.from(assignmentMap.values()).sort((a, b) => {
        if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
        return ['breakfast', 'lunch', 'dinner'].indexOf(a.slotType) - ['breakfast', 'lunch', 'dinner'].indexOf(b.slotType);
      });

      const changed = !compareWeek(existingAssignments, mergedAssignments);
      if (!changed) {
        return { status: 'success_unchanged' };
      }

      const nextWorkspace: ActiveWorkspace = {
        ...ws,
        status: 'ready',
        planId: ws.planId ?? generated.planId,
        input: { routine: generated.routineValue, payload: generated.payload },
        output: {
          assignments: mergedAssignments,
          summary: generated.output.summary,
        },
        compliance: generated.compliance,
        warnings: generated.warnings,
        generatedAt: new Date().toISOString(),
        error: null,
        actionSource: 'regenerateDay',
      };

      setWorkspace(nextWorkspace);
      await persistWorkspace(nextWorkspace);
      return { status: 'success_changed' };
    } catch (error) {
      console.error('[ActivePlanContext] regenerateDay failed', error);
      return { status: 'failed_error', reason: String(error) };
    } finally {
      setDayLoading(prev => ({ ...prev, [dayIndex]: false }));
    }
  }, [generateWorkspaceOutput, persistWorkspace, routine, workspace.planId, workspace.output, workspace.input?.payload, validatePlannerOutput, plannerEligibleRecipes, pantryItems]);

  const regenerateWeek = useCallback(async (): Promise<PlannerActionResult> => {
    setWeekLoading(true);
    try {
      const ws = workspaceRef.current;
      const payload = ws.input?.payload;
      const routineValue = ws.input?.routine ?? routine;

      if (!payload) {
        return { status: 'failed_precondition', reason: 'missing_payload' };
      }

      const existingAssignments = ws.output?.assignments ?? [];
      const generated = generateWorkspaceOutput(payload, routineValue, existingAssignments, Date.now() + 101);

      const changed = !compareWeek(existingAssignments, generated.output.assignments);
      if (!changed) {
        return { status: 'success_unchanged' };
      }

      const nextWorkspace: ActiveWorkspace = {
        ...ws,
        status: 'ready',
        planId: generated.planId,
        input: { routine: generated.routineValue, payload: generated.payload },
        output: generated.output,
        compliance: generated.compliance,
        warnings: generated.warnings,
        generatedAt: new Date().toISOString(),
        error: null,
        actionSource: 'regenerateWeek',
      };

      setWorkspace(nextWorkspace);
      await persistWorkspace(nextWorkspace);
      return { status: 'success_changed' };
    } catch (error) {
      console.error('[ActivePlanContext] regenerateWeek failed', error);
      return { status: 'failed_error', reason: String(error) };
    } finally {
      setWeekLoading(false);
    }
  }, [generateWorkspaceOutput, persistWorkspace, routine, workspace.planId, workspace.output, workspace.input?.payload, validatePlannerOutput, plannerEligibleRecipes, pantryItems]);

  useEffect(() => {
    const budget = workspace.input?.payload?.budgetWeekly ?? 50;
    updateDebugData({ dashboardDisplayedBudget: budget });
  }, [updateDebugData, workspace.input?.payload?.budgetWeekly]);

  const updateFullOnboardingPayload = useCallback(async (updates: Partial<CalibrationPayload>) => {
    const ws = workspaceRef.current;
    const currentPayload = ws.input?.payload || {} as CalibrationPayload;
    
    const nextPayload = {
      ...currentPayload,
      ...updates,
    };

    const nextWorkspace: ActiveWorkspace = {
      ...ws,
      input: {
        routine: ws.input?.routine || routine,
        payload: nextPayload as CalibrationPayload,
      },
      profileVersion: ws.profileVersion + 1,
      userDiet: nextPayload.diet || ws.userDiet,
    };

    setWorkspace(nextWorkspace);
    await persistWorkspace(nextWorkspace);
  }, [routine, persistWorkspace]);

  const toggleLock = useCallback((assignmentId: string) => {
    setWorkspace(prev => {
      if (!prev.output) return prev;
      const nextAssignments = prev.output.assignments.map(a => {
        if (a.id === assignmentId) {
          return {
            ...a,
            state: a.state === 'locked' ? 'proposed' : 'locked' as DashboardAssignmentState
          };
        }
        return a;
      });
      return {
        ...prev,
        output: { ...prev.output, assignments: nextAssignments },
        profileVersion: prev.profileVersion + 1
      };
    });
  }, []);

  const value = useMemo(() => ({
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
    clearWorkspace,
    slotLoading,
    dayLoading,
    weekLoading,
    getSwapCandidates,
    replaceSlot,
    skipAssignment,
    unskipAssignment,
    skipAndKeepIngredients,
    regenerateDay,
      regenerateWeek,
      updateFullOnboardingPayload,
      toggleLock,
    }), [
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
    clearWorkspace,
    slotLoading,
    dayLoading,
    weekLoading,
    getSwapCandidates,
    replaceSlot,
    skipAssignment,
    unskipAssignment,
    skipAndKeepIngredients,
    regenerateDay,
      regenerateWeek,
      updateFullOnboardingPayload,
      toggleLock,
    ]);

  // --- DIAGNOSTICS (Forceful Resolution) ---
  useEffect(() => {
    const contextKeys = [
      'workspace', 'regenerateDay', 'regenerateWeek', 'replaceSlot',
      'skipAssignment', 'unskipAssignment', 'skipAndKeepIngredients',
      'getSwapCandidates', 'slotLoading', 'dayLoading', 'weekLoading'
    ];
    const missing = contextKeys.filter(key => !(key in value));

    console.log('[ActivePlanContext] Provider mounted. Keys available:', Object.keys(value));
    if (missing.length > 0) {
      console.warn('[ActivePlanContext] CRITICAL: Missing context methods:', missing);
    }
  }, [value]); // Depend on 'value' to re-run if context value changes

  return (
    <ActivePlanContext.Provider
      value={value}
    >
      {children}
    </ActivePlanContext.Provider>
  );
}

// Phase 24 Hook Consolidation (Ensures absolute module stability on Windows/Metro)
export function useActivePlan() {
  const context = useContext(ActivePlanContext);
  if (context === undefined) {
    throw new Error('useActivePlan must be used within an ActivePlanProvider');
  }
  return context;
}
