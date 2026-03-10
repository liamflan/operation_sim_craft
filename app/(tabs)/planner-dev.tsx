// ─── Planner Dev Screen ───────────────────────────────────────────────────────
//
// A lightweight debug playground for iterating on the Gemini planner.
// Not linked from the main nav — access via direct navigation: /(tabs)/planner-dev
//
// Shows: PlannerInput → raw Gemini output → Stage A → Stage B → merged plan → metadata

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  TextInput, Platform, Alert, LayoutAnimation
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { buildPlannerInput } from '../../data/plannerInputBuilder';

import { planWeekWithDiagnostics, PlannerDiagnostics } from '../../data/engine';
import { useWeeklyRoutine } from '../../data/WeeklyRoutineContext';
import { useActivePlan } from '../../data/ActivePlanContext';
import { DietaryBaseline } from '../../data/planner/plannerTypes';
import { isRecipeAllowedForBaselineDiet } from '../../data/planner/dietRules';
import { FULL_RECIPE_LIST, FULL_RECIPE_CATALOG } from '../../data/planner/recipeRegistry';

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children, accent }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <View className="mb-6">
      <View className={`px-3 py-1.5 rounded-lg mb-3 self-start ${accent ?? 'bg-gray-100 dark:bg-white/5'}`}>
        <Text className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{title}</Text>
      </View>
      {children}
    </View>
  );
}

function JSONBlock({ value }: { value: unknown }) {
  return (
    <View className="bg-gray-900 rounded-xl p-4">
      <Text
        className="text-green-400 text-xs font-mono"
        style={{ fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }}
        selectable
      >
        {JSON.stringify(value, null, 2)}
      </Text>
    </View>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View className={`px-3 py-1 rounded-full mr-2 mb-2 ${color}`}>
      <Text className="text-xs font-bold text-white">{label}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PlannerDevScreen() {
  const { routine } = useWeeklyRoutine();
  const { workspace } = useActivePlan();

  const [diag, setDiag] = useState<PlannerDiagnostics | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRawGemini, setShowRawGemini] = useState(false);
  const [showRawState, setShowRawState] = useState(false);

  const toggleRawState = () => setShowRawState(!showRawState);

  // Derived shortcuts for rendering
  const plannerInput  = diag?.plannerInput   ?? null;
  const rawOutput     = diag?.rawOutput      ?? null;
  const stageAResult  = diag?.stageAResult   ?? null;
  const suffResult    = diag?.suffResult     ?? null;
  const feasBounds    = diag?.feasBounds     ?? null;
  const stageBResult  = diag?.stageBResult   ?? null;
  const resolvedPlan  = diag?.resolvedPlan   ?? null;

  const copyToClipboard = async () => {
    // 1. Calculate Summary Data (Live)
    const currentDiet = workspace.userDiet as DietaryBaseline;
    const proteinTargetPerMeal = 160 / 3;
    
    // Project exactly what the builder does
    const liveUser = {
      id: 'dev', name: 'Dev',
      targetMacros: { calories: workspace.input?.payload.targetCalories ?? 2200, protein: 160, carbs: 220, fats: 80 },
      budgetWeekly: workspace.input?.payload.budgetWeekly ?? 60,
      dietaryPreference: currentDiet as any,
      allergies: [],
    };
    const projectInput = buildPlannerInput(liveUser, routine);

    const totalRecipes = FULL_RECIPE_LIST.length;
    const dietAllowed = FULL_RECIPE_LIST.filter(r => isRecipeAllowedForBaselineDiet(r, currentDiet));
    
    // The "Eligibility" stage filters by Allergies AND plannerUsable flag
    const eligibilitySafe = dietAllowed.filter(r => projectInput.candidates.some(c => c.id === r.id));
    const proteinSafe = eligibilitySafe.filter(r => r.macrosPerServing.protein >= proteinTargetPerMeal);
    
    const dietClassified = FULL_RECIPE_LIST.filter(r => (r.tags || []).some(t => ['vegan', 'vegetarian', 'pescatarian'].includes(t.toLowerCase()))).length;
    const veganEligible = FULL_RECIPE_LIST.filter(r => isRecipeAllowedForBaselineDiet(r, 'Vegan')).length;
    const veggieEligible = FULL_RECIPE_LIST.filter(r => isRecipeAllowedForBaselineDiet(r, 'Vegetarian')).length;
    const pesciEligible = FULL_RECIPE_LIST.filter(r => isRecipeAllowedForBaselineDiet(r, 'Pescatarian')).length;
    const omniEligible = FULL_RECIPE_LIST.filter(r => isRecipeAllowedForBaselineDiet(r, 'Omnivore')).length;

    const dietMatches = projectInput.profile.dietaryPreference === workspace.userDiet;
    const caloriesMatch = projectInput.profile.targetCalories === (workspace.input?.payload.targetCalories ?? 2200);
    const proteinMatch = projectInput.profile.targetProteinG === 160;
    const budgetMatch = projectInput.profile.weeklyBudgetGBP === (workspace.input?.payload.budgetWeekly ?? 60);
    const isSync = dietMatches && caloriesMatch && proteinMatch && budgetMatch;
    const compliance = diag?.resolvedPlan?.meta.compliance;
    const planningMode = diag?.resolvedPlan?.meta.planningMode || (proteinSafe.length === 0 ? 'degraded_due_to_infeasible_protein_target' : 'standard');

    const activeWarning = dietAllowed.length === 0 ? `No recipes classified for ${currentDiet}` : 
                         proteinSafe.length < 5 ? `Insufficient ${currentDiet} recipes meet protein target` : 
                         planningMode === 'degraded_due_to_infeasible_protein_target' ? `Protein target infeasible - planner continued in degraded mode using best-available diet-compliant candidates` : 
                         errorMsg || null;

    const failureClass = dietAllowed.length === 0 ? 'Metadata Issue / Empty Pool' : 
                         proteinSafe.length < 5 ? 'infeasible_protein_target_for_current_diet' : 
                         !isSync ? 'Wiring/Sync Bug' : 'None Detected';

    // 2. Build Markdown Summary
    let summary = `# PLANNER DIAGNOSTIC SUMMARY\n`;
    summary += `Generated: ${new Date().toISOString()}\n`;
    summary += `Status: ${status}\n`;
    summary += `Planning Mode: ${planningMode === 'degraded_due_to_infeasible_protein_target' ? '⚠ DEGRADED (Protein Infeasible)' : planningMode.toUpperCase()}\n\n`;
    
    summary += `## Dietary Context\n`;
    summary += `- Diet: ${workspace.userDiet}\n`;
    summary += `- Calories: ${workspace.input?.payload.targetCalories ?? 2200}\n`;
    summary += `- Protein: 160g\n`;
    summary += `- Budget: £${workspace.input?.payload.budgetWeekly ?? 60}\n\n`;

    summary += `## State Sync\n`;
    summary += `- Diet Sync: ${dietMatches ? '✅' : '❌'}\n`;
    summary += `- Calories Sync: ${caloriesMatch ? '✅' : '❌'}\n`;
    summary += `- Protein Sync: ${proteinMatch ? '✅' : '❌'}\n`;
    summary += `- Budget Sync: ${budgetMatch ? '✅' : '❌'}\n`;
    summary += `- Classification: ${failureClass}\n\n`;

    if (compliance) {
      summary += `## Compliance & Guardrails\n`;
      summary += `- Hard-rule validity: ${compliance.isHardRuleValid ? '✅' : '❌'}\n`;
      summary += `- Target feasibility: ${compliance.isTargetFeasible ? '✅' : '❌'}\n\n`;
      
      summary += `### Rule Breakdown\n`;
      summary += `- Structural Validity: ${compliance.isStructurallyValid ? '✅' : '❌'}\n`;
      summary += `- Same-Day Variety: ${compliance.sameDayVarietyPassed ? '✅' : '❌'}\n`;
      summary += `- Diet Compliance: ${compliance.dietCompliancePassed ? '✅' : '❌'}\n`;
      summary += `- Allergen Compliance: ${compliance.allergenCompliancePassed ? '✅' : '❌'}\n`;
      summary += `- Effective Repeat Caps: ${compliance.effectiveRepeatCapsPassed ? '✅' : '❌'}\n`;
      summary += `- Nominal (User) Caps: ${compliance.nominalRepeatCapsPassed ? '✅' : '❌'}\n`;
      summary += `- Calorie Threshold Fit: ${compliance.meetsTargetCalories ? '✅' : '⚠ Below 90%'}\n`;
      summary += `- Protein Threshold Fit: ${compliance.meetsTargetProtein ? '✅' : '⚠ Below 90%'}\n\n`;
    }

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

    // 3. Build Full JSON Payload
    const diagnostic = {
      failureClassification: failureClass,
      planningMode,
      compliance,
      activeWarnings: activeWarning ? [activeWarning] : [],
      diagnosticSummary: {
        persistedContext: {
          diet: workspace.userDiet,
          calories: workspace.input?.payload.targetCalories ?? 2200,
          protein: 160,
          budget: workspace.input?.payload.budgetWeekly ?? 60,
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
      },
      plannerInput:         diag?.plannerInput || projectInput,
      rawOutputFromGemini:  diag?.rawOutput,
      feasibilityChecks:    diag?.suffResult,
      stageAResult:         diag?.stageAResult,
      stageBResult:         diag?.stageBResult,
      mergedPlan:           diag?.resolvedPlan,
    };

    const finalPayload = `${summary}\n\n---\n# FULL DIAGNOSTIC JSON\n\`\`\`json\n${JSON.stringify(diagnostic, null, 2)}\n\`\`\``;
    
    await Clipboard.setStringAsync(finalPayload);
    Alert.alert('Copied!', 'Full diagnostic report copied to clipboard (Summary + JSON).');
  };

  async function runPipeline() {
    setStatus('running');
    setDiag(null);
    setErrorMsg(null);

    // Derive live user profile
    const user = {
      id: 'live-user',
      name: 'Live User',
      targetMacros: { 
        calories: workspace.input?.payload.targetCalories ?? 2200, 
        protein: 160, // Default for now, ideally sourced from payload/settings
        carbs: 220, 
        fats: 80 
      },
      budgetWeekly: workspace.input?.payload.budgetWeekly ?? 60,
      dietaryPreference: workspace.userDiet as any,
      allergies: [],
    };

    try {
      const result = await planWeekWithDiagnostics(user, routine);
      setDiag(result);

      if (result.errorMsg) {
        setErrorMsg(result.errorMsg);
        setStatus('error');
      } else {
        setStatus('done');
      }
    } catch (err) {
      setErrorMsg(String(err));
      setStatus('error');
    }
  }

  const toggleRawGemini = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowRawGemini(!showRawGemini);
  };

  const sourceColor = !resolvedPlan ? 'bg-gray-400' :
    resolvedPlan.meta.source === 'gemini_clean'    ? 'bg-avocado' :
    resolvedPlan.meta.source === 'gemini_warned'   ? 'bg-blue-400' :
    resolvedPlan.meta.source === 'gemini_repaired' ? 'bg-yellow-500' :
    resolvedPlan.meta.source === 'previous'        ? 'bg-blueberry' :
    'bg-red-400';

  return (
    <ScrollView className="flex-1 bg-cream dark:bg-darkcream" contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
      {/* Header */}
      <View className="mb-8">
        <View className="flex-row items-center gap-2 mb-1">
          <View className="px-2 py-0.5 bg-red-100 rounded">
            <Text className="text-red-500 text-[10px] font-bold uppercase tracking-widest">Dev Only</Text>
          </View>
        </View>
        <Text className="text-charcoal dark:text-darkcharcoal text-3xl font-extrabold tracking-tight">Planner Dev</Text>
        <Text className="text-gray-400 text-sm mt-1">Inspect the Gemini planning pipeline end-to-end.</Text>
      </View>

      {/* 0. NEW: Data Audit & Filtering Funnel */}
      <Section title="0 · Candidate Lifecycle Audit" accent="bg-blueberry/5">
        <View className="bg-white dark:bg-darkgrey rounded-xl p-5 border border-blueberry/10 mb-2">
          <View className="flex-row justify-between mb-4 border-b border-black/5 dark:border-white/5 pb-4">
            <View>
              <Text className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Dietary Context</Text>
              <Text className="text-charcoal dark:text-white font-bold text-lg">{workspace.userDiet}</Text>
            </View>
            <View className="items-end">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Protein Target</Text>
              <Text className="text-charcoal dark:text-white font-bold text-lg">160g/day</Text>
            </View>
          </View>

          {(() => {
            const total = FULL_RECIPE_LIST.length;
            const classified = FULL_RECIPE_LIST.filter(r => (r.tags || []).some(t => ['vegan', 'vegetarian', 'pescatarian'].includes(t.toLowerCase()))).length;
            
            const currentDiet = workspace.userDiet as DietaryBaseline;
            const postDiet = FULL_RECIPE_LIST.filter(r => isRecipeAllowedForBaselineDiet(r, currentDiet));
            
            // Heuristic for "post-protein" audit on dev screen
            const proteinTarget = 160 / 3; // Approx per meal
            const postProtein = postDiet.filter(r => r.macrosPerServing.protein >= proteinTarget);

            const veganCount = FULL_RECIPE_LIST.filter(r => isRecipeAllowedForBaselineDiet(r, 'Vegan')).length;
            const veggieCount = FULL_RECIPE_LIST.filter(r => isRecipeAllowedForBaselineDiet(r, 'Vegetarian')).length;
            const pesciCount = FULL_RECIPE_LIST.filter(r => isRecipeAllowedForBaselineDiet(r, 'Pescatarian')).length;

            return (
              <View className="gap-y-3">
                <View className="flex-row justify-between items-center">
                  <Text className="text-gray-500 text-xs">Total Recipes in Registry</Text>
                  <Text className="text-charcoal dark:text-white font-mono font-bold text-xs">{total}</Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-gray-500 text-xs">Diet-Classified Recipes</Text>
                  <Text className="text-charcoal dark:text-white font-mono font-bold text-xs">{classified}</Text>
                </View>
                <View className="h-[1px] bg-black/5 dark:bg-white/5 my-1" />
                <View className="flex-row gap-x-4 mb-2">
                   <Text className="text-[10px] font-bold text-avocado uppercase">Vegan: {veganCount}</Text>
                   <Text className="text-[10px] font-bold text-orange-400 uppercase">Veggie: {veggieCount}</Text>
                   <Text className="text-[10px] font-bold text-blue-400 uppercase">Pesci: {pesciCount}</Text>
                </View>
                
                <View className="bg-blueberry/5 p-4 rounded-xl border border-blueberry/10">
                  <Text className="text-blueberry font-bold text-[10px] uppercase tracking-widest mb-3">Filtering Funnel for {currentDiet}</Text>
                  
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-gray-500 text-xs italic">1. Total Candidates</Text>
                    <Text className="text-charcoal dark:text-white font-mono font-bold text-xs">{total}</Text>
                  </View>
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-gray-500 text-xs italic">2. After Diet Filter ({currentDiet})</Text>
                    <Text className={`${postDiet.length === 0 ? 'text-red-500' : 'text-charcoal dark:text-white'} font-mono font-bold text-xs`}>{postDiet.length}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-gray-500 text-xs italic">3. After Protein Filter ({Math.round(proteinTarget)}g+)</Text>
                    <Text className={`${postProtein.length < 10 ? 'text-red-500' : 'text-charcoal dark:text-white'} font-mono font-bold text-xs`}>{postProtein.length}</Text>
                  </View>
                </View>

                {postDiet.length === 0 && (
                   <View className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 flex-row items-center gap-3">
                     <Text className="text-red-600 font-bold text-xs">⚠ Critical: No recipes classified for {currentDiet}.</Text>
                   </View>
                )}
                {postDiet.length > 0 && postProtein.length < 5 && (
                   <View className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 flex-row items-center gap-3">
                     <Text className="text-red-600 font-bold text-xs">⚠ Warning: Insufficient {currentDiet} recipes meet protein target.</Text>
                   </View>
                )}
              </View>
            );
          })()}
        </View>
      </Section>

      {/* 0.5 State Comparison */}
      <Section title="0.5 · Live State Sync Verification" accent="bg-orange-50 dark:bg-orange-900/10">
        <View className="flex-row gap-4">
          <View className="flex-1 bg-white dark:bg-darkgrey rounded-xl p-4 border border-orange-200/50">
            <Text className="text-[10px] font-bold uppercase text-orange-400 mb-2">Workspace (Persisted)</Text>
            <View className="gap-y-1">
              <Text className="text-xs text-charcoal dark:text-white font-bold">Diet: {workspace.userDiet}</Text>
              <Text className="text-xs text-gray-500">Cals: {workspace.input?.payload.targetCalories ?? 'N/A'}</Text>
              <Text className="text-xs text-gray-500">Budget: £{workspace.input?.payload.budgetWeekly ?? 'N/A'}</Text>
            </View>
          </View>
          <View className="flex-1 bg-white dark:bg-darkgrey rounded-xl p-4 border border-orange-200/50">
             <Text className="text-[10px] font-bold uppercase text-orange-400 mb-2">Planner Input (Projected)</Text>
             {(() => {
               // Calculate the exact input the engine would receive
               const projectedInput = buildPlannerInput({
                 id: 'dev',
                 name: 'Dev',
                 targetMacros: { 
                   calories: workspace.input?.payload.targetCalories ?? 2200, 
                   protein: 160, 
                   carbs: 220, 
                   fats: 80 
                 },
                 budgetWeekly: workspace.input?.payload.budgetWeekly ?? 60,
                 dietaryPreference: workspace.userDiet as any,
                 allergies: [],
               }, routine);

               const inputDiet = projectedInput.profile.dietaryPreference;
               const isSync = inputDiet === workspace.userDiet;

               return (
                 <View className="gap-y-1">
                   <Text className={`text-xs font-bold ${isSync ? 'text-green-600' : 'text-red-500'}`}>
                     Diet: {inputDiet} {isSync ? '✓' : '✗ mismatch'}
                   </Text>
                   <Text className="text-xs text-gray-500">
                     Candidates: {projectedInput.candidates.length}
                   </Text>
                   <Text className="text-[10px] text-gray-400 italic mt-1">
                     (Derived via buildPlannerInput)
                   </Text>
                 </View>
               );
             })()}
          </View>
        </View>

        <View className="mt-4">
           <TouchableOpacity 
             onPress={toggleRawState}
             className="bg-orange-100/50 dark:bg-orange-900/20 rounded-xl px-4 py-2 flex-row justify-between items-center mb-2"
           >
             <Text className="text-orange-800 dark:text-orange-300 font-bold text-[10px] uppercase tracking-widest">
               {showRawState ? 'Hide' : 'Compare'} Raw State Payloads
             </Text>
             <Text className="text-orange-400 text-xs">{showRawState ? '▲' : '▼'}</Text>
           </TouchableOpacity>
           
           {showRawState && (
             <View className="flex-row gap-4">
               <View className="flex-1">
                 <Text className="text-[10px] font-bold text-gray-400 mb-1 ml-1">Workspace DB</Text>
                 <JSONBlock value={workspace} />
               </View>
               <View className="flex-1">
                 <Text className="text-[10px] font-bold text-gray-400 mb-1 ml-1">Projected Input</Text>
                 <JSONBlock value={{
                    profile: {
                      dietaryPreference: workspace.userDiet,
                      targetCalories: workspace.input?.payload.targetCalories,
                      targetProteinG: 160,
                      weeklyBudgetGBP: workspace.input?.payload.budgetWeekly
                    },
                    slotsToFill: "..."
                 }} />
               </View>
             </View>
           )}
        </View>
      </Section>


      {/* Run button */}
      {/* Run & Copy buttons */}
      <View className="flex-row gap-3">
        <TouchableOpacity
          onPress={runPipeline}
          disabled={status === 'running'}
          className={`flex-1 h-14 rounded-2xl items-center justify-center mb-8 shadow-lg flex-row gap-3 ${status === 'running' ? 'bg-gray-300 dark:bg-gray-700' : 'bg-avocado'}`}
        >
          {status === 'running' && <ActivityIndicator color="white" />}
          <Text className="text-white font-extrabold text-base">
            {status === 'running' ? 'Running…' : 'Run Pipeline'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={copyToClipboard}
          disabled={!plannerInput}
          className={`h-14 px-6 rounded-2xl items-center justify-center mb-8 shadow-lg flex-row gap-2 ${!plannerInput ? 'bg-gray-200 dark:bg-gray-800' : 'bg-blueberry'}`}
        >
          <Text className="text-white font-bold text-sm">Copy for LLM</Text>
        </TouchableOpacity>
      </View>

      {/* Error */}
      {status === 'error' && (
        <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <View className="flex-row items-center gap-2 mb-2">
            <View className="w-5 h-5 bg-red-500 rounded-full items-center justify-center">
              <Text className="text-white text-[10px] font-bold">!</Text>
            </View>
            <Text className="text-red-600 font-bold text-sm">Pipeline error</Text>
          </View>
          <Text className="text-red-500 text-xs font-mono mb-2" selectable>{errorMsg}</Text>
          
          {(errorMsg?.includes('404') || errorMsg?.includes('vercel dev')) && (
            <View className="mt-2 bg-white/50 p-2 rounded border border-red-100">
              <Text className="text-[10px] font-bold uppercase text-red-400 mb-1">Local Dev Tip</Text>
              <Text className="text-red-800 text-[10px]">
                Generation on localhost requires <Text className="font-bold">npx vercel dev</Text> OR setting <Text className="font-bold">EXPO_PUBLIC_API_BASE_URL</Text> to your production URL in <Text className="font-bold">.env</Text>.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 1. Planner Input */}
      {plannerInput && (
        <Section title="1 · Planner Input (sent to Gemini)" accent="bg-gray-100 dark:bg-white/5">
          <Text className="text-gray-400 text-xs mb-3">
            {(plannerInput as any).slotsToFill?.length ?? 0} slots to fill •{' '}
            {(plannerInput as any).candidates?.length ?? 0} candidates after pre-filtering
          </Text>
          <JSONBlock value={plannerInput} />
        </Section>
      )}

      {/* 1.5 Feasibility Checks */}
      {suffResult && (
        <Section title="1.5 · Pre-planning Sufficiency" accent={suffResult.warnings.length > 0 ? 'bg-yellow-50' : 'bg-avocado/10'}>
          <Text className="text-charcoal dark:text-darkcharcoal text-xs mb-2 font-bold">
            Effective Repeat Caps (User Pref: {(plannerInput as any)?.preferences?.maxRecipeRepeatsPerWeek ?? 2}):
          </Text>
          <View className="flex-row gap-4 mb-3">
            <Text className="text-gray-500 text-xs">• Breakfast: <Text className="font-bold text-charcoal dark:text-darkcharcoal">{suffResult.effectiveCaps.breakfast}</Text></Text>
            <Text className="text-gray-500 text-xs">• Lunch: <Text className="font-bold text-charcoal dark:text-darkcharcoal">{suffResult.effectiveCaps.lunch}</Text></Text>
            <Text className="text-gray-500 text-xs">• Dinner: <Text className="font-bold text-charcoal dark:text-darkcharcoal">{suffResult.effectiveCaps.dinner}</Text></Text>
          </View>
          {suffResult.warnings.length > 0 && (
            <View className="bg-yellow-100 border border-yellow-200 p-3 rounded-lg">
              {suffResult.warnings.map(w => (
                 <Text key={w} className="text-yellow-800 text-xs font-mono mb-1">• {w}</Text>
              ))}
            </View>
          )}
        </Section>
      )}

      {/* 1.75 Feasibility Bounds */}
      {feasBounds && (
        <Section title="1.75 · Feasibility Bounds" accent={!feasBounds.feasible ? 'bg-red-100' : 'bg-avocado/10'}>
          <View className="flex-row flex-wrap gap-3 mb-3">
            <View className="bg-white dark:bg-darkgrey rounded-lg px-3 py-2 border border-black/5">
              <Text className="text-gray-400 text-[10px] uppercase tracking-wider">Min Cost</Text>
              <Text className="text-charcoal dark:text-darkcharcoal text-sm font-bold">£{feasBounds.minWeeklyCostGBP.toFixed(2)}</Text>
            </View>
            <View className="bg-white dark:bg-darkgrey rounded-lg px-3 py-2 border border-black/5">
              <Text className="text-gray-400 text-[10px] uppercase tracking-wider">Max Cals/day</Text>
              <Text className="text-charcoal dark:text-darkcharcoal text-sm font-bold">{Math.round(feasBounds.maxWeeklyCalories / 7)} kcal</Text>
            </View>
            <View className="bg-white dark:bg-darkgrey rounded-lg px-3 py-2 border border-black/5">
              <Text className="text-gray-400 text-[10px] uppercase tracking-wider">Max Protein/day</Text>
              <Text className="text-charcoal dark:text-darkcharcoal text-sm font-bold">{Math.round(feasBounds.maxWeeklyProteinG / 7)}g</Text>
            </View>
          </View>
          <Text className="text-gray-400 text-xs mb-2">Priority order: {feasBounds.priorityOrder.join(' ▸ ')}</Text>
          {feasBounds.warnings.length > 0 && (
            <View className="bg-red-50 border border-red-200 p-3 rounded-lg">
              {feasBounds.warnings.map((w, i) => (
                <Text key={i} className="text-red-700 text-xs font-mono mb-1">⚠ {w}</Text>
              ))}
            </View>
          )}
          {feasBounds.feasible && feasBounds.warnings.length === 0 && (
            <Text className="text-avocado text-xs font-bold">✓ All targets jointly achievable with current pool</Text>
          )}
        </Section>
      )}

      {/* 2. Raw Gemini Output */}
      {rawOutput !== null && (
        <Section title="2 · Raw Gemini Output" accent="bg-blueberry/10">
          <TouchableOpacity 
            onPress={toggleRawGemini}
            className="bg-white dark:bg-darkgrey rounded-xl px-4 py-3 flex-row justify-between items-center mb-2 border border-black/5 dark:border-white/5"
          >
            <Text className="text-charcoal dark:text-darkcharcoal font-bold text-sm">
              {showRawGemini ? 'Hide' : 'Show'} Raw Diagnostic Data
            </Text>
            <Text className="text-gray-400 text-xs">{showRawGemini ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          
          {showRawGemini && (
            <JSONBlock value={rawOutput} />
          )}
        </Section>
      )}

      {/* 3. Stage A */}
      {stageAResult !== null && (
        <Section title="3 · Stage A — Runtime Schema" accent={stageAResult ? 'bg-avocado/10' : 'bg-red-100'}>
          <View className="flex-row items-center gap-3">
            <View className={`w-8 h-8 rounded-full items-center justify-center ${stageAResult ? 'bg-avocado' : 'bg-red-400'}`}>
              <Text className="text-white font-bold">{stageAResult ? '✓' : '✗'}</Text>
            </View>
            <Text className={`font-bold text-sm ${stageAResult ? 'text-avocado' : 'text-red-500'}`}>
              {stageAResult ? 'Schema valid — proceeding to Stage B' : 'Schema invalid — fallback triggered'}
            </Text>
          </View>
        </Section>
      )}

      {/* 4. Stage B */}
      {stageBResult && (
        <Section title="4 · Stage B — Business Validation & Repair" accent={stageBResult.valid ? 'bg-avocado/10' : 'bg-yellow-50'}>
          <View className="flex-row flex-wrap mb-3">
            <Badge label={stageBResult.valid ? 'Valid' : 'Repaired'} color={stageBResult.valid ? 'bg-avocado' : 'bg-yellow-500'} />
            <Badge label={`${stageBResult.warnings.length} warning${stageBResult.warnings.length !== 1 ? 's' : ''}`} color="bg-gray-500" />
          </View>

          {stageBResult.warnings.length > 0 && (
            <View className="mb-4">
              {/* Phase 12C: Repair summary counters */}
              {(() => {
                const repairWarnings = stageBResult.warnings.filter(w => w.startsWith('Repaired '));
                const premiumCount = repairWarnings.filter(w => w.includes('[PREMIUM ESCALATION]')).length;
                const emergencyCount = repairWarnings.filter(w => w.includes('[EMERGENCY FALLBACK]')).length;
                const rescueCount = repairWarnings.filter(w => w.includes('[LUNCH RESCUE]') || w.includes('[DINNER RESCUE]')).length;
                const budgetEscCount = repairWarnings.filter(w => w.includes('[BUDGET ESCALATION]')).length;
                const cleanRepairCount = repairWarnings.filter(w =>
                  !w.includes('[EMERGENCY FALLBACK]') &&
                  !w.includes('[PREMIUM ESCALATION]') &&
                  !w.includes('[BUDGET ESCALATION]')
                ).length;
                if (repairWarnings.length === 0) return null;
                return (
                  <View className="bg-white dark:bg-darkgrey rounded-lg p-3 mb-3 border border-black/5 dark:border-white/5 flex-row flex-wrap gap-x-4 gap-y-1">
                    <Text className="text-[10px] font-bold uppercase tracking-wider text-gray-400 w-full mb-1">Repair Summary · {repairWarnings.length} total</Text>
                    {cleanRepairCount > 0 && <Text className="text-xs font-mono text-green-600">✓ Clean: {cleanRepairCount}</Text>}
                    {rescueCount > 0 && <Text className="text-xs font-mono text-teal-600">↺ Rescue: {rescueCount}</Text>}
                    {premiumCount > 0 && <Text className="text-xs font-mono text-amber-600">⚠ Premium Esc: {premiumCount}</Text>}
                    {emergencyCount > 0 && <Text className="text-xs font-mono text-red-500">⚠ Emergency: {emergencyCount}</Text>}
                    {budgetEscCount > 0 && <Text className="text-xs font-mono text-red-400">↑ Budget Esc: {budgetEscCount}</Text>}
                  </View>
                );
              })()}

              {/* Split warnings from explicit repairs */}
              {stageBResult.warnings.map((w, i) => {
                const isRepair = w.startsWith('Repaired ');
                
                if (isRepair) {
                  // Regex matches all optional tags including [LUNCH RESCUE] and [DINNER RESCUE]
                  const match = w.match(/Repaired (.+?) (.+?) to "(.+?)" \(was "(.+?)"\) \[Cost: (.+?)\] \[Cals: ([+-]?\d+)\] \[Protein: ([+-]?\d+)g\]( \[EMERGENCY FALLBACK\])?( \[PREMIUM ESCALATION\])?( \[(LUNCH RESCUE|DINNER RESCUE)\])?( \[(BUDGET SAVING|BUDGET NEUTRAL|BUDGET ESCALATION)\] \[Proj: (.+?)\])?/);
                  
                  if (match) {
                    const [_, d, s, newRecipe, oldRecipe, costStr, calStr, protStr, emergencyTag, premiumTag, rescueMatch, rescueType, _b, budgetType, projCostStr] = match;
                    const calDelta = parseInt(calStr);
                    const protDelta = parseInt(protStr);
                    const isEmergency = !!emergencyTag;
                    const isPremiumEscalation = !!premiumTag && !isEmergency;
                    const isRescue = !!rescueMatch;
                    
                    const isSevere = !isEmergency && !isPremiumEscalation && calDelta <= -150 && protDelta <= -20;
                    const isDegraded = !isEmergency && !isPremiumEscalation && (calDelta <= -150 || protDelta <= -20);
                    
                    const bgClass = isEmergency
                      ? 'bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-600'
                      : isPremiumEscalation
                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-600'
                        : isSevere 
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/50' 
                          : isDegraded 
                            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700/50' 
                            : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/50';
                    
                    const labelClass = isEmergency
                      ? 'text-red-900 dark:text-red-300'
                      : isPremiumEscalation
                        ? 'text-amber-700 dark:text-amber-400'
                        : isSevere
                          ? 'text-red-800 dark:text-red-400'
                          : isDegraded
                            ? 'text-orange-800 dark:text-orange-400'
                            : 'text-green-800 dark:text-green-400';
                        
                    const labelText = isEmergency
                      ? '⚠ Emergency Fallback'
                      : isPremiumEscalation
                        ? '⚠ Premium Escalation'
                        : isSevere ? 'Severe Downgrade' : isDegraded ? 'Degraded Repair' : 'Acceptable Repair';

                    const budgetColor = budgetType === 'BUDGET SAVING' ? 'text-green-600' : budgetType === 'BUDGET ESCALATION' ? 'text-red-500' : 'text-gray-500';
                    const budgetIcon = budgetType === 'BUDGET SAVING' ? '↓' : budgetType === 'BUDGET ESCALATION' ? '↑' : '→';
                    
                    return (
                      <View key={i} className={`border rounded-lg p-3 mb-2 ${bgClass}`}>
                        <View className="flex-row justify-between items-center mb-1">
                          <Text className={`text-xs font-bold uppercase tracking-wider ${labelClass}`}>{labelText}</Text>
                          <Text className="text-gray-500 text-[10px] uppercase font-bold">{d} {s}</Text>
                        </View>

                        {isRescue && (
                          <View className="flex-row items-center mb-1">
                            <Text className="text-teal-600 dark:text-teal-400 text-[10px] font-bold uppercase tracking-wider">↺ {rescueType} · Pool-Collapse Rescue</Text>
                          </View>
                        )}
                        
                        <View className="mb-2">
                          <Text className="text-gray-500 text-xs line-through">{oldRecipe}</Text>
                          <Text className="text-charcoal dark:text-white text-sm font-semibold">{newRecipe}</Text>
                        </View>
                        
                        <View className="flex-row gap-3 mb-1">
                          <Text className="text-gray-600 dark:text-gray-300 text-xs font-mono">Cost: {costStr}</Text>
                          <Text className={`${calDelta < 0 ? 'text-red-500' : 'text-green-600'} text-xs font-mono`}>Cals: {calStr}</Text>
                          <Text className={`${protDelta < 0 ? 'text-red-500' : 'text-green-600'} text-xs font-mono`}>Prot: {protStr}g</Text>
                        </View>

                        {budgetType && (
                          <View className="flex-row items-center gap-1 border-t border-black/10 dark:border-white/10 pt-1 mt-1">
                            <Text className={`text-[10px] font-bold font-mono ${budgetColor}`}>{budgetIcon} {budgetType}</Text>
                            {projCostStr && <Text className="text-gray-500 text-[10px] font-mono">· Proj total: {projCostStr}</Text>}
                          </View>
                        )}
                      </View>
                    );
                  }

                  // Fallback if regex fails but it's still a repair string
                  return (
                    <View key={i} className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-lg p-3 mb-2">
                       <Text className="text-yellow-800 dark:text-yellow-400 text-xs font-bold mb-1 uppercase tracking-wider">Repair Triggered</Text>
                       <Text className="text-charcoal dark:text-white text-sm">{w}</Text>
                    </View>
                  );
                }

                return (
                  <Text key={i} className="text-gray-600 dark:text-gray-400 text-xs mb-1">• {w}</Text>
                );
              })}
            </View>
          )}
          
          <JSONBlock value={stageBResult.plan} />
        </Section>
      )}

      {/* 5. Resolved Plan */}
      {resolvedPlan && (
        <Section title="5 · Resolved Weekly Plan" accent="bg-avocado/10">
          {/* Metadata strip */}
          <View className="bg-white dark:bg-darkgrey rounded-xl p-4 mb-4 border border-black/5 dark:border-white/5">
            <View className="flex-row flex-wrap mb-2">
              <Badge label={resolvedPlan.meta.source} color={sourceColor} />
              <Badge label={resolvedPlan.meta.plannerVersion} color="bg-gray-400" />
            </View>
            <Text className="text-gray-400 text-xs">Generated: {resolvedPlan.meta.generatedAt}</Text>
            {resolvedPlan.meta.warnings.length > 0 && (
              <View className="mt-3">
                <Text className="text-gray-500 text-xs font-bold mb-1">Warnings:</Text>
                {resolvedPlan.meta.warnings.map((w, i) => (
                  <Text key={i} className="text-yellow-600 text-xs font-mono">• {w}</Text>
                ))}
              </View>
            )}
          </View>

          {/* Plan grid */}
          {resolvedPlan.days.map(day => (
            <View key={day.day} className="bg-white dark:bg-darkgrey rounded-xl p-4 mb-3 border border-black/5 dark:border-white/5">
              <Text className="text-charcoal dark:text-darkcharcoal font-bold mb-2">{day.day}</Text>
              {(['breakfast', 'lunch', 'dinner'] as const).map(slot => {
                const val = day[slot];
                if ('recipeId' in val) {
                  const recipe = FULL_RECIPE_CATALOG[val.recipeId];
                  return (
                    <View key={slot} className="flex-row items-center mb-1">
                      <Text className="text-gray-400 text-xs w-20 capitalize">{slot}</Text>
                      <View className="flex-row items-center">
                        <View className="w-2 h-2 rounded-full bg-avocado mr-2" />
                        <Text className="text-charcoal dark:text-darkcharcoal text-xs font-semibold">
                          {recipe?.title ?? val.recipeId}
                        </Text>
                      </View>
                    </View>
                  );
                }
                return (
                  <View key={slot} className="flex-row items-center mb-1">
                    <Text className="text-gray-400 text-xs w-20 capitalize">{slot}</Text>
                    <View className="flex-row items-center">
                      <View className="w-2 h-2 rounded-full bg-gray-300 mr-2" />
                      <Text className="text-gray-400 text-xs italic">{val.mode}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}

          {/* Summary */}
          {resolvedPlan.summary && (
            <View className="bg-avocado/10 rounded-xl p-4 border border-avocado/20">
              <Text className="font-bold text-avocado text-xs uppercase tracking-wider mb-2">Planner Summary</Text>
              <Text className="text-charcoal dark:text-white text-sm">
                ~{resolvedPlan.summary.estimatedPlannedCalories} kcal •{' '}
                {resolvedPlan.summary.estimatedPlannedProteinG}g protein •{' '}
                £{resolvedPlan.summary.estimatedPlannedCostGBP?.toFixed(2)}
              </Text>
              {resolvedPlan.summary.plannerNote && (
                <Text className="text-gray-500 text-xs mt-2 italic">"{resolvedPlan.summary.plannerNote}"</Text>
              )}
            </View>
          )}
        </Section>
      )}
    </ScrollView>
  );
}
