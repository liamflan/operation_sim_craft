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

export type RecipeValidationStatus = 'draft' | 'needs_review' | 'ready';

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
  | 'High_Protein'
  | 'protein_breakfast'
  | 'protein_heavy'
  | 'budget_breakfast'
  | 'budget_workhorse'
  | 'Variety_Pack'
  | 'premium_meal'
  | 'calorie_dense'
  | 'Staple' 
  | 'Splurge' 
  | 'Quick_Fix' 
  | 'Batch_Cook';

// ---------------------------------------------------------------------------
// CUISINE MODELS (Phase 21 Rework)
// ---------------------------------------------------------------------------

export type CuisineId = 
  | 'italian'
  | 'french'
  | 'mexican'
  | 'japanese'
  | 'chinese'
  | 'indian'
  | 'mediterranean'
  | 'middle_eastern'
  | 'korean'
  | 'south_east_asian';

export interface CuisineProfile {
  id: CuisineId;
  label: string;
  description: string;
  flavourTags: string[];
  styleTags: string[];
  ingredientBiasTags: string[];
}

export const CUISINE_PROFILES: Record<CuisineId, CuisineProfile> = {
  italian: {
    id: 'italian',
    label: 'Italian',
    description: 'Brimming with tomato, basil, and garlic across pasta and fresh comfort dishes.',
    flavourTags: ['tomato', 'basil', 'garlic'],
    styleTags: ['pasta', 'fresh_comfort'],
    ingredientBiasTags: ['parmesan', 'olive_oil', 'mozzarella']
  },
  french: {
    id: 'french',
    label: 'French',
    description: 'Sophisticated flavours featuring rich sauces, fresh herbs, and slow-braised comforts.',
    flavourTags: ['rich', 'herby'],
    styleTags: ['braised', 'stew', 'refined_comfort'],
    ingredientBiasTags: ['butter', 'wine', 'shallots']
  },
  mexican: {
    id: 'mexican',
    label: 'Mexican',
    description: 'Vibrant and smoky palettes with chilli, lime, and earthy cumin.',
    flavourTags: ['chilli', 'lime', 'cumin', 'smoky'],
    styleTags: ['taco', 'street_food'],
    ingredientBiasTags: ['avocado', 'coriander', 'black_beans']
  },
  japanese: {
    id: 'japanese',
    label: 'Japanese',
    description: 'Clean, umami-rich dishes highlighting soy, ginger, and precision.',
    flavourTags: ['umami', 'soy', 'ginger'],
    styleTags: ['rice', 'clean'],
    ingredientBiasTags: ['miso', 'seaweed', 'mirin']
  },
  chinese: {
    id: 'chinese',
    label: 'Chinese',
    description: 'Savoury and aromatic stir-fries powered by ginger, garlic, and sesame soul.',
    flavourTags: ['ginger', 'garlic', 'sesame', 'savoury'],
    styleTags: ['stir_fry'],
    ingredientBiasTags: ['soy_sauce', 'spring_onion', 'bok_choy']
  },
  indian: {
    id: 'indian',
    label: 'Indian',
    description: 'Deeply aromatic curries and warming spices that provide ultimate comfort.',
    flavourTags: ['warming_spice', 'curry', 'aromatic'],
    styleTags: ['saucy'],
    ingredientBiasTags: ['turmeric', 'cumin', 'coconut_milk']
  },
  mediterranean: {
    id: 'mediterranean',
    label: 'Mediterranean',
    description: 'Bright, sun-drenched flavours of lemon, olive oil, and mountain herbs.',
    flavourTags: ['lemon', 'herbs', 'olive_oil'],
    styleTags: ['light', 'fresh'],
    ingredientBiasTags: ['feta', 'cucumber', 'chickpeas']
  },
  middle_eastern: {
    id: 'middle_eastern',
    label: 'Middle Eastern',
    description: 'Arrestingly aromatic dishes with cumin, coriander, and yoghurt accents.',
    flavourTags: ['cumin', 'coriander', 'yoghurt'],
    styleTags: ['roasted', 'warm_spice'],
    ingredientBiasTags: ['tahini', 'pomegranate', 'bulgur']
  },
  korean: {
    id: 'korean',
    label: 'Korean',
    description: 'Bold, punchy flavours driven by fermented umami and sesame.',
    flavourTags: ['gochujang', 'sesame', 'punchy', 'umami'],
    styleTags: ['fermented'],
    ingredientBiasTags: ['kimchi', 'gochugaru', 'beef']
  },
  south_east_asian: {
    id: 'south_east_asian',
    label: 'South East Asian',
    description: 'Fragrant and complex profiles balancing xlime, chilli, and coconut milk.',
    flavourTags: ['lime', 'chilli', 'coconut'],
    styleTags: ['fragrant_herbs'],
    ingredientBiasTags: ['lemongrass', 'fish_sauce', 'thai_basil']
  }
};

export interface Substitution {
  original: string;
  swap: string;
  reason: string; 
}

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
  // Canonical Phase 21 Time & Effort
  activePrepMinutes: number;
  totalMinutes: number;
  complexityScore: number; // 1-5 scale
  
  // Phase 21 Optional Enrichments
  cleanupBurden?: 'Low' | 'Medium' | 'High';
  equipmentRequired?: string[];
  batchFriendly?: boolean;
  leftoverFriendly?: boolean; 
  
  // Cuisine-Led Metadata (Phase 21 Rework)
  cuisineId?: CuisineId;
  ingredientTags: string[];
  flavourIds: string[];
  styleIds: string[];
  
  // Legacy Time & Effort (Preserved temporarily)
  totalTimeMinutes?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  notes?: string;
  substitutions?: Substitution[];
  relatedRecipeIds?: string[];
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
  
  plannerUsable: boolean; 
  libraryVisible: boolean; 
}

// ---------------------------------------------------------------------------
// IMAGE AUDIT SYSTEM (Phase 17)
// ---------------------------------------------------------------------------

export type ImageSourceType = 'imported' | 'manual' | 'generated' | 'fallback';
export type ImageProvider = 'unsplash' | 'pexels' | 'internal' | 'unknown';
export type ImageAuditStatus = 'correct' | 'missing' | 'suspect' | 'needs-review';

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
  fingerprint?: string; 
  alt?: string;
  lastCheckedAt?: string; 
}

export interface TasteProfile {
  preferredCuisineIds: CuisineId[];
  excludedIngredientTags: string[];
}

// ---------------------------------------------------------------------------
// SLOT CONTRACTS & EVALUATION DEFS
// ---------------------------------------------------------------------------

export type SlotType = 'breakfast' | 'lunch' | 'dinner' | 'snack_am' | 'snack_pm' | 'dessert';

export interface SlotContract {
  planId: string;
  dayIndex: number; 
  date: string; 
  slotType: SlotType;
  
  macroTargets: {
    calories: { min: number; max: number; ideal: number };
    protein: { min: number; ideal: number };
  };
  budgetEnvelopeGBP: number;
  dietaryBaseline: DietaryBaseline;
  hardExclusions: string[];
  tasteProfile: TasteProfile;
  
  repeatCap: number; 
  archetypeCaps: Partial<Record<RecipeArchetype, number>>; 
  leftoverPreference: 'prefer_fresh' | 'accept_leftover' | 'require_leftover';
  batchCookPreference: 'allowed' | 'discouraged' | 'required';
  rescueThresholdScore: number; 
}

export interface InsightMetadata {
  type: 'macro_fit' | 'budget_fit' | 'pantry_match' | 'taste_match' | 'variety_fit' | 'prep_warning' | 'rescue_action';
  score: number; 
  icon: string;
  label: string;
  detail: string;
  debug?: Record<string, any>; 
}

export interface PlannerCandidate {
  id: string; 
  recipeId: string;
  slotContractRef: { planId: string; dayIndex: number; slotType: SlotType };
  
  scores: {
    totalScore: number;      
    slotFitScore: number;    
    macroFitScore: number;   
    budgetFitScore: number;  
    tasteFitScore: number;   
    varietyFitScore: number; 
    pantryFitScore: number;  
    leftoverFitScore: number;
  };
  
  penalties: {
    archetypePenalty: number;
    repeatPenalty: number;
    cuisineSaturationPenalty: number; 
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
  | 'exclusion_ingredient_match'; 

export interface RescueMetadata {
  tierTriggered: 1 | 2 | 3; 
  failureReasons: RescueFailureReason[];
  archetypeCapsIgnored: boolean;
  repeatCapsEnforced: boolean;
  budgetDeltaPushed: number;
  originalTargetHash: string; 
}

export type FriendlyFailureCategory = 
  | 'no_slot_match'
  | 'budget_too_tight'
  | 'protein_or_calorie_target_mismatch'
  | 'exclusions_or_diet_conflict'
  | 'repeat_cap_exhausted'
  | 'archetype_cap_exhausted'
  | 'planner_usable_false'
  | 'metadata_missing'
  | 'fallback_exhausted'
  | 'unknown';

export interface NearMissCandidate {
  recipeId: string;
  title: string;
  suitableFor: SlotType[];
  archetype: RecipeArchetype;
  cuisineId?: CuisineId;
  costPerServing: number;
  calories: number;
  protein: number;
  plannerUsable: boolean;
  failureReasons: RescueFailureReason[];
  friendlyCategory: FriendlyFailureCategory;
  score?: number;
}

export interface AssignmentExplanation {
  assignedRecipeId: string;
  assignedTitle: string;
  slotType: SlotType;
  suitableFor: SlotType[];
  archetype: RecipeArchetype;
  cuisineId?: CuisineId;
  scoreBreakdown: PlannerCandidate['scores'];
  isRescue: boolean;
  winnerMargin?: number;
}

export interface AlternativeCandidate {
  recipeId: string;
  title: string;
  archetype: RecipeArchetype;
  score: number;
  margin: number;
}

export interface LunchDinnerSemanticAudit {
  assignedRecipeId: string;
  assignedTitle: string;
  slotType: SlotType;
  suitableFor: SlotType[];
  archetype: RecipeArchetype;
  totalMinutes: number;
  activePrepMinutes: number;
  leftoverFriendly: boolean;
  batchFriendly: boolean;
  scoreBreakdown: PlannerCandidate['scores'];
  semanticMismatchWarning?: string;
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
  
  isBatchCookOrigin: boolean;
  consumesLeftoverFromAssignmentId?: string;
  
  decisionSnapshot?: {
    scores: PlannerCandidate['scores'];
    insights: InsightMetadata[];
    budgetConstraintAtTimeOfDecision: number;
    proteinTargetAtTimeOfDecision: number;
  };
  
  metrics: {
    swappedCount: number;
    autoFilledBy: ActorType | null;
    priorFailedCandidateCounts?: Partial<Record<RescueFailureReason, number>>; 
  };
  
  rescueData?: RescueMetadata;
  pantryTransferStatus?: 'transferred';
 
  collapseContext?: {
    reasons: RescueFailureReason[];
    availableCandidatesBeforeCollapse: number;
    committedBudgetGBP: number;
    remainingBudgetEnvelopeGBP: number;
    userMessage: string;
  };
}

export interface SlotDiagnostic {
  slotId: string; 
  contractAudit: SlotContract; 
  totalConsidered: number;
  eligibleCount: number;
  rejectedCount: number;
  topFailureReasons: Partial<Record<RescueFailureReason, number>>;
  friendlyFailureSummary: Partial<Record<FriendlyFailureCategory, number>>;
  
  nearMisses: NearMissCandidate[];
  topAlternatives?: AlternativeCandidate[];
  assignmentExplanation?: AssignmentExplanation;
  semanticAudit?: LunchDinnerSemanticAudit;

  rescueTriggered: boolean;
  actionTaken: 'filled_normally' | 'soft_rescue' | 'gemini_generation_needed' | 'hard_fallback' | 'failed_completely';
  assignedCandidateId: string | null;
  bestScoreAchieved: number | null;
}

export interface PlannerExecutionDiagnostic {
  runId: string;
  timestamp: string;
  actor: ActorType;
  contractCount: number;
  recipeCount: number;
  preservedAssignmentCount: number;
  enginePath: 'deterministic_local' | 'real_gemini' | 'fallback_mock';
  planningMode: 'normal' | 'degraded_due_to_infeasible_protein_target';
  isHardRuleValid: boolean;
  isTargetFeasible: boolean;
  candidateCountsBySlot: Record<string, number>; 
  topWarnings: string[];
}

export interface OrchestratorOutput {
  assignments: PlannedMealAssignment[];
  diagnostics: SlotDiagnostic[];
  executionMeta?: PlannerExecutionDiagnostic;
}

export interface VarietyContext {
  repeatCount: number;
  archetypeDensity: number;
  sameDayArchetypes: Set<string>;
  consecutiveArchetypeMatch: boolean;
  cuisineSaturationCount: number; 
}
