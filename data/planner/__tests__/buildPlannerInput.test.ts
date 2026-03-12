/**
 * buildPlannerInput.test.ts
 */
import { buildPlannerSetup } from '../buildPlannerInput';
import { DEFAULT_ROUTINE } from '../../weeklyRoutine';
import { CalibrationPayload, CuisineId } from '../plannerTypes';

describe('buildPlannerInput', () => {
  const mockPayload: CalibrationPayload = {
    preferredCuisineIds: ['japanese'] as CuisineId[],
    diet: 'Omnivore' as const,
    budgetWeekly: 60,
    targetProtein: 150,
    targetCalories: 2200,
    excludedIngredientTags: []
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

  test('buildPlannerSetup constructs a valid TasteProfile from preferredCuisineIds', () => {
    const setup = buildPlannerSetup(DEFAULT_ROUTINE, mockPayload);
    const profile = setup.contracts[0].tasteProfile;
    
    expect(profile.preferredCuisineIds).toContain('japanese');
    expect(profile.excludedIngredientTags?.length).toBe(0);
  });

  test('preSelectedAssignments is empty as legacy vibes are removed', () => {
    const setup = buildPlannerSetup(DEFAULT_ROUTINE, mockPayload);
    expect(setup.preSelectedAssignments.length).toBe(0);
  });

  test('handles zero budget or zero targets gracefully', () => {
    const zeroPayload = { ...mockPayload, budgetWeekly: 0, targetCalories: 0 };
    const setup = buildPlannerSetup(DEFAULT_ROUTINE, zeroPayload);
    expect(setup.contracts[0].budgetEnvelopeGBP).toBe(0);
    expect(setup.contracts[0].macroTargets.calories.ideal).toBe(0);
  });
});
