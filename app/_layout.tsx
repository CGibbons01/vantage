import "react-native-reanimated";
import React, { useEffect, useState } from "react";
import { useFonts } from "expo-font";
import { Redirect, Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme, Alert, View, ActivityIndicator } from "react-native";
import { useNetworkState } from "expo-network";
import { isOnboardingComplete } from "@/utils/onboardingStorage";
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

// Routes that are only accessible when NOT authenticated
const UNAUTH_ONLY_ROUTES = ["/auth-screen", "/auth-popup", "/auth-callback", "/welcome"];
// Routes that are accessible regardless of auth state
const PUBLIC_ROUTES = ["/privacy", "/paywall"];
// Onboarding is special — accessible only when authenticated but onboarding not done
const ONBOARDING_ROUTE = "/onboarding";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    // Only check onboarding once we know the user is logged in
    if (!loading && user) {
      isOnboardingComplete().then((done) => {
        console.log("[AuthGuard] onboarding complete:", done);
        setOnboardingDone(done);
      });
    } else if (!loading && !user) {
      // No user — reset so next login re-checks
      setOnboardingDone(null);
    }
  }, [loading, user]);

  // Show spinner while auth state is loading
  if (loading) {
    console.log("[AuthGuard] Auth loading — showing spinner");
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" }}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  const isUnauthOnly = UNAUTH_ONLY_ROUTES.some((r) => pathname.startsWith(r));
  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));
  const isOnboarding = pathname.startsWith(ONBOARDING_ROUTE);
  const isInTabs = pathname.startsWith("/(tabs)") || pathname === "/";

  // ── No user ──────────────────────────────────────────────────────────────
  if (!user) {
    // Allow unauth-only routes and public routes
    if (isUnauthOnly || isPublic) {
      return <>{children}</>;
    }
    // Anything else (tabs, onboarding) → send to welcome
    console.log("[AuthGuard] No user on protected route, redirecting to /welcome");
    return <Redirect href="/welcome" />;
  }

  // ── User is logged in ─────────────────────────────────────────────────────
  // Redirect away from unauth-only routes (welcome, auth-screen, etc.)
  if (isUnauthOnly) {
    console.log("[AuthGuard] Authenticated user on unauth route, redirecting to /(tabs)");
    return <Redirect href="/(tabs)" />;
  }

  // Allow public routes regardless
  if (isPublic) {
    return <>{children}</>;
  }

  // Wait for onboarding check before deciding
  if (onboardingDone === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" }}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  // Onboarding not done → send to onboarding (unless already there)
  if (!onboardingDone && !isOnboarding) {
    console.log("[AuthGuard] Onboarding not complete, redirecting to /onboarding");
    return <Redirect href="/onboarding" />;
  }

  // Onboarding done but user is on the onboarding screen → send to tabs
  if (onboardingDone && isOnboarding) {
    console.log("[AuthGuard] Onboarding already done, redirecting to /(tabs)");
    return <Redirect href="/(tabs)" />;
  }

  // All good — render the requested screen
  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const networkState = useNetworkState();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    if (!networkState.isConnected && networkState.isInternetReachable === false) {
      Alert.alert("You are offline", "Check your connection and try again.");
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
