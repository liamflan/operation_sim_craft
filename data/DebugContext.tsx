import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { DietaryBaseline, PlannerExecutionDiagnostic } from './planner/plannerTypes';

export interface DebugMetadata {
  currentRoute: string;
  actionSource: string;
  selectedOnboardingDiet: DietaryBaseline | null;
  persistedWorkspaceDiet: DietaryBaseline;
  plannerInputDiet: DietaryBaseline;
  executionMeta?: PlannerExecutionDiagnostic;
  plannerLogicFiredThisView: boolean;
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
