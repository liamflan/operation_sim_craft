/**
 * recipeImageAuditPipeline.ts
 * Automated audit of the Provision recipe catalogue.
 * Generates manifests for image generation queues.
 */

import fs from 'fs';
import path from 'path';
import { FULL_RECIPE_LIST } from './recipeRegistry';
import { NormalizedRecipe } from './plannerTypes';

const KNOWN_PLACEHOLDERS = [
  'photo-1473093295043-cdd812d0e601', // Generic pasta
  'photo-1543339308-43e59d6b73a6', // Generic bowl
  'photo-1512621776951-a57141f2eefd', // Generic salad
  'photo-1540189549336-e6e99c3679fe', // Generic bowl
  'photo-1546069901-ba9599a7e63c', // Generic salad bowl
];

interface AuditRow {
  recipeId: string;
  title: string;
  cuisineId: string;
  archetype: string;
  suitableFor: string;
  keyIngredients: string;
  currentImageUrl: string;
  imageStatus: 'good' | 'missing' | 'placeholder' | 'suspect';
  visualDescription: string;
  targetFilename: string;
}

function getStatus(recipe: NormalizedRecipe): AuditRow['imageStatus'] {
  const url = recipe.imageUrl;
  if (!url || (typeof url === 'string' && url.trim() === '')) return 'missing';
  
  if (typeof url !== 'string') return 'good'; // Handle local assets as good for now

  const idMatch = url.match(/photo-([a-zA-Z0-9-]+)/);
  if (idMatch && KNOWN_PLACEHOLDERS.includes(idMatch[1])) return 'placeholder';

  // Suspect logic: weak title/url match or generic keywords
  const titleLower = recipe.title.toLowerCase();
  const urlLower = url.toLowerCase();
  const keywords = titleLower.split(' ').filter(w => w.length > 4);
  const hasKeywordInUrl = keywords.some(k => urlLower.includes(k));

  if (keywords.length > 0 && !hasKeywordInUrl) return 'suspect';

  return 'good';
}

function getVisualDescription(recipe: NormalizedRecipe): string {
  const ingredients = recipe.ingredients.slice(0, 3).map(i => i.name).join(', ');
  return `${recipe.title} featuring ${ingredients}. High-quality food photography, vibrant colors.`;
}

function runAudit() {
  console.log('Starting Recipe Image Audit...');

  const auditData: AuditRow[] = FULL_RECIPE_LIST.map(recipe => {
    const status = getStatus(recipe);
    return {
      recipeId: recipe.id,
      title: recipe.title,
      cuisineId: recipe.cuisineId || 'unknown',
      archetype: recipe.archetype,
      suitableFor: recipe.suitableFor.join(', '),
      keyIngredients: recipe.ingredients.slice(0, 3).map(i => i.name).join(', '),
      currentImageUrl: typeof recipe.imageUrl === 'string' ? recipe.imageUrl : 'local_asset',
      imageStatus: status,
      visualDescription: getVisualDescription(recipe),
      targetFilename: `recipe_${recipe.id}.webp`
    };
  });

  // 1. Save Full Manifest (JSON)
  fs.writeFileSync(
    path.join(__dirname, 'recipe_image_audit_full.json'),
    JSON.stringify(auditData, null, 2)
  );

  // 2. Save Full Manifest (CSV)
  const headers = ['recipeId', 'title', 'cuisineId', 'archetype', 'suitableFor', 'keyIngredients', 'currentImageUrl', 'imageStatus', 'visualDescription', 'targetFilename'];
  const csvRows = auditData.map(row => 
    headers.map(h => `"${(row as any)[h].toString().replace(/"/g, '""')}"`).join(',')
  );
  fs.writeFileSync(
    path.join(__dirname, 'recipe_image_audit_full.csv'),
    [headers.join(','), ...csvRows].join('\n')
  );

  // 3. Save Generation Queue (Filtered)
  const queue = auditData.filter(r => ['missing', 'placeholder', 'suspect'].includes(r.imageStatus));
  fs.writeFileSync(
    path.join(__dirname, 'recipe_image_generation_queue.json'),
    JSON.stringify(queue, null, 2)
  );
  
  const queueCsvRows = queue.map(row => 
    headers.map(h => `"${(row as any)[h].toString().replace(/"/g, '""')}"`).join(',')
  );
  fs.writeFileSync(
    path.join(__dirname, 'recipe_image_generation_queue.csv'),
    [headers.join(','), ...queueCsvRows].join('\n')
  );

  console.log(`Audit Complete!`);
  console.log(`Total Recipes: ${auditData.length}`);
  console.log(`Generation Queue: ${queue.length}`);
  console.log(`- Good: ${auditData.filter(r => r.imageStatus === 'good').length}`);
  console.log(`- Missing: ${auditData.filter(r => r.imageStatus === 'missing').length}`);
  console.log(`- Placeholder: ${auditData.filter(r => r.imageStatus === 'placeholder').length}`);
  console.log(`- Suspect: ${auditData.filter(r => r.imageStatus === 'suspect').length}`);
}

runAudit();
