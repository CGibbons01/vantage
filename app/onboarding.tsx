import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { onboardingQuestions } from "@/constants/OnboardingQuestions";
import { completeOnboarding } from "@/utils/onboardingStorage";
import { useAuth } from "@/contexts/AuthContext";
import { ProgressBar } from "@/components/onboarding/ProgressBar";
import { OptionCard } from "@/components/onboarding/OptionCard";
import { useOnboardingColors } from "@/hooks/useOnboardingColors";
import { COLORS } from "@/constants/theme";

const TOTAL_STEPS = onboardingQuestions.length;
const ONBOARDING_ANSWERS_KEY = "onboarding_answers";

export default function OnboardingScreen() {
  const colors = useOnboardingColors();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const opacity = useSharedValue(1);
  const isAnimating = useRef(false);

  const question = onboardingQuestions[currentStep];
  const selectedOption = answers[currentStep];
  const isLastStep = currentStep === TOTAL_STEPS - 1;
  const isFirstStep = currentStep === 0;

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const goBack = useCallback(() => {
    if (!isFirstStep && !isAnimating.current) {
      isAnimating.current = true;
      opacity.value = withTiming(0, { duration: 150 });
      setTimeout(() => {
        setCurrentStep((prev) => Math.max(0, prev - 1));
        opacity.value = withTiming(1, { duration: 200 });
        isAnimating.current = false;
      }, 150);
    }
  }, [isFirstStep, opacity]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!isFirstStep) {
        goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [isFirstStep, goBack]);

  const handleSelect = (optionId: string) => {
    setAnswers((prev) => ({ ...prev, [currentStep]: optionId }));
  };

  const finishOnboarding = async (currentAnswers: Record<number, string>) => {
    try {
      await AsyncStorage.setItem(ONBOARDING_ANSWERS_KEY, JSON.stringify(currentAnswers));
      console.log('[Onboarding] Answers saved to AsyncStorage:', currentAnswers);
    } catch (e) {
      console.warn('[Onboarding] Failed to save answers:', e);
    }
    try {
      await completeOnboarding();
    } catch (e) {
      console.warn('[Onboarding] Failed to save onboarding state:', e);
    }
    console.log('[Onboarding] Complete — routing to /(tabs)');
    router.replace("/(tabs)");
  };

  const handleSkip = () => {
    console.log('[Onboarding] Skip pressed at step:', currentStep);
    finishOnboarding(answers);
  };

  const handleContinue = async () => {
    if (!selectedOption) return;

    if (isLastStep) {
      console.log('[Onboarding] Last step complete, finishing onboarding');
      await finishOnboarding(answers);
    } else {
      if (isAnimating.current) return;
      isAnimating.current = true;
      opacity.value = withTiming(0, { duration: 150 });
      setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
        opacity.value = withTiming(1, { duration: 200 });
        isAnimating.current = false;
      }, 150);
    }
  };

  if (!question) return null;

  const optionCards = [];
  for (const option of question.options) {
    optionCards.push(
      <OptionCard
        key={option.id}
        emoji={option.emoji}
        label={option.label}
        selected={selectedOption === option.id}
        onPress={() => handleSelect(option.id)}
      />
    );
  }

  const continueDisabled = !selectedOption;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background glow */}
      <View style={styles.glowOrb} />

      <View style={styles.header}>
        {!isFirstStep ? (
          <Pressable onPress={goBack} style={styles.backButton} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.backButton} />
        )}
        <View style={styles.progressWrapper}>
          <ProgressBar totalSteps={TOTAL_STEPS} currentStep={currentStep} />
        </View>
        <Pressable onPress={handleSkip} style={styles.skipButton} hitSlop={12}>
          <Text style={[styles.skipText, { color: COLORS.textSecondary }]}>Skip</Text>
        </Pressable>
      </View>

      <Animated.View style={[styles.content, animatedStyle]}>
        <View style={styles.questionSection}>
          <Text style={[styles.title, { color: colors.text }]}>
            {question.title}
          </Text>
          <Text style={[styles.subtitle, { color: COLORS.textSecondary }]}>
            {question.subtitle}
          </Text>
        </View>

        <View style={styles.optionsSection}>
          {optionCards}
        </View>
      </Animated.View>

      <View style={[styles.footer, { paddingBottom: 16 }]}>
        <Pressable
          onPress={handleContinue}
          disabled={continueDisabled}
          style={[styles.continueButton, continueDisabled && styles.continueButtonDisabled]}
        >
          <LinearGradient
            colors={['#7C3AED', '#4F46E5', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.continueGradient}
          >
            <Text style={styles.continueText}>
              {isLastStep ? "Get Started" : "Continue"}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  glowOrb: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  skipButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    fontSize: 16,
  },
  progressWrapper: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  questionSection: {
    marginTop: 24,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  optionsSection: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 24,
  },
  continueButton: {
    borderRadius: 16,
    overflow: 'hidden',
    height: 55,
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  continueText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
});
