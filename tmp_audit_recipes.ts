
import { FULL_RECIPE_LIST } from './data/planner/recipeRegistry';

async function runAudit() {
  const total = FULL_RECIPE_LIST.length;
  console.log('--- Recipe Audit ---');
  console.log('Total Recipes in Registry:', total);

  const vegan = FULL_RECIPE_LIST.filter(r => 
    (r.tags || []).some(t => t.toLowerCase() === 'vegan')
  );
  
  const vegetarian = FULL_RECIPE_LIST.filter(r => 
    (r.tags || []).some(t => ['vegetarian', 'vegan'].includes(t.toLowerCase()))
  );
  
  const pescatarian = FULL_RECIPE_LIST.filter(r => 
    (r.tags || []).some(t => ['pescatarian', 'vegetarian', 'vegan'].includes(t.toLowerCase())) ||
    r.title.toLowerCase().includes('fish') || 
    r.title.toLowerCase().includes('salmon') ||
    r.title.toLowerCase().includes('tuna')
  );

  console.log('Vegan-eligible (by tag):', vegan.length);
  console.log('Vegetarian-eligible (by tag):', vegetarian.length);
  console.log('Pescatarian-eligible (tag/title):', pescatarian.length);

  // Check protein distribution for vegan
  if (vegan.length > 0) {
    const avgVeganProtein = vegan.reduce((acc, r) => acc + r.macrosPerServing.protein, 0) / vegan.length;
    const maxVeganProtein = Math.max(...vegan.map(r => r.macrosPerServing.protein));
    console.log('Avg Vegan Protein:', avgVeganProtein.toFixed(1), 'g');
    console.log('Max Vegan Protein:', maxVeganProtein, 'g');
    
    console.log('\nVegan Recipes:');
    vegan.forEach(r => console.log(`- ${r.title} (${r.macrosPerServing.protein}g P)`));
  }

  // Check if any recipes have the new allowedDiets field
  const withAllowedDiets = FULL_RECIPE_LIST.filter(r => (r as any).allowedDiets);
  console.log('\nRecipes with allowedDiets field:', withAllowedDiets.length);

  console.log('-------------------');
}

runAudit().catch(console.error);
