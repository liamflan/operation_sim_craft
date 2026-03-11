/**
 * wave1Fixtures.ts
 * Phase 21.1: Pilot Batch Wave 1 recipes targeting specific coverage gaps.
 * All recipes herein strictly use Phase 21 canonical metadata.
 */

import { NormalizedRecipe, RawRecipeInput } from './plannerTypes';

const rawWave1Seed: RawRecipeInput = {
  id: "raw_wave1_seed",
  sourceFamily: 'system',
  sourceMethod: 'seeded',
  requestedByActorType: 'admin_seed',
  requestedByActorId: 'system_core',
  rawPayload: { type: 'internal_seed', dataId: 'wave1' },
  createdAt: new Date('2026-03-12T00:00:00Z'),
  status: 'pending_normalization'
};

// --- CATEGORY 1: QUICK BREAKFASTS ---

export const greekYogurtBerryBowl: NormalizedRecipe = {
  id: "rec_wave1_yogurt_bowl_01",
  sourceId: rawWave1Seed.id,
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  
  macroConfidence: 1.0, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  
  title: 'Greek Yogurt & Mixed Berry Protein Bowl',
  description: 'A 5-minute sweet, tangy start to the day. High in protein and antioxidants.',
  imageUrl: "https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=800&auto=format&fit=crop", // valid unsplash
  
  // Phase 21 Time & Effort
  activePrepMinutes: 5,
  totalMinutes: 5,
  complexityScore: 1, // Extremely simple assemble-only
  cleanupBurden: 'Low',
  equipmentRequired: [],
  batchFriendly: false,
  leftoverFriendly: false,
  
  servings: 1,
  estimatedCostTotalGBP: 1.50,
  estimatedCostPerServingGBP: 1.50,
  macrosTotal: { calories: 320, protein: 25, carbs: 32, fats: 8 },
  macrosPerServing: { calories: 320, protein: 25, carbs: 32, fats: 8 },
  
  ingredients: [], method: [], tags: ['Vegetarian', 'High-Protein', 'Quick'],
  
  archetype: 'protein_breakfast',
  freezerFriendly: false, reheatsWell: false, yieldsLeftovers: false,
  suitableFor: ['breakfast']
};

export const cottageCheeseSourdough: NormalizedRecipe = {
  id: "rec_wave1_cottage_toast_01",
  sourceId: rawWave1Seed.id,
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  
  macroConfidence: 1.0, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  
  title: 'Cottage Cheese & Smashed Avocado Sourdough',
  description: 'Thick sourdough toast layered with creamy cottage cheese, avocado, and chili flakes.',
  imageUrl: "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?q=80&w=800&auto=format&fit=crop",
  
  activePrepMinutes: 5,
  totalMinutes: 5,
  complexityScore: 1,
  cleanupBurden: 'Low',
  equipmentRequired: ['toaster'],
  batchFriendly: false,
  leftoverFriendly: false,
  
  servings: 1,
  estimatedCostTotalGBP: 2.10,
  estimatedCostPerServingGBP: 2.10,
  macrosTotal: { calories: 420, protein: 18, carbs: 35, fats: 24 },
  macrosPerServing: { calories: 420, protein: 18, carbs: 35, fats: 24 },
  
  ingredients: [], method: [], tags: ['Vegetarian', 'Quick'],
  
  archetype: 'budget_breakfast',
  freezerFriendly: false, reheatsWell: false, yieldsLeftovers: false,
  suitableFor: ['breakfast']
};

// --- CATEGORY 2: QUICK LUNCHES (Not reliant on leftovers) ---

export const tunaCannelliniSalad: NormalizedRecipe = {
  id: "rec_wave1_tuna_bean_salad_01",
  sourceId: rawWave1Seed.id,
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  
  macroConfidence: 0.95, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  
  title: '10-Min Tuna & Cannellini Bean Lemon Salad',
  description: 'Pantry-powered healthy lunch that requires exactly zero cooking.',
  imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=800&auto=format&fit=crop",
  
  activePrepMinutes: 10,
  totalMinutes: 10,
  complexityScore: 1, // Can opening and tossing
  cleanupBurden: 'Low',
  equipmentRequired: [],
  batchFriendly: true,
  leftoverFriendly: true,
  
  servings: 2,
  estimatedCostTotalGBP: 2.80,
  estimatedCostPerServingGBP: 1.40,
  macrosTotal: { calories: 700, protein: 60, carbs: 50, fats: 22 },
  macrosPerServing: { calories: 350, protein: 30, carbs: 25, fats: 11 },
  
  ingredients: [], method: [], tags: ['Pescatarian', 'High-Protein', 'Low-Carb'],
  
  archetype: 'budget_workhorse',
  freezerFriendly: false, reheatsWell: false, yieldsLeftovers: true, // stores well cold
  suitableFor: ['lunch']
};

export const smokedTofuWrap: NormalizedRecipe = {
  id: "rec_wave1_tofu_wrap_01",
  sourceId: rawWave1Seed.id,
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  
  macroConfidence: 0.9, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  
  title: 'Smoked Tofu, Hummus & Cucumber Wrap',
  description: 'A lightning-fast vegan wrap using pre-smoked tofu for instant flavour.',
  imageUrl: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?q=80&w=800&auto=format&fit=crop", // Re-using reasonable wrap
  
  activePrepMinutes: 5,
  totalMinutes: 5,
  complexityScore: 1,
  cleanupBurden: 'Low',
  equipmentRequired: [],
  batchFriendly: false,
  leftoverFriendly: false, // wraps get soggy
  
  servings: 1,
  estimatedCostTotalGBP: 2.20,
  estimatedCostPerServingGBP: 2.20,
  macrosTotal: { calories: 480, protein: 22, carbs: 45, fats: 24 },
  macrosPerServing: { calories: 480, protein: 22, carbs: 45, fats: 24 },
  
  ingredients: [], method: [], tags: ['Vegan', 'Quick'],
  
  archetype: 'variety_anchor',
  freezerFriendly: false, reheatsWell: false, yieldsLeftovers: false,
  suitableFor: ['lunch']
};

// --- CATEGORY 3: MODERATE PROTEIN (20-30g) ANCHORS ---

export const lemonHerbChickenBowl: NormalizedRecipe = {
  id: "rec_wave1_chicken_bowl_01",
  sourceId: rawWave1Seed.id,
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  
  macroConfidence: 0.95, costConfidence: 0.95, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  
  title: 'Classic Lemon Herb Chicken & Quinoa',
  description: 'A perfectly balanced, moderate protein dinner. Not too heavy, not too light.',
  imageUrl: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?q=80&w=800&auto=format&fit=crop",
  
  activePrepMinutes: 10,
  totalMinutes: 30, // mostly simmering/baking
  complexityScore: 2, // Basic multi-tasking
  cleanupBurden: 'Medium',
  equipmentRequired: [],
  batchFriendly: true,
  leftoverFriendly: true,
  
  servings: 2,
  estimatedCostTotalGBP: 4.80,
  estimatedCostPerServingGBP: 2.40,
  macrosTotal: { calories: 960, protein: 64, carbs: 100, fats: 30 },
  macrosPerServing: { calories: 480, protein: 32, carbs: 50, fats: 15 }, // Moderate protein
  
  ingredients: [], method: [], tags: ['Omnivore', 'Balanced'],
  
  archetype: 'budget_workhorse',
  freezerFriendly: true, reheatsWell: true, yieldsLeftovers: true,
  suitableFor: ['dinner', 'lunch']
};

export const simpleChickpeaCurry: NormalizedRecipe = {
  id: "rec_wave1_chickpea_curry_01",
  sourceId: rawWave1Seed.id,
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  
  macroConfidence: 0.9, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  
  title: 'Simple Coconut Chickpea & Spinach Curry',
  description: 'A warm, comforting 25-minute vegan curry using store-cupboard heroes.',
  imageUrl: "https://images.unsplash.com/photo-1565557612088-71eab05dfaee?q=80&w=800&auto=format&fit=crop",
  
  activePrepMinutes: 10,
  totalMinutes: 25,
  complexityScore: 2,
  cleanupBurden: 'Low', // One pot!
  equipmentRequired: [],
  batchFriendly: true,
  leftoverFriendly: true,
  
  servings: 4,
  estimatedCostTotalGBP: 4.00,
  estimatedCostPerServingGBP: 1.00,
  macrosTotal: { calories: 1520, protein: 48, carbs: 160, fats: 80 },
  macrosPerServing: { calories: 380, protein: 12, carbs: 40, fats: 20 }, // Low-moderate protein
  
  ingredients: [], method: [], tags: ['Vegan', 'Budget'],
  
  archetype: 'Batch_Cook',
  freezerFriendly: true, reheatsWell: true, yieldsLeftovers: true,
  suitableFor: ['dinner', 'lunch']
};

// --- CATEGORY 4: PESCATARIAN SUPPORT ---

export const bakedCodMedVeg: NormalizedRecipe = {
  id: "rec_wave1_cod_veg_01",
  sourceId: rawWave1Seed.id,
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  
  macroConfidence: 0.95, costConfidence: 0.9, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  
  title: 'Baked Cod with Roasted Mediterranean Vegetables',
  description: 'A beautiful, light, produce-heavy weekend dinner. Low effort but feels premium.',
  imageUrl: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=800&auto=format&fit=crop",
  
  activePrepMinutes: 15,
  totalMinutes: 40, // Mostly roasting
  complexityScore: 2, // Chopping then waiting
  cleanupBurden: 'Low', // Traybake!
  equipmentRequired: [],
  batchFriendly: false,
  leftoverFriendly: false, // Reheated cod isn't ideal
  
  servings: 2,
  estimatedCostTotalGBP: 7.50, // Fish can be pricey
  estimatedCostPerServingGBP: 3.75,
  macrosTotal: { calories: 700, protein: 66, carbs: 40, fats: 32 },
  macrosPerServing: { calories: 350, protein: 33, carbs: 20, fats: 16 },
  
  ingredients: [], method: [], tags: ['Pescatarian', 'Healthy'],
  
  archetype: 'premium_meal',
  freezerFriendly: false, reheatsWell: false, yieldsLeftovers: false,
  suitableFor: ['dinner']
};

export const garlicButterPrawns: NormalizedRecipe = {
  id: "rec_wave1_garlic_prawns_01",
  sourceId: rawWave1Seed.id,
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  
  macroConfidence: 0.9, costConfidence: 0.9, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  
  title: 'Garlic Butter Prawns & Zucchini Noodles',
  description: 'Extremely quick, low-carb mid-week pescatarian dinner.',
  imageUrl: "https://images.unsplash.com/photo-1625943555419-56a2bb07c862?q=80&w=800&auto=format&fit=crop",
  
  activePrepMinutes: 10,
  totalMinutes: 15,
  complexityScore: 2, // Searing prawns requires full active pan attention
  cleanupBurden: 'Medium',
  equipmentRequired: ['spiralizer'], // Optional really, but good to flag
  batchFriendly: false,
  leftoverFriendly: false, 
  
  servings: 2,
  estimatedCostTotalGBP: 6.00,
  estimatedCostPerServingGBP: 3.00,
  macrosTotal: { calories: 520, protein: 48, carbs: 16, fats: 30 },
  macrosPerServing: { calories: 260, protein: 24, carbs: 8, fats: 15 },
  
  ingredients: [], method: [], tags: ['Pescatarian', 'Low-Carb', 'Quick'],
  
  archetype: 'variety_anchor',
  freezerFriendly: false, reheatsWell: false, yieldsLeftovers: false,
  suitableFor: ['dinner']
};

export const WAVE1_FIXTURES = [
  greekYogurtBerryBowl,
  cottageCheeseSourdough,
  tunaCannelliniSalad,
  smokedTofuWrap,
  lemonHerbChickenBowl,
  simpleChickpeaCurry,
  bakedCodMedVeg,
  garlicButterPrawns
];
