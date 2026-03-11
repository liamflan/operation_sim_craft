import { FULL_RECIPE_LIST } from './planner/recipeRegistry';

const suspect = FULL_RECIPE_LIST.filter(r => r.imageMetadata?.status === 'suspect');
console.log("SUSPECT IMAGES:");
suspect.forEach(r => console.log(r.id, r.title, r.imageUrl));

const others = FULL_RECIPE_LIST.filter(r => {
    return !r.id.includes('wave1') && !r.id.includes('w2_') && !(r.sourceId && r.sourceId.startsWith('legacy'));
});
console.log("\nOTHER SEEDED RECIPES (" + others.length + "):");
others.forEach(r => console.log(r.id, r.title));
