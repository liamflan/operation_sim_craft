import { evaluateCandidate, checkHardEligibility, analyzePoolCollapse, determineRescueAction } from '../evaluator';
import { curatedRoast, curatedPasta, typicalDinnerContract, exhaustedBudgetDinnerContract } from '../plannerFixtures';
import { NormalizedRecipe, SlotContract } from '../plannerTypes';

describe('Planner Evaluator', () => {
  it('passes hard eligibility when conditions are met', () => {
    const failures = checkHardEligibility(curatedRoast, typicalDinnerContract, {}, 0);
    expect(failures).toHaveLength(0);
  });

  it('fails hard eligibility when budget is exceeded', () => {
    // Roast costs £3.00, budget is £1.50
    const failures = checkHardEligibility(curatedRoast, exhaustedBudgetDinnerContract, {}, 0);
    expect(failures).toContain('budget_delta_exceeded');
  });

  it('fails hard eligibility when protein minimum is not met', () => {
    // Pasta has 12g protein, typical dinner expects 25g
    const failures = checkHardEligibility(curatedPasta, typicalDinnerContract, {}, 0);
    expect(failures).toContain('protein_minimum_failed');
  });

  it('fails hard eligibility when calorie minimum is severely missed', () => {
    const lowCaloriePasta = {
      ...curatedPasta,
      macrosPerServing: { ...curatedPasta.macrosPerServing, calories: 200 } // Typical dinner min is 400 * 0.75 = 300
    };
    const failures = checkHardEligibility(lowCaloriePasta, typicalDinnerContract, {}, 0);
    expect(failures).toContain('calorie_minimum_failed');
  });
  
  it('fails hard eligibility when slot suitability is wrong', () => {
    const breakfastOnly: NormalizedRecipe = {
      ...curatedPasta,
      suitableFor: ['breakfast']
    };
    const failures = checkHardEligibility(breakfastOnly, typicalDinnerContract, {}, 0);
    expect(failures).toContain('no_slot_match');
  });

  it('calculates full scoring successfully for a valid candidate', () => {
    const result = evaluateCandidate(curatedRoast, typicalDinnerContract, {}, 0);
    expect(result.candidate).not.toBeNull();
    expect(result.failureReasons).toHaveLength(0);
    
    const candidate = result.candidate!;
    // Total score calculation check 
    // Budget is 3.00 vs 4.00 limit => 50 points * (1 - 3/4) = 50 * 0.25 = 12.5 off 100 => ~88
    // Protein is 40 vs 35 => delta 5 => 100 - (5/35)*100 = 85
    // Penalties are 0
    expect(candidate.scores.totalScore).toBeGreaterThan(70);
    expect(candidate.penalties.repeatPenalty).toBe(0);
    expect(candidate.penalties.archetypePenalty).toBe(0);
  });

  it('applies penalties for repeating recipes and archetype density', () => {
    const customContract = { ...typicalDinnerContract, repeatCap: 5 };
    // We already have 1 Staple, and we repeat this recipe once
    const result = evaluateCandidate(curatedRoast, customContract, { 'Staple': 1 }, 1);
    const candidate = result.candidate!;
    
    // 1 repeat = 15 penalty, 1 Staple density = 5 penalty. Total 20 penalty.
    expect(candidate.penalties.repeatPenalty).toBe(15);
    expect(candidate.penalties.archetypePenalty).toBe(5);
  });

  it('analyzes a multi-cause pool collapse correctly', () => {
    // Roast fails budget, Pasta fails protein.
    const failures = analyzePoolCollapse([curatedRoast, curatedPasta], exhaustedBudgetDinnerContract, {});
    expect(failures).toContain('budget_delta_exceeded');
    expect(failures).toContain('protein_minimum_failed');
  });

  it('determines gemini_generation_needed when candidate pool is empty', () => {
    const action = determineRescueAction([], [curatedRoast, curatedPasta], exhaustedBudgetDinnerContract, {});
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
    const result = evaluateCandidate(poorMatch, customContract, {}, 2); // Repeat penalty pushes it over edge
    if (result.candidate) {
      const action = determineRescueAction([result.candidate], [poorMatch], customContract, {});
      expect(action.action).toBe('soft_rescue_needed');
    }
  });
});
