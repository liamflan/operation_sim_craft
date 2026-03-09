// ─── Gemini Planner Contract Types ───────────────────────────────────────────
//
// PlannerInput  → what Provision sends to Gemini (structured context)
// PlannerRawOutput → what Gemini returns (planned-slot assignments only)
// ResolvedWeeklyPlan → merged, validated, app-ready plan
//
// Rule: Gemini never receives raw UI state and never returns the full routine grid.
// Provision is responsible for all hard constraints, merging, and validation.

// ─── Input ────────────────────────────────────────────────────────────────────

export type PlannerInput = {
  profile: {
    dietaryPreference: 'Omnivore' | 'Pescatarian' | 'Vegetarian' | 'Vegan';
    /** Hard exclusions — enforced by Provision before the call, listed for model awareness */
    allergies: string[];
    targetCalories: number;
    targetProteinG: number;
    /** e.g. ['High Protein', 'Budget-First'] */
    goalTags: string[];
    weeklyBudgetGBP: number;
  };

  /** Only slots where routine mode === 'plan'. Non-plan slots are never sent. */
  slotsToFill: {
    day: PlannerDay;
    slot: PlannerSlot;
  }[];

  pantrySignals: {
    ingredientId: string;
    name: string;
    status: 'well_stocked' | 'low' | 'out';
  }[];

  /**
   * Pre-filtered candidate recipes. Provision has already removed any recipe
   * that violates allergies or dietary preference before building this list.
   */
  candidates: PlannerCandidate[];

  preferences: {
    prioritisePantry: boolean;
    preferVariety: boolean;
    maxRecipeRepeatsPerWeek: number;
  };
};

export type PlannerCandidate = {
  id: string;
  title: string;
  suitableFor: PlannerSlot[];
  prepTimeMinutes: number;
  macros: { calories: number; protein: number; carbs: number; fats: number };
  tags: string[];
  /** IDs of ingredients in this recipe that are already well-stocked in the pantry */
  pantryIngredients: string[];
  estimatedCostGBP: number;
};

// ─── Raw Output (Gemini response, before validation) ─────────────────────────

/** Returned by Gemini. Runtime-validated before any business logic runs. */
export type PlannerRawOutput = {
  assignments: PlannerAssignment[];
  /** Optional — display only. Missing summary never reduces plan validity. */
  summary?: PlannerSummary;
};

export type PlannerAssignment = {
  day: PlannerDay;
  slot: PlannerSlot;
  recipeId: string;
};

export type PlannerSummary = {
  estimatedPlannedCostGBP: number;
  estimatedPlannedCalories: number;
  estimatedPlannedProteinG: number;
  pantryIngredientsUsed: string[];
  /** Trimmed and capped at 200 chars during post-processing */
  plannerNote: string;
};

// ─── Resolved Plan (merged, validated, app-ready) ────────────────────────────

export type ResolvedDayPlan = {
  day: PlannerDay;
  breakfast: { recipeId: string } | { mode: 'skip' | 'quick' };
  lunch:     { recipeId: string } | { mode: 'skip' | 'leftovers' | 'out' };
  dinner:    { recipeId: string } | { mode: 'quick' | 'takeaway' | 'out' };
};

export type ResolvedWeeklyPlan = {
  days: ResolvedDayPlan[];
  summary?: PlannerSummary;
  meta: PlanMetadata;
};

export type PlanMetadata = {
  generatedAt: string;
  plannerVersion: string;
  source: 'gemini_clean' | 'gemini_warned' | 'gemini_repaired' | 'previous' | 'fallback_mock';
  warnings: string[];
};

// ─── Validation ───────────────────────────────────────────────────────────────

export type ValidationResult = {
  valid: boolean;
  plan: PlannerRawOutput;
  warnings: string[];
};

// ─── Common Enums ─────────────────────────────────────────────────────────────

export type PlannerDay  = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type PlannerSlot = 'breakfast' | 'lunch' | 'dinner';
