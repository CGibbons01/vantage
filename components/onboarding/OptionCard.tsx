import React from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useOnboardingColors } from "@/hooks/useOnboardingColors";

interface OptionCardProps {
  emoji: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function OptionCard({ emoji, label, selected, onPress }: OptionCardProps) {
  const colors = useOnboardingColors();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: selected ? colors.primary + "15" : colors.card,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <View style={styles.left}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      </View>
      {selected && (
        <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 12,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  emoji: {
    fontSize: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
});
