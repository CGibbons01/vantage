import "react-native-reanimated";
import React, { useEffect } from "react";
import { useFonts } from "expo-font";
import { Redirect, Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme, Alert, View, ActivityIndicator, Platform } from "react-native";
import { useNetworkState } from "expo-network";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { authClient, BEARER_TOKEN_KEY } from "@/lib/auth";
import Constants from "expo-constants";
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { WidgetProvider } from "@/contexts/WidgetContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";

SplashScreen.preventAutoHideAsync();

const AUTH_ROUTES = ["/auth-screen", "/auth-popup", "/auth-callback", "/paywall", "/onboarding", "/welcome", "/privacy"];

// ─── One-time dev reset ───────────────────────────────────────────────────────
// Wipes ALL persisted auth, session, onboarding, and subscription cache so the
// app starts fresh and routes to the welcome/auth screen.
// This runs once on this launch. Remove this call (and the function) when done.
async function wipeAllPersistedData() {
  console.log("[DevReset] Starting full data wipe...");

  const _PROJECT_SCOPE =
    Constants.expoConfig?.extra?.nativelyProjectId ||
    Constants.expoConfig?.slug ||
    "app";

  // SecureStore keys to delete (auth token + onboarding + RC subscription caches)
  const secureKeys = [
    BEARER_TOKEN_KEY,
    `onboarding_complete_${_PROJECT_SCOPE}`,
    `rc_subscribed_${_PROJECT_SCOPE}`,
    `rc_dev_native_${_PROJECT_SCOPE}`,
    // better-auth/expo stores session tokens under this prefix
    `vantageairecruitment_session_token`,
    `vantageairecruitment_session_data`,
  ];

  if (Platform.OS !== "web") {
    for (const key of secureKeys) {
      try {
        await SecureStore.deleteItemAsync(key);
        console.log(`[DevReset] Deleted SecureStore key: ${key}`);
      } catch {
        // key may not exist — ignore
      }
    }
  } else {
    // Web: clear localStorage keys
    for (const key of secureKeys) {
      localStorage.removeItem(key);
    }
    localStorage.removeItem(`rc_mock_purchased_${_PROJECT_SCOPE}`);
    console.log("[DevReset] Cleared web localStorage keys");
  }

  // Wipe all AsyncStorage (covers any other cached state)
  try {
    await AsyncStorage.clear();
    console.log("[DevReset] AsyncStorage.clear() complete");
  } catch (e) {
    console.warn("[DevReset] AsyncStorage.clear() failed:", e);
  }

  // Sign out from better-auth to invalidate the server session
  try {
    await authClient.signOut();
    console.log("[DevReset] authClient.signOut() complete");
  } catch (e) {
    console.warn("[DevReset] authClient.signOut() failed (may already be signed out):", e);
  }

  // RevenueCat logOut — only available in native builds (not Expo Go)
  if (Platform.OS !== "web") {
    try {
      // Dynamic import avoids crashing in Expo Go where the native module is absent
      const rcModule = await import("react-native-purchases");
      const Purchases = rcModule.default;
      if (typeof Purchases?.isConfigured === "function" && await Purchases.isConfigured()) {
        await Purchases.logOut();
        console.log("[DevReset] Purchases.logOut() complete");
      }
    } catch {
      // RC native module not available in standard Expo Go — safe to ignore
    }
  }

  console.log("[DevReset] Full data wipe complete. App will route to welcome screen.");
}
// ─────────────────────────────────────────────────────────────────────────────

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!user && !isAuthRoute) {
    console.log("[AuthGuard] Unauthenticated user, redirecting to /welcome");
    return <Redirect href="/welcome" />;
  }

  if (user && isAuthRoute) {
    console.log("[AuthGuard] Authenticated user on auth route, redirecting to /(tabs)");
    return <Redirect href="/(tabs)" />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const networkState = useNetworkState();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // ONE-TIME DEV RESET — runs on first mount, wipes all cached credentials.
  // Remove this useEffect (and the wipeAllPersistedData function above) after reset is done.
  useEffect(() => {
    wipeAllPersistedData();
  }, []);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    if (!networkState.isConnected && networkState.isInternetReachable === false) {
      Alert.alert(
        "You are offline",
        "Check your connection and try again."
      );
    }
  }, [networkState.isConnected, networkState.isInternetReachable]);

  if (!loaded) return null;

  const CustomDarkTheme: Theme = {
    ...DarkTheme,
    colors: {
      primary: "#F59E0B",
      background: "#0F172A",
      card: "#1E293B",
      text: "#F8FAFC",
      border: "#334155",
      notification: "#EF4444",
    },
  };

  const CustomDefaultTheme: Theme = {
    ...DefaultTheme,
    colors: {
      primary: "#F59E0B",
      background: "#0F172A",
      card: "#1E293B",
      text: "#F8FAFC",
      border: "#334155",
      notification: "#EF4444",
    },
  };

  return (
    <AuthProvider>
      <SubscriptionProvider>
        <NotificationProvider>
          <ThemeProvider value={colorScheme === "dark" ? CustomDarkTheme : CustomDefaultTheme}>
            <SafeAreaProvider>
              <WidgetProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <StatusBar style="light" animated />
                  <AuthGuard>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="auth-screen" options={{ headerShown: false }} />
                    <Stack.Screen name="auth-popup" options={{ headerShown: false }} />
                    <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
                    <Stack.Screen name="paywall" options={{ headerShown: false, presentation: "modal" }} />
                    <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                    <Stack.Screen name="welcome" options={{ headerShown: false }} />
                    <Stack.Screen
                      name="privacy"
                      options={{
                        headerShown: true,
                        headerTitle: "Privacy Policy",
                        headerBackButtonDisplayMode: "minimal",
                        headerStyle: { backgroundColor: "#0F2B5B" },
                        headerTintColor: "#F8FAFC",
                      }}
                    />
                    <Stack.Screen
                      name="notifications"
                      options={{
                        headerShown: true,
                        headerTitle: "Job Alerts",
                        headerBackButtonDisplayMode: "minimal",
                        headerStyle: { backgroundColor: "#0F172A" },
                        headerTintColor: "#F8FAFC",
                      }}
                    />
                    <Stack.Screen
                      name="job/[id]"
                      options={{
                        headerShown: true,
                        headerTitle: "Job Details",
                        headerBackButtonDisplayMode: "minimal",
                        headerStyle: { backgroundColor: "#0F172A" },
                        headerTintColor: "#F8FAFC",
                      }}
                    />
                    <Stack.Screen
                      name="profile/edit"
                      options={{
                        headerShown: true,
                        headerTitle: "Edit Profile",
                        headerBackButtonDisplayMode: "minimal",
                        headerStyle: { backgroundColor: "#0F172A" },
                        headerTintColor: "#F8FAFC",
                      }}
                    />
                  </Stack>
                  </AuthGuard>
                  <SystemBars style="light" />
                </GestureHandlerRootView>
              </WidgetProvider>
            </SafeAreaProvider>
          </ThemeProvider>
        </NotificationProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}
