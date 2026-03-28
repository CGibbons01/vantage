/**
 * Paywall Screen — Premium Purple/Pink theme
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
import { COLORS } from "@/constants/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

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

export default function PaywallScreen() {
  const router = useRouter();

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

  React.useEffect(() => {
    if (packages.length > 0 && !selectedPackage) {
      setSelectedPackage(packages[0]);
    }
  }, [packages, selectedPackage]);

  const handlePurchase = async () => {
    if (!selectedPackage) return;
    console.log('[Paywall] Purchase button pressed:', selectedPackage.identifier);
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

  const handleRestore = async () => {
    console.log('[Paywall] Restore purchases pressed');
    try {
      setRestoring(true);
      const restored = await restorePurchases();
      if (restored) {
        Alert.alert("Restored!", "Your subscription has been restored.", [
          { text: "OK", onPress: () => router.replace("/(tabs)/(home)") },
        ]);
      } else {
        Alert.alert("No Purchases Found", "We couldn't find any previous purchases.");
      }
    } catch (error: any) {
      Alert.alert("Restore Failed", error.message || "Please try again.");
    } finally {
      setRestoring(false);
    }
  };

  const handleClose = () => {
    console.log('[Paywall] Close button pressed');
    router.replace("/(tabs)");
  };

  const handleWebMockPurchase = async () => {
    if (!selectedPackage) return;
    console.log('[Paywall] Web mock purchase initiated');
    setWebMockState("processing");
    await new Promise((resolve) => setTimeout(resolve, 400));
    setWebMockState("idle");
    setWebMockDialogState("selecting");
  };

  const handleDownloadApp = () => {
    const iosUrl = "https://apps.apple.com/app/vantage-ai-recruitment";
    const androidUrl = "https://play.google.com/store/apps/details?id=com.vantage.airecruitment";
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

  if (isSubscribed) {
    return (
      <View style={styles.subscribedContainer}>
        <LinearGradient
          colors={['#0D0B1E', '#1E1A3A', '#0D0B1E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.subscribedGradient}
        >
          <View style={[styles.floatingOrb, styles.orb1]} />
          <View style={[styles.floatingOrb, styles.orb2]} />
          <View style={[styles.floatingOrb, styles.orb3]} />

          <SafeAreaView edges={["top", "bottom"]} style={styles.subscribedSafeArea}>
            <TouchableOpacity style={styles.subscribedCloseButton} onPress={handleClose}>
              <Text style={styles.subscribedCloseText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.subscribedContent}>
              <View style={styles.celebrationIconContainer}>
                <View style={styles.celebrationGlow} />
                <Text style={styles.celebrationIcon}>🎉</Text>
              </View>

              <LinearGradient
                colors={['rgba(124, 58, 237, 0.25)', 'rgba(236, 72, 153, 0.25)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.proMemberBadge}
              >
                <Text style={styles.proMemberText}>PRO MEMBER</Text>
              </LinearGradient>

              <Text style={styles.subscribedTitle}>You're All Set!</Text>
              <Text style={styles.subscribedSubtitle}>Welcome to the premium experience</Text>

              <View style={styles.featuresCard}>
                <Text style={styles.featuresCardTitle}>Unlocked Features</Text>
                {FEATURES.slice(0, 3).map((feature, index) => (
                  <View key={index} style={styles.featureCheckRow}>
                    <LinearGradient
                      colors={['#7C3AED', '#EC4899']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.checkCircle}
                    >
                      <Text style={styles.checkMark}>✓</Text>
                    </LinearGradient>
                    <Text style={styles.featureCheckText}>{feature.title}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={styles.exploreButton} onPress={handleClose}>
                <LinearGradient
                  colors={['#7C3AED', '#4F46E5', '#EC4899']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.exploreButtonInner}
                >
                  <Text style={styles.exploreButtonText}>Start Exploring</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0D0B1E', '#1E1A3A', '#0D0B1E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBackground}
        >
          <View style={[styles.floatingOrb, styles.orb1]} />
          <View style={[styles.floatingOrb, styles.orb2]} />
          <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
            <View style={styles.centeredContainer}>
              <ActivityIndicator size="large" color={COLORS.primaryLight} />
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
        colors={['#0D0B1E', '#1E1A3A', '#0D0B1E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      >
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
              <LinearGradient
                colors={['rgba(124, 58, 237, 0.25)', 'rgba(236, 72, 153, 0.25)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.premiumBadge}
              >
                <Text style={styles.premiumBadgeText}>PREMIUM</Text>
              </LinearGradient>
              <Text style={styles.title}>Upgrade to Premium</Text>
              <Text style={styles.subtitle}>
                Unlock all features and get the most out of the app
              </Text>
            </View>

            {/* Features List */}
            <View style={styles.featuresCard}>
              <Text style={styles.featuresCardTitle}>What You'll Get</Text>
              {FEATURES.map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <LinearGradient
                    colors={index % 2 === 0 ? ['#7C3AED', '#4F46E5'] : ['#EC4899', '#7C3AED']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.featureIcon}
                  >
                    <Text style={styles.featureIconText}>{feature.icon}</Text>
                  </LinearGradient>
                  <View style={styles.featureText}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureDescription}>{feature.description}</Text>
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
                      style={[styles.packageCard, isSelected && styles.packageCardSelected]}
                      onPress={() => {
                        console.log('[Paywall] Package selected:', pkg.identifier);
                        setSelectedPackage(pkg);
                      }}
                    >
                      {isSelected && (
                        <LinearGradient
                          colors={['#7C3AED', '#EC4899']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.selectedIndicator}
                        />
                      )}
                      <View style={styles.packageHeader}>
                        <Text style={styles.packageTitle}>{pkg.product.title}</Text>
                        {isSelected && (
                          <LinearGradient
                            colors={['#7C3AED', '#EC4899']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.checkmarkCircle}
                          >
                            <Text style={styles.checkmark}>✓</Text>
                          </LinearGradient>
                        )}
                      </View>
                      {pkg.product.priceString ? (
                        <Text style={styles.packagePrice}>{pkg.product.priceString}</Text>
                      ) : null}
                      {pkg.product.description && (
                        <Text style={styles.packageDescription}>{pkg.product.description}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

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
                      console.log('[Paywall] Dev simulate purchase pressed');
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
            {isWeb ? (
              <>
                <TouchableOpacity
                  style={[styles.primaryButton, (!selectedPackage || webMockState === "processing") && styles.buttonDisabled]}
                  onPress={handleWebMockPurchase}
                  disabled={!selectedPackage || webMockState === "processing"}
                >
                  <LinearGradient
                    colors={['#7C3AED', '#4F46E5', '#EC4899']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryButtonGradient}
                  >
                    {webMockState === "processing" ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        {selectedPackage
                          ? selectedPackage.product.priceString
                            ? `Subscribe for ${selectedPackage.product.priceString}`
                            : "Subscribe"
                          : "Select a plan"}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleRestore} disabled={restoring}>
                  {restoring
                    ? <ActivityIndicator size="small" color={COLORS.textSecondary} />
                    : <Text style={styles.secondaryButtonText}>Restore Purchases</Text>
                  }
                </TouchableOpacity>
                <Text style={styles.legalText}>Preview mode — purchases available in the mobile app</Text>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.primaryButton, (!selectedPackage || purchasing) && styles.buttonDisabled]}
                  onPress={handlePurchase}
                  disabled={!selectedPackage || purchasing}
                >
                  <LinearGradient
                    colors={['#7C3AED', '#4F46E5', '#EC4899']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryButtonGradient}
                  >
                    {purchasing ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        {selectedPackage
                          ? (selectedPackage.product.priceString
                              ? `Subscribe for ${selectedPackage.product.priceString}`
                              : "Subscribe")
                          : "Select a plan"}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryButton} onPress={handleRestore} disabled={restoring}>
                  {restoring
                    ? <ActivityIndicator size="small" color={COLORS.textSecondary} />
                    : <Text style={styles.secondaryButtonText}>Restore Purchases</Text>
                  }
                </TouchableOpacity>

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

      {isWeb && webMockDialogState !== "hidden" && (
        <View style={styles.webDialogOverlay}>
          <View style={styles.webDialogBox}>
            {webMockDialogState === "selecting" && (
              <>
                <Text style={styles.webDialogTitle}>Test Purchase</Text>
                <Text style={styles.webDialogBody}>
                  {`⚠️ This is a test purchase and should only be used during development.\n\nPackage ID: ${selectedPackage?.identifier}\nTitle: ${selectedPackage?.product.title}\nPrice: ${selectedPackage?.product.priceString || "N/A"}`}
                </Text>
                <View style={styles.webDialogDivider} />
                <TouchableOpacity style={styles.webDialogButton} onPress={() => setWebMockDialogState("failed")}>
                  <Text style={[styles.webDialogButtonText, { color: COLORS.error }]}>Test Failed Purchase</Text>
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
                  <Text style={[styles.webDialogButtonText, { color: COLORS.primaryLight }]}>Test Valid Purchase</Text>
                </TouchableOpacity>
                <View style={styles.webDialogDivider} />
                <TouchableOpacity style={styles.webDialogButton} onPress={() => setWebMockDialogState("hidden")}>
                  <Text style={[styles.webDialogButtonText, { color: COLORS.primaryLight }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
            {webMockDialogState === "failed" && (
              <>
                <Text style={styles.webDialogTitle}>Purchase Failed</Text>
                <Text style={styles.webDialogBody}>Test purchase failure: no real transaction occurred</Text>
                <View style={styles.webDialogDivider} />
                <TouchableOpacity style={styles.webDialogButton} onPress={() => setWebMockDialogState("hidden")}>
                  <Text style={[styles.webDialogButtonText, { color: COLORS.primaryLight }]}>OK</Text>
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
    color: COLORS.textSecondary,
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
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
  },
  premiumBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primaryLight,
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: COLORS.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 8,
  },
  featuresCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    width: "100%",
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  featuresCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primaryLight,
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
    color: COLORS.text,
  },
  featureDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
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
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
    overflow: "hidden",
    width: "100%",
  },
  packageCardSelected: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  selectedIndicator: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  packageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  packageTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  checkmarkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  checkmark: {
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  packagePrice: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.primaryLight,
    marginTop: 8,
  },
  packageDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  noPackagesContainer: {
    padding: 24,
    alignItems: "center",
  },
  noPackagesText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  devMockButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    alignItems: "center",
  },
  devMockButtonText: {
    color: COLORS.primaryLight,
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
    borderRadius: 16,
    overflow: 'hidden',
  },
  primaryButtonGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
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
    color: COLORS.textSecondary,
  },
  legalText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 16,
  },
  webDialogOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  webDialogBox: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 14,
    width: "85%",
    maxWidth: 400,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  webDialogTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "center",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 4,
  },
  webDialogBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    paddingHorizontal: 16,
    paddingBottom: 20,
    lineHeight: 18,
  },
  webDialogDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  webDialogButton: {
    paddingVertical: 14,
    alignItems: "center",
  },
  webDialogButtonText: {
    fontSize: 17,
  },
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
  },
  orb1: {
    width: 220,
    height: 220,
    top: -60,
    right: -60,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
  },
  orb2: {
    width: 160,
    height: 160,
    bottom: 100,
    left: -50,
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
  },
  orb3: {
    width: 110,
    height: 110,
    top: SCREEN_HEIGHT * 0.3,
    right: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  subscribedCloseButton: {
    position: "absolute",
    top: 16,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  subscribedCloseText: {
    fontSize: 18,
    color: COLORS.primaryLight,
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
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    top: -20,
    left: -20,
  },
  celebrationIcon: {
    fontSize: 80,
  },
  proMemberBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
  },
  proMemberText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primaryLight,
    letterSpacing: 1.5,
  },
  subscribedTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: 8,
  },
  subscribedSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
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
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  checkMark: {
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  featureCheckText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: "500",
  },
  exploreButton: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
  },
  exploreButtonInner: {
    paddingVertical: 18,
    alignItems: "center",
    borderRadius: 16,
  },
  exploreButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
});
