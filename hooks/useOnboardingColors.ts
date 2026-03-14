import { useColorScheme } from "react-native";

export function useOnboardingColors() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  return {
    primary: "#007AFF",
    background: isDark ? "#000" : "#fff",
    text: isDark ? "#fff" : "#000",
    card: isDark ? "#1c1c1e" : "#f2f2f7",
    border: isDark ? "#38383a" : "#c6c6c8",
  };
}
