import { getMealCardViewModel, getWeeklyMetrics } from '../selectors';
import { normalAssignment, typicalDinnerContract, curatedRoast } from '../plannerFixtures';
import { PlannedMealAssignment } from '../plannerTypes';

describe('Planner Selectors', () => {

  it('transforms a locked assignment into a robust MealCardViewModel', () => {
    // using normalAssignment which has a cooked/locked state and the Roast recipe
    const vm = getMealCardViewModel(normalAssignment, curatedRoast);
    
    expect(vm.assignmentId).toBe(normalAssignment.id);
    expect(vm.isGenerating).toBe(false);
    expect(vm.title).toBe('Classic Roast Chicken');
    expect(vm.state).toBe('locked');
    expect(vm.insights.length).toBeGreaterThan(0);
    // It should have the macro_fit insight based on the normalAssignment fixture
    expect(vm.insights.some(i => i.type === 'macro_fit')).toBe(true);
  });

  it('transforms a generating assignment into a loading MealCardViewModel', () => {
    const generatingSlot: PlannedMealAssignment = {
      ...normalAssignment,
      state: 'generating',
      recipeId: null,
      candidateId: null,
      metrics: { swappedCount: 0, autoFilledBy: null }
    };

    const vm = getMealCardViewModel(generatingSlot, undefined);
    
    expect(vm.isGenerating).toBe(true);
    expect(vm.title).toBeNull();
    expect(vm.state).toBe('generating');
  });

  it('calculates accurate weekly metrics for a week plan', () => {
    const assignments: PlannedMealAssignment[] = [
      { ...normalAssignment, id: '1', planId: 'week_test' }, // Has roast (400 cals, 40g prot, 3.00 cost)
      { ...normalAssignment, id: '2', planId: 'week_test' }, // Has roast
      { ...normalAssignment, id: '3', planId: 'week_test', recipeId: null, state: 'generating' } // Empty
    ];

    const recipes = {
      [curatedRoast.id]: curatedRoast
    };

    const metrics = getWeeklyMetrics(assignments, 'week_test', recipes);

    expect(metrics.populatedSlots).toBe(2);
    expect(metrics.totalSlots).toBe(3);
    
    // 2 roasts = 6.00
    expect(metrics.estimatedTotalCostGBP).toBe(6.00);
    // 2 roasts * 400 cals = 800 cals
    expect(metrics.totalCalories).toBe(1200); // 600 cals * 2
    // 2 roasts * 40g protein = 80g
    expect(metrics.totalProtein).toBe(80);
  });
});
