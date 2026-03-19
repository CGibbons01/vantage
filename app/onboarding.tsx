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
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { onboardingQuestions } from "@/constants/OnboardingQuestions";
import { completeOnboarding } from "@/utils/onboardingStorage";
import { useAuth } from "@/contexts/AuthContext";
import { ProgressBar } from "@/components/onboarding/ProgressBar";
import { OptionCard } from "@/components/onboarding/OptionCard";
import { useOnboardingColors } from "@/hooks/useOnboardingColors";

const TOTAL_STEPS = onboardingQuestions.length;

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

  const handleContinue = async () => {
    if (!selectedOption) return;

    if (isLastStep) {
      try {
        await completeOnboarding();
      } catch (e) {
        console.warn('Failed to save onboarding state:', e);
      }
      console.log('[Onboarding] Complete — routing to /(tabs)');
      router.replace("/(tabs)");
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
      <OptionCard key={option.id} emoji={option.emoji} label={option.label} selected={selectedOption === option.id} onPress={() => handleSelect(option.id)} />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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
        <View style={styles.backButton} />
      </View>

      <Animated.View style={[styles.content, animatedStyle]}>
        <View style={styles.questionSection}>
          <Text style={[styles.title, { color: colors.text }]}>
            {question.title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.text + "99" }]}>
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
          disabled={!selectedOption}
          style={[
            styles.continueButton,
            {
              backgroundColor: colors.primary,
              opacity: selectedOption ? 1 : 0.4,
            },
          ]}
        >
          <Text style={styles.continueText}>
            {isLastStep ? "Get Started" : "Continue"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    height: 55,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  continueText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
});
