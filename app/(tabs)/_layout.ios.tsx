import React from "react";
import { Dimensions, Image, View } from "react-native";
import { Tabs } from "expo-router";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import FloatingTabBar from "@/components/FloatingTabBar";
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";

function HeaderLogo() {
  return (
    <Image
      source={require("../../assets/images/app-icon-lca.png")}
      style={{ width: 32, height: 32, borderRadius: 8 }}
      resizeMode="cover"
    />
  );
}

const TABS = [
  { name: "(home)", route: "/(tabs)/(home)" as const, icon: "home" as const, label: "Dashboard" },
  { name: "jobs", route: "/(tabs)/jobs" as const, icon: "work" as const, label: "Jobs" },
  { name: "cv-writer", route: "/(tabs)/cv-writer" as const, icon: "description" as const, label: "CV Writer" },
  { name: "cover-letter", route: "/(tabs)/cover-letter" as const, icon: "mail" as const, label: "Cover Letter" },
  { name: "applications", route: "/(tabs)/applications" as const, icon: "list" as const, label: "Applications" },
];

export default function TabLayout() {
  useSubscriptionGuard();
  return (
    <View style={{ flex: 1, backgroundColor: "#0D0B1E" }}>
      <Tabs
        screenOptions={{
          headerShown: true,
          headerTitle: () => <HeaderLogo />,
          headerTitleAlign: "center",
          headerStyle: { backgroundColor: "#0D0B1E" },
          headerShadowVisible: false,
          tabBarStyle: { display: "none" },
        }}
      >
        <Tabs.Screen name="(home)" />
        <Tabs.Screen name="jobs" />
        <Tabs.Screen name="cv-writer" />
        <Tabs.Screen name="cover-letter" />
        <Tabs.Screen name="applications" />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>
      <FloatingTabBar tabs={TABS} containerWidth={Math.min(420, SCREEN_WIDTH - 32)} />
    </View>
  );
}
