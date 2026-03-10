/**
 * selectors.test.ts
 */
import { getMealCardViewModel, getWeeklyMetrics } from '../selectors';
import { PlannedMealAssignment, NormalizedRecipe } from '../plannerTypes';

describe('selectors', () => {
  const mockAssignment: PlannedMealAssignment = {
    id: 'a1',
    planId: 'p1',
    dayIndex: 0,
    date: '2026-03-10',
    slotType: 'breakfast',
    state: 'generating',
    candidateId: null,
    recipeId: 'r1',
    isBatchCookOrigin: false,
    metrics: { swappedCount: 0, autoFilledBy: null }
  };

  const mockRecipe: NormalizedRecipe = {
    id: 'r1',
    sourceId: 's1',
    status: 'approved',
    title: 'Test Recipe',
    description: 'A test recipe',
    archetype: 'Staple',
    totalTimeMinutes: 20,
    prepTimeMinutes: 10,
    difficulty: 'Easy',
    servings: 1,
    estimatedCostTotalGBP: 2.50,
    estimatedCostPerServingGBP: 2.50,
    macrosTotal: { calories: 400, protein: 20, carbs: 50, fats: 10 },
    macrosPerServing: { calories: 400, protein: 20, carbs: 50, fats: 10 },
    ingredients: [],
    method: [],
    tags: ['Quick'],
    suitableFor: ['breakfast'],
    macroConfidence: 1,
    costConfidence: 1,
    ingredientMappingConfidence: 1,
    servingConfidence: 1,
    normalizationWarnings: [],
    plannerUsable: true,
    libraryVisible: true,
    freezerFriendly: false,
    reheatsWell: true,
    yieldsWell: false,
    yieldsLeftovers: false
  } as NormalizedRecipe;

  describe('getMealCardViewModel', () => {
    test('resolves correctly when recipe is provided', () => {
      const vm = getMealCardViewModel(mockAssignment, mockRecipe);
      expect(vm.title).toBe('Test Recipe');
      expect(vm.calories).toBe(400);
      expect(vm.isGenerating).toBe(true);
    });

    test('handles missing recipe safely', () => {
      const vm = getMealCardViewModel(mockAssignment, undefined);
      expect(vm.recipeId).toBe('r1');
      expect(vm.title).toBeNull();
      expect(vm.calories).toBeNull();
      expect(vm.tags).toEqual([]);
    });

    test('correctly identifies rescue state', () => {
      const rescueAssignment = {
        ...mockAssignment,
        rescueData: { tierTriggered: 2, failureReasons: ['pool_exhausted'] }
      } as any;
      const vm = getMealCardViewModel(rescueAssignment, mockRecipe);
      expect(vm.isRescue).toBe(true);
    });
  });

  describe('getWeeklyMetrics', () => {
    const recipes: Record<string, NormalizedRecipe> = {
      'r1': mockRecipe,
      'r2': { ...mockRecipe, id: 'r2', title: 'Recipe 2', macrosPerServing: { ...mockRecipe.macrosPerServing, protein: 30 } }
    };

    const assignments: PlannedMealAssignment[] = [
      { ...mockAssignment, recipeId: 'r1' },
      { ...mockAssignment, id: 'a2', recipeId: 'r2' },
      { ...mockAssignment, id: 'a3', recipeId: 'invalid' } // Missing recipe
    ];

    test('aggregates metrics correctly and skips invalid recipes', () => {
      const metrics = getWeeklyMetrics(assignments, 'p1', recipes);
      expect(metrics.populatedSlots).toBe(2);
      expect(metrics.totalSlots).toBe(3);
      expect(metrics.totalProtein).toBe(50); // 20 + 30
      expect(metrics.estimatedTotalCostGBP).toBe(5.00); // 2.50 + 2.50
    });

    test('handles empty assignments safely', () => {
      const metrics = getWeeklyMetrics([], 'p1', {});
      expect(metrics.populatedSlots).toBe(0);
      expect(metrics.totalSlots).toBe(0);
      expect(metrics.totalCalories).toBe(0);
    });
  });
});
