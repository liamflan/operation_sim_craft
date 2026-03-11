import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { DietaryBaseline, PlannerExecutionDiagnostic, SlotType, RescueFailureReason } from './planner/plannerTypes';

export type UnchangedReason =
  | 'no_better_candidate'
  | 'pool_collapse'
  | 'action_ignored'
  | 'same_best_result';

export type ActionPhase =
  | 'click_received'
  | 'action_ignored'
  | 'planner_running'
  | 'persist_started'
  | 'complete'
  | 'error';

export interface SwapCollapseContext {
  reason: string;
  candidateCount: number;
  committedCost: number;
  remainingBudget: number;
  userMessage: string;
}

export interface DebugMetadata {
  // ─── Route ──────────────────────────────────────────────────────────────────
  currentRoute: string;
  plannerLogicFiredThisView: boolean;

  // ─── Diet trace (existing) ───────────────────────────────────────────────────
  actionSource: string;
  selectedOnboardingDiet: DietaryBaseline | null;
  persistedWorkspaceDiet: DietaryBaseline;
  plannerInputDiet: DietaryBaseline;
  executionMeta?: PlannerExecutionDiagnostic;

  // ─── Budget trace ────────────────────────────────────────────────────────────
  selectedOnboardingBudget: number | null;
  persistedWorkspaceBudget: number | null;
  plannerInputBudget: number | null;
  dashboardDisplayedBudget: number | null;

  // ─── Last Action (updated on every click, even ignored ones) ────────────────
  lastActionIntent: string | null;
  lastActionRunId: string | null;
  lastActionPhase: ActionPhase | null;
  lastClickAt: string | null;
  actionIgnoredReason: string | null;

  // ─── Planner lifecycle ───────────────────────────────────────────────────────
  lastPlannerExecutionSource: string | null;
  lastPlannerStartAt: string | null;
  lastPlannerEndAt: string | null;
  lastPersistEndAt: string | null;
  loadingCleared: boolean | null;

  // ─── Swap target ────────────────────────────────────────────────────────────
  lastSwapTargetDay: number | null;
  lastSwapTargetSlot: SlotType | null;
  lastSwapCurrentRecipeId: string | null;
  cardStateBefore: string | null;
  cardStateAfter: string | null;
  resultChanged: boolean | null;
  unchangedReason: UnchangedReason | null;

  // ─── Collapse context ────────────────────────────────────────────────────────
  collapseContext: SwapCollapseContext | null;
}

interface DebugContextType {
  debugData: DebugMetadata;
  updateDebugData: (data: Partial<DebugMetadata>) => void;
  resetDebugData: () => void;
}

const INITIAL_DEBUG_DATA: DebugMetadata = {
  currentRoute: 'unknown',
  actionSource: 'none',
  selectedOnboardingDiet: null,
  persistedWorkspaceDiet: 'Omnivore',
  plannerInputDiet: 'Omnivore',
  plannerLogicFiredThisView: false,

  selectedOnboardingBudget: null,
  persistedWorkspaceBudget: null,
  plannerInputBudget: null,
  dashboardDisplayedBudget: null,

  lastActionIntent: null,
  lastActionRunId: null,
  lastActionPhase: null,
  lastClickAt: null,
  actionIgnoredReason: null,

  lastPlannerExecutionSource: null,
  lastPlannerStartAt: null,
  lastPlannerEndAt: null,
  lastPersistEndAt: null,
  loadingCleared: null,

  lastSwapTargetDay: null,
  lastSwapTargetSlot: null,
  lastSwapCurrentRecipeId: null,
  cardStateBefore: null,
  cardStateAfter: null,
  resultChanged: null,
  unchangedReason: null,

  collapseContext: null,
};

const DebugContext = createContext<DebugContextType | undefined>(undefined);

export function DebugProvider({ children }: { children: ReactNode }) {
  const [debugData, setDebugData] = useState<DebugMetadata>(INITIAL_DEBUG_DATA);

  const updateDebugData = useCallback((data: Partial<DebugMetadata>) => {
    setDebugData(prev => ({ ...prev, ...data }));
  }, []);

  const resetDebugData = useCallback(() => {
    setDebugData(INITIAL_DEBUG_DATA);
  }, []);

  return (
    <DebugContext.Provider value={{ debugData, updateDebugData, resetDebugData }}>
      {children}
    </DebugContext.Provider>
  );
}

export function useDebug() {
  const context = useContext(DebugContext);
  if (context === undefined) {
    throw new Error('useDebug must be used within a DebugProvider');
  }
  return context;
}
