import "react-native-reanimated";
import React, { useEffect, useState } from "react";
import { useFonts } from "expo-font";
import { Stack, useRouter, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme, Alert } from "react-native";
import { useNetworkState } from "expo-network";
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { WidgetProvider } from "@/contexts/WidgetContext";
import { SubscriptionProvider, useSubscription } from "@/contexts/SubscriptionContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { isOnboardingComplete } from "@/utils/onboardingStorage";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

const AUTH_ROUTES = ["/auth-screen", "/auth-popup", "/auth-callback", "/paywall", "/onboarding"];

function AuthGuard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));
    if (!user && !isAuthRoute) {
      router.replace("/auth-screen");
    }
  }, [user, loading, pathname]);

  return null;
}


function SubscriptionRedirect() {
  const { isSubscribed, loading } = useSubscription();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    isOnboardingComplete().then(setOnboardingDone).catch(() => setOnboardingDone(true));
  }, [pathname]);

  useEffect(() => {
    if (loading || onboardingDone === null) return;
    const onOnboarding = pathname.startsWith("/onboarding");
    const onPaywall = pathname === "/paywall";
    const onAuthScreen = pathname === "/auth-screen";
    if (onOnboarding || onPaywall || onAuthScreen) return;
    if (!onboardingDone) return;
    if (!user) {
      router.replace("/auth-screen");
    } else if (!isSubscribed) {
      router.replace("/paywall");
    }
  }, [isSubscribed, loading, pathname, onboardingDone, user]);

  return null;
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
          <SubscriptionRedirect />
          <ThemeProvider value={colorScheme === "dark" ? CustomDarkTheme : CustomDefaultTheme}>
            <SafeAreaProvider>
              <WidgetProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <StatusBar style="light" animated />
                  <AuthGuard />
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="auth-screen" options={{ headerShown: false }} />
                    <Stack.Screen name="auth-popup" options={{ headerShown: false }} />
                    <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
                    <Stack.Screen name="paywall" options={{ headerShown: false, presentation: "modal" }} />
                    <Stack.Screen name="onboarding" options={{ headerShown: false }} />
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
