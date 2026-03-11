import { WAVE2_FIXTURES } from './planner/wave2Fixtures';

let allPassed = true;

WAVE2_FIXTURES.forEach(r => {
  console.log(`Verifying: ${r.title}`);
  
  // Phase 21 core constraints
  if (r.activePrepMinutes > r.totalMinutes) {
    console.error(`  [X] activePrep > totalMinutes`);
    allPassed = false;
  }
  if (r.complexityScore < 1 || r.complexityScore > 5) {
    console.error(`  [X] complexity outside 1-5`);
    allPassed = false;
  }
  if (r.imageUrl) {
    console.error(`  [X] imageUrl present, should be omitted for fallback policy`);
    allPassed = false;
  }
  
  // Bucket target checks (basic heuristics)
  if (r.id.includes('lamb') || r.id.includes('risotto')) {
    if (r.totalMinutes < 60) {
      console.error(`  [X] Premium meal totalMinutes < 60`);
      allPassed = false;
    }
  }
  if (r.id.includes('sausage') || r.id.includes('caprese')) {
    if (r.totalMinutes < 45) {
       console.error(`  [X] Batch cook totalMinutes < 45`);
       allPassed = false;
    }
    if (r.activePrepMinutes > 10) {
       console.error(`  [X] Batch cook activePrep > 10`);
       allPassed = false;
    }
  }
});

if (allPassed) {
  console.log('All Wave 2 recipes pass constraints and targets.');
} else {
  console.log('Wave 2 validation FAILED.');
}
