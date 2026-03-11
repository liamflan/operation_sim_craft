import { WAVE1_FIXTURES } from './planner/wave1Fixtures';
import { auditRecipeImage } from './planner/RecipeImageAuditor';
import { evaluateCandidate } from './planner/evaluator';
import { SlotContract, VarietyContext } from './planner/plannerTypes';

console.log("--- WAVE 1 LIVE VALIDATION ---");

// 1. Image Integrity Check
console.log("\n1. IMAGE INTEGRITY:");
WAVE1_FIXTURES.forEach(r => {
  const audit = auditRecipeImage(r.title, r.imageUrl);
  console.log(`- ${r.title}: [${audit.status}] ${audit.reasons.join(', ')}`);
});

// 2. Metadata & Slot Checks
console.log("\n2. METADATA & SLOT QUALITY:");
WAVE1_FIXTURES.forEach(r => {
  console.log(`- ${r.title}:`);
  console.log(`   Archetype: ${r.archetype} | Slots: ${r.suitableFor.join(', ')} | Tags: ${r.tags.join(', ')}`);
  console.log(`   Cost: £${r.estimatedCostPerServingGBP.toFixed(2)} | Macros: ${r.macrosPerServing.calories}kcal, ${r.macrosPerServing.protein}g P`);
});

// 3. Mock Planner Contracts
console.log("\n3. PLANNER SURFACE BEHAVIOUR:");

const baseVariety: VarietyContext = {
  repeatCount: 0,
  sameDayArchetypes: new Set(),
  consecutiveArchetypeMatch: false,
  archetypeDensity: 0
};

// Scenario A: Pescaterian Dinner, Moderate Budget
const pescContract: SlotContract = {
  planId: 'test_1', dayIndex: 0, date: '2026-03-12', slotType: 'dinner',
  macroTargets: { calories: { min: 400, max: 700, ideal: 500 }, protein: { min: 20, ideal: 35 } },
  budgetEnvelopeGBP: 5.00,
  dietaryBaseline: 'Pescatarian',
  repeatCap: 2, archetypeCaps: { 'premium_meal': 2, 'variety_anchor': 5 },
  leftoverPreference: 'prefer_fresh', batchCookPreference: 'allowed', rescueThresholdScore: 50,
  hardExclusions: [], tasteProfile: { anchorCount: 0, totalTagWeight: 0, totalArchetypeWeight: 0, preferredTags: {}, preferredArchetypes: {} }
};

console.log("\n--- Scenario A: Pescatarian Dinner (£5.00 limit, 35g protein ideal) ---");
WAVE1_FIXTURES.filter(r => r.suitableFor.includes('dinner')).forEach(r => {
  const result = evaluateCandidate(r, pescContract, baseVariety, [], 0, false);
  console.log(`${r.title}: Score ${result.scores.totalScore} ${result.isEligible ? '(Eligible)' : '(INVALID: ' + result.invalidationReason + ')'}`);
});

// Scenario B: Quick Breakfast limit
const breakfastContract: SlotContract = {
  planId: 'test_2', dayIndex: 0, date: '2026-03-12', slotType: 'breakfast',
  macroTargets: { calories: { min: 300, max: 500, ideal: 400 }, protein: { min: 15, ideal: 25 } },
  budgetEnvelopeGBP: 2.50,
  dietaryBaseline: 'Vegetarian',
  repeatCap: 2, archetypeCaps: {},
  leftoverPreference: 'prefer_fresh', batchCookPreference: 'allowed', rescueThresholdScore: 50,
  hardExclusions: [], tasteProfile: { anchorCount: 0, totalTagWeight: 0, totalArchetypeWeight: 0, preferredTags: {}, preferredArchetypes: {} }
};

console.log("\n--- Scenario B: Vegetarian Breakfast (£2.50 limit, 25g protein ideal) ---");
WAVE1_FIXTURES.filter(r => r.suitableFor.includes('breakfast')).forEach(r => {
  const result = evaluateCandidate(r, breakfastContract, baseVariety, [], 0, false);
  console.log(`${r.title}: Score ${result.scores.totalScore} ${result.isEligible ? '(Eligible)' : '(INVALID: ' + result.invalidationReason + ')'}`);
});
