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

async function debug() {
  const user = {
    id: 'test-user',
    name: 'Test',
    targetMacros: { calories: 2200, protein: 160, carbs: 220, fats: 80 },
    budgetWeekly: 60,
    dietaryPreference: 'Vegan',
    allergies: [],
  };

  console.log('Running Vegan 2200/160 diagnostic...');
  const res = await planWeekWithDiagnostics(user, DEFAULT_ROUTINE);
  const compliance = res.resolvedPlan.meta.compliance;
  
  console.log('--- COMPLIANCE RESULT ---');
  console.log(JSON.stringify(compliance, null, 2));
  
  if (!compliance.isHardRuleValid) {
    console.log('\n--- DIAGNOSIS ---');
    if (!compliance.isStructurallyValid) console.log('- FAILED: isStructurallyValid');
    if (!compliance.sameDayVarietyPassed) console.log('- FAILED: sameDayVarietyPassed');
    if (!compliance.effectiveRepeatCapsPassed) console.log('- FAILED: effectiveRepeatCapsPassed');
    if (!compliance.dietCompliancePassed) console.log('- FAILED: dietCompliancePassed');
    if (!compliance.allergenCompliancePassed) console.log('- FAILED: allergenCompliancePassed');
  }

  // Check counts
  const counts = {};
  res.resolvedPlan.days.forEach(d => {
    ['breakfast', 'lunch', 'dinner'].forEach(s => {
      const rid = d[s]?.recipeId;
      if (rid) counts[rid] = (counts[rid] || 0) + 1;
    });
  });
  console.log('\n--- RECIPE COUNTS ---');
  console.log(JSON.stringify(counts, null, 2));
}

debug();
