/**
 * actions.ts
 * Pure functions representing state transitions on the planner assignments. 
 * These strictly capture the context making the decisions auditable.
 */

import {
  PlannerCandidate,
  PlannedMealAssignment,
  SlotContract,
  ActorType,
  RescueFailureReason
} from './plannerTypes';

/**
 * Assigns a candidate to a slot, cementing exactly WHY it was chosen at this moment.
 */
export function assignCandidateToSlot(
  assignment: PlannedMealAssignment,
  candidate: PlannerCandidate,
  contract: SlotContract, // We take the contract to snapshot the truth
  actor: ActorType
): PlannedMealAssignment {
  return {
    ...assignment,
    state: 'proposed',
    candidateId: candidate.id,
    recipeId: candidate.recipeId,
    decisionSnapshot: {
      scores: candidate.scores,
      insights: candidate.insights,
      budgetConstraintAtTimeOfDecision: contract.budgetEnvelopeGBP,
      proteinTargetAtTimeOfDecision: contract.macroTargets.protein.ideal
    },
    metrics: {
      ...assignment.metrics,
      autoFilledBy: actor
    }
  };
}

export function lockSlot(assignment: PlannedMealAssignment): PlannedMealAssignment {
  if (!assignment.candidateId) {
    throw new Error("Cannot lock an empty assignment.");
  }
  return {
    ...assignment,
    state: 'locked'
  };
}

/**
 * A direct swap by a user.
 */
export function swapSlot(
  assignment: PlannedMealAssignment,
  newCandidate: PlannerCandidate,
  contract: SlotContract
): PlannedMealAssignment {
  const swapped = assignCandidateToSlot(assignment, newCandidate, contract, 'swap_request');
  return {
    ...swapped,
    state: 'locked', // Explicit UI swap freezes the meal
    metrics: {
      ...swapped.metrics,
      swappedCount: (assignment.metrics.swappedCount || 0) + 1
    }
  };
}

/**
 * Flushes a slot, preparing it for a generative/autofill pipeline.
 * We want to retain *why* it failed before, if we know it.
 */
export function regenerateSlot(
  assignment: PlannedMealAssignment,
  failureContext?: RescueFailureReason[]
): PlannedMealAssignment {
  
  const priorFails = { ...(assignment.metrics.priorFailedCandidateCounts || {}) };
  
  // Aggregate existing failures into context for the rescue engine
  if (failureContext) {
    failureContext.forEach(r => {
      priorFails[r] = (priorFails[r] || 0) + 1;
    });
  }

  return {
    ...assignment,
    state: 'generating',
    candidateId: null,
    recipeId: null,
    rescueData: undefined, // Cleared for fresh run
    decisionSnapshot: undefined,
    metrics: {
      ...assignment.metrics,
      priorFailedCandidateCounts: priorFails
    }
  };
}

export function regenerateDay(assignments: PlannedMealAssignment[], dayIndex: number): PlannedMealAssignment[] {
  return assignments.map(a => 
    a.dayIndex === dayIndex && a.state !== 'locked' && a.state !== 'cooked'
      ? regenerateSlot(a)
      : a
  );
}

export function regenerateWeek(assignments: PlannedMealAssignment[]): PlannedMealAssignment[] {
  return assignments.map(a => 
    a.state !== 'locked' && a.state !== 'cooked'
      ? regenerateSlot(a)
      : a
  );
}
