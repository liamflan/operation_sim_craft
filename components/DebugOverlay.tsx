import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { usePathname } from 'expo-router';
import { useDebug } from '../data/DebugContext';
import { FontAwesome5 } from '@expo/vector-icons';

export default function DebugOverlay() {
  const { debugData, updateDebugData } = useDebug();
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();

  // Track route changes
  useEffect(() => {
    updateDebugData({ 
      currentRoute: pathname,
      plannerLogicFiredThisView: false
    });
  }, [pathname, updateDebugData]);

  // Track logic execution
  useEffect(() => {
    if (debugData.executionMeta?.runId) {
      updateDebugData({ plannerLogicFiredThisView: true });
    }
  }, [debugData.executionMeta?.runId, updateDebugData]);

  // Only show in development
  if (!__DEV__) return null;

  const copySnapshot = async () => {
    const text = JSON.stringify(debugData, null, 2);
    await Clipboard.setStringAsync(text);
    alert('Debug snapshot copied to clipboard!');
  };

  const renderField = (label: string, value: any) => (
    <View style={styles.field} key={label}>
      <Text style={styles.label}>{label}:</Text>
      <Text style={[styles.value, typeof value === 'boolean' && { color: value ? '#4ade80' : '#f87171' }]}>
        {value === null ? 'null' : value === undefined ? 'n/a' : String(value)}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, expanded && styles.containerExpanded]}>
      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => setExpanded(!expanded)} 
          style={styles.headerContent}
        >
          <FontAwesome5 name="bug" size={12} color="#9DCD8B" />
          <Text style={styles.headerText}>
            Planner Debug: {debugData.actionSource} | {debugData.executionMeta?.enginePath || 'idle'}
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
          <Text style={styles.sectionTitle}>Context State</Text>
          {renderField('Current Route', debugData.currentRoute)}
          {renderField('Action Source', debugData.actionSource)}
          {renderField('Onboarding Diet', debugData.selectedOnboardingDiet)}
          {renderField('Workspace Diet', debugData.persistedWorkspaceDiet)}
          {renderField('Planner Input Diet', debugData.plannerInputDiet)}
          {renderField('Logic Fired', debugData.plannerLogicFiredThisView)}

          <Text style={styles.sectionTitle}>Planner Execution</Text>
          {debugData.executionMeta ? (
            <>
              {renderField('Engine Path', debugData.executionMeta.enginePath)}
              {renderField('Planning Mode', debugData.executionMeta.planningMode)}
              {renderField('Hard Rules Valid', debugData.executionMeta.isHardRuleValid)}
              {renderField('Target Feasible', debugData.executionMeta.isTargetFeasible)}
              {renderField('Timestamp', debugData.executionMeta.timestamp)}
              
              <Text style={styles.subSectionTitle}>Candidate Counts</Text>
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
  );
}

const styles = StyleSheet.create({
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
    height: 400,
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
    marginTop: 12,
    textTransform: 'uppercase',
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
  },
  label: {
    color: '#8C9A90',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  value: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
