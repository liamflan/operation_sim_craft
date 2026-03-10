import { generatePlan } from './orchestrator';
import { 
  curatedRoast, 
  curatedPasta, 
  generatedLentilStew, 
  typicalDinnerContract, 
  exhaustedBudgetDinnerContract 
} from './plannerFixtures';

const recipes = [curatedRoast, curatedPasta];

console.log('--- TEST 2: detects pool collapse ---');
const t2 = generatePlan([exhaustedBudgetDinnerContract], recipes, 'planner_autofill');
console.dir(t2.diagnostics[0].topFailureReasons, { depth: null });
console.log('Action Taken:', t2.diagnostics[0].actionTaken);

console.log('\n--- TEST 3: assigns rescue recipe normally ---');
const rescuePool = [...recipes, generatedLentilStew];
const t3 = generatePlan([exhaustedBudgetDinnerContract], rescuePool, 'planner_autofill');
console.dir(t3.diagnostics[0].topFailureReasons, { depth: null });
console.log('Action Taken:', t3.diagnostics[0].actionTaken);

console.log('\n--- TEST 6: blocks same day duplicates ---');
const looseContract = { ...typicalDinnerContract, repeatCap: 5, dayIndex: 0 };
const mondayLunch = { ...looseContract, slotType: 'lunch' as const };
const mondayDinner = { ...looseContract, slotType: 'dinner' as const };
const duplicatePool = [
  { ...curatedRoast, suitableFor: ['lunch', 'dinner'] as any },
  { ...curatedPasta, suitableFor: ['lunch', 'dinner'] as any }
];
const t6 = generatePlan([mondayLunch, mondayDinner], duplicatePool, 'planner_autofill');
console.dir(t6.diagnostics[1].topFailureReasons, { depth: null });
console.log('Assignment 1 Recipe:', t6.assignments[0].recipeId);
console.log('Assignment 2 Recipe:', t6.assignments[1].recipeId);
