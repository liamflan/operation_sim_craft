import { mockFallbackPlan } from './data/engine';
import { globalRepair, validatePlannerOutput } from './data/plannerValidation';
import { MOCK_RECIPES } from './data/seed';
import { FULL_RECIPE_LIST } from './data/planner/recipeRegistry';

const mockUser = {
  id: 'test',
  name: 'Tester',
  targetMacros: { calories: 2000, protein: 150, carbs: 200, fats: 70 },
  budgetWeekly: 50,
  dietaryPreference: 'Omnivore' as any,
  allergies: [],
};

const mockRoutine = {
  Mon: { breakfast: 'plan', lunch: 'plan', dinner: 'plan' },
  Tue: { breakfast: 'plan', lunch: 'plan', dinner: 'plan' },
  Wed: { breakfast: 'skip', lunch: 'skip', dinner: 'skip' },
  Thu: { breakfast: 'skip', lunch: 'skip', dinner: 'skip' },
  Fri: { breakfast: 'skip', lunch: 'skip', dinner: 'skip' },
  Sat: { breakfast: 'skip', lunch: 'skip', dinner: 'skip' },
  Sun: { breakfast: 'skip', lunch: 'skip', dinner: 'skip' },
};

function testFallbackVariety() {
  console.log('Testing Fallback Variety...');
  const plan = mockFallbackPlan(mockUser as any, mockRoutine as any, []);
  
  for (const dayPlan of plan.days) {
    const ids = new Set();
    const slots = ['breakfast', 'lunch', 'dinner'];
    for (const s of slots) {
      const val = (dayPlan as any)[s];
      if (val && val.recipeId) {
        if (ids.has(val.recipeId)) {
          throw new Error(`Fallback VARIETY VIOLATION on ${dayPlan.day}: ${val.recipeId} duplicate`);
        }
        ids.add(val.recipeId);
      }
    }
  }
  console.log('✅ Fallback Variety Passed');
}

function testRepairVariety() {
  console.log('Testing Repair Variety...');
  const input = {
    profile: { dietaryPreference: 'Omnivore', allergies: [], targetCalories: 2000, targetProteinG: 150, goalTags: [], weeklyBudgetGBP: 50 },
    slotsToFill: [{ day: 'Mon', slot: 'lunch' }],
    candidates: [
      { id: 'r1', title: 'Recipe 1', suitableFor: ['lunch'], macros: { protein: 20, calories: 500 }, estimatedCostGBP: 5, archetype: 'quick_default', pantryIngredients: [], tags: [] },
      { id: 'r2', title: 'Recipe 2', suitableFor: ['lunch'], macros: { protein: 20, calories: 500 }, estimatedCostGBP: 5, archetype: 'quick_default', pantryIngredients: [], tags: [] },
    ],
    preferences: { maxRecipeRepeatsPerWeek: 2, prioritisePantry: false, preferVariety: true },
    composition: { archetypeCounts: {}, archetypeRepeatCaps: { 'quick_default': 99 } }
  };

  const repeatCounts = new Map();
  const archetypeCounts = new Map();
  const assignedToday = new Set(['r1']); // r1 already assigned to Mon breakfast
  
  const repairs = globalRepair('Mon' as any, 'lunch' as any, input as any, repeatCounts, archetypeCounts, 0, 0, undefined, undefined, 0, assignedToday);
  
  if (repairs?.startsWith('r1')) {
    throw new Error(`Repair VARIETY VIOLATION: r1 was assigned even though it was in assignedToday`);
  }
  console.log('✅ Repair Variety Passed (Picked r2 or fallback)');
}

function testValidationCompliance() {
  console.log('Testing Validation Compliance Reporting...');
  const input = {
    profile: { targetCalories: 2000, targetProteinG: 150, weeklyBudgetGBP: 50 },
    slotsToFill: [{ day: 'Mon', slot: 'breakfast' }, { day: 'Mon', slot: 'lunch' }],
    candidates: [
      { id: 'r1', title: 'R1', suitableFor: ['breakfast', 'lunch'], macros: { protein: 10, calories: 100 }, estimatedCostGBP: 1, archetype: 'quick_default', pantryIngredients: [], tags: [] }
    ],
    preferences: { maxRecipeRepeatsPerWeek: 1 },
    composition: { archetypeCounts: {}, archetypeRepeatCaps: { 'quick_default': 99 } }
  };

  const raw = {
    assignments: [
      { day: 'Mon', slot: 'breakfast', recipeId: 'r1' },
      { day: 'Mon', slot: 'lunch', recipeId: 'r1' } // Injection: Same day duplicate + Repeat cap breach
    ]
  };

  const result = validatePlannerOutput(raw as any, input as any);
  const comp = result.compliance;

  if (comp) {
    if (comp.sameDayVarietyPassed !== false) throw new Error('Failed to detect same-day variety violation');
    if (comp.nominalRepeatCapsPassed !== false) throw new Error('Failed to detect nominal repeat cap violation');
    if (comp.meetsTargetCalories !== false) throw new Error('Failed to detect calorie shortfall (soft compliance)');
  } else {
    throw new Error('Compliance object missing from result');
  }
  
  console.log('✅ Validation Compliance Reporting Passed');
}

try {
  testFallbackVariety();
  testRepairVariety();
  testValidationCompliance();
  console.log('\nALL 18E VERIFICATION TESTS PASSED');
} catch (e) {
  console.error('\n❌ TEST FAILED');
  console.error(e);
  process.exit(1);
}
