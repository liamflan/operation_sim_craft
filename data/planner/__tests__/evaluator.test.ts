import { evaluateCandidate, checkHardEligibility, analyzePoolCollapse, determineRescueAction } from '../evaluator';
import { curatedRoast, curatedPasta, typicalDinnerContract, exhaustedBudgetDinnerContract } from '../plannerFixtures';
import { NormalizedRecipe, SlotContract, VarietyContext } from '../plannerTypes';

const defaultVariety: VarietyContext = {
  repeatCount: 0,
  archetypeDensity: 0,
  sameDayArchetypes: new Set(),
  consecutiveArchetypeMatch: false
};

describe('Planner Evaluator', () => {
  it('passes hard eligibility when conditions are met', () => {
    const failures = checkHardEligibility(curatedRoast, typicalDinnerContract, defaultVariety);
    expect(failures).toHaveLength(0);
  });

  it('fails hard eligibility when budget is exceeded', () => {
    // Roast costs £1.50, budget is mocked to £1.00 to force failure
    const strictBudgetContract = { ...exhaustedBudgetDinnerContract, budgetEnvelopeGBP: 1.00 };
    const failures = checkHardEligibility(curatedRoast, strictBudgetContract, defaultVariety);
    expect(failures).toContain('budget_delta_exceeded');
  });

  it('fails hard eligibility when protein minimum is not met', () => {
    // Pasta has 12g protein, typical dinner expects 25g
    const failures = checkHardEligibility(curatedPasta, typicalDinnerContract, defaultVariety);
    expect(failures).toContain('protein_minimum_failed');
  });

  it('fails hard eligibility when calorie minimum is severely missed', () => {
    const lowCaloriePasta = {
      ...curatedPasta,
      macrosPerServing: { ...curatedPasta.macrosPerServing, calories: 200 } // Typical dinner min is 400 * 0.75 = 300
    };
    const failures = checkHardEligibility(lowCaloriePasta, typicalDinnerContract, defaultVariety);
    expect(failures).toContain('calorie_minimum_failed');
  });
  
  it('fails hard eligibility when slot suitability is wrong', () => {
    const breakfastOnly: NormalizedRecipe = {
      ...curatedPasta,
      suitableFor: ['breakfast']
    };
    const failures = checkHardEligibility(breakfastOnly, typicalDinnerContract, defaultVariety);
    expect(failures).toContain('no_slot_match');
  });

  it('calculates full scoring successfully for a valid candidate', () => {
    const result = evaluateCandidate(curatedRoast, typicalDinnerContract, defaultVariety);
    expect(result.candidate).not.toBeNull();
    expect(result.failureReasons).toHaveLength(0);
    
    const candidate = result.candidate!;
    // Budget is £3 vs £4 limit = ~81 budgetFit. Macro fits well. Variety defaults 100.
    expect(candidate.scores.totalScore).toBeGreaterThan(70);
    expect(candidate.penalties.repeatPenalty).toBe(0);
    expect(candidate.penalties.archetypePenalty).toBe(0);
  });

  it('applies penalties for repeating recipes, archetype density, and clustering', () => {
    const customContract = { ...typicalDinnerContract, repeatCap: 5 };
    // Context: repeated 1 time, archetype density 1, same-day matching archetype, consecutive archetype match
    const penaltyVariety: VarietyContext = {
      repeatCount: 1, // -20 variety, -15 absolute repeat
      archetypeDensity: 1, // -5 variety, -5 absolute archetype
      sameDayArchetypes: new Set([curatedRoast.archetype]), // -20 variety
      consecutiveArchetypeMatch: true // -15 variety
    };

    const result = evaluateCandidate(curatedRoast, customContract, penaltyVariety);
    const candidate = result.candidate!;
    
    expect(candidate.penalties.repeatPenalty).toBe(15);
    expect(candidate.penalties.archetypePenalty).toBe(5);

    // Variety fit score: 100 - (1*20) - (1*5) - 20 - 15 = 40.
    expect(candidate.scores.varietyFitScore).toBe(40);
  });

  it('analyzes a multi-cause pool collapse correctly', () => {
    // Roast fails budget (£1.50 vs £1.00), Pasta fails protein.
    const strictBudgetContract = { ...exhaustedBudgetDinnerContract, budgetEnvelopeGBP: 1.00 };
    const failures = analyzePoolCollapse([curatedRoast, curatedPasta], strictBudgetContract, {});
    expect(failures).toContain('budget_delta_exceeded');
    expect(failures).toContain('protein_minimum_failed');
  });

  it('determines gemini_generation_needed when candidate pool is empty', () => {
    const strictBudgetContract = { ...exhaustedBudgetDinnerContract, budgetEnvelopeGBP: 1.00 };
    const action = determineRescueAction([], [curatedRoast, curatedPasta], strictBudgetContract, {});
    expect(action.action).toBe('gemini_generation_needed');
    expect(action.reasons).toContain('budget_delta_exceeded');
  });

  it('determines soft_rescue_needed when best candidate is below threshold', () => {
    const poorMatch = {
      ...curatedRoast,
      macrosPerServing: { calories: 450, protein: 26, carbs: 10, fats: 10 },
      estimatedCostPerServingGBP: 3.90 // Barely under 4.00, terrible macro fit
    };
    
    const customContract = { ...typicalDinnerContract, repeatCap: 5 };
    const poorVariety = { ...defaultVariety, repeatCount: 2 }; // heavy repeat penalty guarantees drop below threshold
    
    const result = evaluateCandidate(poorMatch, customContract, poorVariety); 
    if (result.candidate) {
      const action = determineRescueAction([result.candidate], [poorMatch], customContract, {});
      expect(action.action).toBe('soft_rescue_needed');
    }
  });
});
