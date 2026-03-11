/**
 * wave2Fixtures.ts
 * Phase 21.2: Pilot Batch Wave 2 recipes targeting specific coverage gaps.
 * All recipes herein strictly use Phase 21 canonical metadata.
 */

import { NormalizedRecipe, RawRecipeInput } from './plannerTypes';

const rawWave2Seed: RawRecipeInput = {
  id: "raw_wave2_seed",
  sourceFamily: 'system',
  sourceMethod: 'seeded',
  requestedByActorType: 'admin_seed',
  requestedByActorId: 'system_core',
  rawPayload: { type: 'internal_seed', dataId: 'wave2' },
  createdAt: new Date(),
  status: 'pending_normalization'
};

// --- CATEGORY 1: WEEKEND PROJECTS & SPLURGES ---

const w2r1: NormalizedRecipe = {
  id: 'w2_r1_lamb',
  sourceId: rawWave2Seed.id,
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  
  macroConfidence: 1.0, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  
  title: 'Slow-Roast Lamb Shoulder with Roots',
  description: 'A beautiful weekend centerpiece meal. Requires very little active effort but hours of low and slow roasting.',
  
  activePrepMinutes: 25,
  totalMinutes: 180,
  complexityScore: 4,
  cleanupBurden: 'High',
  equipmentRequired: [],
  batchFriendly: true,
  leftoverFriendly: true,
  
  servings: 4,
  estimatedCostTotalGBP: 30.00,
  estimatedCostPerServingGBP: 7.50,
  macrosTotal: { calories: 3400, protein: 180, carbs: 160, fats: 220 },
  macrosPerServing: { calories: 850, protein: 45, carbs: 40, fats: 55 },
  
  ingredients: [
    { name: 'lamb shoulder', amount: 1.2, unit: 'kg', canonicalIngredientId: 'i_lamb' },
    { name: 'potato', amount: 800, unit: 'g', canonicalIngredientId: 'i_potato' }
  ],
  method: [], 
  tags: ['Premium', 'Weekend', 'Slow Roast', 'High Protein'],
  
  archetype: 'premium_meal',
  freezerFriendly: true, reheatsWell: true, yieldsLeftovers: true,
  suitableFor: ['dinner']
};

const w2r2: NormalizedRecipe = {
  id: 'w2_r2_risotto',
  sourceId: rawWave2Seed.id,
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  
  macroConfidence: 1.0, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  
  title: 'Wild Mushroom & Truffle Risotto',
  description: 'A rich, earthy Italian classic that requires constant love and stirring.',
  
  activePrepMinutes: 40,
  totalMinutes: 65,
  complexityScore: 4,
  cleanupBurden: 'Medium',
  equipmentRequired: [],
  batchFriendly: false,
  leftoverFriendly: true,
  
  servings: 2,
  estimatedCostTotalGBP: 9.60,
  estimatedCostPerServingGBP: 4.80,
  macrosTotal: { calories: 1200, protein: 30, carbs: 160, fats: 44 },
  macrosPerServing: { calories: 600, protein: 15, carbs: 80, fats: 22 },
  
  ingredients: [
    { name: 'arborio rice', amount: 200, unit: 'g', canonicalIngredientId: 'i_rice_arborio' },
    { name: 'mixed mushrooms', amount: 300, unit: 'g', canonicalIngredientId: 'i_mushroom' }
  ],
  method: [], 
  tags: ['Premium', 'Italian', 'Vegetarian'],
  
  archetype: 'premium_meal',
  freezerFriendly: false, reheatsWell: true, yieldsLeftovers: true,
  suitableFor: ['dinner']
};


// --- CATEGORY 2: PASSIVE BULK / TRAYBAKES ---

const w2r3: NormalizedRecipe = {
  id: 'w2_r3_sausage_tray',
  sourceId: rawWave2Seed.id,
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  
  macroConfidence: 1.0, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  
  title: 'Sheet Pan Sausage & Sweet Potato',
  description: 'Throw it all on a tray and walk away. Unbeatable effort-to-flavor ratio.',
  
  activePrepMinutes: 10,
  totalMinutes: 45,
  complexityScore: 2,
  cleanupBurden: 'Low',
  equipmentRequired: [],
  batchFriendly: true,
  leftoverFriendly: true,
  
  servings: 4,
  estimatedCostTotalGBP: 8.80,
  estimatedCostPerServingGBP: 2.20,
  macrosTotal: { calories: 2600, protein: 112, carbs: 240, fats: 128 },
  macrosPerServing: { calories: 650, protein: 28, carbs: 60, fats: 32 },
  
  ingredients: [
    { name: 'sausage', amount: 12, unit: 'link', canonicalIngredientId: 'i_sausage' },
    { name: 'sweet potato', amount: 800, unit: 'g', canonicalIngredientId: 'i_potato_sweet' }
  ],
  method: [], 
  tags: ['Traybake', 'Meal Prep', 'Low Effort', 'High Protein'],
  
  archetype: 'Batch_Cook',
  freezerFriendly: true, reheatsWell: true, yieldsLeftovers: true,
  suitableFor: ['dinner', 'lunch']
};

const w2r4: NormalizedRecipe = {
  id: 'w2_r4_caprese_chicken',
  sourceId: rawWave2Seed.id,
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  
  macroConfidence: 1.0, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  
  title: 'Oven-Baked Caprese Chicken & Veg',
  description: 'Chicken breast topped with mozzarella and tomatoes, roasted alongside zucchini.',
  
  activePrepMinutes: 10,
  totalMinutes: 50,
  complexityScore: 2,
  cleanupBurden: 'Low',
  equipmentRequired: [],
  batchFriendly: true,
  leftoverFriendly: true,
  
  servings: 4,
  estimatedCostTotalGBP: 12.40,
  estimatedCostPerServingGBP: 3.10,
  macrosTotal: { calories: 2080, protein: 220, carbs: 80, fats: 96 },
  macrosPerServing: { calories: 520, protein: 55, carbs: 20, fats: 24 },
  
  ingredients: [
    { name: 'chicken breast', amount: 800, unit: 'g', canonicalIngredientId: 'i2' },
    { name: 'mozzarella', amount: 200, unit: 'g', canonicalIngredientId: 'i_cheese_mozz' }
  ],
  method: [], 
  tags: ['Traybake', 'High Protein', 'Italian'],
  
  archetype: 'Batch_Cook',
  freezerFriendly: true, reheatsWell: true, yieldsLeftovers: true,
  suitableFor: ['dinner', 'lunch']
};


// --- CATEGORY 3: VEGAN CORE ANCHORS ---

const w2r5: NormalizedRecipe = {
  id: 'w2_r5_lentil_stew',
  sourceId: rawWave2Seed.id,
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  
  macroConfidence: 1.0, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  
  title: 'Hearty Lentil & Vegetable Stew',
  description: 'A deeply comforting, budget-friendly staple packed with fiber.',
  
  activePrepMinutes: 15,
  totalMinutes: 40,
  complexityScore: 2,
  cleanupBurden: 'Medium',
  equipmentRequired: [],
  batchFriendly: true,
  leftoverFriendly: true,
  
  servings: 4,
  estimatedCostTotalGBP: 4.40,
  estimatedCostPerServingGBP: 1.10,
  macrosTotal: { calories: 1800, protein: 88, carbs: 300, fats: 32 },
  macrosPerServing: { calories: 450, protein: 22, carbs: 75, fats: 8 },
  
  ingredients: [
    { name: 'green lentils', amount: 320, unit: 'g', canonicalIngredientId: 'i_lentil_green' },
    { name: 'vegetable stock', amount: 1600, unit: 'ml', canonicalIngredientId: 'i_stock_veg' }
  ],
  method: [], 
  tags: ['Vegan', 'Staple', 'Budget'],
  
  archetype: 'budget_workhorse',
  freezerFriendly: true, reheatsWell: true, yieldsLeftovers: true,
  suitableFor: ['dinner', 'lunch']
};

const w2r6: NormalizedRecipe = {
  id: 'w2_r6_black_bean_quinoa',
  sourceId: rawWave2Seed.id,
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  
  macroConfidence: 1.0, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  
  title: 'Spicy Black Bean & Quinoa Bowl',
  description: 'A vibrant, zesty bowl that comes together in under 30 minutes.',
  
  activePrepMinutes: 10,
  totalMinutes: 25,
  complexityScore: 2,
  cleanupBurden: 'Low',
  equipmentRequired: [],
  batchFriendly: true,
  leftoverFriendly: true,
  
  servings: 2,
  estimatedCostTotalGBP: 3.20,
  estimatedCostPerServingGBP: 1.60,
  macrosTotal: { calories: 1020, protein: 36, carbs: 170, fats: 24 },
  macrosPerServing: { calories: 510, protein: 18, carbs: 85, fats: 12 },
  
  ingredients: [
    { name: 'black beans', amount: 240, unit: 'g', canonicalIngredientId: 'i_bean_black' },
    { name: 'quinoa', amount: 120, unit: 'g', canonicalIngredientId: 'i_quinoa' }
  ],
  method: [], 
  tags: ['Vegan', 'Mexican', 'Quick'],
  
  archetype: 'variety_anchor',
  freezerFriendly: false, reheatsWell: true, yieldsLeftovers: true,
  suitableFor: ['dinner', 'lunch']
};


// --- CATEGORY 4: BUDGET WORKHORSE LUNCHES ---

const w2r7: NormalizedRecipe = {
  id: 'w2_r7_chickpea_sandwich',
  sourceId: rawWave2Seed.id,
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  
  macroConfidence: 1.0, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  
  title: 'Smashed Chickpea & Dill Sandwich',
  description: 'Vegan alternative to tuna salad. Fresh, herby, and insanely cheap.',
  
  activePrepMinutes: 10,
  totalMinutes: 10,
  complexityScore: 1,
  cleanupBurden: 'Low',
  equipmentRequired: [],
  batchFriendly: false,
  leftoverFriendly: false,
  
  servings: 1,
  estimatedCostTotalGBP: 0.85,
  estimatedCostPerServingGBP: 0.85,
  macrosTotal: { calories: 420, protein: 16, carbs: 65, fats: 12 },
  macrosPerServing: { calories: 420, protein: 16, carbs: 65, fats: 12 },
  
  ingredients: [
    { name: 'chickpeas', amount: 100, unit: 'g', canonicalIngredientId: 'i_chickpea' },
    { name: 'whole wheat bread', amount: 2, unit: 'slice', canonicalIngredientId: 'i15' }
  ],
  method: [], 
  tags: ['Vegan', 'Quick', 'No Cook', 'Budget'],
  
  archetype: 'budget_workhorse',
  freezerFriendly: false, reheatsWell: false, yieldsLeftovers: false,
  suitableFor: ['lunch']
};

const w2r8: NormalizedRecipe = {
  id: 'w2_r8_egg_salad_wrap',
  sourceId: rawWave2Seed.id,
  status: 'approved',
  plannerUsable: true,
  libraryVisible: true,
  
  macroConfidence: 1.0, costConfidence: 1.0, ingredientMappingConfidence: 1.0, servingConfidence: 1.0,
  normalizationWarnings: [],
  
  title: 'Quick Egg Salad Lettuce Wraps',
  description: 'Classic creamy egg salad served in crisp gem lettuce leaves for a low-carb lunch.',
  
  activePrepMinutes: 10,
  totalMinutes: 15,
  complexityScore: 1,
  cleanupBurden: 'Low',
  equipmentRequired: [],
  batchFriendly: false,
  leftoverFriendly: false,
  
  servings: 1,
  estimatedCostTotalGBP: 0.95,
  estimatedCostPerServingGBP: 0.95,
  macrosTotal: { calories: 350, protein: 20, carbs: 8, fats: 26 },
  macrosPerServing: { calories: 350, protein: 20, carbs: 8, fats: 26 },
  
  ingredients: [
    { name: 'egg', amount: 3, unit: 'item', canonicalIngredientId: 'i9' },
    { name: 'gem lettuce', amount: 4, unit: 'leaf', canonicalIngredientId: 'i_gem_lettuce' }
  ],
  method: [], 
  tags: ['Vegetarian', 'Low Carb', 'Quick', 'Budget'],
  
  archetype: 'budget_workhorse',
  freezerFriendly: false, reheatsWell: false, yieldsLeftovers: false,
  suitableFor: ['lunch']
};

export const WAVE2_FIXTURES: NormalizedRecipe[] = [
  w2r1, w2r2, w2r3, w2r4, w2r5, w2r6, w2r7, w2r8
];
