/**
 * plannerTypes.ts
 * Deep, rigorous type definitions for the Provision Hybrid Recipe Intelligence System.
 */

export type SourceFamily = 'system' | 'imported' | 'generated';
export type SourceMethod = 'seeded' | 'url' | 'text' | 'manual' | 'gemini';

export type ActorType = 
  | 'user_manual' 
  | 'planner_autofill' 
  | 'swap_request' 
  | 'regenerate_request'
  | 'regenerate_week_request' 
  | 'rescue_operation' 
  | 'background_enrichment' 
  | 'admin_seed';

export type DietaryBaseline = 'Omnivore' | 'Pescatarian' | 'Vegetarian' | 'Vegan';

export type RawPayload = 
  | { type: 'url'; url: string; scrapedHtml?: string }
  | { type: 'text'; content: string }
  | { type: 'model_json'; prompt: string; rawResponse: any }
  | { type: 'internal_seed'; dataId: string };

export interface RawRecipeInput {
  id: string; // Origin UUID
  sourceFamily: SourceFamily;
  sourceMethod: SourceMethod;
  
  requestedByActorType: ActorType;
  requestedByActorId: string;
  triggerReason?: string; // e.g., "budget_exhausted_rescue"
  
  rawPayload: RawPayload;
  createdAt: Date;
  status: 'pending_normalization' | 'failed_extraction';
}

export type RecipeValidationStatus = 'draft' | 'needs_human_review' | 'approved' | 'rejected';

export interface NormalizationWarning {
  code: 'MISSING_MACROS' | 'UNUSUAL_COST_VARIANCE' | 'CANNOT_MAP_INGREDIENT';
  message: string;
}

export interface MacroTarget {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export type RecipeArchetype = 
  | 'Staple' 
  | 'Splurge' 
  | 'Quick_Fix' 
  | 'Batch_Cook'
  | 'protein_breakfast'
  | 'high_protein_anchor'
  | 'budget_breakfast'
  | 'budget_workhorse'
  | 'variety_anchor'
  | 'premium_meal'
  | 'calorie_dense';

export interface NormalizedRecipe {
  id: string;
  sourceId: string;
  status: RecipeValidationStatus;
  
  // Provenance & Confidence
  macroConfidence: number; // 0.0 - 1.0 
  costConfidence: number; 
  ingredientMappingConfidence: number;
  servingConfidence: number;
  normalizationWarnings: NormalizationWarning[];
  
  // Image Correctness (Phase 17)
  imageMetadata?: RecipeImageMetadata;
  
  // Core Data
  title: string;
  description: string;
  imageUrl?: string;
  totalTimeMinutes: number;
  prepTimeMinutes: number;
  cookTimeMinutes?: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  servings: number;
  estimatedCostTotalGBP: number;
  estimatedCostPerServingGBP: number;
  macrosTotal: MacroTarget;
  macrosPerServing: MacroTarget;
  
  ingredients: { name: string; amount: number; unit: string; canonicalIngredientId?: string }[];
  method: { step: number; text: string }[];
  tags: string[];
  
  // System Flags
  archetype: RecipeArchetype;
  freezerFriendly: boolean;
  reheatsWell: boolean;
  yieldsLeftovers: boolean;
  suitableFor: SlotType[];
  
  // Rich Optional Details
  notes?: string;
  substitutions?: { original: string; swap: string; reason: string }[];
  relatedRecipeIds?: string[];
  
  // Usability Gates
  plannerUsable: boolean; // Has it passed all base checks to be considered for an auto-plan?
  libraryVisible: boolean; // Should the user see this in their recipe vault?
}

// ---------------------------------------------------------------------------
// IMAGE AUDIT SYSTEM (Phase 17)
// ---------------------------------------------------------------------------

export type ImageSourceType = 'imported' | 'manual' | 'generated' | 'fallback';
export type ImageProvider = 'unsplash' | 'pexels' | 'internal' | 'unknown';
export type ImageAuditStatus = 'correct' | 'missing' | 'suspect' | 'needs-review';

/** Centralized audit reasons to prevent string drift */
export const IMAGE_AUDIT_REASONS = {
  MISSING_URL: 'missing-url' as const,
  PLACEHOLDER_IMAGE: 'placeholder-image' as const,
  DUPLICATE_URL: 'duplicate-url' as const,
  DIVERSE_REUSE: 'diverse-reuse' as const,
  KEYWORD_MISMATCH_WEAK: 'keyword-weak-mismatch' as const,
  MANUAL_FLAG: 'manual-flag' as const,
} as const;

export type ImageAuditReason = typeof IMAGE_AUDIT_REASONS[keyof typeof IMAGE_AUDIT_REASONS];

export interface RecipeImageMetadata {
  sourceType: ImageSourceType;
  provider: ImageProvider;
  status: ImageAuditStatus;
  reasons: ImageAuditReason[];
  fingerprint?: string; // Normalized URL or Provider ID
  alt?: string;
  lastCheckedAt?: string; // ISO
}

// ---------------------------------------------------------------------------
// SLOT CONTRACTS & EVALUATION DEFS
// ---------------------------------------------------------------------------

export type SlotType = 'breakfast' | 'lunch' | 'dinner' | 'snack_am' | 'snack_pm' | 'dessert';

export interface SlotContract {
  planId: string;
  dayIndex: number; // 0 (Mon) to 6 (Sun)
  date: string; // ISO Date e.g., "2026-03-10"
  slotType: SlotType;
  
  // Guiderails
  macroTargets: {
    calories: { min: number; max: number; ideal: number };
    protein: { min: number; ideal: number };
  };
  budgetEnvelopeGBP: number;
  dietaryBaseline: DietaryBaseline;
  /** Normalized (lowercase, trimmed) strings from profileExclusions. Hard gate in evaluator. */
  hardExclusions: string[];
  
  // Planner Constraints
  repeatCap: number; // Max occurrences of same recipe in plan
  archetypeCaps: Partial<Record<RecipeArchetype, number>>; // Max allowed uses of archetypes (e.g., max 1 Splurge)
  leftoverPreference: 'prefer_fresh' | 'accept_leftover' | 'require_leftover';
  batchCookPreference: 'allowed' | 'discouraged' | 'required';
  rescueThresholdScore: number; // 0-100 threshold
}

export interface InsightMetadata {
  type: 'macro_fit' | 'budget_fit' | 'pantry_match' | 'taste_match' | 'prep_warning' | 'rescue_action';
  score: number; // 0.0 to 1.0 
  label: string;
  detail: string;
  icon: string;
}

export interface PlannerCandidate {
  id: string; // Transient evaluate-time ID
  recipeId: string;
  slotContractRef: { planId: string; dayIndex: number; slotType: SlotType };
  
  scores: {
    totalScore: number;      // Weighted aggregate 0-100
    slotFitScore: number;    // Culinary / typical appropriateness
    macroFitScore: number;   // Delta vs ranges
    budgetFitScore: number;  // Delta vs envelope
    tasteFitScore: number;   // User DNA match
    varietyFitScore: number; // Distance from recent meals
    pantryFitScore: number;  // Ingredient inventory coverage
    leftoverFitScore: number;// Efficacy of leftover chaining
  };
  
  penalties: {
    archetypePenalty: number;
    repeatPenalty: number;
  };
  
  rescueEligible: boolean; 
  insights: InsightMetadata[];
}

export type AssignmentState = 'proposed' | 'locked' | 'cooked' | 'skipped' | 'leftover_consumption' | 'generating' | 'pool_collapse';

export type RescueFailureReason = 
  | 'not_planner_usable'
  | 'archetype_cap_exhausted' 
  | 'repeat_cap_exhausted' 
  | 'same_day_duplicate'
  | 'budget_delta_exceeded' 
  | 'no_slot_match' 
  | 'taste_pool_collapse' 
  | 'candidate_pool_empty'
  | 'protein_minimum_failed'
  | 'calorie_minimum_failed'
  | 'calorie_maximum_exceeded'
  | 'batch_cook_mismatch'
  | 'leftover_mismatch'
  | 'dietary_mismatch'
  | 'exclusion_ingredient_match'; // Recipe contains an ingredient matching a hardExclusion from profileExclusions

export interface RescueMetadata {
  tierTriggered: 1 | 2 | 3; 
  failureReasons: RescueFailureReason[];
  archetypeCapsIgnored: boolean;
  repeatCapsEnforced: boolean;
  budgetDeltaPushed: number;
  originalTargetHash: string; // e.g. "budget=5, protein=40"
}

export interface PlannedMealAssignment {
  id: string;
  planId: string;
  dayIndex: number;
  date: string;
  slotType: SlotType;
  
  state: AssignmentState;
  candidateId: string | null;
  recipeId: string | null;
  
  // Chaining
  isBatchCookOrigin: boolean;
  consumesLeftoverFromAssignmentId?: string;
  
  // Decision context ensures history doesn't drift if the candidate scoring changes later
  decisionSnapshot?: {
    scores: PlannerCandidate['scores'];
    insights: InsightMetadata[];
    budgetConstraintAtTimeOfDecision: number;
    proteinTargetAtTimeOfDecision: number;
  };
  
  metrics: {
    swappedCount: number;
    autoFilledBy: ActorType | null;
    priorFailedCandidateCounts?: Partial<Record<RescueFailureReason, number>>; // Tracking why the slot struggled
  };
  
  rescueData?: RescueMetadata;
  pantryTransferStatus?: 'transferred';

  // Set when state === 'pool_collapse' — carries the reason and UI-ready message
  collapseContext?: {
    reasons: RescueFailureReason[];
    availableCandidatesBeforeCollapse: number;
    committedBudgetGBP: number;
    remainingBudgetEnvelopeGBP: number;
    userMessage: string;
  };
}

export interface SlotDiagnostic {
  slotId: string; // "dayIndex_slotType"
  totalConsidered: number;
  eligibleCount: number;
  rejectedCount: number;
  topFailureReasons: Partial<Record<RescueFailureReason, number>>;
  rescueTriggered: boolean;
  actionTaken: 'filled_normally' | 'soft_rescue' | 'gemini_generation_needed' | 'hard_fallback' | 'failed_completely';
  assignedCandidateId: string | null;
  bestScoreAchieved: number | null;
}

export interface PlannerExecutionDiagnostic {
  runId: string;
  timestamp: string;
  enginePath: 'deterministic_local' | 'real_gemini' | 'fallback_mock';
  planningMode: 'normal' | 'degraded_due_to_infeasible_protein_target';
  isHardRuleValid: boolean;
  isTargetFeasible: boolean;
  candidateCountsBySlot: Record<string, number>; // "dayIndex_slotType" -> count
  topWarnings: string[];
}

export interface OrchestratorOutput {
  assignments: PlannedMealAssignment[];
  diagnostics: SlotDiagnostic[];
  executionMeta?: PlannerExecutionDiagnostic;
}
