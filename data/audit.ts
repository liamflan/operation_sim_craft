// run with tsx or ts-node
import { MOCK_RECIPES } from './seed';
import * as fixtures from './planner/plannerFixtures';
import { normalizeLegacyRecipe } from './planner/recipeRegistry';

const allRecipes = [
  ...MOCK_RECIPES.map(normalizeLegacyRecipe),
  ...Object.values(fixtures).filter(v => v && typeof v === 'object' && 'id' in v)
];

const audit = {
  total: allRecipes.length,
  slots: { breakfast: 0, lunch: 0, dinner: 0, snack_am: 0, snack_pm: 0, dessert: 0 },
  diet: { Omnivore: 0, Pescatarian: 0, Vegetarian: 0, Vegan: 0 },
  archetype: {} as Record<string, number>,
  budgetBands: { under2: 0, under4: 0, over4: 0 },
  calorieBands: { under400: 0, under600: 0, over600: 0 },
  proteinBands: { under20: 0, under35: 0, over35: 0 },
};

allRecipes.forEach((r: any) => {
  r.suitableFor.forEach((s: any) => { if (audit.slots[s] !== undefined) audit.slots[s]++; });
  
  const isVegan = r.tags.includes('Vegan');
  const isVeg = r.tags.includes('Vegetarian');
  const isPesc = r.tags.includes('Pescatarian');
  
  if (isVegan) audit.diet.Vegan++;
  else if (isVeg) audit.diet.Vegetarian++;
  else if (isPesc) audit.diet.Pescatarian++;
  else audit.diet.Omnivore++;
  
  audit.archetype[r.archetype] = (audit.archetype[r.archetype] || 0) + 1;
  
  const cost = r.estimatedCostPerServingGBP;
  if (cost < 2) audit.budgetBands.under2++;
  else if (cost <= 4) audit.budgetBands.under4++;
  else audit.budgetBands.over4++;
  
  const cals = r.macrosPerServing.calories;
  if (cals < 400) audit.calorieBands.under400++;
  else if (cals <= 600) audit.calorieBands.under600++;
  else audit.calorieBands.over600++;
  
  const pro = r.macrosPerServing.protein;
  if (pro < 20) audit.proteinBands.under20++;
  else if (pro <= 35) audit.proteinBands.under35++;
  else audit.proteinBands.over35++;
});

console.log(JSON.stringify(audit, null, 2));
