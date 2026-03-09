// ─── Gemini Planner Contract Types ───────────────────────────────────────────

// ─── Recipe Archetypes ────────────────────────────────────────────────────────
// Planner-facing roles. Never user-facing directly.

export type RecipeArchetype =
  | 'budget_breakfast'    // cheap, highly repeatable morning option
  | 'protein_breakfast'   // targets protein goal at breakfast
  | 'budget_workhorse'    // cheap lunch/dinner, can repeat most days
  | 'high_protein_anchor' // high protein, use 1-2× per week max
  | 'calorie_dense'       // fills calorie gap, use when daily avg is low
  | 'variety_anchor'      // interesting/premium feel, use 1-2× per week
  | 'premium_meal'        // expensive, use at most once per week
  | 'quick_default';      // fast fallback, fills gaps when budget/pool exhausted

// ─── Weekly Composition Target ────────────────────────────────────────────────
// Computed before the Gemini call. Tells the planner how many of each archetype
// to use, and what repeat cap applies per archetype.

export type WeeklyCompositionTarget = {
  archetypeCounts: Partial<Record<RecipeArchetype, number>>;
  archetypeRepeatCaps: Record<RecipeArchetype, number>;
};

// ─── Input ────────────────────────────────────────────────────────────────────────────────

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

  /** Weekly composition strategy produced by plannerStrategy.ts */
  composition: WeeklyCompositionTarget;
};

export type PlannerCandidate = {
  id: string;
  title: string;
  suitableFor: PlannerSlot[];
  prepTimeMinutes: number;
  macros: { calories: number; protein: number; carbs: number; fats: number };
  tags: string[];
  archetype: RecipeArchetype;
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
