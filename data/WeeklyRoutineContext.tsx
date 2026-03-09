import React, { createContext, useContext, useState, ReactNode } from 'react';
import {
  WeeklyRoutine,
  DEFAULT_ROUTINE,
  Day,
  MealSlot,
  BreakfastMode,
  LunchMode,
  DinnerMode,
  MealMode,
} from './weeklyRoutine';

// ─── Context Shape ────────────────────────────────────────────────────────────

type CtxShape = {
  routine: WeeklyRoutine;
  /** Update a single meal slot for a given day. mode must match the slot type. */
  setSlot: (day: Day, slot: MealSlot, mode: MealMode) => void;
  applyPreset: (preset: WeeklyRoutine) => void;
  reset: () => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const WeeklyRoutineContext = createContext<CtxShape | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WeeklyRoutineProvider({ children }: { children: ReactNode }) {
  const [routine, setRoutine] = useState<WeeklyRoutine>(DEFAULT_ROUTINE);

  const setSlot = (day: Day, slot: MealSlot, mode: MealMode) => {
    setRoutine(prev => ({
      ...prev,
      [day]: { ...prev[day], [slot]: mode },
    }));
  };

  const applyPreset = (preset: WeeklyRoutine) => setRoutine(preset);

  const reset = () => setRoutine(DEFAULT_ROUTINE);

  return (
    <WeeklyRoutineContext.Provider value={{ routine, setSlot, applyPreset, reset }}>
      {children}
    </WeeklyRoutineContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWeeklyRoutine(): CtxShape {
  const ctx = useContext(WeeklyRoutineContext);
  if (!ctx) throw new Error('useWeeklyRoutine must be used inside WeeklyRoutineProvider');
  return ctx;
}
