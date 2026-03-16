import React from "react";
import { View, Image } from "react-native";
import { Tabs } from "expo-router";
import FloatingTabBar from "@/components/FloatingTabBar";

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
  { name: "index", route: "/(tabs)/", icon: "home" as const, label: "Dashboard" },
  { name: "jobs", route: "/(tabs)/jobs", icon: "work" as const, label: "Jobs" },
  { name: "cv-writer", route: "/(tabs)/cv-writer", icon: "description" as const, label: "CV Writer" },
  { name: "cover-letter", route: "/(tabs)/cover-letter", icon: "mail" as const, label: "Cover Letter" },
  { name: "applications", route: "/(tabs)/applications", icon: "list" as const, label: "Applications" },
];

export default function TabLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <Tabs
        screenOptions={{
          headerShown: true,
          headerTitle: () => <HeaderLogo />,
          headerTitleAlign: "center",
          headerStyle: { backgroundColor: "#0F172A" },
          headerShadowVisible: false,
          tabBarStyle: { display: "none" },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="jobs" />
        <Tabs.Screen name="cv-writer" />
        <Tabs.Screen name="cover-letter" />
        <Tabs.Screen name="applications" />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>
      <FloatingTabBar tabs={TABS} containerWidth={380} />
    </View>
  );
}
