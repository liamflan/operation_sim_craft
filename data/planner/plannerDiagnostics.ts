/**
 * plannerDiagnostics.ts
 * Dedicated diagnostic helpers for the Provision Planner.
 * Strictly decoupled from runtime logic to ensure zero behavior drift.
 */

import { 
  RescueFailureReason, 
  FriendlyFailureCategory, 
  NormalizedRecipe, 
  SlotContract, 
  PlannerCandidate, 
  LunchDinnerSemanticAudit,
  OrchestratorOutput
} from './plannerTypes';

/**
 * Maps raw technical failure reasons to high-level "friendly" categories for easier diagnosis.
 */
export function classifyFailure(reasons: RescueFailureReason[]): FriendlyFailureCategory {
  if (reasons.includes('no_slot_match')) return 'no_slot_match';
  if (reasons.includes('budget_delta_exceeded')) return 'budget_too_tight';
  
  if (reasons.includes('protein_minimum_failed') || 
      reasons.includes('calorie_minimum_failed') || 
      reasons.includes('calorie_maximum_exceeded')) {
    return 'protein_or_calorie_target_mismatch';
  }
  
  if (reasons.includes('dietary_mismatch') || reasons.includes('exclusion_ingredient_match')) {
    return 'exclusions_or_diet_conflict';
  }
  
  if (reasons.includes('repeat_cap_exhausted')) return 'repeat_cap_exhausted';
  if (reasons.includes('archetype_cap_exhausted')) return 'archetype_cap_exhausted';
  if (reasons.includes('not_planner_usable')) return 'planner_usable_false';
  
  if (reasons.includes('candidate_pool_empty')) return 'fallback_exhausted';
  
  return 'unknown';
}

/**
 * Performs a semantic audit of a lunch/dinner assignment to flag potential "feeling" mismatches.
 */
export function performSemanticAudit(
  recipe: NormalizedRecipe, 
  contract: SlotContract,
  scores: PlannerCandidate['scores']
): LunchDinnerSemanticAudit {
  const audit: LunchDinnerSemanticAudit = {
    assignedRecipeId: recipe.id,
    assignedTitle: recipe.title,
    slotType: contract.slotType,
    suitableFor: recipe.suitableFor,
    archetype: recipe.archetype,
    totalMinutes: recipe.totalMinutes,
    activePrepMinutes: recipe.activePrepMinutes,
    leftoverFriendly: !!recipe.leftoverFriendly,
    batchFriendly: !!recipe.batchFriendly,
    scoreBreakdown: scores
  };

  // Heuristic for "Dinner-heavy" meals in Lunch
  if (contract.slotType === 'lunch') {
    if (recipe.totalMinutes > 45) {
      audit.semanticMismatchWarning = 'Long duration for lunch (>45m)';
    } else if (recipe.archetype === 'premium_meal' || recipe.archetype === 'Splurge') {
      audit.semanticMismatchWarning = 'Premium/Splurge archetype in lunch';
    } else if (recipe.suitableFor.includes('dinner') && !recipe.suitableFor.includes('lunch')) {
      audit.semanticMismatchWarning = 'Not marked as suitable for lunch';
    }
  }

  // Heuristic for "Lunch-only" styles in Dinner
  if (contract.slotType === 'dinner') {
    if (recipe.archetype === 'Quick_Fix' && recipe.totalMinutes < 15) {
      audit.semanticMismatchWarning = 'Very light Quick Fix for dinner (<15m)';
    }
  }

  return audit;
}

/**
 * Technical diagnostic reporter to help developers debug planner issues.
 */
export function printPlannerDiagnosticReport(output: OrchestratorOutput) {
  console.log('\n========= STRICT PLANNER DIAGNOSTIC REPORT =========');
  console.log(`Run ID: ${output.executionMeta?.runId || 'N/A'}`);
  console.log(`Actor: ${output.executionMeta?.actor || 'N/A'}`);
  console.log(`Contracts: ${output.executionMeta?.contractCount || 0}`);
  console.log(`Recipe Pool: ${output.executionMeta?.recipeCount || 0}`);
  console.log(`Timestamp: ${output.executionMeta?.timestamp || new Date().toISOString()}`);
  console.log('----------------------------------------------------');

  output.diagnostics.forEach(diag => {
    const statusIcon = diag.actionTaken === 'failed_completely' ? '❌' : (diag.rescueTriggered ? '⚠️' : '✅');
    console.log(`${statusIcon} SLOT: ${diag.slotId} [${diag.actionTaken}]`);
    console.log(`   - Candidates: Total=${diag.totalConsidered}, Eligible=${diag.eligibleCount}, Rejected=${diag.rejectedCount}`);
    
    if (diag.rejectedCount > 0) {
      const topReasons = Object.entries(diag.topFailureReasons).sort((a, b) => b[1] - a[1]).slice(0, 3);
      if (topReasons.length > 0) {
        console.log('   - Top Rejection Reasons:');
        topReasons.forEach(([reason, count]) => {
          console.log(`     * ${reason}: ${count}`);
        });
      }
    }

    if (diag.nearMisses.length > 0) {
      console.log('   - Near Misses (Top 3):');
      diag.nearMisses.slice(0, 3).forEach(miss => {
        console.log(`     * "${miss.title}" (Predicted Score: ${Math.round(miss.score || 0)}) - Failures: [${miss.failureReasons.join(', ')}]`);
      });
    }

    if (diag.assignmentExplanation) {
      const exp = diag.assignmentExplanation;
      console.log(`   - Assigned: "${exp.assignedTitle}" (${exp.archetype}) [Score: ${diag.bestScoreAchieved}]`);
      if (exp.winnerMargin !== undefined) {
        console.log(`     * Winner Margin: +${exp.winnerMargin} points over next eligible`);
      }
      if (diag.semanticAudit?.semanticMismatchWarning) {
        console.log(`     ⚠️  SEMANTIC WARNING: ${diag.semanticAudit.semanticMismatchWarning}`);
      }

      if (diag.topAlternatives && diag.topAlternatives.length > 0) {
        console.log('   - Top Eligible Alternatives:');
        diag.topAlternatives.slice(0, 3).forEach((alt, idx) => {
          console.log(`     ${idx + 1}. "${alt.title}" (${alt.archetype}) [Score: ${alt.score}] - Margin: -${alt.margin}`);
        });
      }
    }
    console.log(' ');
  });
  console.log('====================================================\n');
}
