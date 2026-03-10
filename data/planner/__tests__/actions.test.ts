import { 
  assignCandidateToSlot, 
  lockSlot, 
  swapSlot, 
  regenerateSlot, 
  regenerateDay, 
  regenerateWeek 
} from '../actions';
import { 
  normalAssignment, 
  typicalDinnerContract, 
  curatedPasta 
} from '../plannerFixtures';
import { PlannerCandidate, PlannedMealAssignment } from '../plannerTypes';

describe('Planner Actions', () => {

  const mockCandidate: PlannerCandidate = {
    id: 'cand_test_1',
    recipeId: curatedPasta.id,
    slotContractRef: { planId: 'week_42', dayIndex: 0, slotType: 'dinner' },
    scores: { totalScore: 90, slotFitScore: 80, macroFitScore: 90, budgetFitScore: 100, tasteFitScore: 80, varietyFitScore: 100, pantryFitScore: 50, leftoverFitScore: 100 },
    penalties: { archetypePenalty: 0, repeatPenalty: 0 },
    rescueEligible: false,
    insights: []
  };

  it('assigns candidate and snapshots contract truth', () => {
    // Start with a generic unassigned slot
    const emptySlot: PlannedMealAssignment = {
      id: 'slot_1', planId: 'week_42', dayIndex: 0, date: '2026-03-09', slotType: 'dinner',
      state: 'generating', candidateId: null, recipeId: null, isBatchCookOrigin: false,
      metrics: { swappedCount: 0, autoFilledBy: null }
    };

    const actioned = assignCandidateToSlot(emptySlot, mockCandidate, typicalDinnerContract, 'planner_autofill');

    expect(actioned.state).toBe('proposed');
    expect(actioned.candidateId).toBe(mockCandidate.id);
    expect(actioned.recipeId).toBe(mockCandidate.recipeId);
    expect(actioned.metrics.autoFilledBy).toBe('planner_autofill');
    expect(actioned.decisionSnapshot).toBeDefined();
    expect(actioned.decisionSnapshot?.budgetConstraintAtTimeOfDecision).toBe(typicalDinnerContract.budgetEnvelopeGBP);
  });

  it('locks a proposed slot', () => {
    // Using the fixture 'normalAssignment' which is already locked, let's unlock it to test
    const proposedSlot = { ...normalAssignment, state: 'proposed' as const };
    const locked = lockSlot(proposedSlot);
    expect(locked.state).toBe('locked');
  });

  it('throws when locking an empty slot', () => {
    const emptySlot: PlannedMealAssignment = {
      id: 'slot_1', planId: 'week_42', dayIndex: 0, date: '2026-03-09', slotType: 'dinner',
      state: 'generating', candidateId: null, recipeId: null, isBatchCookOrigin: false,
      metrics: { swappedCount: 0, autoFilledBy: null }
    };
    expect(() => lockSlot(emptySlot)).toThrow();
  });

  it('swaps a slot, locking it and incrementing swap count', () => {
    const swapped = swapSlot(normalAssignment, mockCandidate, typicalDinnerContract);
    
    expect(swapped.state).toBe('locked');
    expect(swapped.candidateId).toBe(mockCandidate.id);
    expect(swapped.metrics.swappedCount).toBe(1);
    expect(swapped.metrics.autoFilledBy).toBe('swap_request');
  });

  it('regenerates a slot, clearing data but preserving failure histories', () => {
    const regenerated = regenerateSlot(normalAssignment, ['budget_delta_exceeded']);
    
    expect(regenerated.state).toBe('generating');
    expect(regenerated.candidateId).toBeNull();
    expect(regenerated.recipeId).toBeNull();
    expect(regenerated.decisionSnapshot).toBeUndefined();
    expect(regenerated.rescueData).toBeUndefined();
    // It should log the new failure reason
    expect(regenerated.metrics.priorFailedCandidateCounts!['budget_delta_exceeded']).toBe(1);
  });

  it('regenerates a day while ignoring locked meals', () => {
    const assignments: PlannedMealAssignment[] = [
      { ...normalAssignment, id: 'a1', dayIndex: 0, state: 'proposed' }, // Will regenerate
      { ...normalAssignment, id: 'a2', dayIndex: 0, state: 'locked' },   // Ignored
      { ...normalAssignment, id: 'a3', dayIndex: 1, state: 'proposed' }  // Different day, ignored
    ];

    const output = regenerateDay(assignments, 0);
    expect(output[0].state).toBe('generating');
    expect(output[1].state).toBe('locked');
    expect(output[2].state).toBe('proposed');
  });

  it('regenerates a week while ignoring locked meals', () => {
    const assignments: PlannedMealAssignment[] = [
      { ...normalAssignment, id: 'a1', dayIndex: 0, state: 'proposed' }, // Will regenerate
      { ...normalAssignment, id: 'a2', dayIndex: 3, state: 'locked' },   // Ignored
      { ...normalAssignment, id: 'a3', dayIndex: 6, state: 'proposed' }  // Will regenerate
    ];

    const output = regenerateWeek(assignments);
    expect(output[0].state).toBe('generating');
    expect(output[1].state).toBe('locked');
    expect(output[2].state).toBe('generating');
  });
});
