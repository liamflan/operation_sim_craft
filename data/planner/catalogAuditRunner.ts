import { FULL_RECIPE_LIST } from './recipeRegistry';
import { IMAGE_AUDIT_REASONS, NormalizedRecipe } from './plannerTypes';

/**
 * catalogAuditRunner.ts
 * Tooling logic for Tier 2 (Catalog-Level) audits.
 * Run this to generate a structured audit report for the entire project.
 */

export interface CatalogAuditReport {
  timestamp: string;
  totalRecipes: number;
  stats: {
    correct: number;
    missing: number;
    suspect: number;
    needsReview: number;
  };
  duplicates: {
    fingerprint: string;
    recipes: { id: string; title: string; category?: string }[];
  }[];
  flaggedRecipes: Partial<NormalizedRecipe>[];
}

export function runCatalogAudit(): CatalogAuditReport {
  const recipes = FULL_RECIPE_LIST;
  const report: CatalogAuditReport = {
    timestamp: new Date().toISOString(),
    totalRecipes: recipes.length,
    stats: { correct: 0, missing: 0, suspect: 0, needsReview: 0 },
    duplicates: [],
    flaggedRecipes: [],
  };

  const fingerprintMap: Record<string, NormalizedRecipe[]> = {};

  // 1. Group by fingerprint
  recipes.forEach(r => {
    const status = r.imageMetadata?.status || 'correct';
    report.stats[status === 'needs-review' ? 'needsReview' : status]++;

    if (r.imageMetadata?.fingerprint) {
      const fp = r.imageMetadata.fingerprint;
      if (!fingerprintMap[fp]) fingerprintMap[fp] = [];
      fingerprintMap[fp].push(r);
    }

    if (status !== 'correct') {
      report.flaggedRecipes.push({
        id: r.id,
        title: r.title,
        imageMetadata: r.imageMetadata
      });
    }
  });

  // 2. Identify duplicates
  Object.entries(fingerprintMap).forEach(([fp, group]) => {
    if (group.length > 1) {
      // We have a duplicate. Check if it's "suspicious" (across different categories)
      // For now, any duplicate is worth a 'needs-review' flag
      report.duplicates.push({
        fingerprint: fp,
        recipes: group.map(r => ({ id: r.id, title: r.title }))
      });

      // Update the metadata for these recipes to 'needs-review' if they aren't already flagged worse
      group.forEach(r => {
        if (r.imageMetadata && r.imageMetadata.status === 'correct') {
          r.imageMetadata.status = 'needs-review';
          r.imageMetadata.reasons.push(IMAGE_AUDIT_REASONS.DUPLICATE_URL);
          // If we mutated a 'correct' one, we should move it to flagged list
          if (!report.flaggedRecipes.find(fr => fr.id === r.id)) {
            report.flaggedRecipes.push({
                id: r.id,
                title: r.title,
                imageMetadata: r.imageMetadata
            });
            report.stats.correct--;
            report.stats.needsReview++;
          }
        }
      });
    }
  });

  return report;
}
