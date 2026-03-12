import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { generatePlan } from '../../data/planner/orchestrator';
import { 
  curatedRoast, 
  curatedPasta,
  generatedLentilStew, 
  typicalDinnerContract
} from '../../data/planner/plannerFixtures';
import { SlotContract, OrchestratorOutput } from '../../data/planner/plannerTypes';
import { getMealCardViewModel } from '../../data/planner/selectors';

const MOCK_RECIPES = [curatedRoast, curatedPasta, generatedLentilStew];
const DAY_CONTRACTS: SlotContract[] = [
  { ...typicalDinnerContract, slotType: 'breakfast', budgetEnvelopeGBP: 1.50, macroTargets: { calories: { min: 300, ideal: 400, max: 600 }, protein: { min: 15, ideal: 25 } } },
  { ...typicalDinnerContract, slotType: 'lunch', budgetEnvelopeGBP: 2.50, macroTargets: { calories: { min: 400, ideal: 500, max: 700 }, protein: { min: 20, ideal: 30 } } },
  { ...typicalDinnerContract, slotType: 'dinner' }
];

const WEEK_CONTRACTS: SlotContract[] = Array.from({ length: 7 }).flatMap((_, i) => 
  DAY_CONTRACTS.map(c => ({ ...c, dayIndex: i }))
);

export default function PlannerSandbox() {
  const [activeTab, setActiveTab] = useState<'day' | 'week'>('day');
  const [isGenerating, setIsGenerating] = useState(true);
  const [engineResult, setEngineResult] = useState<OrchestratorOutput | null>(null);
  
  // Handlers for generation
  useEffect(() => {
    async function runGeneration() {
      setIsGenerating(true);
      try {
        const contractsToRun = activeTab === 'day' ? DAY_CONTRACTS : WEEK_CONTRACTS;
        const result = await generatePlan(contractsToRun, MOCK_RECIPES, 'planner_autofill', []);
        setEngineResult(result);
      } catch (err) {
        console.error('Sandbox generation failed:', err);
      } finally {
        setIsGenerating(false);
      }
    }
    
    runGeneration();
  }, [activeTab]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Provision Engine Sandbox</Text>
        <View style={styles.tabs}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'day' && styles.activeTab]} 
            onPress={() => setActiveTab('day')}
          >
            <Text style={[styles.tabText, activeTab === 'day' && styles.activeTabText]}>1-Day Plan</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'week' && styles.activeTab]} 
            onPress={() => setActiveTab('week')}
          >
            <Text style={[styles.tabText, activeTab === 'week' && styles.activeTabText]}>7-Day Plan</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll}>
        {isGenerating ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#212529" />
            <Text style={styles.loadingText}>Running Planner Engine...</Text>
          </View>
        ) : !engineResult ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Failed to generate sandbox plan.</Text>
          </View>
        ) : (
          <>
            <View style={styles.metrics}>
              <Text style={styles.metricText}>
                Generated {(engineResult.assignments || []).length} assignments.
              </Text>
              <Text style={styles.metricText}>
                Rescues Triggered: {(engineResult.diagnostics || []).filter(d => d.rescueTriggered).length}
              </Text>
            </View>

            {(engineResult.assignments || []).map((assignment, index) => {
              const diagnostic = (engineResult.diagnostics || []).find(d => d.slotId === `${assignment.dayIndex}_${assignment.slotType}`);
              const contract = (activeTab === 'day' ? DAY_CONTRACTS : WEEK_CONTRACTS).find(
                c => c.slotType === assignment.slotType && (activeTab === 'day' || c.dayIndex === assignment.dayIndex)
              );
              
              if (!contract) return null;

              const recipe = MOCK_RECIPES.find(r => r.id === assignment.recipeId);
              const vm = getMealCardViewModel(assignment, recipe);
              const fullRecipe = recipe;

              return (
                <View key={assignment.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Day {assignment.dayIndex + 1} - {assignment.slotType.toUpperCase()}</Text>
                    <View style={[styles.badge, diagnostic?.rescueTriggered ? styles.badgeRescue : styles.badgeNormal]}>
                      <Text style={styles.badgeText}>
                        {(diagnostic?.actionTaken || 'filled_normally').replace(/_/g, ' ').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.row}>
                    <View style={styles.col}>
                      <Text style={styles.label}>Chosen Recipe</Text>
                      <Text style={styles.value}>{vm.title || 'None (Generating)'}</Text>
                      {fullRecipe && (
                        <Text style={styles.subValue}>
                          £{fullRecipe.estimatedCostPerServingGBP.toFixed(2)} | {fullRecipe.macrosPerServing.protein}g P
                        </Text>
                      )}
                    </View>
                    <View style={styles.col}>
                      <Text style={styles.label}>Contract Target</Text>
                      <Text style={styles.value}>Max £{contract.budgetEnvelopeGBP.toFixed(2)}</Text>
                      <Text style={styles.subValue}>Min {contract.macroTargets.protein.min}g P</Text>
                    </View>
                  </View>

                  <View style={styles.diagnosticsBox}>
                    <Text style={styles.diagTitle}>Engine Diagnostics</Text>
                    <Text style={styles.diagText}>Candidates Evaluated: {diagnostic?.totalConsidered ?? 0}</Text>
                    <Text style={styles.diagText}>Eligible: {diagnostic?.eligibleCount ?? 0} | Rejected: {diagnostic?.rejectedCount ?? 0}</Text>
                    {diagnostic && diagnostic.topFailureReasons && Object.keys(diagnostic.topFailureReasons).length > 0 && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={styles.diagTextAlert}>Top Pool Failures:</Text>
                        {Object.entries(diagnostic.topFailureReasons).map(([reason, count]) => (
                          <Text key={reason} style={styles.diagTextAlertItem}>• {count} failed due to: {reason}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 24, paddingTop: 60, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E9ECEF' },
  title: { fontSize: 24, fontWeight: '700', color: '#212529', marginBottom: 16 },
  tabs: { flexDirection: 'row', gap: 12 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#E9ECEF' },
  activeTab: { backgroundColor: '#212529' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#495057' },
  activeTabText: { color: '#FFFFFF' },
  scroll: { flex: 1, padding: 16 },
  loadingContainer: { flex: 1, paddingVertical: 100, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 16, fontSize: 15, color: '#495057', fontWeight: '500' },
  errorContainer: { flex: 1, paddingVertical: 100, alignItems: 'center' },
  errorText: { fontSize: 15, color: '#D32F2F', fontWeight: '500' },
  metrics: { marginBottom: 16, padding: 16, backgroundColor: '#E3F2FD', borderRadius: 12 },
  metricText: { fontSize: 14, color: '#0D47A1', fontWeight: '500' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#212529' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeNormal: { backgroundColor: '#E8F5E9' },
  badgeRescue: { backgroundColor: '#FFF3E0' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#2E7D32' },
  row: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  col: { flex: 1 },
  label: { fontSize: 12, fontWeight: '600', color: '#868E96', textTransform: 'uppercase', marginBottom: 4 },
  value: { fontSize: 15, fontWeight: '600', color: '#212529' },
  subValue: { fontSize: 13, color: '#495057', marginTop: 2 },
  diagnosticsBox: { backgroundColor: '#F8F9FA', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E9ECEF' },
  diagTitle: { fontSize: 13, fontWeight: '700', color: '#495057', marginBottom: 8 },
  diagText: { fontSize: 13, color: '#495057', marginBottom: 4 },
  diagTextAlert: { fontSize: 13, color: '#D32F2F', fontWeight: '600', marginTop: 4, marginBottom: 4 },
  diagTextAlertItem: { fontSize: 12, color: '#D32F2F', marginLeft: 8, marginBottom: 2 }
});
