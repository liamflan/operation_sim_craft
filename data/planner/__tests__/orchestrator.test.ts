import { generatePlan } from '../orchestrator';
import { 
  curatedRoast, 
  curatedPasta, 
  generatedLentilStew, 
  typicalDinnerContract, 
  exhaustedBudgetDinnerContract 
} from '../plannerFixtures';
import { SlotContract, NormalizedRecipe } from '../plannerTypes';

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
    expect(assignment.decisionSnapshot!.budgetConstraintAtTimeOfDecision).toBe(typicalDinnerContract.budgetEnvelopeGBP);
    expect(assignment.decisionSnapshot!.proteinTargetAtTimeOfDecision).toBe(typicalDinnerContract.macroTargets.protein.ideal);

    // Assert diagnostics
    expect(diagnostic.actionTaken).toBe('filled_normally');
    expect(diagnostic.eligibleCount).toBe(1); // Pasta fails protein minimum for typical dinner
    expect(diagnostic.rejectedCount).toBe(1);
  });

  it('detects pool collapse and triggers a gemini regeneration flow', () => {
    const contracts: SlotContract[] = [exhaustedBudgetDinnerContract];
    
    // Roast fails budget constraint. Pasta fails protein constraint.
    const { assignments, diagnostics } = generatePlan(contracts, recipes, 'planner_autofill');
    
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
    
    const { assignments, diagnostics } = generatePlan(contracts, rescuePool, 'planner_autofill');
    
    expect(assignments).toHaveLength(1);
    const assignment = assignments[0];
    const diagnostic = diagnostics[0];

    // Filled successfully without needing to trigger a new generation
    expect(assignment.state).toBe('proposed');
    expect(assignment.recipeId).toBe(generatedLentilStew.id);
    expect(diagnostic.actionTaken).toBe('filled_normally');
  });

  it('simulates a full week generation tracking constraints', () => {
    // Generate 7 identical dinner contracts for a mock week
    const weekContracts: SlotContract[] = Array.from({ length: 7 }).map((_, i) => ({
      ...typicalDinnerContract,
      dayIndex: i,
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
});
