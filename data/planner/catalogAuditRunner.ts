import { FULL_RECIPE_LIST } from './recipeRegistry';
import { isRecipeAllowedForBaselineDiet } from './dietRules';
import { DietaryBaseline, RecipeArchetype, SlotType } from './plannerTypes';

const DIETS: DietaryBaseline[] = ['Vegan', 'Vegetarian', 'Pescatarian', 'Omnivore'];
const SLOTS: SlotType[] = ['breakfast', 'lunch', 'dinner'];
const ARCHETYPES: RecipeArchetype[] = ['Staple', 'Splurge', 'Quick_Fix', 'Batch_Cook'];

const EXPANSION_IDS = [
  'rec_lentil_01',
  'rec_vegan_steak_01',
  'rec_vegan_tempeh_01',
  'rec_veggie_halloumi_01',
  'rec_vegan_scramble_01'
];

function audit() {
  console.log('# RECIPE CATALOG COVERAGE AUDIT (PHASE 19 FINAL)');
  console.log(`Generated: ${new Date().toISOString()}\n`);

  console.log('## 1. Before vs After Expansion (Total Pool size)');
  console.log('| Diet | Baseline (Before) | Current (After) | Delta |');
  console.log('| :--- | :--- | :--- | :--- |');
  
  for (const diet of DIETS) {
    const total = FULL_RECIPE_LIST.filter(r => isRecipeAllowedForBaselineDiet(r, diet as any));
    const baseline = total.filter(r => !EXPANSION_IDS.includes(r.id));
    console.log(`| ${diet} | ${baseline.length} | ${total.length} | +${total.length - baseline.length} |`);
  }
  console.log('\n');

  console.log('## 2. Coverage Matrix (Unique Candidate Pool)');
  for (const diet of DIETS) {
    console.log(`### ${diet} Coverage`);
    const eligible = FULL_RECIPE_LIST.filter(r => isRecipeAllowedForBaselineDiet(r, diet as any));
    
    console.log(`| Slot | ${ARCHETYPES.join(' | ')} | Total |`);
    console.log(`| :--- | ${ARCHETYPES.map(() => ':---').join(' | ')} | :--- |`);
    
    for (const slot of SLOTS) {
      const slotRecipes = eligible.filter(r => r.suitableFor.includes(slot));
      const counts = ARCHETYPES.map(arch => slotRecipes.filter(r => r.archetype === arch).length);
      console.log(`| ${slot} | ${counts.join(' | ')} | ${slotRecipes.length} |`);
    }
    console.log('\n');
  }

  console.log('## 3. Protein Cuisine Analysis (35g+ Protein Dinners)');
  console.log('| Diet | HP Dinners Count | Sample Cuisines |');
  console.log('| :--- | :--- | :--- |');
  for (const diet of DIETS) {
    const eligible = FULL_RECIPE_LIST.filter(r => isRecipeAllowedForBaselineDiet(r, diet as any));
    const hpDinners = eligible.filter(r => r.suitableFor.includes('dinner') && r.macrosPerServing.protein >= 35);
    const samples = hpDinners.slice(0, 2).map(r => `${r.title} (${r.macrosPerServing.protein}g)`).join(', ');
    console.log(`| ${diet} | ${hpDinners.length} | ${samples || 'NONE'} |`);
  }
  console.log('\n');
  
  console.log('## 4. Glossary & Notes');
  console.log('- **Weekly Total**: The sum of values across 21 planned slots (7 days x 3 meals).');
  console.log('- **Daily Average**: The weekly total divided by 7.');
  console.log('- Counts refer to unique normalized recipes in catalog.');
}

audit();
