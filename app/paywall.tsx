/**
 * Paywall Screen
 *
 * Shows subscription options and handles purchases.
 * On web, displays features and prompts user to download the app.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { PurchasesPackage } from "react-native-purchases";

import { useSubscription } from "@/contexts/SubscriptionContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Premium features for the paywall
const FEATURES = [
  {
    icon: "📄",
    title: "AI CV Writer",
    description: "Generate & improve your CV with AI, tailored for ATS systems",
  },
  {
    icon: "✉️",
    title: "AI Cover Letter",
    description: "Create tailored cover letters for any job in seconds",
  },
  {
    icon: "🔔",
    title: "Advanced Job Alerts",
    description: "Smart notifications for matching roles, interview reminders & salary insights",
  },
  {
    icon: "📊",
    title: "Enhanced Job Matching",
    description: "See your exact match % for every role with skill gap analysis",
  },
];

// App colour palette
const colors = {
  bg: "#0F2B5B",
  surface: "#1A3A6B",
  accent: "#F59E0B",
  text: "#FFFFFF",
  textSecondary: "#94A3B8",
  border: "#1E3A5F",
};

export default function PaywallScreen() {
  const router = useRouter();

  // Get subscription state and methods from context
  const {
    packages,
    loading,
    isSubscribed,
    isWeb,
    purchasePackage,
    restorePurchases,
    mockWebPurchase,
    mockNativePurchase,
  } = useSubscription();

  const [selectedPackage, setSelectedPackage] =
    useState<PurchasesPackage | null>(packages[0] || null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [webMockState, setWebMockState] = useState<"idle" | "processing">("idle");
  const [webMockDialogState, setWebMockDialogState] = useState<"hidden" | "selecting" | "failed">("hidden");

  // Update selected package when packages load
  React.useEffect(() => {
    if (packages.length > 0 && !selectedPackage) {
      setSelectedPackage(packages[0]);
    }
  }, [packages, selectedPackage]);

  // Handle purchase
  const handlePurchase = async () => {
    if (!selectedPackage) return;

    try {
      setPurchasing(true);
      const success = await purchasePackage(selectedPackage);
      if (success) {
        Alert.alert("Welcome!", "Thank you for your purchase.", [
          { text: "OK", onPress: () => router.replace("/(tabs)/(home)") },
        ]);
      }
    } catch (error: any) {
      Alert.alert("Purchase Failed", error.message || "Please try again.");
    } finally {
      setPurchasing(false);
    }
  };

  // Handle restore
  const handleRestore = async () => {
    try {
      setRestoring(true);
      const restored = await restorePurchases();
      if (restored) {
        Alert.alert("Restored!", "Your subscription has been restored.", [
          { text: "OK", onPress: () => router.replace("/(tabs)/(home)") },
        ]);
      } else {
        Alert.alert(
          "No Purchases Found",
          "We couldn't find any previous purchases."
        );
      }
    } catch (error: any) {
      Alert.alert("Restore Failed", error.message || "Please try again.");
    } finally {
      setRestoring(false);
    }
  };

  const handleClose = () => {
    router.replace("/(tabs)/(home)");
  };

  // Handle web mock purchase (replicates RevenueCat test store flow for web preview)
  // Note: Alert.alert with multiple buttons silently fails on React Native Web,
  // so we use a custom View-based dialog overlay instead.
  const handleWebMockPurchase = async () => {
    if (!selectedPackage) return;
    setWebMockState("processing");
    await new Promise((resolve) => setTimeout(resolve, 400));
    setWebMockState("idle");
    setWebMockDialogState("selecting");
  };

  // Handle app store links for web
  const handleDownloadApp = () => {
    // TODO: Replace with your actual app store URLs
    const iosUrl = "https://apps.apple.com/app/your-app-id";
    const androidUrl = "https://play.google.com/store/apps/details?id=your.app.id";

    // On web, we can't detect which device the user has, so show both options
    Alert.alert(
      "Download the App",
      "To subscribe, please download our app from your device's app store.",
      [
        { text: "App Store (iOS)", onPress: () => Linking.openURL(iosUrl) },
        { text: "Google Play", onPress: () => Linking.openURL(androidUrl) },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  // Already subscribed - show celebration confirmation
  if (isSubscribed) {
    return (
      <View style={styles.subscribedContainer}>
        <LinearGradient
          colors={["#0F2B5B", "#1A3A6B", "#0F2B5B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.subscribedGradient}
        >
          {/* Decorative floating orbs */}
          <View style={[styles.floatingOrb, styles.orb1]} />
          <View style={[styles.floatingOrb, styles.orb2]} />
          <View style={[styles.floatingOrb, styles.orb3]} />

          <SafeAreaView edges={["top", "bottom"]} style={styles.subscribedSafeArea}>
            {/* Close button */}
            <TouchableOpacity style={styles.subscribedCloseButton} onPress={handleClose}>
              <Text style={styles.subscribedCloseText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.subscribedContent}>
              {/* Celebration icon with glow */}
              <View style={styles.celebrationIconContainer}>
                <View style={styles.celebrationGlow} />
                <Text style={styles.celebrationIcon}>🎉</Text>
              </View>

              {/* PRO MEMBER badge */}
              <View style={styles.proMemberBadge}>
                <Text style={styles.proMemberText}>PRO MEMBER</Text>
              </View>

              {/* Title */}
              <Text style={styles.subscribedTitle}>You're All Set!</Text>
              <Text style={styles.subscribedSubtitle}>
                Welcome to the premium experience
              </Text>

              {/* Features card */}
              <View style={styles.featuresCard}>
                <Text style={styles.featuresCardTitle}>Unlocked Features</Text>
                {FEATURES.slice(0, 3).map((feature, index) => (
                  <View key={index} style={styles.featureCheckRow}>
                    <View style={styles.checkCircle}>
                      <Text style={styles.checkMark}>✓</Text>
                    </View>
                    <Text style={styles.featureCheckText}>{feature.title}</Text>
                  </View>
                ))}
              </View>

              {/* Start Exploring button */}
              <TouchableOpacity style={styles.exploreButton} onPress={handleClose}>
                <View style={styles.exploreButtonInner}>
                  <Text style={styles.exploreButtonText}>Start Exploring</Text>
                </View>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  // Feature icon background colors (amber tint for all)
  const featureIconColors = [
    "rgba(245, 158, 11, 0.2)",
    "rgba(245, 158, 11, 0.2)",
    "rgba(245, 158, 11, 0.2)",
    "rgba(245, 158, 11, 0.2)",
  ];

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={["#0F2B5B", "#1A3A6B", "#0F2B5B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBackground}
        >
          {/* Decorative floating orbs */}
          <View style={[styles.floatingOrb, styles.orb1]} />
          <View style={[styles.floatingOrb, styles.orb2]} />
          <View style={[styles.floatingOrb, styles.orb3]} />

          <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
            <View style={styles.centeredContainer}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0F2B5B", "#1A3A6B", "#0F2B5B"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      >
        {/* Decorative floating orbs */}
        <View style={[styles.floatingOrb, styles.orb1]} />
        <View style={[styles.floatingOrb, styles.orb2]} />
        <View style={[styles.floatingOrb, styles.orb3]} />

        <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              {/* Premium badge */}
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>PREMIUM</Text>
              </View>
              <Text style={styles.title}>Upgrade to Premium</Text>
              <Text style={styles.subtitle}>
                Unlock all features and get the most out of the app
              </Text>
            </View>

            {/* Features List - Glass Card */}
            <View style={styles.featuresCard}>
              <Text style={styles.featuresCardTitle}>What You'll Get</Text>
              {FEATURES.map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <View style={[styles.featureIcon, { backgroundColor: featureIconColors[index % featureIconColors.length] }]}>
                    <Text style={styles.featureIconText}>{feature.icon}</Text>
                  </View>
                  <View style={styles.featureText}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureDescription}>
                      {feature.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Package Selection */}
            {packages.length > 0 && (
              <View style={styles.packagesContainer}>
                {packages.map((pkg) => {
                  const isSelected = selectedPackage?.identifier === pkg.identifier;
                  return (
                    <TouchableOpacity
                      key={pkg.identifier}
                      style={[
                        styles.packageCard,
                        isSelected && styles.packageCardSelected,
                      ]}
                      onPress={() => setSelectedPackage(pkg)}
                    >
                      {isSelected && <View style={styles.selectedIndicator} />}
                      <View style={styles.packageHeader}>
                        <Text style={styles.packageTitle}>{pkg.product.title}</Text>
                        {isSelected && (
                          <View style={styles.checkmarkCircle}>
                            <Text style={styles.checkmark}>✓</Text>
                          </View>
                        )}
                      </View>
                      {pkg.product.priceString ? (
                        <Text style={styles.packagePrice}>
                          {pkg.product.priceString}
                        </Text>
                      ) : null}
                      {pkg.product.description && (
                        <Text style={styles.packageDescription}>
                          {pkg.product.description}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* No packages available - only show on native */}
            {/* This appears in standard Expo Go because react-native-purchases */}
            {/* native module is not bundled in Expo Go. Use a dev build to test purchases. */}
            {!isWeb && packages.length === 0 && !loading && (
              <View style={styles.noPackagesContainer}>
                <Text style={styles.noPackagesText}>
                  Purchases are not available in standard Expo Go.
                </Text>
                <Text style={[styles.noPackagesText, { marginTop: 8, opacity: 0.7 }]}>
                  To test purchases, use a development build or production build.
                  {"\n"}This is expected — your onboarding and storage are working correctly.
                </Text>
                {__DEV__ && (
                  <TouchableOpacity
                    style={styles.devMockButton}
                    onPress={async () => {
                      await mockNativePurchase();
                      router.replace("/(tabs)/(home)");
                    }}
                  >
                    <Text style={styles.devMockButtonText}>Dev: Simulate Purchase</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>

          {/* Bottom Actions */}
          <View style={styles.bottomActions}>
            {/* Web: mock test-store flow that mirrors Expo Go behavior */}
            {isWeb ? (
              <>
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (!selectedPackage || webMockState === "processing") &&
                      styles.buttonDisabled,
                  ]}
                  onPress={handleWebMockPurchase}
                  disabled={!selectedPackage || webMockState === "processing"}
                >
                  {webMockState === "processing" ? (
                    <ActivityIndicator color="#0F2B5B" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {selectedPackage
                        ? selectedPackage.product.priceString
                          ? `Subscribe for ${selectedPackage.product.priceString}`
                          : "Subscribe"
                        : "Select a plan"}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleRestore}
                  disabled={restoring}
                >
                  {restoring ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.secondaryButtonText}>
                      Restore Purchases
                    </Text>
                  )}
                </TouchableOpacity>
                <Text style={styles.legalText}>
                  Preview mode — purchases available in the mobile app
                </Text>
              </>
            ) : (
              <>
                {/* Native: Subscribe Button */}
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (!selectedPackage || purchasing) && styles.buttonDisabled,
                  ]}
                  onPress={handlePurchase}
                  disabled={!selectedPackage || purchasing}
                >
                  {purchasing ? (
                    <ActivityIndicator color="#0F2B5B" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {selectedPackage
                        ? (selectedPackage.product.priceString
                            ? `Subscribe for ${selectedPackage.product.priceString}`
                            : "Subscribe")
                        : "Select a plan"}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Restore Button */}
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleRestore}
                  disabled={restoring}
                >
                  {restoring ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.secondaryButtonText}>Restore Purchases</Text>
                  )}
                </TouchableOpacity>

                {/* Legal Text - Required by App Store */}
                <Text style={styles.legalText}>
                  Payment will be charged to your{" "}
                  {Platform.OS === "ios" ? "Apple ID" : "Google Play"} account.
                  Subscription automatically renews unless canceled at least 24 hours
                  before the end of the current period.
                </Text>
              </>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Web Mock Purchase Dialog - View-based overlay (Alert.alert with multiple buttons */}
      {/* silently fails on React Native Web - callbacks never fire) */}
      {isWeb && webMockDialogState !== "hidden" && (
        <View style={styles.webDialogOverlay}>
          <View style={styles.webDialogBox}>
            {webMockDialogState === "selecting" && (
              <>
                <Text style={styles.webDialogTitle}>Test Purchase</Text>
                <Text style={styles.webDialogBody}>
                  {`⚠️ This is a test purchase and should only be used during development. In production, use an Apple/Google API key from RevenueCat.

Package ID: ${selectedPackage?.identifier}
Title: ${selectedPackage?.product.title}
Price: ${selectedPackage?.product.priceString || "N/A"}`}
                </Text>
                <View style={styles.webDialogDivider} />
                <TouchableOpacity
                  style={styles.webDialogButton}
                  onPress={() => setWebMockDialogState("failed")}
                >
                  <Text style={[styles.webDialogButtonText, { color: "#EF4444" }]}>
                    Test Failed Purchase
                  </Text>
                </TouchableOpacity>
                <View style={styles.webDialogDivider} />
                <TouchableOpacity
                  style={styles.webDialogButton}
                  onPress={() => {
                    setWebMockDialogState("hidden");
                    mockWebPurchase();
                    router.replace("/(tabs)/(home)");
                  }}
                >
                  <Text style={[styles.webDialogButtonText, { color: "#007AFF" }]}>
                    Test Valid Purchase
                  </Text>
                </TouchableOpacity>
                <View style={styles.webDialogDivider} />
                <TouchableOpacity
                  style={styles.webDialogButton}
                  onPress={() => setWebMockDialogState("hidden")}
                >
                  <Text style={[styles.webDialogButtonText, { color: "#007AFF" }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </>
            )}
            {webMockDialogState === "failed" && (
              <>
                <Text style={styles.webDialogTitle}>Purchase Failed</Text>
                <Text style={styles.webDialogBody}>
                  Test purchase failure: no real transaction occurred
                </Text>
                <View style={styles.webDialogDivider} />
                <TouchableOpacity
                  style={styles.webDialogButton}
                  onPress={() => setWebMockDialogState("hidden")}
                >
                  <Text style={[styles.webDialogButtonText, { color: "#007AFF" }]}>
                    OK
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#94A3B8",
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
    width: "100%",
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  premiumBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  premiumBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#F59E0B",
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 8,
  },
  featuresCard: {
    backgroundColor: "#1A3A6B",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    width: "100%",
    borderLeftWidth: 3,
    borderLeftColor: "#F59E0B",
    borderWidth: 1,
    borderColor: "#1E3A5F",
  },
  featuresCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F59E0B",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 16,
    textAlign: "center",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 12,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  featureIconText: {
    fontSize: 20,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  featureDescription: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 2,
  },
  packagesContainer: {
    gap: 12,
    width: "100%",
  },
  packageCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E3A5F",
    backgroundColor: "#1A3A6B",
    overflow: "hidden",
    width: "100%",
  },
  packageCardSelected: {
    borderColor: "#F59E0B",
    borderWidth: 2,
    backgroundColor: "#1A3A6B",
  },
  selectedIndicator: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "#F59E0B",
  },
  packageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  packageTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  checkmarkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(245, 158, 11, 0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  checkmark: {
    fontSize: 14,
    color: "#F59E0B",
    fontWeight: "bold",
  },
  packagePrice: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#F59E0B",
    marginTop: 8,
  },
  packageDescription: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 4,
  },
  noPackagesContainer: {
    padding: 24,
    alignItems: "center",
  },
  noPackagesText: {
    fontSize: 16,
    color: "#94A3B8",
    textAlign: "center",
  },
  devMockButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    borderStyle: "dashed",
    alignItems: "center",
  },
  devMockButtonText: {
    color: "#F59E0B",
    fontSize: 13,
    textAlign: "center",
  },
  bottomActions: {
    padding: 24,
    paddingBottom: 32,
    gap: 12,
    width: "100%",
  },
  primaryButton: {
    backgroundColor: "#F59E0B",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonText: {
    color: "#0F2B5B",
    fontSize: 18,
    fontWeight: "bold",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 16,
    color: "#94A3B8",
  },
  legalText: {
    fontSize: 11,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 16,
  },

  // Web mock purchase dialog (View-based, since Alert.alert with multiple buttons fails on web)
  webDialogOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  webDialogBox: {
    backgroundColor: "#1A3A6B",
    borderRadius: 14,
    width: "85%",
    maxWidth: 400,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1E3A5F",
  },
  webDialogTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 4,
  },
  webDialogBody: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    paddingHorizontal: 16,
    paddingBottom: 20,
    lineHeight: 18,
  },
  webDialogDivider: {
    height: 1,
    backgroundColor: "#1E3A5F",
  },
  webDialogButton: {
    paddingVertical: 14,
    alignItems: "center",
  },
  webDialogButtonText: {
    fontSize: 17,
  },

  // Subscribed celebration styles
  subscribedContainer: {
    flex: 1,
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
  subscribedGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  subscribedSafeArea: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  floatingOrb: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(245, 158, 11, 0.06)",
  },
  orb1: {
    width: 200,
    height: 200,
    top: -50,
    right: -50,
  },
  orb2: {
    width: 150,
    height: 150,
    bottom: 100,
    left: -40,
  },
  orb3: {
    width: 100,
    height: 100,
    top: SCREEN_HEIGHT * 0.3,
    right: 20,
  },
  subscribedCloseButton: {
    position: "absolute",
    top: 16,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  subscribedCloseText: {
    fontSize: 18,
    color: "#F59E0B",
    fontWeight: "600",
  },
  subscribedContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  celebrationIconContainer: {
    position: "relative",
    marginBottom: 20,
  },
  celebrationGlow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    top: -20,
    left: -20,
  },
  celebrationIcon: {
    fontSize: 80,
  },
  proMemberBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  proMemberText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#F59E0B",
    letterSpacing: 1.5,
  },
  subscribedTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
  },
  subscribedSubtitle: {
    fontSize: 16,
    color: "#94A3B8",
    textAlign: "center",
    marginBottom: 32,
  },
  featureCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  checkMark: {
    fontSize: 14,
    color: "#F59E0B",
    fontWeight: "bold",
  },
  featureCheckText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  exploreButton: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
  },
  exploreButtonInner: {
    backgroundColor: "#F59E0B",
    paddingVertical: 18,
    alignItems: "center",
    borderRadius: 16,
  },
  exploreButtonText: {
    color: "#0F2B5B",
    fontSize: 18,
    fontWeight: "bold",
  },
});
