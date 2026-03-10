const fs = require('fs');
const path = require('path');

// FORCE ENV LOADING
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
}

const { planWeekWithDiagnostics } = require('./data/engine');
const { DEFAULT_ROUTINE } = require('./data/weeklyRoutine');
const { FULL_RECIPE_CATALOG } = require('./data/planner/recipeRegistry');

const scenarios = [
  { name: 'Vegan / 2200 / 160', diet: 'Vegan', cals: 2200, prot: 160 },
  { name: 'Vegetarian / 2200 / 160', diet: 'Vegetarian', cals: 2200, prot: 160 },
  { name: 'Pescatarian / 2200 / 160', diet: 'Pescatarian', cals: 2200, prot: 160 },
  { name: 'Omnivore / 2200 / 160', diet: 'Omnivore', cals: 2200, prot: 160 },
  { name: 'Vegan / 2200 / 120', diet: 'Vegan', cals: 2200, prot: 120 },
  { name: 'Vegetarian / 2200 / 130', diet: 'Vegetarian', cals: 2200, prot: 130 },
];

async function runScenarios() {
  const results = [];
  console.log(`Running ${scenarios.length} scenarios...\n`);

  for (const s of scenarios) {
    process.stdout.write(`> Testing ${s.name}... `);
    const user = {
      id: 'test-user',
      name: 'Test',
      targetMacros: { calories: s.cals, protein: s.prot, carbs: 200, fats: 70 },
      budgetWeekly: 60,
      dietaryPreference: s.diet,
      allergies: [],
    };

    try {
      const res = await planWeekWithDiagnostics(user, DEFAULT_ROUTINE);
      const compliance = res.resolvedPlan.meta.compliance;
      const enginePath = res.resolvedPlan.meta.source === 'fallback_mock' ? 'fallback_mock' : 'real_gemini';

      const hasInvalidId = res.resolvedPlan.meta.warnings?.some(w => w.includes('Invalid recipeId')) ?? false;
      const sameDayVarietyPassed = compliance?.sameDayVarietyPassed ?? false;
      const dietCompliancePassed = compliance?.dietCompliancePassed ?? false;
      const allergenCompliancePassed = compliance?.allergenCompliancePassed ?? false;

      results.push({
        name: s.name,
        enginePath,
        planningMode: res.resolvedPlan.meta.planningMode,
        isValid: res.stageBResult?.valid ?? false,
        isHardRuleValid: compliance?.isHardRuleValid ?? false,
        isTargetFeasible: compliance?.isTargetFeasible ?? false,
        calories: Math.round(res.stageBResult?.plan.summary.estimatedPlannedCalories || 0),
        protein: Math.round(res.stageBResult?.plan.summary.estimatedPlannedProteinG || 0),
        warnings: res.resolvedPlan.meta.warnings || [],
        hasInvalidId,
        sameDayVarietyPassed,
        dietCompliancePassed,
        allergenCompliancePassed
      });
      console.log('Done.');
    } catch (err) {
      console.log(`Failed: ${err.message}`);
      results.push({
        name: s.name,
        error: err.message
      });
    }
  }

  // GENERATE MARKDOWN REPORT
  let report = '# PHASE 19 FINAL BLOCKER VERIFICATION\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += '| Scenario | Engine | Hard-Rule Valid | Feasible | Variety | Diet | Allergen | Invalid ID | Mode |\n';
  report += '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n';

  for (const r of results) {
    if (r.error) {
      report += `| ${r.name} | ERROR | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | N/A (Error: ${r.error}) |\n`;
      continue;
    }
    const valid = r.isHardRuleValid ? '✅' : '❌';
    const feasible = r.isTargetFeasible ? '✅' : '❌';
    const variety = r.sameDayVarietyPassed ? '✅' : '❌';
    const diet = r.dietCompliancePassed ? '✅' : '❌';
    const allergen = r.allergenCompliancePassed ? '✅' : '❌';
    const invalidId = r.hasInvalidId ? '❌ (Found!)' : '✅ (None)';
    
    report += `| ${r.name} | ${r.enginePath} | ${valid} | ${feasible} | ${variety} | ${diet} | ${allergen} | ${invalidId} | ${r.planningMode} |\n`;
  }

  report += '\n## Detailed Metrics (Weekly Totals)\n\n';
  report += '| Scenario | Planned Calories | Planned Protein |\n';
  report += '| :--- | :--- | :--- |\n';
  for (const r of results) {
    if (r.error) continue;
    report += `| ${r.name} | ${r.calories} kcal | ${r.protein}g |\n`;
  }

  fs.writeFileSync('scenario_results_final_clean.md', report, 'utf8');
  fs.writeFileSync('scenario_results.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('\nResults written to scenario_results_final_clean.md and scenario_results.json');
}

runScenarios().catch(console.error);
