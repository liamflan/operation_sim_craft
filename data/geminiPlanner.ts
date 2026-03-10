// ─── Gemini Planner API Call ──────────────────────────────────────────────────
//
// Builds the structured prompt, calls Gemini with JSON mode, and returns
// the raw parsed response. All validation happens in plannerValidation.ts.

import { Platform } from 'react-native';
import { PlannerInput, PlannerRawOutput } from './plannerSchema';

const MODEL_ID = 'gemini-2.5-flash-lite'; // Synced with server expectation

// Production URL for Native environments, relative for Web
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || '';
const PROXY_URL = `${API_BASE}/api/generateContent`;

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(input: PlannerInput): string {
  const slotList = input.slotsToFill
    .map(s => `  - ${s.day} ${s.slot}`)
    .join('\n');

  const totalSlots = input.slotsToFill.length;
  const perMealBudget = totalSlots > 0 ? (input.profile.weeklyBudgetGBP / totalSlots) : 0;

  const candidateList = input.candidates
    .map(c => {
      const share = input.profile.weeklyBudgetGBP > 0
        ? Math.round((c.estimatedCostGBP / input.profile.weeklyBudgetGBP) * 100)
        : 0;
      return (
        `  - [${c.archetype}] id: "${c.id}", title: "${c.title}", suitableFor: [${c.suitableFor.join(', ')}], ` +
        `calories: ${c.macros.calories}, protein: ${c.macros.protein}g, ` +
        `tags: [${c.tags.join(', ')}], pantryIngredients: ${c.pantryIngredients.length > 0 ? 'yes' : 'none'}, ` +
        `cost: £${c.estimatedCostGBP.toFixed(2)} (${share}% of weekly budget)`
      );
    })
    .join('\n');

  const pantryList = input.pantrySignals
    .filter(p => p.status !== 'out')
    .map(p => `  - ${p.name}: ${p.status}`)
    .join('\n') || '  (none)';

  const comp = input.composition;
  const compStr = Object.entries(comp.archetypeCounts)
    .filter(([_, count]) => count > 0)
    .map(([arch, count]) => `  - ${arch}: ${count} slot(s)`)
    .join('\n');

  const capsStr = Object.entries(comp.archetypeRepeatCaps)
    .map(([arch, cap]) => `  - ${arch}: max ${cap} repeats`)
    .join('\n');

  return `
You are a weekly meal planner for a nutrition and grocery app called Provision.
Your only output is a valid JSON object — no prose, no markdown, no extra text.

PLANNING CONTEXT:
- Dietary preference: ${input.profile.dietaryPreference}
- Allergies/exclusions: ${input.profile.allergies.join(', ') || 'none'}
- Calorie target: ${input.profile.targetCalories} kcal/day
- Protein target: ${input.profile.targetProteinG}g/day
- Goals: ${input.profile.goalTags.join(', ') || 'none specified'}
- Weekly budget: £${input.profile.weeklyBudgetGBP.toFixed(2)} HARD LIMIT
- Slots to fill: ${totalSlots} meals → average budget per meal = £${perMealBudget.toFixed(2)}

WEEKLY COMPOSITION STRATEGY (Prioritise this exact mix of meal archetypes):
${compStr || '  (no specific archetype targets)'}

PER-ARCHETYPE REPEAT CAPS (Do not exceed these limits across the week):
${capsStr}

SLOTS TO FILL (only these need a recipe):
${slotList}

AVAILABLE RECIPES (candidates — use IDs exactly as shown, cost shown as £ and % of weekly budget):
${candidateList}

PANTRY (well-stocked ingredients to help reduce shopping cost):
${pantryList}

INSTRUCTIONS:
1. Assign exactly one recipe from the candidates list to each slot in SLOTS TO FILL
2. Use only the recipe IDs provided above — DO NOT invent IDs by adding prefixes/suffixes. Use only exact recipe IDs from the candidates list.
3. BUDGET CONSTRAINT (HIGHEST PRIORITY): The sum of all recipe costs MUST stay at or below £${input.profile.weeklyBudgetGBP.toFixed(2)}. Recipes marked with a high % of weekly budget should be used sparingly or avoided if cheaper alternatives are nutritionally adequate
4. COMPOSITION TARGET: Select recipes whose [archetype] tags match the counts requested in the WEEKLY COMPOSITION STRATEGY section
5. REPETITION: Absolutely do not exceed the max repeats defined in the PER-ARCHETYPE REPEAT CAPS section
6. Prefer recipes that use pantry ingredients to further reduce shopping cost
7. Aim for variety across days — the same recipe should not appear on consecutive days if avoidable
8. Each planned day should have meals totalling close to ${input.profile.targetCalories} kcal. Prioritise filling calorie-light slots (e.g. breakfast) with higher-calorie options
9. Honour goal tags where possible (e.g. prefer high-protein recipes if "High Protein" is in goals)
10. You MAY include an optional "summary" object. Only include a plannerNote if you have a genuinely useful observation — do not claim the plan is within budget unless you have verified the total cost

RESPONSE FORMAT — return this exact JSON shape and nothing else:
{
  "assignments": [
    { "day": "Mon", "slot": "breakfast", "recipeId": "r3" },
    ...
  ],
  "summary": {
    "estimatedPlannedCostGBP": 42.50,
    "estimatedPlannedCalories": 14200,
    "estimatedPlannedProteinG": 840,
    "pantryIngredientsUsed": ["i8", "i7"],
    "plannerNote": "Prioritised pantry-heavy breakfasts to stay within budget."
  }
}
`.trim();
}

// ─── API Call (Proxy) ─────────────────────────────────────────────────────────

export async function callGeminiPlanner(input: PlannerInput): Promise<PlannerRawOutput> {
  const prompt = buildPrompt(input);

  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const status = response.status;
    const isLocal404 = status === 404 && !API_BASE;
    
    let msg = errorData.error || `Generation failed: ${status}`;
    if (isLocal404) {
      msg = `API 404 on localhost. Ensure you are running with 'vercel dev' or have set EXPO_PUBLIC_API_BASE_URL.`;
    }
    
    const error = new Error(msg);
    (error as any).status = status;
    (error as any).code = errorData.code;
    throw error;
  }

  // Validated JSON return directly from proxy
  return await response.json() as PlannerRawOutput;
}

export { MODEL_ID as PLANNER_MODEL_VERSION };
