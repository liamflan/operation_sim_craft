import { FULL_RECIPE_LIST } from './data/planner/recipeRegistry';
import { isRecipeAllowedForBaselineDiet } from './data/planner/dietRules';
import { buildPlannerInput } from './data/plannerInputBuilder';

const workspace = {
  userDiet: 'Vegan',
  input: {
    payload: {
      targetCalories: 2400,
      budgetWeekly: 50
    }
  }
};

const routine = {
  id: 'dev-routine',
  days: []
};

// Mock diag to simulate 'done' with plan
const diag = {
    resolvedPlan: { days: [] }
};
const status = 'done';

function generateSample() {
    const currentDiet = workspace.userDiet;
    const proteinTargetPerMeal = 160 / 3;
    
    const liveUser = {
      id: 'dev', name: 'Dev',
      targetMacros: { calories: workspace.input.payload.targetCalories, protein: 160, carbs: 220, fats: 80 },
      budgetWeekly: workspace.input.payload.budgetWeekly,
      dietaryPreference: currentDiet as any,
      allergies: [],
    };
    const projectInput = buildPlannerInput(liveUser, routine as any);

    const totalRecipes = FULL_RECIPE_LIST.length;
    const dietAllowed = FULL_RECIPE_LIST.filter(r => isRecipeAllowedForBaselineDiet(r as any, currentDiet as any));
    const eligibilitySafe = dietAllowed.filter(r => projectInput.candidates.some(c => c.id === r.id));
    const proteinSafe = eligibilitySafe.filter(r => r.macrosPerServing.protein >= proteinTargetPerMeal);
    
    const dietClassified = FULL_RECIPE_LIST.filter(r => (r.tags || []).some(t => ['vegan', 'vegetarian', 'pescatarian'].includes(t.toLowerCase()))).length;
    const veganEligible = FULL_RECIPE_LIST.filter(r => isRecipeAllowedForBaselineDiet(r as any, 'Vegan')).length;
    const veggieEligible = FULL_RECIPE_LIST.filter(r => isRecipeAllowedForBaselineDiet(r as any, 'Vegetarian')).length;
    const pesciEligible = FULL_RECIPE_LIST.filter(r => isRecipeAllowedForBaselineDiet(r as any, 'Pescatarian')).length;
    const omniEligible = FULL_RECIPE_LIST.filter(r => isRecipeAllowedForBaselineDiet(r as any, 'Omnivore')).length;

    const dietMatches = projectInput.profile.dietaryPreference === workspace.userDiet;
    const caloriesMatch = projectInput.profile.targetCalories === (workspace.input.payload.targetCalories);
    const proteinMatch = projectInput.profile.targetProteinG === 160;
    const budgetMatch = projectInput.profile.weeklyBudgetGBP === (workspace.input.payload.budgetWeekly);
    const isSync = dietMatches && caloriesMatch && proteinMatch && budgetMatch;

    const isDegraded = proteinSafe.length === 0 && diag?.resolvedPlan !== null && status === 'done';
    const planningMode = isDegraded ? 'degraded_due_to_infeasible_protein_target' : 'standard';

    const activeWarning = dietAllowed.length === 0 ? `No recipes classified for ${currentDiet}` : 
                         proteinSafe.length < 5 ? `Insufficient ${currentDiet} recipes meet protein target` : 
                         isDegraded ? `Protein target infeasible - planner continued in degraded mode using best-available diet-compliant candidates` : 
                         null;

    const failureClass = dietAllowed.length === 0 ? 'Metadata Issue / Empty Pool' : 
                         proteinSafe.length < 5 ? 'Genuine Dataset Shortage' : 
                         !isSync ? 'Wiring/Sync Bug' : 'None Detected';

    let summary = `# PLANNER DIAGNOSTIC SUMMARY\n`;
    summary += `Generated: ${new Date().toISOString()}\n`;
    summary += `Status: ${status}\n`;
    summary += `Planning Mode: ${isDegraded ? '⚠ DEGRADED (Protein Infeasible)' : 'STANDARD'}\n\n`;
    
    summary += `## Dietary Context\n`;
    summary += `- Diet: ${workspace.userDiet}\n`;
    summary += `- Calories: ${workspace.input.payload.targetCalories}\n`;
    summary += `- Protein: 160g\n`;
    summary += `- Budget: £${workspace.input.payload.budgetWeekly}\n\n`;

    summary += `## State Sync\n`;
    summary += `- Diet Sync: ${dietMatches ? '✅' : '❌'}\n`;
    summary += `- Calories Sync: ${caloriesMatch ? '✅' : '❌'}\n`;
    summary += `- Protein Sync: ${proteinMatch ? '✅' : '❌'}\n`;
    summary += `- Budget Sync: ${budgetMatch ? '✅' : '❌'}\n`;
    summary += `- Classification: ${failureClass}\n\n`;

    summary += `## Candidate Funnel (${currentDiet})\n`;
    summary += `- Total Recipes in Registry: ${totalRecipes}\n`;
    summary += `- 1. After Diet Filter: ${dietAllowed.length}\n`;
    summary += `- 2. After Eligibility (Allergens/Usability): ${eligibilitySafe.length}\n`;
    summary += `- 3. After Protein Filter (${Math.round(proteinTargetPerMeal)}g+): ${proteinSafe.length}\n\n`;

    summary += `## Candidate Samples\n`;
    summary += `### After Diet Filter:\n${dietAllowed.slice(0, 3).map(r => ` - ${r.title} (${r.id}) [P: ${r.macrosPerServing.protein}g]`).join('\n') || 'None'}\n`;
    summary += `### After Protein Filter:\n${proteinSafe.slice(0, 3).map(r => ` - ${r.title} (${r.id}) [P: ${r.macrosPerServing.protein}g]`).join('\n') || 'None'}\n\n`;

    if (activeWarning) {
      summary += `## Active Warnings/Errors\n- ${activeWarning}\n\n`;
    }

    const diagnostic = {
      failureClassification: failureClass,
      planningMode,
      activeWarnings: activeWarning ? [activeWarning] : [],
      diagnosticSummary: {
        persistedContext: {
          diet: workspace.userDiet,
          calories: workspace.input.payload.targetCalories,
          protein: 160,
          budget: workspace.input.payload.budgetWeekly,
          exclusions: [],
        },
        plannerInputProjection: {
          diet: projectInput.profile.dietaryPreference,
          calories: projectInput.profile.targetCalories,
          protein: projectInput.profile.targetProteinG,
          budget: projectInput.profile.weeklyBudgetGBP,
          projectedUsableCandidateCount: projectInput.candidates.length,
          exclusions: projectInput.profile.allergies,
        },
        stateSync: {
          isSync,
          dietMatches,
          caloriesMatch,
          proteinMatch,
          budgetMatch,
        },
        registryAudit: { 
          totalRecipes: totalRecipes, 
          dietClassifiedRecipes: dietClassified, 
          veganEligible, 
          vegetarianEligible: veggieEligible, 
          pescatarianEligible: pesciEligible, 
          omnivoreEligible: omniEligible 
        },
        activeDietFunnel: {
          total: totalRecipes,
          postDiet: dietAllowed.length,
          postEligibility: eligibilitySafe.length,
          postProtein: proteinSafe.length,
        },
        candidateSamples: {
          afterDiet: dietAllowed.slice(0, 5).map(r => ({ id: r.id, title: r.title, protein: r.macrosPerServing.protein })),
          afterProtein: proteinSafe.slice(0, 5).map(r => ({ id: r.id, title: r.title, protein: r.macrosPerServing.protein })),
        }
      }
    };

    console.log(summary);
    console.log('---\n# FULL DIAGNOSTIC JSON (TRUNCATED)');
    console.log(JSON.stringify(diagnostic, null, 2));
}

generateSample();
