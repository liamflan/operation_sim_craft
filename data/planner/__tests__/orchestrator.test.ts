import { generatePlan } from '../orchestrator';
import { 
  curatedRoast, 
  curatedPasta, 
  generatedLentilStew, 
  typicalDinnerContract, 
  exhaustedBudgetDinnerContract 
} from '../plannerFixtures';
import { SlotContract, NormalizedRecipe, PlannedMealAssignment } from '../plannerTypes';

describe('Planner Orchestrator', () => {
  const recipes: NormalizedRecipe[] = [curatedRoast, curatedPasta];

  it('fills a single slot normally when valid candidates exist', () => {
    const contracts: SlotContract[] = [typicalDinnerContract];
    
    const { assignments, diagnostics } = generatePlan(contracts, recipes, 'planner_autofill');
    
    expect(assignments).toHaveLength(1);
    expect(diagnostics).toHaveLength(1);

    const assignment = assignments[0];
    const diagnostic = diagnostics[0];

    // Assert the logic
    expect(assignment.state).toBe('proposed');
    expect(assignment.recipeId).toBe(curatedRoast.id); // Roast fits the protein requirements better than pasta
    expect(assignment.metrics.autoFilledBy).toBe('planner_autofill');
    
    // Assert decision snapshot integrity
    expect(assignment.decisionSnapshot).toBeDefined();
    expect(assignment.decisionSnapshot!.proteinTargetAtTimeOfDecision).toBe(typicalDinnerContract.macroTargets.protein.ideal);

    // Assert diagnostics
    expect(diagnostic.actionTaken).toBe('filled_normally');
    expect(diagnostic.eligibleCount).toBe(1); // Pasta fails protein minimum for typical dinner
    expect(diagnostic.rejectedCount).toBe(1);
    
    // NEW RULE ASSERTION: Since 1 meal costs £1.50, and wallet is £50, dynamic envelope for the single slot is (£50/1)*1.2 = £60
    expect(assignment.decisionSnapshot!.budgetConstraintAtTimeOfDecision).toBe(60); 
  });

  it('detects pool collapse and triggers a gemini regeneration flow', () => {
    const contracts: SlotContract[] = [exhaustedBudgetDinnerContract];
    
    // We pass a very low global budget of £1.00. 
    // CuratedRoast (£1.50) will fail because dynamic envelope is (£1.00 / 1 * 1.2) = £1.20
    const { assignments, diagnostics } = generatePlan(contracts, recipes, 'planner_autofill', [], 1.00);
    
    expect(assignments).toHaveLength(1);
    const assignment = assignments[0];
    const diagnostic = diagnostics[0];

    // Engine should put it in the generating state
    expect(assignment.state).toBe('generating');
    expect(assignment.recipeId).toBeNull();
    
    // Metrics should log the history of WHY it failed
    expect(assignment.metrics.priorFailedCandidateCounts).toBeDefined();
    expect(assignment.metrics.priorFailedCandidateCounts!['budget_delta_exceeded']).toBeGreaterThan(0);

    expect(diagnostic.rescueTriggered).toBe(true);
    expect(diagnostic.actionTaken).toBe('gemini_generation_needed');
  });

  it('assigns a rescue recipe normally if it is passed in the pool', () => {
    const contracts: SlotContract[] = [exhaustedBudgetDinnerContract];
    // We add the lentil stew to the pool. It satisfies both £1.50 and 35g protein.
    const rescuePool = [...recipes, generatedLentilStew];
    
    // Again, we use a low global budget to force the expensive ones out
    // Global £1.00 -> envelope £1.20. Roast (£1.50) fails. Pasta fails protein. 
    // Lentil (£0.50) passes everything.
    const { assignments, diagnostics } = generatePlan(contracts, rescuePool, 'planner_autofill', [], 1.00);
    
    expect(assignments).toHaveLength(1);
    const assignment = assignments[0];
    const diagnostic = diagnostics[0];

    // Filled successfully without needing to trigger a new generation
    expect(assignment.state).toBe('proposed');
    expect(assignment.recipeId).toBe(generatedLentilStew.id);
    expect(diagnostic.actionTaken).toBe('filled_normally');
  });

  it('simulates a full week generation tracking constraints', () => {
    // Generate 7 identical dinner contracts for a mock week, but map them to different days
    const weekContracts: SlotContract[] = Array.from({ length: 7 }).map((_, i) => ({
      ...typicalDinnerContract,
      dayIndex: i, // Monday, Tuesday, Wednesday...
    }));

    const { assignments, diagnostics } = generatePlan(weekContracts, recipes, 'planner_autofill');

    expect(assignments).toHaveLength(7);
    
    // The first assignment should be Roast
    expect(assignments[0].recipeId).toBe(curatedRoast.id);
    
    // Since repeatCap is 1 on the contract, the second instance should fail
    // We expect the later days to collapse or soft-rescue if they run out of viable meals
    // Because we only have 2 recipes, and Pasta fails protein minimum, days 1-6 will collapse.
    expect(diagnostics[0].actionTaken).toBe('filled_normally');
    expect(diagnostics[1].actionTaken).toBe('gemini_generation_needed');
  });

  it('preserves existing locked assignments and updates counts correctly', () => {
    // We give the second day a forgiving protein minimum so curatedPasta can pass
    const forgivingContract: SlotContract = { 
      ...typicalDinnerContract, 
      dayIndex: 1, 
      macroTargets: { ...typicalDinnerContract.macroTargets, protein: { min: 10, ideal: 25 } } 
    };
    
    const contracts: SlotContract[] = [typicalDinnerContract, forgivingContract];
    
    // Day 0 is already locked with Roast
    const lockedAssignment: PlannedMealAssignment = {
      id: 'assign_wk42_0_dinner', planId: 'week_42', dayIndex: 0, date: '2026-03-09', slotType: 'dinner',
      state: 'locked', candidateId: 'cand_1', recipeId: curatedRoast.id, isBatchCookOrigin: false,
      metrics: { swappedCount: 0, autoFilledBy: 'user_manual' }
    };

    // We only pass the second contract to represent generating the REST of the week
    const { assignments, diagnostics } = generatePlan([forgivingContract], recipes, 'planner_autofill', [lockedAssignment]);
    
    // It should generate day 1
    expect(assignments).toHaveLength(1);
    expect(diagnostics).toHaveLength(1);

    // Because Day 0 has Roast (and repeatCap is 1), Day 1 should NOT be allowed to use Roast again.
    // So it should pick Pasta.
    expect(assignments[0].recipeId).toBe(curatedPasta.id);
    expect(diagnostics[0].topFailureReasons['repeat_cap_exhausted']).toBe(1); // One recipe failed due to the locked one
  });

  it('blocks same-day duplicates even if global repeatCap is not exhausted', () => {
    // Contract allows up to 5 repeats for the week, but we shouldn't get the same meal in one day
    const looseContract: SlotContract = { 
      ...typicalDinnerContract, 
      repeatCap: 5,
      dayIndex: 0 // Monday
    };
    
    // We request two slots on the same day
    const mondayLunch: SlotContract = { ...looseContract, slotType: 'lunch' };
    const mondayDinner: SlotContract = { ...looseContract, slotType: 'dinner' };
    
    // We use a small mock array of recipes that BOTH pass protein (25g)
    const duplicatePool: NormalizedRecipe[] = [
      { ...curatedRoast, suitableFor: ['lunch', 'dinner'] },
      { ...generatedLentilStew, suitableFor: ['lunch', 'dinner'] }
    ];

    const { assignments, diagnostics } = generatePlan([mondayLunch, mondayDinner], duplicatePool, 'planner_autofill');
    
    expect(assignments).toHaveLength(2);
    expect(diagnostics[0].actionTaken).toBe('filled_normally');
    expect(diagnostics[1].actionTaken).toBe('filled_normally');
    
    // They must pick different recipes. If the duplicate guard failed, they would both pick the highest scoring one (Roast).
    expect(assignments[0].recipeId).not.toBe(assignments[1].recipeId);
    expect(diagnostics[1].topFailureReasons['same_day_duplicate']).toBe(1);
  });

  it('deducts locked meal costs from the global budget dynamically', () => {
    // Generate 2 contracts
    const contractOne: SlotContract = { ...typicalDinnerContract, dayIndex: 0, slotType: 'lunch' };
    const contractTwo: SlotContract = { ...typicalDinnerContract, dayIndex: 0, slotType: 'dinner' };
    
    // We lock an extremely expensive caviar meal to the first slot.
    // Base weekly budget is £50. This costs £49.
    const expensiveLockedAssignment: PlannedMealAssignment = {
      id: 'assign_lunch', planId: 'week_test', dayIndex: 0, date: '2026-03-09', slotType: 'lunch',
      state: 'locked', candidateId: 'cand_caviar', recipeId: 'caviar_id', isBatchCookOrigin: false,
      metrics: { swappedCount: 0, autoFilledBy: 'user_manual' }
    };
    
    // Inject the mock expensive recipe
    const caviarRecipe: NormalizedRecipe = {
      ...curatedRoast, id: 'caviar_id', title: 'Caviar', estimatedCostPerServingGBP: 49.00
    };

    const runPool = [curatedRoast, caviarRecipe]; // Roast costs £3.50. 
    // £50 - £49 = £1 remaining. Roast costs £3.50, which is > (£1 / 1 slot * 1.2 flex = £1.20).
    // Roast should trigger a budget_delta_exceeded failure because the locked meal drained the wallet.
    
    const { assignments, diagnostics } = generatePlan([contractTwo], runPool, 'planner_autofill', [expensiveLockedAssignment]);
    
    expect(assignments).toHaveLength(1);
    expect(diagnostics).toHaveLength(1);
    
    // Because roasted chicken is £3.50 and the envelope is clamped to £1.20, it must fail budget constraints
    expect(diagnostics[0].topFailureReasons['budget_delta_exceeded']).toBeGreaterThan(0);
    // Which means it falls through to GEMINI as it is an empty pool
    expect(diagnostics[0].actionTaken).toBe('gemini_generation_needed');
  });
});
