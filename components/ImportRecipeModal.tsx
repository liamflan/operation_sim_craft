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
import { useTheme } from './ThemeContext';

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
  { id: 'more_like_this',  label: 'More like this',    icon: 'thumbs-up',    color: '#9DCD8B' },
  { id: 'less_prep',       label: 'Less prep',         icon: 'bolt',         color: '#E8B07A' },
  { id: 'lower_cost',      label: 'Lower cost',        icon: 'tag',          color: '#D6E58B' },
  { id: 'higher_protein',  label: 'Higher protein',    icon: 'dumbbell',     color: '#D97C6C' },
  { id: 'not_for_me',      label: 'Not for me',        icon: 'times-circle', color: '#6E7C74' },
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
  const { isDarkMode } = useTheme();
  const [step, setStep] = useState<ImportState>('input');
  const [url, setUrl] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [processingText, setProcessingText] = useState('Extracting recipe data…');
  const [selectedFeedback, setSelectedFeedback] = useState<string | null>(null);

  // Desktop: animate modal panel in/out
  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Handle Escape key and body scrolling (web)
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (visible) {
        document.body.style.overflow = 'hidden';
        const handleEscape = (e: KeyboardEvent) => {
          if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEscape);
        return () => {
          document.body.style.overflow = 'auto';
          window.removeEventListener('keydown', handleEscape);
        };
      } else {
        document.body.style.overflow = 'auto';
      }
    }
  }, [visible, onClose]);

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
        {/* Overlay — unified semi-transparent black */}
        <Pressable
          testID="import-recipe-overlay"
          onPress={onClose}
          className="absolute inset-0 bg-black/40 dark:bg-black/60"
          style={{ backdropFilter: 'blur(4px)' } as any}
        />

        {/* Centered animated panel */}
        <View className="flex-1 justify-center items-center" style={{ pointerEvents: 'box-none' } as any}>
          <Animated.View
            className="overflow-hidden shadow-2xl border border-black/[0.05] dark:border-darksoftBorder"
            style={{
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
              width: step === 'review' ? 680 : 480, // standardized medium & large widths
              maxHeight: '88vh',
              borderRadius: 32, // standardized radius
              backgroundColor: isDarkMode ? '#212623' : '#FBFCF8',
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
        className="flex-1 justify-end bg-black/40 dark:bg-black/60"
      >
        <View 
          className="rounded-t-[32px] max-h-[90%] overflow-hidden"
          style={{ backgroundColor: isDarkMode ? '#212623' : '#FBFCF8' }}
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
        className="flex-row justify-between items-center p-5 pb-4 border-b border-black/[0.05] dark:border-darksoftBorder"
      >
        <View className="flex-row items-center">
          <View className="w-9 h-9 bg-sageTint dark:bg-darksageTint rounded-[10px] items-center justify-center mr-3">
            <FontAwesome5 name="file-import" size={14} color="#9DCD8B" />
          </View>
          <Text className="text-[17px] font-bold tracking-tight text-textMain dark:text-darktextMain">
            Import recipe
          </Text>
        </View>
        <TouchableOpacity
          testID="import-recipe-close-btn"
          onPress={onClose}
          className="w-8 h-8 rounded-full bg-black/[0.04] dark:bg-white/[0.05] items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        >
          <FontAwesome5 name="times" size={13} color="#8C9A90" />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {/* ─── Step 1: Input ─── */}
        {step === 'input' && (
          <View className={isDesktop ? "p-8" : "p-6"}>

            {/* Section heading */}
            <View className="mb-6">
              <Text className="text-[22px] font-medium tracking-tight text-textMain dark:text-darktextMain mb-1">
                Import a recipe
              </Text>
              <Text className="text-[14px] font-medium text-textSec dark:text-darktextSec leading-tight">
                Paste a link or recipe text — we'll extract ingredients, estimate macros, and learn your preferences.
              </Text>
            </View>

            {/* ── PRIMARY: URL input ── */}
            <Text className="text-[10px] font-bold uppercase tracking-widest text-[#8C9A90] dark:text-[#6E7C74] mb-2">
              Recipe URL
            </Text>
            <View
              className={`flex-row items-center px-4 py-3.5 mb-5 rounded-[16px] border transition-colors ${url.trim() ? 'bg-surface dark:bg-darksurface border-primary/50 shadow-sm' : 'bg-black/[0.02] dark:bg-white/[0.04] border-black/[0.04] dark:border-white/10 hover:border-black/10 dark:hover:border-white/20 focus-within:border-black/20 dark:focus-within:border-white/30'}`}
            >
              <View className={`w-7 h-7 rounded-[8px] items-center justify-center mr-3 ${url.trim() ? 'bg-primary/10 dark:bg-primary/20' : 'bg-black/[0.04] dark:bg-white/[0.05]'}`}>
                <FontAwesome5 name="link" size={11} color={url.trim() ? '#9DCD8B' : '#8C9A90'} />
              </View>

              <TextInput
                testID="import-recipe-url-input"
                value={url}
                onChangeText={setUrl}
                placeholder="https://..."
                placeholderTextColor="#A0ABA5"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                className="flex-1 text-[16px] font-medium text-textMain dark:text-gray-200 outline-none"
                style={{ outlineWidth: 0 } as any}
              />

              {url.trim() ? (
                <TouchableOpacity onPress={() => setUrl('')} className="p-1 ml-2">
                  <FontAwesome5 name="times-circle" size={14} color="#8C9A90" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* ── DIVIDER ── */}
            <View className="flex-row items-center mb-5">
              <View className="flex-1 h-[1px] bg-black/[0.05] dark:bg-darksoftBorder" />
              <Text className="text-[11px] font-medium text-textSec/60 dark:text-darktextSec/60 mx-4">or paste recipe text</Text>
              <View className="flex-1 h-[1px] bg-black/[0.05] dark:bg-darksoftBorder" />
            </View>

            {/* ── SECONDARY: paste area — independent state ── */}
            <Text className="text-[10px] font-bold uppercase tracking-widest text-[#8C9A90] dark:text-[#6E7C74] mb-2">
              Ingredients or method
            </Text>
            <View
              className={`rounded-[16px] border p-4 mb-8 transition-colors ${pastedText.trim() ? 'bg-surface dark:bg-darksurface border-primary/50 shadow-sm' : 'bg-black/[0.02] dark:bg-white/[0.04] border-black/[0.04] dark:border-white/10 hover:border-black/10 dark:hover:border-white/20 focus-within:border-black/20 dark:focus-within:border-white/30'}`}
            >
              <TextInput
                testID="import-recipe-text-input"
                value={pastedText}
                onChangeText={setPastedText}
                placeholder="Paste ingredients, method, or any recipe text…"
                placeholderTextColor="#A0ABA5"
                multiline
                textAlignVertical="top"
                className="text-[15px] font-medium text-textMain dark:text-gray-200 min-h-[100px] outline-none leading-relaxed"
                style={{ outlineWidth: 0 } as any}
              />
            </View>

            {/* Extract button */}
            <TouchableOpacity
              testID="import-recipe-submit-btn"
              onPress={onExtract}
              disabled={!hasInput}
              className={`py-4 rounded-full items-center transition-all ${hasInput ? 'bg-primary hover:bg-primary-hover shadow-[0_4px_16px_rgba(157,205,139,0.3)] active:scale-[0.98]' : 'bg-black/[0.04] dark:bg-white/[0.05]'}`}
            >
              <Text className={`text-[16px] font-bold tracking-tight ${hasInput ? 'text-white' : 'text-textSec/50 dark:text-[#6E7C74]'}`}>
                Extract recipe
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Step 2: Processing ─── */}
        {step === 'processing' && (
          <View className="items-center justify-center p-8 md:p-12">
            <View className="w-full max-w-[280px] items-center">
              {/* Main Visual: Spinner + Pulse */}
              <View className="relative mb-6 items-center justify-center">
                <View className="w-20 h-20 bg-surface dark:bg-darkgrey rounded-full items-center justify-center shadow-[0_4px_24px_rgba(157,205,139,0.15)] dark:shadow-none border border-black/[0.05] dark:border-white/5">
                  <ActivityIndicator size="large" color="#9DCD8B" />
                </View>
                <View className="absolute w-8 h-8 bg-surface dark:bg-[#2A332E] rounded-full items-center justify-center shadow-sm border border-black/[0.04] dark:border-white/10">
                  <FontAwesome5 name="leaf" size={14} color="#9DCD8B" />
                </View>
              </View>

              <Text className="text-[20px] font-bold text-textMain dark:text-darktextMain tracking-tight mb-2 text-center">
                Provision is thinking…
              </Text>
              <Text className="text-[14px] font-medium text-textSec dark:text-darktextSec text-center mb-8 leading-snug">
                {processingText}
              </Text>

              {/* Simulated Progress Bar */}
              <View className="w-full h-1.5 bg-black/[0.04] dark:bg-white/[0.04] rounded-full overflow-hidden mb-8">
                <Animated.View 
                  className="h-full bg-primary rounded-full"
                  style={{ width: processingText.includes('profile') ? '90%' : processingText.includes('macros') ? '60%' : '30%' } as any}
                />
              </View>

              {/* Step indicators */}
              <View className="w-full pl-2">
                {[
                  { label: 'Reading recipe structure', done: true },
                  { label: 'Analyzing nutrition & complexity', done: processingText.includes('macros') || processingText.includes('profile') },
                  { label: 'Personalizing your taste profile', done: processingText.includes('profile') },
                ].map((s, i) => (
                  <View key={i} className="flex-row items-start mb-4">
                    <View className="items-center w-5 mr-3 relative">
                      <View className={`w-5 h-5 rounded-full items-center justify-center z-10 ${s.done ? 'bg-primary shadow-sm' : 'bg-black/[0.04] dark:bg-white/[0.05]'}`}>
                        {s.done 
                          ? <FontAwesome5 name="check" size={8} color="white" />
                          : <View className="w-1.5 h-1.5 rounded-full bg-black/20 dark:bg-white/20" />
                        }
                      </View>
                      {i < 2 && (
                        <View className={`absolute top-5 w-[2px] h-[20px] ${s.done && (i === 0 ? (processingText.includes('macros') || processingText.includes('profile')) : processingText.includes('profile')) ? 'bg-primary' : 'bg-black/[0.04] dark:bg-white/[0.05]'}`} />
                      )}
                    </View>
                    <Text className={`text-[13px] pt-0.5 ${s.done ? 'font-bold text-textMain dark:text-darktextMain' : 'font-medium text-textSec/60 dark:text-darktextSec/60'}`}>
                      {s.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ─── Step 3: Review ─── */}
        {step === 'review' && (
          <View className={isDesktop ? "flex-row flex-1" : "p-6"}>

            {/* Left / top: recipe preview */}
            <View className={isDesktop ? "w-[290px] border-r border-black/[0.05] dark:border-darksoftBorder" : "mb-6"}>
              {/* Image */}
              <View className="relative w-full overflow-hidden" style={{ height: isDesktop ? 200 : 160 } as any}>
                <Image
                  source={mockExtractedRecipe.imageUrl}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
                {/* Gradient overlay */}
                <View className="absolute bottom-0 left-0 right-0 h-[70px] justify-end px-4 pb-3" style={{ background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.6))' } as any}>
                  <View className="flex-row items-center gap-1.5">
                    <FontAwesome5 name="globe" size={10} color="rgba(255,255,255,0.7)" />
                    <Text className="text-white/90 text-[10px] font-bold tracking-widest uppercase">
                      {mockExtractedRecipe.domain}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Recipe info */}
              <View className={isDesktop ? "p-5 pt-4" : "pt-4"}>
                <Text className="text-[16px] font-bold tracking-tight text-textMain dark:text-darktextMain mb-4 leading-snug">
                  {mockExtractedRecipe.title}
                </Text>

                {/* Tags */}
                <View className="flex-row flex-wrap gap-1.5 mb-5">
                  {mockExtractedRecipe.tags.map((tag: string) => (
                    <View key={tag} className="bg-sageTint dark:bg-darksageTint px-2.5 py-1 rounded-full">
                      <Text className="text-primary dark:text-[#85B674] text-[10px] font-bold uppercase tracking-wide">
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Macro stats */}
                <View className="flex-row gap-2">
                  <View className="flex-1 bg-black/[0.03] dark:bg-white/[0.03] rounded-[16px] p-3.5 border border-transparent dark:border-white/5">
                    <Text className="text-[9px] font-bold text-textSec/70 dark:text-darktextSec/70 uppercase tracking-widest mb-1.5">Macros</Text>
                    <Text className="text-[12px] font-bold text-textMain dark:text-darktextMain leading-tight">{mockExtractedRecipe.macros}</Text>
                  </View>
                  <View className="flex-1 bg-black/[0.03] dark:bg-white/[0.03] rounded-[16px] p-3.5 border border-transparent dark:border-white/5">
                    <Text className="text-[9px] font-bold text-textSec/70 dark:text-darktextSec/70 uppercase tracking-widest mb-1.5">Prep</Text>
                    <Text className="text-[12px] font-bold text-textMain dark:text-darktextMain leading-tight">{mockExtractedRecipe.effort} · {mockExtractedRecipe.time}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Right / bottom: preference section */}
            <View className={isDesktop ? "flex-1 p-7 pt-6" : "mt-2"}>
              <Text className="text-[10px] font-bold uppercase tracking-widest text-[#8C9A90] dark:text-[#6E7C74] mb-2">
                Extraction complete
              </Text>
              <Text className="text-[18px] font-bold tracking-tight text-textMain dark:text-darktextMain mb-1.5">
                How should Provision learn from this?
              </Text>
              <Text className="text-[13px] font-medium text-textSec dark:text-darktextSec mb-6 leading-snug">
                Your choice shapes which meals appear in future week plans.
              </Text>

              {/* Feedback options */}
              <View className="gap-2 mb-2">
                {FEEDBACK_OPTIONS.map((opt, index) => {
                  const isSelected = selectedFeedback === opt.id;
                  const isPrimary = index === 0;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      testID={`import-recipe-feedback-${opt.id}`}
                      onPress={() => onFeedback(opt.id)}
                      className={`flex-row items-center px-4 py-3 rounded-[16px] border transition-all ${
                        isSelected 
                          ? 'border-primary bg-primary/10 shadow-sm' 
                          : isPrimary
                            ? 'border-primary/30 bg-primary/5 hover:bg-primary/10 dark:border-primary/20 dark:bg-primary/10'
                            : 'border-black/[0.04] dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      <View className={`w-7 h-7 rounded-[8px] items-center justify-center mr-3 ${isSelected ? 'bg-primary/20' : isPrimary ? 'bg-white dark:bg-black/20 shadow-sm dark:shadow-none' : 'bg-black/[0.04] dark:bg-white/[0.05]'}`}>
                        <FontAwesome5 name={opt.icon} size={11} color={isSelected || isPrimary ? opt.color : '#8C9A90'} />
                      </View>
                      <Text className={`flex-1 text-[14px] ${isSelected ? 'font-bold text-primary dark:text-[#85B674]' : isPrimary ? 'font-bold text-textMain dark:text-darktextMain' : 'font-medium text-textSec dark:text-darktextSec'}`}>
                        {opt.label}
                      </Text>
                      {isSelected && (
                        <FontAwesome5 name="check" size={12} color="#9DCD8B" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Secondary save */}
              <TouchableOpacity
                testID="import-recipe-skip-btn"
                onPress={() => onFeedback('saved_only')}
                className="mt-3 py-3 rounded-[16px] items-center border border-black/[0.06] dark:border-white/10 bg-black/[0.01] dark:bg-white/[0.01] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
              >
                <Text className="text-[14px] font-medium text-textSec dark:text-darktextSec">
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
