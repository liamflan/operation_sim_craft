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
import { MOCK_RECIPES } from '../../data/seed';

import { planWeekWithDiagnostics, PlannerDiagnostics } from '../../data/engine';
import { useWeeklyRoutine } from '../../data/WeeklyRoutineContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const HARDCODED_API_KEY = 'REDACTED_LEAKED_KEY_20260310'; // Add your key here for testing

const mockUser = {
  id: 'dev-user',
  name: 'Dev User',
  targetMacros: { calories: 2200, protein: 160, carbs: 220, fats: 80 },
  budgetWeekly: 60,
  dietaryPreference: 'Omnivore' as const,
  allergies: [],
};

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

  const [diag, setDiag] = useState<PlannerDiagnostics | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState(HARDCODED_API_KEY);
  const [showRawGemini, setShowRawGemini] = useState(false);

  // Derived shortcuts for rendering
  const plannerInput  = diag?.plannerInput   ?? null;
  const rawOutput     = diag?.rawOutput      ?? null;
  const stageAResult  = diag?.stageAResult   ?? null;
  const suffResult    = diag?.suffResult     ?? null;
  const feasBounds    = diag?.feasBounds     ?? null;
  const stageBResult  = diag?.stageBResult   ?? null;
  const resolvedPlan  = diag?.resolvedPlan   ?? null;

  const copyToClipboard = async () => {
    const diagnostic = {
      timestamp: new Date().toISOString(),
      plannerInput:         diag?.plannerInput,
      rawOutputFromGemini:  diag?.rawOutput,
      feasibilityChecks:    diag?.suffResult,
      stageAResult:         diag?.stageAResult,
      stageBResult:         diag?.stageBResult,
      mergedPlan:           diag?.resolvedPlan,
    };

    const text = `PLANNER DIAGNOSTIC EXPORT\n=========================\n\n${JSON.stringify(diagnostic, null, 2)}`;
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied!', 'Diagnostic data copied to clipboard.');
  };

  async function runPipeline() {
    setStatus('running');
    setDiag(null);
    setErrorMsg(null);

    try {
      if (apiKey && typeof window !== 'undefined') {
        (window as any).GEMINI_API_KEY = apiKey;
      }

      // Single pipeline call — all diagnostic states come from the same Gemini response
      const result = await planWeekWithDiagnostics(mockUser, routine);
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

      {/* API Key input */}
      <Section title="Gemini API Key" accent="bg-blueberry/10">
        <TextInput
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="AIza… (leave blank to use env var)"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
          className="bg-white dark:bg-darkgrey border border-black/10 dark:border-white/5 rounded-xl px-4 py-3 text-charcoal dark:text-darkcharcoal text-sm font-mono"
        />
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
          <Text className="text-red-600 font-bold text-sm mb-1">Pipeline error</Text>
          <Text className="text-red-500 text-xs font-mono">{errorMsg}</Text>
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
                  const recipe = MOCK_RECIPES.find(r => r.id === val.recipeId);
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
