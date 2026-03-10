import { FULL_RECIPE_LIST } from './data/planner/recipeRegistry';
import { isRecipeAllowedForBaselineDiet } from './data/planner/dietRules';

const diets = ['Omnivore', 'Pescatarian', 'Vegetarian', 'Vegan'];
const total = FULL_RECIPE_LIST.length;

console.log(`TOTAL RECIPES: ${total}`);

diets.forEach(diet => {
  const eligible = FULL_RECIPE_LIST.filter(r => isRecipeAllowedForBaselineDiet(r as any, diet as any));
  const proteinChecked = eligible.filter(r => r.macrosPerServing.protein >= 30);
  console.log(`${diet}: Eligible=${eligible.length}, 30g+ Protein=${proteinChecked.length}`);
});
