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
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Image } from 'expo-image';

type ImportState = 'input' | 'processing' | 'review';

const SCREEN_WIDTH = Dimensions.get('window').width;
const IS_DESKTOP = Platform.OS === 'web' && SCREEN_WIDTH >= 768;

// Feedback option type
type FeedbackOption = {
  id: string;
  label: string;
  icon: string;
  color: string;
};

const FEEDBACK_OPTIONS: FeedbackOption[] = [
  { id: 'more_like_this',  label: 'More like this',   icon: 'thumbs-up',   color: '#6DBE75' },
  { id: 'less_prep',       label: 'Less prep',         icon: 'bolt',        color: '#F59E0B' },
  { id: 'lower_cost',      label: 'Lower cost',        icon: 'tag',         color: '#8B5CF6' },
  { id: 'higher_protein',  label: 'Higher protein',    icon: 'dumbbell',    color: '#4F7FFF' },
  { id: 'not_for_me',      label: 'Not for me',        icon: 'times-circle', color: '#9CA3AF' },
];

export default function ImportRecipeModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const [step, setStep] = useState<ImportState>('input');
  const [url, setUrl] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [processingText, setProcessingText] = useState('Extracting recipe data…');
  const [selectedFeedback, setSelectedFeedback] = useState<string | null>(null);

  // Desktop: animate modal panel in/out
  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setStep('input');
      setUrl('');
      setPastedText('');
      setSelectedFeedback(null);
      setProcessingText('Extracting recipe data…');
      // Animate in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 220,
          friction: 20,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.94);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const handleExtract = () => {
    // Accept whichever field the user filled in
    if (!url.trim() && !pastedText.trim()) return;
    setStep('processing');
    setTimeout(() => setProcessingText('Estimating macros & effort…'), 1200);
    setTimeout(() => setProcessingText('Building your taste profile…'), 2500);
    setTimeout(() => setStep('review'), 3600);
  };

  const hasInput = url.trim().length > 0 || pastedText.trim().length > 0;

  const handleFeedback = (feedbackId: string) => {
    setSelectedFeedback(feedbackId);
    const finalPayload = {
      recipe: mockExtractedRecipe,
      userFeedback: feedbackId,
      tasteProfileUpdates: mockExtractedRecipe.signals,
    };
    setTimeout(() => {
      onSave(finalPayload);
      onClose();
    }, 400);
  };

  const mockExtractedRecipe = {
    title: 'Spicy Honey Glazed Salmon Bowl',
    domain: 'halfbakedharvest.com',
    time: '25 mins',
    macros: '42g protein • 550 kcal',
    effort: 'Low prep',
    imageUrl:
      'https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=800&auto=format&fit=crop',
    tags: ['High-protein', 'Pescatarian', 'Quick', 'Spicy'],
    signals: { likesSpicy: true, openToFish: true, prefersQuickMeals: true, formatPreference: 'Bowl' },
  };

  // ─── Desktop: centered modal with animated panel ────────────────────────────
  if (IS_DESKTOP) {
    return (
      <Modal
        testID="import-recipe-modal"
        visible={visible}
        animationType="none"
        transparent
        statusBarTranslucent
      >
        {/* Overlay — warm, low opacity */}
        <Pressable
          testID="import-recipe-overlay"
          onPress={onClose}
          style={{
            position: 'absolute', inset: 0,
            backgroundColor: 'rgba(30, 24, 16, 0.35)',
            backdropFilter: 'blur(4px)',
          } as any}
        />

        {/* Centered animated panel */}
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'box-none',
          } as any}
        >
          <Animated.View
            style={{
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
              width: step === 'review' ? 680 : 520,
              maxHeight: '88vh',
              borderRadius: 28,
              backgroundColor: '#FAF8F4',
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 24 },
              shadowOpacity: 0.18,
              shadowRadius: 60,
            } as any}
          >
            <ModalContent
              step={step}
              url={url}
              setUrl={setUrl}
              pastedText={pastedText}
              setPastedText={setPastedText}
              hasInput={hasInput}
              processingText={processingText}
              onExtract={handleExtract}
              onFeedback={handleFeedback}
              onClose={onClose}
              selectedFeedback={selectedFeedback}
              mockExtractedRecipe={mockExtractedRecipe}
              isDesktop
            />
          </Animated.View>
        </View>
      </Modal>
    );
  }

  // ─── Mobile: bottom sheet ────────────────────────────────────────────────────
  return (
    <Modal
      testID="import-recipe-modal"
      visible={visible}
      animationType="slide"
      transparent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: 'rgba(30, 24, 16, 0.5)', justifyContent: 'flex-end' }}
      >
        <View
          style={{
            backgroundColor: '#FAF8F4',
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            maxHeight: '90%',
            overflow: 'hidden',
          }}
        >
          <ModalContent
            step={step}
            url={url}
            setUrl={setUrl}
            pastedText={pastedText}
            setPastedText={setPastedText}
            hasInput={hasInput}
            processingText={processingText}
            onExtract={handleExtract}
            onFeedback={handleFeedback}
            onClose={onClose}
            selectedFeedback={selectedFeedback}
            mockExtractedRecipe={mockExtractedRecipe}
            isDesktop={false}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Shared modal content ───────────────────────────────────────────────────
function ModalContent({
  step,
  url,
  setUrl,
  pastedText,
  setPastedText,
  hasInput,
  processingText,
  onExtract,
  onFeedback,
  onClose,
  selectedFeedback,
  mockExtractedRecipe,
  isDesktop,
}: {
  step: ImportState;
  url: string;
  setUrl: (v: string) => void;
  pastedText: string;
  setPastedText: (v: string) => void;
  hasInput: boolean;
  processingText: string;
  onExtract: () => void;
  onFeedback: (id: string) => void;
  onClose: () => void;
  selectedFeedback: string | null;
  mockExtractedRecipe: any;
  isDesktop: boolean;
}) {
  return (
    <>
      {/* ─── Header ─── */}
      <View
        testID="import-recipe-header"
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 20,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(0,0,0,0.05)',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 36,
              height: 36,
              backgroundColor: 'rgba(109,190,117,0.15)',
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <FontAwesome5 name="file-import" size={14} color="#6DBE75" />
          </View>
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.3 }}>
            Import recipe
          </Text>
        </View>
        <TouchableOpacity
          testID="import-recipe-close-btn"
          onPress={onClose}
          style={{
            width: 32,
            height: 32,
            backgroundColor: 'rgba(0,0,0,0.05)',
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FontAwesome5 name="times" size={13} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Step 1: Input ─── */}
        {step === 'input' && (
          <View style={{ padding: isDesktop ? 28 : 22, paddingTop: 22, paddingBottom: isDesktop ? 28 : 22 }}>

            {/* Section heading */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.4, marginBottom: 5 }}>
                Import a recipe
              </Text>
              <Text style={{ fontSize: 13, color: '#6B7280', fontWeight: '500', lineHeight: 19 }}>
                Paste a link or recipe text — we'll extract ingredients, estimate macros, and learn your preferences.
              </Text>
            </View>

            {/* ── PRIMARY: URL input ── */}
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 7 }}>
              Recipe URL
            </Text>
            <View
              style={{
                backgroundColor: 'white',
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: url.trim() ? '#6DBE75' : 'rgba(0,0,0,0.09)',
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 13,
                paddingVertical: 12,
                marginBottom: 18,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 6,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: url.trim() ? 'rgba(109,190,117,0.12)' : 'rgba(0,0,0,0.04)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                  flexShrink: 0,
                }}
              >
                <FontAwesome5 name="link" size={11} color={url.trim() ? '#6DBE75' : '#C4C4C4'} />
              </View>

              <TextInput
                testID="import-recipe-url-input"
                value={url}
                onChangeText={setUrl}
                placeholder="https://..."
                placeholderTextColor="#C4C4C4"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                style={{
                  flex: 1,
                  fontSize: 15,
                  color: '#1C1C1E',
                  fontWeight: '500',
                  outlineWidth: 0,
                } as any}
              />

              {url.trim() ? (
                <TouchableOpacity onPress={() => setUrl('')} style={{ padding: 4, marginLeft: 6 }}>
                  <FontAwesome5 name="times-circle" size={13} color="#D1D5DB" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* ── DIVIDER ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.09)' }} />
              <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginHorizontal: 14, letterSpacing: 0.3 }}>
                or paste recipe text
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.09)' }} />
            </View>

            {/* ── SECONDARY: paste area — independent state ── */}
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 7 }}>
              Ingredients or method
            </Text>
            <View
              style={{
                backgroundColor: pastedText.trim() ? 'white' : 'rgba(0,0,0,0.02)',
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: pastedText.trim() ? '#6DBE75' : 'rgba(0,0,0,0.08)',
                padding: 13,
                marginBottom: 22,
              }}
            >
              <TextInput
                testID="import-recipe-text-input"
                value={pastedText}
                onChangeText={setPastedText}
                placeholder="Paste ingredients, method, or any recipe text…"
                placeholderTextColor="#C4C4C4"
                multiline
                textAlignVertical="top"
                style={{
                  fontSize: 14,
                  color: '#1C1C1E',
                  fontWeight: '400',
                  minHeight: 80,
                  lineHeight: 21,
                  outlineWidth: 0,
                } as any}
              />
            </View>

            {/* Extract button */}
            <TouchableOpacity
              testID="import-recipe-submit-btn"
              onPress={onExtract}
              disabled={!hasInput}
              style={{
                paddingVertical: 14,
                borderRadius: 15,
                alignItems: 'center',
                backgroundColor: '#1C1C1E',
                opacity: hasInput ? 1 : 0.22,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: 'white', letterSpacing: 0.15 }}>
                Extract recipe
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Step 2: Processing ─── */}
        {step === 'processing' && (
          <View style={{ alignItems: 'center', justifyContent: 'center', padding: 36, paddingVertical: 50 }}>
            {/* Main Visual: Spinner + Pulse */}
            <View style={{ position: 'relative', marginBottom: 24, alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  width: 88,
                  height: 88,
                  backgroundColor: 'white',
                  borderRadius: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#6DBE75',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 12,
                }}
              >
                <ActivityIndicator size="large" color="#6DBE75" />
              </View>
              <View 
                style={{
                  position: 'absolute',
                  width: 32,
                  height: 32,
                  backgroundColor: 'white',
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                }}
              >
                <FontAwesome5 name="leaf" size={14} color="#6DBE75" />
              </View>
            </View>

            <Text style={{ fontSize: 20, fontWeight: '800', color: '#1C1C1E', marginBottom: 8, letterSpacing: -0.4 }}>
              Provision is thinking…
            </Text>
            <Text style={{ fontSize: 13, color: '#9CA3AF', fontWeight: '500', textAlign: 'center', marginBottom: 32, paddingHorizontal: 20, lineHeight: 19 }}>
              {processingText}
            </Text>

            {/* Simulated Progress Bar */}
            <View style={{ width: '100%', maxWidth: 300, height: 6, backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 3, overflow: 'hidden', marginBottom: 32 }}>
              <Animated.View 
                style={{ 
                  height: '100%', 
                  backgroundColor: '#6DBE75', 
                  width: processingText.includes('profile') ? '90%' : processingText.includes('macros') ? '60%' : '30%',
                  borderRadius: 3
                } as any}
              />
            </View>

            {/* Step indicators — vertical list with connecting lines */}
            <View style={{ width: '100%', maxWidth: 260 }}>
              {[
                { label: 'Reading recipe structure', done: true },
                { label: 'Analyzing nutrition & complexity', done: processingText.includes('macros') || processingText.includes('profile') },
                { label: 'Personalizing your taste profile', done: processingText.includes('profile') },
              ].map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 }}>
                  <View style={{ alignItems: 'center', width: 20, marginRight: 12 }}>
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: s.done ? '#6DBE75' : 'rgba(0,0,0,0.04)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2,
                      }}
                    >
                      {s.done 
                        ? <FontAwesome5 name="check" size={8} color="white" />
                        : <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' }} />
                      }
                    </View>
                    {i < 2 && (
                      <View 
                        style={{ 
                          position: 'absolute',
                          top: 20,
                          width: 2,
                          height: 14,
                          backgroundColor: s.done && (i === 0 ? (processingText.includes('macros') || processingText.includes('profile')) : processingText.includes('profile')) 
                            ? '#6DBE75' 
                            : 'rgba(0,0,0,0.04)',
                        }} 
                      />
                    )}
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: s.done ? '700' : '500', color: s.done ? '#1C1C1E' : '#C4C4C4', paddingTop: 1 }}>
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ─── Step 3: Review ─── */}
        {step === 'review' && (
          <View style={isDesktop ? { flexDirection: 'row', flex: 1 } : { padding: 20 }}>

            {/* Left / top: recipe preview */}
            <View
              style={isDesktop
                ? { width: 290, borderRightWidth: 1, borderRightColor: 'rgba(0,0,0,0.05)' }
                : { marginBottom: 24 }
              }
            >
              {/* Image — taller, better breathing room */}
              <View style={{ height: isDesktop ? 200 : 150, position: 'relative' }}>
                <Image
                  source={mockExtractedRecipe.imageUrl}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
                {/* Gradient overlay */}
                <View
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 70,
                    background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.55))',
                    justifyContent: 'flex-end',
                    paddingHorizontal: 14,
                    paddingBottom: 12,
                  } as any}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <FontAwesome5 name="globe" size={9} color="rgba(255,255,255,0.6)" />
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '600', letterSpacing: 0.5 }}>
                      {mockExtractedRecipe.domain}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Recipe info — more breathing room */}
              <View style={{ padding: isDesktop ? 20 : 0, paddingTop: isDesktop ? 18 : 16 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.3, marginBottom: 12, lineHeight: 21 }}>
                  {mockExtractedRecipe.title}
                </Text>

                {/* Tags */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 16 }}>
                  {mockExtractedRecipe.tags.map((tag: string) => (
                    <View key={tag} style={{ backgroundColor: 'rgba(109,190,117,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 }}>
                      <Text style={{ color: '#6DBE75', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 }}>
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Macro stats */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 12, padding: 11 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: '#B0B0B0', textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 4 }}>Macros</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1C1C1E', lineHeight: 17 }}>{mockExtractedRecipe.macros}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 12, padding: 11 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: '#B0B0B0', textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 4 }}>Prep</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1C1C1E', lineHeight: 17 }}>{mockExtractedRecipe.effort} · {mockExtractedRecipe.time}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Right / bottom: preference section */}
            <View style={isDesktop ? { flex: 1, padding: 26, paddingTop: 26 } : { marginTop: 4 }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>
                Extraction complete
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.3, marginBottom: 6 }}>
                How should Provision learn from this?
              </Text>
              <Text style={{ fontSize: 13, color: '#9CA3AF', fontWeight: '500', marginBottom: 22, lineHeight: 18 }}>
                Your choice shapes which meals appear in future week plans.
              </Text>

              {/* Feedback options */}
              <View style={{ gap: 5 }}>
                {FEEDBACK_OPTIONS.map((opt, index) => {
                  const isSelected = selectedFeedback === opt.id;
                  const isPrimary = index === 0;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      testID={`import-recipe-feedback-${opt.id}`}
                      onPress={() => onFeedback(opt.id)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 10,
                        paddingHorizontal: 13,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isSelected
                          ? opt.color
                          : isPrimary
                            ? 'rgba(109,190,117,0.28)'
                            : 'rgba(0,0,0,0.06)',
                        backgroundColor: isSelected
                          ? `${opt.color}18`
                          : isPrimary
                            ? 'rgba(109,190,117,0.06)'
                            : 'rgba(0,0,0,0.02)',
                      }}
                    >
                      <View
                        style={{
                          width: 27,
                          height: 27,
                          borderRadius: 7,
                          backgroundColor: `${opt.color}16`,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 11,
                        }}
                      >
                        <FontAwesome5 name={opt.icon} size={11} color={opt.color} />
                      </View>
                      <Text style={{ fontSize: 13.5, fontWeight: isPrimary ? '700' : '600', color: isSelected ? opt.color : isPrimary ? '#1C1C1E' : '#374151', flex: 1 }}>
                        {opt.label}
                      </Text>
                      {isSelected && (
                        <FontAwesome5 name="check" size={10} color={opt.color} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Secondary save — more visible outlined style */}
              <TouchableOpacity
                testID="import-recipe-skip-btn"
                onPress={() => onFeedback('saved_only')}
                style={{
                  alignItems: 'center',
                  marginTop: 12,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(0,0,0,0.09)',
                  backgroundColor: 'rgba(0,0,0,0.02)',
                }}
              >
                <Text style={{ fontSize: 13, color: '#6B7280', fontWeight: '600' }}>
                  Just save this recipe
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
}
