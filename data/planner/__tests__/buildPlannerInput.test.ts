/**
 * buildPlannerInput.test.ts
 */
import { buildPlannerSetup } from '../buildPlannerInput';
import { DEFAULT_ROUTINE } from '../../weeklyRoutine';

describe('buildPlannerInput', () => {
  const mockPayload = {
    selectedVibes: ['r1', 'fake_stale_id'], // Mix valid and stale
    diet: 'Omnivore' as const,
    budgetWeekly: 60,
    targetProtein: 150,
    targetCalories: 2200,
    profileExclusions: []
  };

  test('buildPlannerSetup generates a valid planId and contracts', () => {
    const setup = buildPlannerSetup(DEFAULT_ROUTINE, mockPayload);
    
    expect(setup.planId).toMatch(/^plan_\d+/);
    expect(setup.contracts.length).toBe(21);
    
    const firstContract = setup.contracts[0];
    expect(firstContract.dayIndex).toBe(0); // Monday
    expect(firstContract.budgetEnvelopeGBP).toBeCloseTo(60 / 21);
    expect(firstContract.macroTargets.calories.ideal).toBe(2200 * 0.33);
  });

  test('buildPlannerSetup constructs a valid TasteProfile from selectedVibes', () => {
    const setup = buildPlannerSetup(DEFAULT_ROUTINE, mockPayload);
    const profile = setup.contracts[0].tasteProfile;
    
    // Only 'r1' should have resolved successfully, 'fake_stale_id' should be safely ignored
    expect(profile.anchorCount).toBe(1);
    expect(profile.totalTagWeight).toBeGreaterThan(0);
    expect(profile.totalArchetypeWeight).toBeGreaterThan(0);
    
    // We know from FULL_RECIPE_LIST that r1 is a Core Collection recipe and should have tags
    const hasTags = Object.keys(profile.preferredTags).length > 0;
    expect(hasTags).toBe(true);
  });

  test('handles different routines correctly', () => {
    const skewedRoutine = {
      ...DEFAULT_ROUTINE,
      Mon: { breakfast: 'plan', lunch: 'skip', dinner: 'plan' },
      Tue: { breakfast: 'plan', lunch: 'plan', dinner: 'plan' }
    };
    // 2 (Mon) + 3 (Tue) + 5*3 (Rest) = 20 slots
    const setup = buildPlannerSetup(skewedRoutine as any, mockPayload);
    expect(setup.contracts.length).toBe(20);
    expect(setup.contracts[0].budgetEnvelopeGBP).toBeCloseTo(60 / 20);
  });

  test('buildVibeAssignments maps valid vibes to early slots', () => {
    const setup = buildPlannerSetup(DEFAULT_ROUTINE, mockPayload);
    // Even though selectedVibes has length 2, the assignment respects the raw original array length 
    // when carving slots out, though it assigns to 'fake_stale_id' as a pointer (safe fallback behaviour)
    expect(setup.vibeAssignments.length).toBe(2);
    expect(setup.vibeAssignments[0].recipeId).toBe('r1');
    expect(setup.vibeAssignments[0].dayIndex).toBe(0); // Monday
    expect(setup.vibeAssignments[0].state).toBe('locked');
  });

  test('handles zero budget or zero targets gracefully', () => {
    const zeroPayload = { ...mockPayload, budgetWeekly: 0, targetCalories: 0 };
    const setup = buildPlannerSetup(DEFAULT_ROUTINE, zeroPayload);
    expect(setup.contracts[0].budgetEnvelopeGBP).toBe(0);
    expect(setup.contracts[0].macroTargets.calories.ideal).toBe(0);
  });
});
