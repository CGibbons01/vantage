// Uses expo-secure-store which is compatible with standard Expo Go, web, and production builds.
// DO NOT replace with @react-native-async-storage/async-storage — it requires a native/dev build
// and will crash with "Native module is null" in standard Expo Go.
import Constants from "expo-constants";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// Scoped per project so different apps on the same Expo Go device don't share onboarding state
const _PROJECT_SCOPE = Constants.expoConfig?.extra?.nativelyProjectId || Constants.expoConfig?.slug || "app";
const ONBOARDING_KEY = `onboarding_complete_${_PROJECT_SCOPE}`;

export async function isOnboardingComplete(): Promise<boolean> {
  if (Platform.OS === "web") {
    return localStorage.getItem(ONBOARDING_KEY) === "true";
  }
  const value = await SecureStore.getItemAsync(ONBOARDING_KEY);
  return value === "true";
}

export async function completeOnboarding(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(ONBOARDING_KEY, "true");
    return;
  }
  await SecureStore.setItemAsync(ONBOARDING_KEY, "true");
}

export async function resetOnboarding(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(ONBOARDING_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(ONBOARDING_KEY);
}
