// ─── Planner Dev Screen ───────────────────────────────────────────────────────
//
// A lightweight debug playground for iterating on the Gemini planner.
// Not linked from the main nav — access via direct navigation: /(tabs)/planner-dev
//
// Shows: PlannerInput → raw Gemini output → Stage A → Stage B → merged plan → metadata

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  TextInput, Platform, Alert,
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
          <JSONBlock value={rawOutput} />
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
        <Section title="4 · Stage B — Business Validation" accent={stageBResult.valid ? 'bg-avocado/10' : 'bg-yellow-50'}>
          <View className="flex-row flex-wrap mb-3">
            <Badge label={stageBResult.valid ? 'Valid' : 'Repaired'} color={stageBResult.valid ? 'bg-avocado' : 'bg-yellow-500'} />
            <Badge label={`${stageBResult.warnings.length} warning${stageBResult.warnings.length !== 1 ? 's' : ''}`} color="bg-gray-500" />
          </View>
          {stageBResult.warnings.length > 0 && (
            <View className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-3">
              {stageBResult.warnings.map((w, i) => (
                <Text key={i} className="text-yellow-700 text-xs font-mono mb-1">• {w}</Text>
              ))}
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
