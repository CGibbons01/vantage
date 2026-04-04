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
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { WidgetProvider } from "@/contexts/WidgetContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";

SplashScreen.preventAutoHideAsync();

const UNAUTH_ONLY_ROUTES = ["/auth-screen", "/auth-popup", "/auth-callback", "/welcome"];
const PUBLIC_ROUTES = ["/privacy", "/paywall"];
const ONBOARDING_ROUTE = "/onboarding";

const PremiumDarkTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0D0B1E',
    card: '#161230',
    text: '#F0EEFF',
    border: 'rgba(124, 58, 237, 0.2)',
    primary: '#7C3AED',
    notification: '#EC4899',
  },
};

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading && user) {
      isOnboardingComplete().then((done) => {
        console.log("[AuthGuard] onboarding complete:", done);
        setOnboardingDone(done);
      });
    } else if (!loading && !user) {
      setOnboardingDone(null);
    }
  }, [loading, user]);

  if (loading) {
    console.log("[AuthGuard] Auth loading — showing spinner");
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0D0B1E" }}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  const isUnauthOnly = UNAUTH_ONLY_ROUTES.some((r) => pathname.startsWith(r));
  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));
  const isOnboarding = pathname.startsWith(ONBOARDING_ROUTE);

  if (!user) {
    if (isUnauthOnly || isPublic) {
      return <>{children}</>;
    }
    console.log("[AuthGuard] No user on protected route, redirecting to /welcome");
    return <Redirect href="/welcome" />;
  }

  if (isUnauthOnly) {
    console.log("[AuthGuard] Authenticated user on unauth route, redirecting to /(tabs)");
    return <Redirect href="/(tabs)" />;
  }

  if (isPublic) {
    return <>{children}</>;
  }

  if (onboardingDone === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0D0B1E" }}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  if (!onboardingDone && !isOnboarding) {
    console.log("[AuthGuard] Onboarding not complete, redirecting to /onboarding");
    return <Redirect href="/onboarding" />;
  }

  if (onboardingDone && isOnboarding) {
    console.log("[AuthGuard] Onboarding already done, redirecting to /(tabs)");
    return <Redirect href="/(tabs)" />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
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

  return (
    <AuthProvider>
      <SubscriptionProvider>
        <NotificationProvider>
          <ThemeProvider value={PremiumDarkTheme}>
            <SafeAreaProvider>
              <WidgetProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <StatusBar style="light" animated />
                  <AuthGuard>
                    <Stack
                      screenOptions={{
                        headerShown: false,
                        animation: 'slide_from_right',
                        animationDuration: 300,
                        contentStyle: { backgroundColor: '#0D0B1E' },
                        headerStyle: { backgroundColor: '#0D0B1E' },
                        headerTintColor: '#F0EEFF',
                        headerTitleStyle: { color: '#F0EEFF', fontWeight: '600' },
                        headerShadowVisible: false,
                      }}
                    >
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
                          headerStyle: { backgroundColor: '#0D0B1E' },
                          headerTintColor: '#F0EEFF',
                        }}
                      />
                      <Stack.Screen
                        name="job/[id]"
                        options={{
                          headerShown: true,
                          headerTitle: "Job Details",
                          headerBackButtonDisplayMode: "minimal",
                          headerStyle: { backgroundColor: '#0D0B1E' },
                          headerTintColor: '#F0EEFF',
                        }}
                      />
                      <Stack.Screen
                        name="profile/edit"
                        options={{
                          headerShown: true,
                          headerTitle: "Edit Profile",
                          headerBackButtonDisplayMode: "minimal",
                          headerStyle: { backgroundColor: '#0D0B1E' },
                          headerTintColor: '#F0EEFF',
                        }}
                      />
                      <Stack.Screen
                        name="notification-preferences"
                        options={{
                          headerShown: true,
                          headerTitle: "Notification Preferences",
                          headerBackButtonDisplayMode: "minimal",
                          headerStyle: { backgroundColor: '#0D0B1E' },
                          headerTintColor: '#F0EEFF',
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
