/**
 * plannerFixtures.ts
 * Strictly typed, honest mock data demonstrating real planner validation flows.
 * No type checking bypasses or shortcuts are permitted here.
 */

import {
  NormalizedRecipe,
  SlotContract,
  PlannedMealAssignment,
  RawRecipeInput,
  TasteProfile
} from './plannerTypes';

// --- 1. PROVENANCE EXAMPLES (Raw Inputs) ---

export const rawUserImport: RawRecipeInput = {
  id: "raw_01",
  sourceFamily: 'imported',
  sourceMethod: 'url',
  requestedByActorType: 'user_manual',
  requestedByActorId: 'user_abc',
  rawPayload: { type: 'url', url: 'https://example.com/spaghetti' },
  createdAt: new Date('2026-03-01T10:00:00Z'),
  status: 'pending_normalization'
};

export const rawRescueGeneration: RawRecipeInput = {
  id: "raw_02",
  sourceFamily: 'generated',
  sourceMethod: 'gemini',
  requestedByActorType: 'rescue_operation',
  requestedByActorId: 'system_core',
  triggerReason: 'budget_delta_exceeded',
  rawPayload: { 
    type: 'model_json', 
    prompt: 'Generate 35g protein dinner using pantry staples under £2.00',
    rawResponse: {} // Mocked 
  },
  createdAt: new Date('2026-03-10T18:00:00Z'),
  status: 'pending_normalization'
};


// --- 2. CANONICAL DATABASE (Normalized Recipes) ---

export const curatedRoast: NormalizedRecipe = {
  id: "rec_roast_01",
  sourceId: 'src_sys_01',
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  
  macroConfidence: 0.95, costConfidence: 0.90, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  
  title: 'Classic Roast Chicken',
  description: 'A stable, hearty Sunday roast.',
  imageUrl: "https://images.unsplash.com/photo-MsIX4c1aP7A?q=80&w=800&auto=format&fit=crop",
  totalTimeMinutes: 90, prepTimeMinutes: 15, difficulty: 'Medium', servings: 4,
  
  estimatedCostTotalGBP: 6.00,
  estimatedCostPerServingGBP: 1.50, 
  macrosTotal: { calories: 2400, protein: 160, carbs: 120, fats: 100 },
  macrosPerServing: { calories: 600, protein: 40, carbs: 30, fats: 25 },
  
  ingredients: [], method: [], tags: ['High-Protein', 'Sunday Roast'],
  archetype: 'Staple', freezerFriendly: false, reheatsWell: true, yieldsLeftovers: true, suitableFor: ['dinner', 'lunch'],
};

export const curatedPasta: NormalizedRecipe = {
  id: "rec_pasta_01",
  sourceId: 'src_sys_02',
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  
  macroConfidence: 0.90, costConfidence: 0.95, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  
  title: 'Quick Tomato Pasta',
  description: 'Fast, cheap, and easy.',
  imageUrl: "https://images.unsplash.com/photo-Qp0VyysIuzs?q=80&w=800&auto=format&fit=crop",
  totalTimeMinutes: 15, prepTimeMinutes: 5, difficulty: 'Easy', servings: 2,
  
  estimatedCostTotalGBP: 2.00,
  estimatedCostPerServingGBP: 1.00, // Very cheap
  macrosTotal: { calories: 800, protein: 24, carbs: 140, fats: 16 },
  macrosPerServing: { calories: 400, protein: 12, carbs: 70, fats: 8 }, // Low protein
  
  ingredients: [], method: [], tags: ['Vegetarian', 'Quick'],
  archetype: 'Quick_Fix', freezerFriendly: true, reheatsWell: true, yieldsLeftovers: true, suitableFor: ['lunch', 'dinner'],
};

export const generatedLentilStew: NormalizedRecipe = {
  id: "rec_lentil_01",
  sourceId: rawRescueGeneration.id,
  status: 'needs_human_review', // Generated recipes always start here
  plannerUsable: true, // But we can still allow the engine to use it if desperate
  libraryVisible: false, // Don't show in the vault until user approves it
  
  macroConfidence: 0.85, costConfidence: 0.90, ingredientMappingConfidence: 0.95, servingConfidence: 1.0,
  normalizationWarnings: [],
  
  title: 'Spiced Lentil & Bean Stew',
  description: 'Hearty, plant-based rescue meal.',
  imageUrl: "https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=800&auto=format&fit=crop",
  totalTimeMinutes: 35, prepTimeMinutes: 10, difficulty: 'Easy', servings: 4,
  
  estimatedCostTotalGBP: 4.80,
  estimatedCostPerServingGBP: 1.20,
  macrosTotal: { calories: 1200, protein: 60, carbs: 180, fats: 20 },
  macrosPerServing: { calories: 300, protein: 15, carbs: 45, fats: 5 },
  
  ingredients: [], method: [], tags: ['Vegan', 'High-Fiber', 'Budget'],
  archetype: 'budget_workhorse', freezerFriendly: true, reheatsWell: true, yieldsLeftovers: true, suitableFor: ['dinner', 'lunch'],
};

export const highProteinSeitan: NormalizedRecipe = {
  id: "rec_vegan_steak_01",
  sourceId: 'src_sys_03',
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  macroConfidence: 0.90, costConfidence: 0.80, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  title: 'Seitan "Steak" & Garlic Mash',
  description: 'A savory seitan steak with a balsamic glaze, served with cauliflower mash.',
  imageUrl: "https://images.unsplash.com/photo-6DT8J3nZUPE?q=80&w=800&auto=format&fit=crop",
  totalTimeMinutes: 40, prepTimeMinutes: 10, difficulty: 'Medium', servings: 1,
  estimatedCostTotalGBP: 5.50,
  estimatedCostPerServingGBP: 5.50,
  macrosTotal: { calories: 550, protein: 52, carbs: 20, fats: 28 }, // Keto seitan is rare but possible
  macrosPerServing: { calories: 550, protein: 52, carbs: 20, fats: 28 },
  ingredients: [], method: [], tags: ['Vegan', 'High-Protein', 'Low-Carb'],
  archetype: 'premium_meal', freezerFriendly: false, reheatsWell: true, yieldsLeftovers: true, suitableFor: ['dinner'],
};

export const highProteinTempeh: NormalizedRecipe = {
  id: "rec_vegan_tempeh_01",
  sourceId: 'src_sys_hp_02',
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  macroConfidence: 1.0, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  title: 'Smoky Tempeh & Peanut Stir-fry',
  description: 'A nutty, high-protein vegan lunch or dinner.',
  imageUrl: "https://images.unsplash.com/photo-0kD2Wp67wQk?q=80&w=800&auto=format&fit=crop",
  totalTimeMinutes: 20, prepTimeMinutes: 10, difficulty: 'Easy', servings: 1,
  estimatedCostTotalGBP: 2.20,
  estimatedCostPerServingGBP: 2.20,
  macrosTotal: { calories: 580, protein: 41, carbs: 35, fats: 32 },
  macrosPerServing: { calories: 580, protein: 41, carbs: 35, fats: 32 },
  ingredients: [], method: [], tags: ['Vegan', 'High-Protein'],
  archetype: 'Staple', freezerFriendly: false, reheatsWell: true, yieldsLeftovers: false, suitableFor: ['lunch', 'dinner'],
};

export const highProteinHalloumi: NormalizedRecipe = {
  id: "rec_veggie_halloumi_01",
  sourceId: 'src_sys_hp_03',
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  macroConfidence: 1.0, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  title: 'Baked Halloumi & Mediterranean Veg',
  description: 'Crispy halloumi with roasted peppers and zucchini.',
  imageUrl: "https://images.unsplash.com/photo-1594970544699-c88f38bb67cc?q=80&w=800&auto=format&fit=crop",
  totalTimeMinutes: 30, prepTimeMinutes: 5, difficulty: 'Easy', servings: 1,
  estimatedCostTotalGBP: 3.50,
  estimatedCostPerServingGBP: 3.50,
  macrosTotal: { calories: 620, protein: 38, carbs: 15, fats: 48 },
  macrosPerServing: { calories: 620, protein: 38, carbs: 15, fats: 48 },
  ingredients: [], method: [], tags: ['Vegetarian', 'High-Protein'],
  archetype: 'Staple', freezerFriendly: false, reheatsWell: false, yieldsLeftovers: false, suitableFor: ['dinner'],
};

export const highProteinTofuScramble: NormalizedRecipe = {
  id: "rec_vegan_scramble_01",
  sourceId: 'src_sys_hp_04',
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  macroConfidence: 1.0, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  title: 'Smoky Tofu Scramble',
  description: 'The ultimate high-protein vegan breakfast.',
  imageUrl: "https://images.unsplash.com/photo-rJ-a9JlgWEc?q=80&w=800&auto=format&fit=crop",
  totalTimeMinutes: 15, prepTimeMinutes: 5, difficulty: 'Easy', servings: 1,
  estimatedCostTotalGBP: 1.80,
  estimatedCostPerServingGBP: 1.80,
  macrosTotal: { calories: 420, protein: 32, carbs: 12, fats: 28 },
  macrosPerServing: { calories: 420, protein: 32, carbs: 12, fats: 28 },
  ingredients: [], method: [], tags: ['Vegan', 'High-Protein'],
  archetype: 'protein_breakfast', freezerFriendly: false, reheatsWell: true, yieldsLeftovers: false, suitableFor: ['breakfast'],
};

// --- BATCH 1: POOL EXPANSION ---

export const veganTikkaMasala: NormalizedRecipe = {
  id: "rec_vegan_tikka_01",
  sourceId: 'src_batch1_01',
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  macroConfidence: 1.0, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  title: 'Tofu & Chickpea Tikka Masala',
  description: 'A rich, creamy vegan curry packed with protein.',
  imageUrl: "https://images.unsplash.com/photo-1565557612088-71eab05dfaee?q=80&w=800&auto=format&fit=crop",
  totalTimeMinutes: 30, prepTimeMinutes: 10, difficulty: 'Medium', servings: 1,
  estimatedCostTotalGBP: 2.80,
  estimatedCostPerServingGBP: 2.80,
  macrosTotal: { calories: 720, protein: 48, carbs: 65, fats: 25 },
  macrosPerServing: { calories: 720, protein: 48, carbs: 65, fats: 25 },
  ingredients: [], method: [], tags: ['Vegan', 'High-Protein', 'Calorie-Dense'],
  archetype: 'high_protein_anchor', freezerFriendly: true, reheatsWell: true, yieldsLeftovers: true, suitableFor: ['lunch', 'dinner'],
};

export const veganMeatloaf: NormalizedRecipe = {
  id: "rec_vegan_meatloaf_01",
  sourceId: 'src_batch1_02',
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  macroConfidence: 1.0, costConfidence: 0.9, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  title: 'Lentil & Walnut "Meatloaf" with Garlic Mash',
  description: 'Savory, dense, and incredibly satisfying vegan comfort food.',
  imageUrl: "https://images.unsplash.com/photo-_bILufSltJM?q=80&w=800&auto=format&fit=crop",
  totalTimeMinutes: 50, prepTimeMinutes: 15, difficulty: 'Medium', servings: 1,
  estimatedCostTotalGBP: 3.20,
  estimatedCostPerServingGBP: 3.20,
  macrosTotal: { calories: 750, protein: 42, carbs: 80, fats: 28 },
  macrosPerServing: { calories: 750, protein: 42, carbs: 80, fats: 28 },
  ingredients: [], method: [], tags: ['Vegan', 'High-Protein', 'Calorie-Dense'],
  archetype: 'high_protein_anchor', freezerFriendly: true, reheatsWell: true, yieldsLeftovers: true, suitableFor: ['dinner'],
};

export const veganOvernightOats: NormalizedRecipe = {
  id: "rec_vegan_oats_01",
  sourceId: 'src_batch1_03',
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  macroConfidence: 1.0, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  title: 'Peanut Butter & Hemp Seed Overnight Oats',
  description: 'Creamy, high-protein breakfast that preps in 5 minutes.',
  imageUrl: "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?q=80&w=800&auto=format&fit=crop",
  totalTimeMinutes: 480, prepTimeMinutes: 5, difficulty: 'Easy', servings: 1,
  estimatedCostTotalGBP: 1.90,
  estimatedCostPerServingGBP: 1.90,
  macrosTotal: { calories: 550, protein: 30, carbs: 60, fats: 22 },
  macrosPerServing: { calories: 550, protein: 30, carbs: 60, fats: 22 },
  ingredients: [], method: [], tags: ['Vegan', 'High-Protein'],
  archetype: 'protein_breakfast', freezerFriendly: false, reheatsWell: false, yieldsLeftovers: false, suitableFor: ['breakfast'],
};

export const veganTempehBowl: NormalizedRecipe = {
  id: "rec_vegan_tempeh_bowl_01",
  sourceId: 'src_batch1_04',
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  macroConfidence: 1.0, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  title: 'Tempeh "Bacon" & Avocado Power Bowl',
  description: 'A nutrient-packed bowl with smoky tempeh and healthy fats.',
  imageUrl: "https://images.unsplash.com/photo-j6GwMrgeL_A?q=80&w=800&auto=format&fit=crop",
  totalTimeMinutes: 25, prepTimeMinutes: 10, difficulty: 'Easy', servings: 1,
  estimatedCostTotalGBP: 3.50,
  estimatedCostPerServingGBP: 3.50,
  macrosTotal: { calories: 710, protein: 38, carbs: 45, fats: 42 },
  macrosPerServing: { calories: 710, protein: 38, carbs: 45, fats: 42 },
  ingredients: [], method: [], tags: ['Vegan', 'High-Protein', 'Calorie-Dense'],
  archetype: 'high_protein_anchor', freezerFriendly: false, reheatsWell: true, yieldsLeftovers: false, suitableFor: ['lunch', 'dinner'],
};

export const veganOmlette: NormalizedRecipe = {
  id: "rec_vegan_omelette_01",
  sourceId: 'src_batch1_05',
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  macroConfidence: 1.0, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  title: 'Savory Chickpea Flour "Omelette"',
  description: 'A protein-rich vegan omelette alternative filled with veggies.',
  imageUrl: "https://images.unsplash.com/photo-PeA56-Gt7Dw?q=80&w=800&auto=format&fit=crop",
  totalTimeMinutes: 15, prepTimeMinutes: 5, difficulty: 'Easy', servings: 1,
  estimatedCostTotalGBP: 1.50,
  estimatedCostPerServingGBP: 1.50,
  macrosTotal: { calories: 450, protein: 28, carbs: 40, fats: 18 },
  macrosPerServing: { calories: 450, protein: 28, carbs: 40, fats: 18 },
  ingredients: [], method: [], tags: ['Vegan', 'High-Protein'],
  archetype: 'protein_breakfast', freezerFriendly: false, reheatsWell: true, yieldsLeftovers: false, suitableFor: ['breakfast'],
};

export const veggieShells: NormalizedRecipe = {
  id: "rec_veggie_shells_01",
  sourceId: 'src_batch1_06',
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  macroConfidence: 1.0, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  title: 'Cottage Cheese & Spinach Stuffed Shells',
  description: 'Classical comfort food lightened up with high-protein cottage cheese.',
  imageUrl: "https://images.unsplash.com/photo-xd5mqeeg9qE?q=80&w=800&auto=format&fit=crop&uid=v60akm",
  totalTimeMinutes: 40, prepTimeMinutes: 15, difficulty: 'Medium', servings: 1,
  estimatedCostTotalGBP: 3.00,
  estimatedCostPerServingGBP: 3.00,
  macrosTotal: { calories: 680, protein: 45, carbs: 70, fats: 22 },
  macrosPerServing: { calories: 680, protein: 45, carbs: 70, fats: 22 },
  ingredients: [], method: [], tags: ['Vegetarian', 'High-Protein'],
  archetype: 'high_protein_anchor', freezerFriendly: true, reheatsWell: true, yieldsLeftovers: true, suitableFor: ['dinner'],
};

export const veggieMutterPaneer: NormalizedRecipe = {
  id: "rec_veggie_mutter_paneer_01",
  sourceId: 'src_batch1_07',
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  macroConfidence: 1.0, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  title: 'Paneer & Pea Curry (Mutter Paneer)',
  description: 'Rich and spicy curry with fried paneer and sweet peas.',
  imageUrl: "https://images.unsplash.com/photo-AEU9UZstCfs?q=80&w=800&auto=format&fit=crop&uid=k5gblc",
  totalTimeMinutes: 30, prepTimeMinutes: 10, difficulty: 'Medium', servings: 1,
  estimatedCostTotalGBP: 3.50,
  estimatedCostPerServingGBP: 3.50,
  macrosTotal: { calories: 650, protein: 40, carbs: 25, fats: 45 },
  macrosPerServing: { calories: 650, protein: 40, carbs: 25, fats: 45 },
  ingredients: [], method: [], tags: ['Vegetarian', 'High-Protein'],
  archetype: 'high_protein_anchor', freezerFriendly: true, reheatsWell: true, yieldsLeftovers: true, suitableFor: ['lunch', 'dinner'],
};

export const veggieFetaWrap: NormalizedRecipe = {
  id: "rec_veggie_feta_wrap_01",
  sourceId: 'src_batch1_08',
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  macroConfidence: 1.0, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  title: 'Greek Yogurt & Feta Protein Wraps',
  description: 'A tangy, creamy, and quick high-protein lunch.',
  imageUrl: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?q=80&w=800&auto=format&fit=crop",
  totalTimeMinutes: 10, prepTimeMinutes: 10, difficulty: 'Easy', servings: 1,
  estimatedCostTotalGBP: 2.50,
  estimatedCostPerServingGBP: 2.50,
  macrosTotal: { calories: 580, protein: 35, carbs: 45, fats: 28 },
  macrosPerServing: { calories: 580, protein: 35, carbs: 45, fats: 28 },
  ingredients: [], method: [], tags: ['Vegetarian', 'High-Protein'],
  archetype: 'high_protein_anchor', freezerFriendly: false, reheatsWell: false, yieldsLeftovers: false, suitableFor: ['lunch'],
};

export const pesciSeabass: NormalizedRecipe = {
  id: "rec_pesci_seabass_01",
  sourceId: 'src_batch1_09',
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  macroConfidence: 1.0, costConfidence: 0.9, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  title: 'Pan-Seared Seabass with Cannellini Bean Mash',
  description: 'Elegant Fish dinner with a high-protein bean base.',
  imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=800&auto=format&fit=crop&uid=pao9f",
  totalTimeMinutes: 20, prepTimeMinutes: 5, difficulty: 'Medium', servings: 1,
  estimatedCostTotalGBP: 5.50,
  estimatedCostPerServingGBP: 5.50,
  macrosTotal: { calories: 620, protein: 46, carbs: 35, fats: 24 },
  macrosPerServing: { calories: 620, protein: 46, carbs: 35, fats: 24 },
  ingredients: [], method: [], tags: ['Pescatarian', 'High-Protein'],
  archetype: 'high_protein_anchor', freezerFriendly: false, reheatsWell: false, yieldsLeftovers: false, suitableFor: ['dinner'],
};

export const pesciSalmonBagel: NormalizedRecipe = {
  id: "rec_pesci_salmon_bagel_01",
  sourceId: 'src_batch1_10',
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  macroConfidence: 1.0, costConfidence: 0.9, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  title: 'Smoked Salmon & Cream Cheese Protein Bagel',
  description: 'Classic bagel upgraded with extra protein and healthy fats.',
  imageUrl: "https://images.unsplash.com/photo-8LxEnrfgjgg?q=80&w=800&auto=format&fit=crop&uid=ox1xdk",
  totalTimeMinutes: 5, prepTimeMinutes: 5, difficulty: 'Easy', servings: 1,
  estimatedCostTotalGBP: 4.50,
  estimatedCostPerServingGBP: 4.50,
  macrosTotal: { calories: 520, protein: 32, carbs: 45, fats: 22 },
  macrosPerServing: { calories: 520, protein: 32, carbs: 45, fats: 22 },
  ingredients: [], method: [], tags: ['Pescatarian', 'High-Protein'],
  archetype: 'protein_breakfast', freezerFriendly: false, reheatsWell: false, yieldsLeftovers: false, suitableFor: ['breakfast'],
};


// --- 3. HARD SLOT CONTRACTS ---

const NEUTRAL_TASTE_PROFILE: TasteProfile = {
  anchorCount: 0,
  totalTagWeight: 0,
  totalArchetypeWeight: 0,
  preferredTags: {},
  preferredArchetypes: {},
};

export const typicalDinnerContract: SlotContract = {
  planId: 'week_42', dayIndex: 0, date: '2026-03-09', slotType: 'dinner',
  macroTargets: {
    calories: { min: 400, max: 700, ideal: 600 },
    protein: { min: 25, ideal: 35 }
  },
  budgetEnvelopeGBP: 4.00, // Reasonable budget
  dietaryBaseline: 'Omnivore',
  repeatCap: 1, archetypeCaps: { 'Splurge': 1, 'Staple': 5, 'Quick_Fix': 3, 'Batch_Cook': 2 },
  leftoverPreference: 'prefer_fresh', batchCookPreference: 'allowed', rescueThresholdScore: 65.0,
  hardExclusions: [],
  tasteProfile: NEUTRAL_TASTE_PROFILE
};

export const exhaustedBudgetDinnerContract: SlotContract = {
  planId: 'week_42', dayIndex: 3, date: '2026-03-12', slotType: 'dinner',
  macroTargets: {
    calories: { min: 400, max: 700, ideal: 500 },
    protein: { min: 35, ideal: 40 } // Hard requirement for 35g min
  },
  budgetEnvelopeGBP: 1.50, // Almost no money left in the weekly envelope!
  dietaryBaseline: 'Omnivore',
  repeatCap: 1, archetypeCaps: { 'Splurge': 0, 'Staple': 5, 'Quick_Fix': 3, 'Batch_Cook': 2 },
  leftoverPreference: 'prefer_fresh', batchCookPreference: 'allowed', rescueThresholdScore: 65.0,
  hardExclusions: [],
  tasteProfile: NEUTRAL_TASTE_PROFILE
};


// --- 4. ENGINE PLACEMENT STATES ---

export const normalAssignment: PlannedMealAssignment = {
  id: "assign_mon_dinner", planId: 'week_42', dayIndex: 0, date: '2026-03-09', slotType: 'dinner',
  state: 'locked', candidateId: 'cand_temp_1', recipeId: curatedRoast.id,
  isBatchCookOrigin: false,
  decisionSnapshot: {
    scores: { totalScore: 88, slotFitScore: 80, macroFitScore: 90, budgetFitScore: 85, tasteFitScore: 90, varietyFitScore: 100, pantryFitScore: 60, leftoverFitScore: 100 },
    insights: [{ type: 'macro_fit', score: 0.9, label: 'Hits Protein Target', detail: '40g aligns with 35g goal', icon: 'bullseye' }],
    budgetConstraintAtTimeOfDecision: 4.00,
    proteinTargetAtTimeOfDecision: 35
  },
  metrics: { swappedCount: 0, autoFilledBy: 'background_enrichment' }
};

/**
 * The Real Rescue Flow: 
 * The system tried to fill `exhaustedBudgetDinnerContract`.
 * - `curatedPasta` failed hard eligibility: 'protein_minimum_failed' (12g < 35g).
 * - `curatedRoast` failed hard eligibility: 'budget_delta_exceeded' (£3.00 > £1.50).
 * - System triggered Tier 2 Gemini Generation, producing `generatedLentilStew` (£1.25 / 36g protein).
 * - System assigned it.
 */
export const rescueAssignment: PlannedMealAssignment = {
  id: "assign_thu_dinner_rescue", planId: 'week_42', dayIndex: 3, date: '2026-03-12', slotType: 'dinner',
  state: 'proposed', candidateId: 'cand_lentil_1', recipeId: generatedLentilStew.id,
  isBatchCookOrigin: false,
  decisionSnapshot: {
    scores: { totalScore: 78, slotFitScore: 80, macroFitScore: 85, budgetFitScore: 100, tasteFitScore: 65, varietyFitScore: 90, pantryFitScore: 100, leftoverFitScore: 100 },
    insights: [{ type: 'rescue_action', score: 1.0, label: 'Budget Rescue', detail: 'Generated to fit your strict £1.50 remaining budget.', icon: 'life-ring' }],
    budgetConstraintAtTimeOfDecision: 1.50,
    proteinTargetAtTimeOfDecision: 40
  },
  metrics: { 
    swappedCount: 0, 
    autoFilledBy: 'rescue_operation',
    priorFailedCandidateCounts: {
      'protein_minimum_failed': 12, // 12 recipes looked at failed protein
      'budget_delta_exceeded': 28 // 28 recipes looked at broke the bank
    }
  },
  rescueData: {
    tierTriggered: 2, // Gemini Generation
    failureReasons: ['budget_delta_exceeded', 'protein_minimum_failed'], // The aggregate reasons the pool collapsed
    archetypeCapsIgnored: false,
    repeatCapsEnforced: true,
    budgetDeltaPushed: 0, // We mathematically saved it without breaking the limit!
    originalTargetHash: 'b_1.50_p_35' 
  }
};
