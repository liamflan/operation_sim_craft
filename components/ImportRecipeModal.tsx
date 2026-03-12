import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Dimensions,
  Pressable,
  StyleSheet
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from './ThemeContext';
import { useRecipes } from '../data/RecipeContext';
import { NormalizedRecipe, RecipeValidationStatus } from '../data/planner/plannerTypes';

type ImportState = 'input' | 'processing' | 'review';

const SCREEN_WIDTH = Dimensions.get('window').width;
const IS_DESKTOP = Platform.OS === 'web' && SCREEN_WIDTH >= 768;

export default function ImportRecipeModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { isDarkMode } = useTheme();
  const { importRecipe } = useRecipes();
  const [step, setStep] = useState<ImportState>('input');
  const [url, setUrl] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [processingText, setProcessingText] = useState('Extracting recipe data…');
  
  // Review editable fields
  const [title, setTitle] = useState('');
  const [protein, setProtein] = useState('');
  const [calories, setCalories] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (visible) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'auto';
      }
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setStep('input');
      setUrl('');
      setPastedText('');
      setTitle('');
      setProtein('');
      setCalories('');
      setIsSaving(false);
      setProcessingText('Extracting recipe…');
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 220, friction: 20, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleExtract = () => {
    if (!url.trim() && !pastedText.trim()) return;
    setStep('processing');
    setTimeout(() => setProcessingText('Parsing content…'), 1200);
    setTimeout(() => {
      // Mock extraction result
      setTitle('Spicy Honey Glazed Salmon Bowl');
      setProtein('42');
      setCalories('550');
      setStep('review');
    }, 2800);
  };

  const handleSave = async (status: RecipeValidationStatus) => {
    setIsSaving(true);
    
    const newRecipe: Partial<NormalizedRecipe> = {
      title: title.trim() || 'Untitled Recipe',
      description: `Imported from ${url.trim() || 'pasted text'}`,
      imageUrl: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=800&auto=format&fit=crop',
      status: status,
      // Note: plannerUsable is handled internally by RecipeContext based on status
      activePrepMinutes: 10,
      totalMinutes: 25,
      macrosPerServing: { 
        calories: parseInt(calories) || 0, 
        protein: parseInt(protein) || 0, 
        carbs: 45, 
        fats: 18 
      },
      tags: ['New Import', 'Quick'],
      sourceId: 'imported_user'
    };

    await importRecipe(newRecipe);
    
    setTimeout(() => {
      setIsSaving(false);
      onClose();
    }, 600);
  };

  // Eligibility check for "Mark as Ready"
  const canMarkAsReady = title.trim().length > 0 && protein.trim() !== '' && calories.trim() !== '';

  const content = (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerIconContainer}>
            <FontAwesome5 name="file-import" size={14} color="#7BA96A" />
          </View>
          <Text style={[styles.headerTitle, { color: isDarkMode ? '#FFF' : '#1B251F' }]}>Import recipe</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <FontAwesome5 name="times" size={14} color="#8C9A90" />
        </TouchableOpacity>
      </View>

      <ScrollView scrollEnabled={step !== 'processing'} style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        {step === 'input' && (
          <View style={styles.inputStepContainer}>
            <View style={styles.stepHeader}>
              <Text style={[styles.stepTitle, { color: isDarkMode ? '#FFF' : '#1B251F' }]}>Recipe Source</Text>
              <Text style={[styles.stepDesc, { color: isDarkMode ? '#8C9A90' : '#6A766E' }]}>
                Paste a link or full recipe text. Provision will extract the core details for your review.
              </Text>
            </View>

            <View style={styles.fieldSection}>
              <Text style={styles.fieldLabel}>URL</Text>
              <TextInput
                value={url}
                onChangeText={setUrl}
                placeholder="https://..."
                placeholderTextColor={isDarkMode ? '#444' : '#BBB'}
                style={[styles.input, { backgroundColor: isDarkMode ? '#141A17' : '#F7F8F5', color: isDarkMode ? '#FFF' : '#000' }]}
              />
            </View>

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: isDarkMode ? '#333' : '#EEE' }]} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={[styles.dividerLine, { backgroundColor: isDarkMode ? '#333' : '#EEE' }]} />
            </View>

            <View style={styles.fieldSection}>
              <Text style={styles.fieldLabel}>Paste Recipe Text</Text>
              <TextInput
                value={pastedText}
                onChangeText={setPastedText}
                placeholder="Ingredients, method, or whole article..."
                placeholderTextColor={isDarkMode ? '#444' : '#BBB'}
                multiline
                numberOfLines={6}
                style={[styles.input, styles.textArea, { backgroundColor: isDarkMode ? '#141A17' : '#F7F8F5', color: isDarkMode ? '#FFF' : '#000' }]}
              />
            </View>

            <TouchableOpacity 
              disabled={!url.trim() && !pastedText.trim()}
              onPress={handleExtract}
              style={[styles.submitBtn, (!url.trim() && !pastedText.trim()) && { opacity: 0.5 }]}
            >
              <Text style={styles.submitBtnText}>Analyze Recipe</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'processing' && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color="#7BA96A" />
            <Text style={[styles.processingTitle, { color: isDarkMode ? '#FFF' : '#1B251F' }]}>{processingText}</Text>
          </View>
        )}

        {step === 'review' && (
          <View style={[styles.reviewContainer, IS_DESKTOP && styles.reviewContainerDesktop]}>
            <View style={[styles.reviewPreview, IS_DESKTOP && styles.reviewPreviewDesktop]}>
              <Image 
                source="https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=800&auto=format&fit=crop" 
                style={styles.reviewImage}
                contentFit="cover"
              />
              <View style={styles.reviewMain}>
                <Text style={styles.fieldLabel}>Extracted Title</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Recipe Title"
                  style={[styles.input, styles.titleInput, { backgroundColor: isDarkMode ? '#141A17' : '#F7F8F5', color: isDarkMode ? '#FFF' : '#000' }]}
                />
              </View>
            </View>

            <View style={[styles.reviewFields, IS_DESKTOP && styles.reviewFieldsDesktop]}>
              <Text style={styles.fieldLabel}>Nutrition Review</Text>
              <View style={styles.macroGrid}>
                <View style={styles.macroItem}>
                  <Text style={styles.macroLabel}>Protein (g)</Text>
                  <TextInput
                    value={protein}
                    onChangeText={setProtein}
                    placeholder="—"
                    keyboardType="numeric"
                    style={[styles.macroInput, { backgroundColor: isDarkMode ? '#141A17' : '#F7F8F5', color: isDarkMode ? '#FFF' : '#000' }]}
                  />
                </View>
                <View style={styles.macroItem}>
                  <Text style={styles.macroLabel}>Calories</Text>
                  <TextInput
                    value={calories}
                    onChangeText={setCalories}
                    placeholder="—"
                    keyboardType="numeric"
                    style={[styles.macroInput, { backgroundColor: isDarkMode ? '#141A17' : '#F7F8F5', color: isDarkMode ? '#FFF' : '#000' }]}
                  />
                </View>
              </View>

              <View style={styles.infoBox}>
                <FontAwesome5 name="shield-alt" size={12} color="#7BA96A" style={{ marginRight: 10 }} />
                <Text style={styles.infoText}>
                  Mark as "Ready" only if macros and title are accurate. Ready recipes are eligible for your automated plans.
                </Text>
              </View>

              <View style={styles.actionColumn}>
                <TouchableOpacity 
                  onPress={() => handleSave('ready')}
                  style={[styles.readyBtn, !canMarkAsReady && styles.disabledBtn]}
                  disabled={isSaving || !canMarkAsReady}
                >
                  {isSaving ? <ActivityIndicator color="white" /> : <Text style={styles.readyBtnText}>Mark as Ready</Text>}
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => handleSave('draft')}
                  style={styles.draftBtn}
                  disabled={isSaving}
                >
                  <Text style={[styles.draftBtnText, { color: isDarkMode ? '#8C9A90' : '#6A766E' }]}>Save as Draft</Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity onPress={() => setStep('input')} style={styles.backBtn}>
                <Text style={styles.backBtnText}>Incorrect result? Try again</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );

  return (
    <Modal visible={visible} animationType={IS_DESKTOP ? "none" : "slide"} transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <View style={[styles.backdrop, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.4)' }]} />
        </Pressable>
        
        {IS_DESKTOP ? (
          <View style={styles.centerContainer}>
            <Animated.View
              style={[
                styles.desktopPanel,
                {
                  transform: [{ scale: scaleAnim }],
                  opacity: opacityAnim,
                  width: step === 'review' ? 800 : 500,
                  backgroundColor: isDarkMode ? '#1E2622' : '#FBFCF8',
                }
              ]}
            >
              {content}
            </Animated.View>
          </View>
        ) : (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.mobileContainer}>
            <View style={[styles.mobilePanel, { backgroundColor: isDarkMode ? '#1E2622' : '#FBFCF8' }]}>
              {content}
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  desktopPanel: { borderRadius: 32, height: '85%', maxHeight: 800, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20 },
  mobileContainer: { width: '100%', justifyContent: 'flex-end' },
  mobilePanel: { borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '90%' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  headerIconContainer: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#EDF4E9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.03)', alignItems: 'center', justifyContent: 'center' },
  
  inputStepContainer: { padding: 32 },
  stepHeader: { marginBottom: 32 },
  stepTitle: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  stepDesc: { fontSize: 15, lineHeight: 22 },
  
  fieldSection: { marginBottom: 24 },
  fieldLabel: { fontSize: 10, fontWeight: '800', color: '#8C9A90', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  input: { borderRadius: 16, padding: 16, fontSize: 15, fontWeight: '600' },
  textArea: { height: 120, textAlignVertical: 'top' },
  
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: 16, fontSize: 10, fontWeight: '700', color: '#CCC' },
  
  submitBtn: { backgroundColor: '#7BA96A', padding: 18, borderRadius: 20, alignItems: 'center', marginTop: 12 },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  
  processingContainer: { padding: 80, alignItems: 'center', justifyContent: 'center' },
  processingTitle: { fontSize: 18, fontWeight: '700', marginTop: 24, color: '#1B251F', textAlign: 'center' },
  
  reviewContainer: { flex: 1, padding: 24 },
  reviewContainerDesktop: { flexDirection: 'row', gap: 32, padding: 32 },
  reviewPreview: { marginBottom: 24 },
  reviewPreviewDesktop: { flex: 1, marginBottom: 0 },
  reviewImage: { width: '100%', height: 200, borderRadius: 24, marginBottom: 20 },
  reviewMain: { gap: 8 },
  titleInput: { fontSize: 18, paddingVertical: 14 },
  
  reviewFields: { flex: 1, gap: 24 },
  reviewFieldsDesktop: { flex: 1 },
  macroGrid: { flexDirection: 'row', gap: 16 },
  macroItem: { flex: 1 },
  macroLabel: { fontSize: 12, fontWeight: '600', color: '#8C9A90', marginBottom: 8 },
  macroInput: { borderRadius: 12, padding: 14, fontSize: 16, fontWeight: '700' },
  
  infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(123, 169, 106, 0.05)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(123, 169, 106, 0.1)' },
  infoText: { fontSize: 12, color: '#6E7C74', flex: 1, lineHeight: 18 },
  
  actionColumn: { gap: 12 },
  readyBtn: { backgroundColor: '#1B251F', padding: 18, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  readyBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  disabledBtn: { opacity: 0.3 },
  
  draftBtn: { padding: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  draftBtnText: { fontSize: 14, fontWeight: '600' },
  
  backBtn: { padding: 12, alignItems: 'center' },
  backBtnText: { color: '#8C9A90', fontSize: 14, fontWeight: '500' }
});
