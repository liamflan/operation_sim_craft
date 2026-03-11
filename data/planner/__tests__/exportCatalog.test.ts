import fs from 'fs';
import path from 'path';

import { FULL_RECIPE_LIST } from '../recipeRegistry';

const CSV_PATH = 'C:\\Users\\liamf\\.gemini\\antigravity\\brain\\b0e88560-1d95-4b17-8efb-c60dbd28880c\\recipe_catalog_export.csv';
const MD_PATH = 'C:\\Users\\liamf\\.gemini\\antigravity\\brain\\b0e88560-1d95-4b17-8efb-c60dbd28880c\\recipe_catalog_summary.md';

const rows: string[] = [];

// CSV Header
const headers = [
  'recipeId', 'title', 'suitableFor', 'dietTags', 'archetype', 'tags',
  'estimatedCostPerServingGBP', 'caloriesPerServing', 'proteinPerServingG',
  'activePrepMinutes', 'totalMinutes', 'complexityScore', 'batchFriendly',
  'leftoverFriendly', 'cleanupBurden', 'equipmentRequired', 'imageUrl',
  'imageSourceType', 'usesLegacyFallback', 'metadataDebtFlags', 'canonicalIngredientCount',
  'ingredientNames', 'servings', 'waveSource', 'phase21Native',
  'breakfastCapable', 'lunchCapable', 'dinnerCapable', 'isVegan', 'isVegetarian',
  'isPescatarian', 'isOmnivore', 'isLowBudget', 'isModerateProtein', 'isPremiumMeal'
];

rows.push(headers.join(','));

function escapeCsv(str: string): string {
  if (str == null) return '';
  const s = String(str);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const stats = {
  total: 0,
  slots: { breakfast: 0, lunch: 0, dinner: 0 },
  diets: { vegan: 0, vegetarian: 0, pescatarian: 0, omnivore: 0 },
  archetypes: {} as Record<string, number>,
  waves: { legacy: 0, wave1: 0, wave2: 0, other: 0 },
  imageSource: { correct: 0, placeholder: 0, missing: 0, fallback: 0, suspect: 0, 'needs-review': 0 } as Record<string, number>,
  metadataDebt: 0
};

FULL_RECIPE_LIST.forEach(r => {
  stats.total++;
  
  const tagsLower = r.tags.map(t => t.toLowerCase());
  const isVegan = tagsLower.includes('vegan');
  // If it's vegan, it's also vegetarian. If vegetarian, also pescatarian (by diet rules, implicitly)
  const isVegetarian = isVegan || tagsLower.includes('vegetarian');
  const isPescatarian = isVegetarian || tagsLower.includes('pescatarian');
  const isOmnivore = !isVegetarian && !isPescatarian;

  const dietTags = [
    isVegan ? 'Vegan' : null,
    isVegetarian && !isVegan ? 'Vegetarian' : null,
    isPescatarian && !isVegetarian ? 'Pescatarian' : null,
    isOmnivore ? 'Omnivore' : null
  ].filter(Boolean).join(';');

  const usesLegacyFallback = !!r.totalTimeMinutes;
  const metadataDebtFlags = usesLegacyFallback ? 'Phase20_Legacy_Mapping' : 'None';
  
  const ingredientList = (r as any).normalizedIngredients || r.ingredients || [];
  const ingredientNames = ingredientList.map((i: any) => i.canonicalName || i.name).join(';');
  let waveSource = 'legacy';
  if (r.id.includes('wave1')) waveSource = 'wave1';
  else if (r.id.includes('w2_') || r.sourceId?.includes('wave2')) waveSource = 'wave2';
  else if (r.sourceId?.startsWith('legacy')) waveSource = 'legacy';
  else waveSource = 'other';
  
  const phase21Native = !usesLegacyFallback;
  
  const breakfastCapable = r.suitableFor.includes('breakfast');
  const lunchCapable = r.suitableFor.includes('lunch');
  const dinnerCapable = r.suitableFor.includes('dinner');
  
  const isLowBudget = r.estimatedCostPerServingGBP < 2.00;
  const isModerateProtein = r.macrosPerServing.protein >= 20 && r.macrosPerServing.protein <= 35;
  const isPremiumMeal = r.archetype?.toLowerCase().includes('premium') || r.estimatedCostPerServingGBP > 4.50;

  const imageStatus = r.imageMetadata?.status || 'missing';
  
  // Update stats
  if (breakfastCapable) stats.slots.breakfast++;
  if (lunchCapable) stats.slots.lunch++;
  if (dinnerCapable) stats.slots.dinner++;
  
  if (isVegan) stats.diets.vegan++;
  else if (isVegetarian) stats.diets.vegetarian++;
  else if (isPescatarian) stats.diets.pescatarian++;
  else stats.diets.omnivore++;
  
  stats.archetypes[r.archetype] = (stats.archetypes[r.archetype] || 0) + 1;
  stats.waves[waveSource as keyof typeof stats.waves] = (stats.waves[waveSource as keyof typeof stats.waves] || 0) + 1;
  stats.imageSource[imageStatus as keyof typeof stats.imageSource] = (stats.imageSource[imageStatus as keyof typeof stats.imageSource] || 0) + 1;
  if (!r.imageUrl) stats.imageSource.placeholder = (stats.imageSource.placeholder || 0) + 1;
  
  if (usesLegacyFallback) stats.metadataDebt++;

  const row = [
    r.id,
    r.title,
    r.suitableFor.join(';'),
    dietTags,
    r.archetype,
    r.tags.join(';'),
    r.estimatedCostPerServingGBP.toFixed(2),
    r.macrosPerServing.calories,
    r.macrosPerServing.protein,
    r.activePrepMinutes,
    r.totalMinutes,
    r.complexityScore,
    r.batchFriendly || false,
    r.leftoverFriendly || false,
    r.cleanupBurden || 'Medium',
    (r.equipmentRequired || []).join(';'),
    r.imageUrl || '',
    r.imageUrl ? imageStatus : 'placeholder-omitted',
    usesLegacyFallback,
    metadataDebtFlags,
    ingredientList.length,
    ingredientNames,
    r.servings,
    waveSource,
    phase21Native,
    breakfastCapable,
    lunchCapable,
    dinnerCapable,
    isVegan,
    isVegetarian,
    isPescatarian,
    isOmnivore,
    isLowBudget,
    isModerateProtein,
    isPremiumMeal
  ].map(escapeCsv);

  rows.push(row.join(','));
});

fs.writeFileSync(CSV_PATH, rows.join('\n'), 'utf8');

// Build Markdown Summary
const md = `
# Recipe Catalog Export Summary

## Overall Metrics
- **Total Active Recipes:** ${stats.total}
- **Recipes carrying Legacy Metadata Debt:** ${stats.metadataDebt}
- **Recipes with Phase 21 Native Mappings:** ${stats.total - stats.metadataDebt}

## Coverage by Wave Source
- **Legacy Catalog:** ${stats.waves.legacy}
- **Pilot Batch Wave 1:** ${stats.waves.wave1}
- **Pilot Batch Wave 2:** ${stats.waves.wave2}
- **Other/Seeded:** ${stats.waves.other}

## Coverage by Slot Suitability
*(Note: Recipes can be suitable for multiple slots)*
- **Breakfasts:** ${stats.slots.breakfast}
- **Lunches:** ${stats.slots.lunch}
- **Dinners:** ${stats.slots.dinner}

## Coverage by Diet
*(Strictly categorized by most restrictive tier)*
- **Vegan:** ${stats.diets.vegan}
- **Vegetarian:** ${stats.diets.vegetarian}
- **Pescatarian:** ${stats.diets.pescatarian}
- **Omnivore:** ${stats.diets.omnivore}

## Coverage by Archetype
${Object.entries(stats.archetypes).map(([arch, count]) => `- **${arch}:** ${count}`).join('\n')}

## Image Integrity
- **Verified/Correct Images:** ${stats.imageSource.correct || 0}
- **Explicit Placeholders (Omitted URL):** ${stats.imageSource.placeholder || 0}
- **Missing URLs:** ${stats.imageSource.missing || 0}
- **Suspect/Placeholder Strings:** ${stats.imageSource.suspect || 0}
- **Needs Review:** ${stats.imageSource['needs-review'] || 0}

*Full structural data is available in \`recipe_catalog_export.csv\`.*
`;

fs.writeFileSync(MD_PATH, md.trim(), 'utf8');

console.log('Export Complete!');
