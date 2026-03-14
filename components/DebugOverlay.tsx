import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useDebug } from '../data/DebugContext';
import { FontAwesome5 } from '@expo/vector-icons';

export default function DebugOverlay() {
  const { debugData, updateDebugData } = useDebug();
  const [expanded, setExpanded] = useState(false);
  const [enabled, setEnabled] = useState(false);

  // Track logic execution
  useEffect(() => {
    if (debugData.executionMeta?.runId) {
      updateDebugData({ plannerLogicFiredThisView: true });
    }
  }, [debugData.executionMeta?.runId, updateDebugData]);

  // Allow debug overlay in live mode for testing
  // if (!__DEV__) return null;

  const copySnapshot = async () => {
    const text = JSON.stringify(debugData, null, 2);
    await Clipboard.setStringAsync(text);
    alert('Debug snapshot copied to clipboard!');
  };

  const renderField = (label: string, value: any) => (
    <View style={styles.field} key={label}>
      <Text style={styles.label}>{label}:</Text>
      <Text style={[
        styles.value,
        typeof value === 'boolean' && { color: value ? '#4ade80' : '#f87171' },
        value === null || value === undefined ? { color: '#4b5563' } : null,
      ]}>
        {value === null ? 'null' : value === undefined ? 'n/a' : String(value)}
      </Text>
    </View>
  );

  const phaseColor = (phase: string | null | undefined) => {
    if (!phase) return '#6b7280';
    if (phase === 'complete') return '#4ade80';
    if (phase === 'error') return '#f87171';
    if (phase === 'action_ignored') return '#fbbf24';
    if (phase === 'planner_running') return '#60a5fa';
    return '#d1d5db';
  };

  return (
    <>
      {!__DEV__ && (
        <TouchableOpacity 
          style={styles.liveToggle}
          onPress={() => setEnabled(!enabled)}
        >
          <FontAwesome5 name="bug" size={12} color={enabled ? "#9DCD8B" : "#6b7280"} />
        </TouchableOpacity>
      )}

      {(__DEV__ || enabled) && (
        <View style={[styles.container, expanded && styles.containerExpanded]}>
          {/* Header Bar */}
          <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => setExpanded(!expanded)} 
          style={styles.headerContent}
        >
          <FontAwesome5 name="bug" size={12} color="#9DCD8B" />
          <Text style={styles.headerText}>
            🐛 {debugData.lastActionIntent ?? debugData.actionSource} | phase:{' '}
            <Text style={{ color: phaseColor(debugData.lastActionPhase) }}>
              {debugData.lastActionPhase ?? 'idle'}
            </Text>
            {' '}| {debugData.executionMeta?.enginePath ?? 'no-engine'}
          </Text>
          <FontAwesome5 name={expanded ? 'chevron-down' : 'chevron-up'} size={12} color="#8C9A90" />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={copySnapshot} style={styles.copyBtn}>
          <FontAwesome5 name="copy" size={12} color="#9DCD8B" />
        </TouchableOpacity>
      </View>

      {/* Expandable Details */}
      {expanded && (
        <ScrollView style={styles.details} contentContainerStyle={styles.detailsContent}>

          {/* ─── Last Action ──────────────────────────────────────────────── */}
          <Text style={styles.sectionTitle}>Last Action</Text>
          {renderField('Intent', debugData.lastActionIntent)}
          {renderField('RunId', debugData.lastActionRunId)}
          <View style={styles.field} key="phase-color">
            <Text style={styles.label}>Phase:</Text>
            <Text style={[styles.value, { color: phaseColor(debugData.lastActionPhase) }]}>
              {debugData.lastActionPhase ?? 'n/a'}
            </Text>
          </View>
          {renderField('ClickAt', debugData.lastClickAt)}
          {renderField('IgnoredReason', debugData.actionIgnoredReason)}

          {/* ─── Planner Lifecycle ────────────────────────────────────────── */}
          <Text style={styles.sectionTitle}>Planner Lifecycle</Text>
          {renderField('ExecutionSource', debugData.lastPlannerExecutionSource)}
          {renderField('PlannerStart', debugData.lastPlannerStartAt)}
          {renderField('PlannerEnd', debugData.lastPlannerEndAt)}
          {renderField('PersistEnd', debugData.lastPersistEndAt)}
          {renderField('LoadingCleared', debugData.loadingCleared)}
          {renderField('PantryMatchCount', debugData.debugPlannerInputPantryCount)}

          {/* ─── Swap Target ─────────────────────────────────────────────── */}
          <Text style={styles.sectionTitle}>Swap Target</Text>
          {renderField('TargetDay', debugData.lastSwapTargetDay)}
          {renderField('TargetSlot', debugData.lastSwapTargetSlot)}
          {renderField('CurrentRecipeId', debugData.lastSwapCurrentRecipeId)}
          {renderField('CardStateBefore', debugData.cardStateBefore)}
          {renderField('CardStateAfter', debugData.cardStateAfter)}
          {renderField('ResultChanged', debugData.changed)}
          {renderField('UnchangedReason', debugData.unchangedReason)}

          {/* ─── Phase 20G Early Returns ──────────────────────────────────── */}
          <Text style={styles.sectionTitle}>UX Early Return Trace</Text>
          {renderField('Early Return Blocked?', debugData.earlyReturn)}
          {renderField('Early Return Reason', debugData.earlyReturnReason)}
          {renderField('Target Day No-Op Reason', debugData.targetDayNoopReason)}
          {debugData.targetDayCandidateCounts && (
            <>
              <Text style={styles.subSectionTitle}>Day Candidates</Text>
              {Object.entries(debugData.targetDayCandidateCounts).map(([slot, count]) => (
                 renderField(slot, count)
              ))}
            </>
          )}

          {/* ─── Collapse Context ─────────────────────────────────────────── */}
          {debugData.collapseContext ? (
            <>
              <Text style={styles.sectionTitle}>Collapse Context</Text>
              {renderField('Reason', debugData.collapseContext.reason)}
              {renderField('CandidateCount', debugData.collapseContext.candidateCount)}
              {renderField('CommittedCost £', debugData.collapseContext.committedCost)}
              {renderField('RemainingBudget £', debugData.collapseContext.remainingBudget)}
              {renderField('UserMessage', debugData.collapseContext.userMessage)}
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Collapse Context</Text>
              <Text style={styles.emptyText}>None for this action.</Text>
            </>
          )}

          {/* ─── Budget Trace ─────────────────────────────────────────────── */}
          <Text style={styles.sectionTitle}>Budget Trace</Text>
          {renderField('OnboardingSelected £', debugData.selectedOnboardingBudget)}
          {renderField('PersistedWorkspace £', debugData.persistedWorkspaceBudget)}
          {renderField('PlannerInput £', debugData.plannerInputBudget)}
          {renderField('DashboardDisplayed £', debugData.dashboardDisplayedBudget)}

          {/* ─── Exclusions Trace ─────────────────────────────────────────── */}
          <Text style={styles.sectionTitle}>Exclusions Trace</Text>
          <View style={styles.field} key="excl-count">
            <Text style={styles.label}>ActiveCount:</Text>
            <Text style={[styles.value, (debugData.hardExclusionsActive ?? 0) > 0 ? { color: '#f87171' } : {}]}>
              {debugData.hardExclusionsActive ?? 0}
              {(debugData.hardExclusionsActive ?? 0) > 0 ? ' ⛔ hard gate on' : ' — none set'}
            </Text>
          </View>
          {(debugData.hardExclusionValues ?? []).length > 0 ? (
            debugData.hardExclusionValues!.map((ex, i) => renderField(`  [${i}]`, ex))
          ) : (
            <Text style={styles.emptyText}>No exclusions active.</Text>
          )}

          {/* ─── Context State (Diet) ─────────────────────────────────────── */}
          <Text style={styles.sectionTitle}>Context State</Text>
          {renderField('Current Route', debugData.currentRoute)}
          {renderField('Action Source', debugData.actionSource)}
          {renderField('Onboarding Diet', debugData.selectedOnboardingDiet)}
          {renderField('Workspace Diet', debugData.persistedWorkspaceDiet)}
          {renderField('Planner Input Diet', debugData.plannerInputDiet)}
          {renderField('Logic Fired', debugData.plannerLogicFiredThisView)}

          {/* ─── Profile Freshness (Reliability Pass) ─────────────────────── */}
          <Text style={styles.sectionTitle}>Profile Freshness</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Freshness State:</Text>
            <Text style={[styles.value, debugData.debugUsedLatestProfileForRun ? { color: '#4ade80' } : { color: '#fbbf24' }]}>
              {debugData.debugUsedLatestProfileForRun ? 'LATEST' : 'STALE (SNAPSHOT)'}
            </Text>
          </View>
          {debugData.debugProfileMismatchReasons && (
             <Text style={styles.warningText}>Mismatches: {debugData.debugProfileMismatchReasons.join(', ')}</Text>
          )}
          {renderField('Current Version', debugData.debugProfileVersion)}
          {renderField('Planner Run Version', debugData.debugPlannerInputProfileVersion)}
          {renderField('Input Source', debugData.debugPlannerInputSource)}
          {renderField('Used Defaults?', debugData.debugUsedDefaultsForRun)}
          {debugData.debugDefaultedFields && debugData.debugDefaultedFields.length > 0 && (
             <Text style={styles.warningText}>Defaulted: {debugData.debugDefaultedFields.join(', ')}</Text>
          )}

          <Text style={styles.subSectionTitle}>Effective Profile (Latest Truth)</Text>
          {renderField('Diet', debugData.debugCurrentUserDiet)}
          {renderField('Budget £', debugData.debugCurrentBudgetWeekly)}
          {renderField('Calories', debugData.debugCurrentTargetCalories)}
          {renderField('Protein', debugData.debugCurrentTargetProteinG)}
          {renderField('Cuisines', (debugData.debugCurrentSelectedCuisines ?? []).length)}
          {renderField('Exclusions', (debugData.debugCurrentProfileExclusions ?? []).length)}

          <Text style={styles.subSectionTitle}>Planner Input (Most Recent Run)</Text>
          {renderField('Diet', debugData.debugPlannerInputDiet)}
          {renderField('Budget £', debugData.debugPlannerInputBudgetWeekly)}
          {renderField('Calories', debugData.debugPlannerInputTargetCalories)}
          {renderField('Protein', debugData.debugPlannerInputTargetProteinG)}
          {renderField('Cuisines', (debugData.debugPlannerInputSelectedCuisines ?? []).length)}
          {renderField('Exclusions', (debugData.debugPlannerInputExclusions ?? []).length)}

          {/* ─── Planner Execution Meta ───────────────────────────────────── */}
          <Text style={styles.sectionTitle}>Planner Execution</Text>
          {debugData.executionMeta ? (
            <>
              {renderField('RunId', debugData.executionMeta.runId)}
              {renderField('Engine Path', debugData.executionMeta.enginePath)}
              {renderField('Planning Mode', debugData.executionMeta.planningMode)}
              {renderField('Hard Rules Valid', debugData.executionMeta.isHardRuleValid)}
              {renderField('Target Feasible', debugData.executionMeta.isTargetFeasible)}
              {renderField('Timestamp', debugData.executionMeta.timestamp)}
              
              <Text style={styles.subSectionTitle}>Candidate Counts by Slot</Text>
              {Object.entries(debugData.executionMeta.candidateCountsBySlot).map(([slot, count]) => (
                renderField(slot, count)
              ))}

              {debugData.executionMeta.topWarnings.length > 0 && (
                <>
                  <Text style={styles.subSectionTitle}>Warnings</Text>
                  {debugData.executionMeta.topWarnings.map((w, i) => (
                    <Text key={i} style={styles.warningText}>• {w}</Text>
                  ))}
                </>
              )}
            </>
          ) : (
            <Text style={styles.emptyText}>No execution data for this session.</Text>
          )}
        </ScrollView>
      )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  liveToggle: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 48,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(20, 24, 20, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2d332f',
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(20, 24, 20, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#2d332f',
    zIndex: 9999,
  },
  containerExpanded: {
    height: 480,
  },
  header: {
    flexDirection: 'row',
    height: 40,
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  headerText: {
    color: '#8C9A90',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  copyBtn: {
    padding: 8,
  },
  details: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: '#2d332f',
  },
  detailsContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: '#9DCD8B',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  subSectionTitle: {
    color: '#8C9A90',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2d332f',
    flexWrap: 'wrap',
    gap: 4,
  },
  label: {
    color: '#8C9A90',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flexShrink: 0,
  },
  value: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flexShrink: 1,
    textAlign: 'right',
  },
  warningText: {
    color: '#fca5a5',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 12,
    fontStyle: 'italic',
  }
});
