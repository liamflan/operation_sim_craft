import { generatePlan } from './data/planner/orchestrator';
import { FULL_RECIPE_LIST } from './data/planner/recipeRegistry';
import { buildSlotContracts } from './data/planner/buildPlannerInput';
import { DEFAULT_ROUTINE } from './data/weeklyRoutine';
import { PlannedMealAssignment } from './data/planner/plannerTypes';

async function testRegenDay() {
  console.log("Starting testRegenDay script...");
  const routine = DEFAULT_ROUTINE;
  const payload = {
    selectedVibes: [FULL_RECIPE_LIST[0].id, FULL_RECIPE_LIST[1].id, FULL_RECIPE_LIST[2].id],
    diet: 'Omnivore' as any
  };

  const planId = 'test_plan_1';
  console.log("1. Building initial week contracts...");
  const initialContracts = buildSlotContracts(planId, routine, payload);
  
  console.log("2. Generating initial full week...");
  const initialOutput = generatePlan(initialContracts, FULL_RECIPE_LIST, 'planner_autofill', []);
  console.log(`Initial assignments generated: ${initialOutput.assignments.length}`);

  // Test Case: Regen day 0 (Monday) with no locks
  const dayIndex = 0;
  console.log(`\n--- Test Case: Regen Day ${dayIndex} (No Locks) ---`);
  
  const preservedAssignments = initialOutput.assignments.filter(
    (a: PlannedMealAssignment) => !(a.dayIndex === dayIndex && a.state !== 'locked' && a.state !== 'skipped')
  );

  const rerollCount = initialOutput.assignments.length - preservedAssignments.length;
  console.log(`Preserved (Fixed): ${preservedAssignments.length}`);
  console.log(`To Reroll: ${rerollCount}`);

  if (rerollCount === 0) {
    console.log("Error: Nothing to reroll.");
  } else {
    try {
      const startTime = Date.now();
      const newOutput = generatePlan(initialContracts, FULL_RECIPE_LIST, 'regenerate_request', preservedAssignments);
      const duration = Date.now() - startTime;
      console.log(`Success! Regenerated in ${duration}ms. New assignments: ${newOutput.assignments.length}`);
      console.log(`Engine: ${newOutput.executionMeta.enginePath}, Mode: ${newOutput.executionMeta.planningMode}`);
      
      const monAssignments = newOutput.assignments.filter(a => a.dayIndex === 0).map(a => `${a.slotType}: ${a.recipeId} (${a.state})`);
      console.log("Monday's new plan:\n", monAssignments.join('\n '));
    } catch (e) {
      console.error("Failed during generatePlan:", e);
    }
  }
}

testRegenDay().catch(console.error);
