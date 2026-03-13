import { checkHardSafetyOnly, checkHardEligibility } from '../evaluator';
import { curatedRoast, typicalDinnerContract } from '../plannerFixtures';
import { VarietyContext, SlotContract } from '../plannerTypes';

const defaultVariety: VarietyContext = {
  repeatCount: 0,
  archetypeDensity: 0,
  sameDayArchetypes: new Set(),
  sameDayRecipeIds: new Set(),
  consecutiveArchetypeMatch: false,
  cuisineSaturationCount: 0
};

describe('Planner Reliability Pass - Safety vs Preferences', () => {
  
  it('identifies recipes that fail soft preferences but are still hard-safe', () => {
    // Modify contract to have strict budget (£1.00)
    // Curated Roast costs £1.50
    const strictContract: SlotContract = { 
      ...typicalDinnerContract, 
      budgetEnvelopeGBP: 1.00 
    };

    // checkHardEligibility should fail (at Tier 1, budget multiplier is small)
    const eligibilityFailures = checkHardEligibility(curatedRoast, strictContract, defaultVariety, 1);
    expect(eligibilityFailures).toContain('budget_delta_exceeded');

    // BUT checkHardSafetyOnly should PASS because budget is a preference/relaxation, not a safe gate
    const safetyFailures = checkHardSafetyOnly(curatedRoast, strictContract);
    expect(safetyFailures).toHaveLength(0);
  });

  it('strictly blocks hard-unsafe recipes even in safety check', () => {
    // 1. Dietary mismatch
    const veganContract: SlotContract = {
      ...typicalDinnerContract,
      dietaryBaseline: 'Vegan'
    };
    // Roast contains chicken (Omnivore)
    const safetyFailures = checkHardSafetyOnly(curatedRoast, veganContract);
    expect(safetyFailures).toContain('dietary_mismatch');

    // 2. Exclusion match
    const excludedContract: SlotContract = {
      ...typicalDinnerContract,
      hardExclusions: ['chicken']
    };
    const exclusionFailures = checkHardSafetyOnly(curatedRoast, excludedContract);
    expect(exclusionFailures).toContain('exclusion_ingredient_match');

    // 3. Not planner usable
    const brokenRecipe = { ...curatedRoast, plannerUsable: false };
    const usabilityFailures = checkHardSafetyOnly(brokenRecipe, typicalDinnerContract);
    expect(usabilityFailures).toContain('not_planner_usable');
  });

  it('ensures Tier 4 rescue still honors suitability gates correctly', () => {
    const breakfastOnly = { ...curatedRoast, suitableFor: ['breakfast'] as any };
    
    // Dinner slot regen
    const dinnerContract: SlotContract = { ...typicalDinnerContract, slotType: 'dinner' };
    
    // evaluator.ts Tier 4 allows 'lunch' recipes to fill 'dinner', but NOT 'breakfast'
    const tier4Failures = checkHardEligibility(breakfastOnly, dinnerContract, defaultVariety, 4);
    expect(tier4Failures).toContain('no_slot_match');

    const lunchRecipe = { ...curatedRoast, suitableFor: ['lunch'] as any };
    const tier4LunchFailures = checkHardEligibility(lunchRecipe, dinnerContract, defaultVariety, 4);
    expect(tier4LunchFailures).not.toContain('no_slot_match');
  });

  describe('Same-Day Variety & Duplicate Consistency', () => {
    it('hard-blocks the exact same recipe on the same day', () => {
      const varietyWithId: VarietyContext = {
        ...defaultVariety,
        sameDayRecipeIds: new Set([curatedRoast.id])
      };
      
      const failures = checkHardEligibility(curatedRoast, typicalDinnerContract, varietyWithId);
      expect(failures).toContain('same_day_duplicate');
    });

    it('does NOT hard-block different recipes with the same archetype (soft preference)', () => {
      const varietyWithArchetype: VarietyContext = {
        ...defaultVariety,
        sameDayArchetypes: new Set([curatedRoast.archetype])
      };

      // checkHardEligibility should NOT block it
      const failures = checkHardEligibility(curatedRoast, typicalDinnerContract, varietyWithArchetype);
      expect(failures).not.toContain('same_day_duplicate');
    });
  });
});
