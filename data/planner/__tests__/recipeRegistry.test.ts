import { describe, it, expect } from '@jest/globals';
import { FULL_RECIPE_CATALOG, FULL_RECIPE_LIST } from '../recipeRegistry';
import { curatedRoast } from '../plannerFixtures';
import { MOCK_RECIPES } from '../../seed';

describe('Recipe Registry', () => {
  it('should contain all legacy recipes from seed.ts', () => {
    MOCK_RECIPES.forEach(mock => {
      expect(FULL_RECIPE_CATALOG[mock.id]).toBeDefined();
      expect(FULL_RECIPE_CATALOG[mock.id]?.id).toBe(mock.id);
    });
  });

  it('should contain all high-fidelity planner fixtures', () => {
    expect(FULL_RECIPE_CATALOG[curatedRoast.id]).toBeDefined();
    expect(FULL_RECIPE_CATALOG[curatedRoast.id]?.id).toBe(curatedRoast.id);
  });

  it('should correctly normalize legacy recipes', () => {
    const mock = MOCK_RECIPES[0];
    const normalized = FULL_RECIPE_CATALOG[mock.id];
    
    expect(normalized?.title).toBe(mock.title);
    expect(normalized?.macrosPerServing.calories).toBe(mock.macros.calories);
    expect(normalized?.plannerUsable).toBe(true);
  });

  it('should have a consistent list and catalog size', () => {
    expect(FULL_RECIPE_LIST.length).toBe(Object.keys(FULL_RECIPE_CATALOG).length);
  });
});
