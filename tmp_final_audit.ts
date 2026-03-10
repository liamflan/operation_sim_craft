
import { FULL_RECIPE_LIST } from './data/planner/recipeRegistry';
import { isRecipeAllowedForBaselineDiet } from './data/planner/dietRules';

async function runAudit() {
  const total = FULL_RECIPE_LIST.length;
  console.log('--- Recipe Diet Audit ---');
  console.log('Total Recipes in Registry:', total);

  const diets = ['Vegan', 'Vegetarian', 'Pescatarian', 'Omnivore'] as const;
  
  const stats = diets.map(diet => {
    const eligible = FULL_RECIPE_LIST.filter(r => isRecipeAllowedForBaselineDiet(r, diet));
    const avgProtein = eligible.reduce((acc, r) => acc + r.macrosPerServing.protein, 0) / eligible.length;
    return { diet, count: eligible.length, avgProtein: avgProtein.toFixed(1) };
  });

  stats.forEach(s => {
    console.log(`${s.diet}: ${s.count} recipes (Avg Protein: ${s.avgProtein}g)`);
  });

  const veganRecipes = FULL_RECIPE_LIST.filter(r => isRecipeAllowedForBaselineDiet(r, 'Vegan'));
  console.log('\nVegan Recipe Details:');
  veganRecipes.forEach(r => {
    console.log(`- ${r.title}: ${r.macrosPerServing.protein}g protein`);
  });

  console.log('-------------------------');
}

runAudit().catch(console.error);
