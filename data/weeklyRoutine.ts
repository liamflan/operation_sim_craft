// ─── Weekly Routine Data Model ───────────────────────────────────────────────
//
// Defines how users tell Provision which meals they actually want help planning.
// Each day of the week has three slots, each with a mode that downstream
// surfaces (Dashboard, Fuel List, Gemini recommendations) read and act on.

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type Day = typeof DAYS[number];

export type BreakfastMode = 'plan' | 'skip' | 'quick';
export type LunchMode    = 'plan' | 'skip' | 'leftovers' | 'out';
export type DinnerMode   = 'plan' | 'quick' | 'takeaway' | 'out';
export type MealMode     = BreakfastMode | LunchMode | DinnerMode;
export type MealSlot     = 'breakfast' | 'lunch' | 'dinner';

export type DayRoutine = {
  breakfast: BreakfastMode;
  lunch:     LunchMode;
  dinner:    DinnerMode;
};

export type WeeklyRoutine = Record<Day, DayRoutine>;

// ─── Defaults ────────────────────────────────────────────────────────────────
// All slots default to "plan" so users start with a blank canvas.

export const DEFAULT_ROUTINE: WeeklyRoutine = {
  Mon: { breakfast: 'plan', lunch: 'plan', dinner: 'plan' },
  Tue: { breakfast: 'plan', lunch: 'plan', dinner: 'plan' },
  Wed: { breakfast: 'plan', lunch: 'plan', dinner: 'plan' },
  Thu: { breakfast: 'plan', lunch: 'plan', dinner: 'plan' },
  Fri: { breakfast: 'plan', lunch: 'plan', dinner: 'plan' },
  Sat: { breakfast: 'plan', lunch: 'plan', dinner: 'plan' },
  Sun: { breakfast: 'plan', lunch: 'plan', dinner: 'plan' },
};

// ─── Presets ─────────────────────────────────────────────────────────────────

export type RoutinePreset = {
  label: string;
  key: string;
  routine: WeeklyRoutine;
};

export const ROUTINE_PRESETS: RoutinePreset[] = [
  {
    label: 'Full week',
    key: 'full',
    routine: DEFAULT_ROUTINE,
  },
  {
    label: 'Weekday dinners',
    key: 'weekday_dinners',
    routine: {
      Mon: { breakfast: 'skip', lunch: 'out',      dinner: 'plan' },
      Tue: { breakfast: 'skip', lunch: 'out',      dinner: 'plan' },
      Wed: { breakfast: 'skip', lunch: 'out',      dinner: 'plan' },
      Thu: { breakfast: 'skip', lunch: 'out',      dinner: 'plan' },
      Fri: { breakfast: 'skip', lunch: 'out',      dinner: 'takeaway' },
      Sat: { breakfast: 'skip', lunch: 'out',      dinner: 'out' },
      Sun: { breakfast: 'skip', lunch: 'leftovers',dinner: 'out' },
    },
  },
  {
    label: 'Skip weekends',
    key: 'skip_weekends',
    routine: {
      Mon: { breakfast: 'plan', lunch: 'plan', dinner: 'plan' },
      Tue: { breakfast: 'plan', lunch: 'plan', dinner: 'plan' },
      Wed: { breakfast: 'plan', lunch: 'plan', dinner: 'plan' },
      Thu: { breakfast: 'plan', lunch: 'plan', dinner: 'plan' },
      Fri: { breakfast: 'plan', lunch: 'plan', dinner: 'plan' },
      Sat: { breakfast: 'skip', lunch: 'out',  dinner: 'out'  },
      Sun: { breakfast: 'skip', lunch: 'out',  dinner: 'out'  },
    },
  },
  {
    label: 'Quick breakfasts',
    key: 'quick_breakfasts',
    routine: {
      Mon: { breakfast: 'quick', lunch: 'plan', dinner: 'plan' },
      Tue: { breakfast: 'quick', lunch: 'plan', dinner: 'plan' },
      Wed: { breakfast: 'quick', lunch: 'plan', dinner: 'plan' },
      Thu: { breakfast: 'quick', lunch: 'plan', dinner: 'plan' },
      Fri: { breakfast: 'quick', lunch: 'plan', dinner: 'plan' },
      Sat: { breakfast: 'quick', lunch: 'plan', dinner: 'plan' },
      Sun: { breakfast: 'quick', lunch: 'plan', dinner: 'plan' },
    },
  },
];

// ─── Slot Option Definitions ──────────────────────────────────────────────────

export const BREAKFAST_OPTIONS: { value: BreakfastMode; label: string }[] = [
  { value: 'plan',  label: 'Plan'  },
  { value: 'quick', label: 'Quick' },
  { value: 'skip',  label: 'Skip'  },
];

export const LUNCH_OPTIONS: { value: LunchMode; label: string }[] = [
  { value: 'plan',      label: 'Plan'      },
  { value: 'leftovers', label: 'Leftovers' },
  { value: 'out',       label: 'Out'       },
  { value: 'skip',      label: 'Skip'      },
];

export const DINNER_OPTIONS: { value: DinnerMode; label: string }[] = [
  { value: 'plan',     label: 'Plan'     },
  { value: 'quick',   label: 'Quick'    },
  { value: 'takeaway', label: 'Takeaway' },
  { value: 'out',      label: 'Out'      },
];

// ─── Derived Helpers ──────────────────────────────────────────────────────────

/** Returns true if the slot will result in a Provision-planned meal. */
export function isPlanned(mode: MealMode): boolean {
  return mode === 'plan';
}

/** Human-readable label for a non-plan slot, slot-aware for natural phrasing. */
export function slotLabel(slot: MealSlot, mode: MealMode): string {
  if (slot === 'breakfast') {
    switch (mode) {
      case 'quick': return 'Quick breakfast';
      case 'skip':  return 'Skipping breakfast';
      default:      return 'Not planned';
    }
  }
  if (slot === 'lunch') {
    switch (mode) {
      case 'leftovers': return 'Leftovers';
      case 'out':       return 'Out for lunch';
      case 'skip':      return 'Skipping lunch';
      default:          return 'Not planned';
    }
  }
  // dinner
  switch (mode) {
    case 'quick':    return 'Quick dinner';
    case 'takeaway': return 'Takeaway night';
    case 'out':      return 'Eating out';
    default:         return 'Not planned';
  }
}

/** Brief past-tense description used in Fuel List exclusion summaries. */
export function slotExclusionLabel(slot: MealSlot, mode: MealMode): string {
  if (mode === 'takeaway') return 'takeaway';
  if (mode === 'out')      return 'eating out';
  if (mode === 'quick')    return slot === 'breakfast' ? 'quick breakfast' : 'quick dinner';
  if (mode === 'leftovers') return 'leftovers';
  if (mode === 'skip')      return 'skipped';
  return '';
}
