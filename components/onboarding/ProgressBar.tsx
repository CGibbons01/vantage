import React from "react";
import { View, StyleSheet } from "react-native";
import { useOnboardingColors } from "@/hooks/useOnboardingColors";

interface ProgressBarProps {
  totalSteps: number;
  currentStep: number;
}

export function ProgressBar({ totalSteps, currentStep }: ProgressBarProps) {
  const colors = useOnboardingColors();

  if (!totalSteps || totalSteps <= 0) return null;

  const segments = [];
  for (let i = 0; i < totalSteps; i++) {
    segments.push(
      <View
        key={i}
        style={[
          styles.segment,
          {
            backgroundColor:
              i <= currentStep ? colors.primary : colors.border,
          },
        ]}
      />
    );
  }

  return (
    <View style={styles.container}>
      {segments}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 24,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
});
