import * as fs from 'fs';
import * as path from 'path';
import { generatePlan } from '../data/planner/orchestrator';
import { 
  curatedRoast, 
  curatedPasta, 
  generatedLentilStew, 
  typicalDinnerContract 
} from '../data/planner/plannerFixtures';

function main() {
  const recipes = [curatedRoast, curatedPasta, generatedLentilStew];
  
  // 1-Day Plan
  const oneDayContracts = [
    { ...typicalDinnerContract, slotType: 'breakfast', budgetEnvelopeGBP: 1.50, macroTargets: { calories: { min: 300, ideal: 400, max: 600 }, protein: { min: 15, ideal: 25 } } },
    { ...typicalDinnerContract, slotType: 'lunch', budgetEnvelopeGBP: 2.50, macroTargets: { calories: { min: 400, ideal: 500, max: 700 }, protein: { min: 20, ideal: 30 } } },
     typicalDinnerContract 
  ];

  const oneDayPlan = generatePlan(oneDayContracts, recipes, 'planner_autofill');

  // 7-Day Plan (just repeat the contracts)
  const sevenDayContracts = Array.from({ length: 7 }).flatMap((_, i) => 
    oneDayContracts.map(c => ({ ...c, dayIndex: i }))
  );
  
  const sevenDayPlan = generatePlan(sevenDayContracts, recipes, 'planner_autofill');

  const output = {
    oneDayPlan,
    sevenDayPlan
  };

  const outPath = path.join(__dirname, '../data/planner/golden-outputs.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote golden outputs to ${outPath}`);
}

main();
