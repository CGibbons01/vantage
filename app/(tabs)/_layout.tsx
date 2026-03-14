import React from "react";
import { View } from "react-native";
import { Tabs, useRouter, usePathname } from "expo-router";
import FloatingTabBar from "@/components/FloatingTabBar";
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";

const TABS = [
  { name: "index", route: "/(tabs)/", icon: "home" as const, label: "Dashboard" },
  { name: "jobs", route: "/(tabs)/jobs", icon: "work" as const, label: "Jobs" },
  { name: "applications", route: "/(tabs)/applications", icon: "list" as const, label: "Applications" },
  { name: "profile", route: "/(tabs)/profile", icon: "person" as const, label: "Profile" },
];

export default function TabLayout() {
  useSubscriptionGuard();

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <Tabs
        screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="jobs" />
        <Tabs.Screen name="applications" />
        <Tabs.Screen name="profile" />
      </Tabs>
      <FloatingTabBar tabs={TABS} containerWidth={340} />
    </View>
  );
}
