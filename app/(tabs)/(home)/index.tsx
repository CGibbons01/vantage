import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  Animated,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BodyScrollView } from "@/components/BodyScrollView";
import { NotificationBell } from "@/components/NotificationBell";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useAuth } from "@/contexts/AuthContext";
import { COLORS } from "@/constants/theme";
import { apiGet } from "@/utils/api";

const USER_CV_KEY = "user_cv_text";

const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_PADDING = 16;
const GRID_GAP = 10;
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * 2) / 3);

interface Profile {
  first_name?: string | null;
  name?: string | null;
}

interface CVInsights {
  headline: string;
  skills: string[];
  summary: string;
}

const QUICK_ACTIONS = [
  { label: "Search Jobs", icon: "briefcase-outline" as const, route: "/(tabs)/jobs", gradient: ["#7C3AED", "#4F46E5"] as const },
  { label: "AI CV Writer", icon: "pencil-outline" as const, route: "/(tabs)/cv-writer", gradient: ["#4F46E5", "#3B82F6"] as const },
  { label: "Cover Letter", icon: "mail-outline" as const, route: "/(tabs)/cover-letter", gradient: ["#3B82F6", "#06B6D4"] as const },
  { label: "Applications", icon: "list-outline" as const, route: "/(tabs)/applications", gradient: ["#EC4899", "#7C3AED"] as const },
  { label: "View Profile", icon: "person-outline" as const, route: "/profile/edit", gradient: ["#7C3AED", "#EC4899"] as const },
  { label: "Job Alerts", icon: "notifications-outline" as const, route: "/(tabs)/notifications", gradient: ["#F59E0B", "#EC4899"] as const },
];

// Parse CV text locally — no backend, no file system
function parseCVInsights(text: string): CVInsights {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Extract headline — first line matching a job title pattern within first 8 lines
  let headline = "";
  const titlePattern = /\b(engineer|developer|manager|analyst|designer|consultant|director|lead|architect|specialist|coordinator|executive|officer|recruiter|advisor|strategist)\b/i;
  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    if (titlePattern.test(lines[i]) && lines[i].length < 80) {
      headline = lines[i];
      break;
    }
  }

  // Extract summary
  let summary = "";
  const summaryIdx = lines.findIndex((l) =>
    /^(professional\s+)?summary|profile|about\s*me?$/i.test(l)
  );
  if (summaryIdx !== -1) {
    const summaryLines: string[] = [];
    for (let i = summaryIdx + 1; i < lines.length && i < summaryIdx + 6; i++) {
      if (/^(experience|education|skills|achievements|employment|work)/i.test(lines[i])) break;
      summaryLines.push(lines[i]);
    }
    summary = summaryLines.join(" ").trim();
  }

  // Extract skills
  let skills: string[] = [];
  const skillsIdx = lines.findIndex((l) => /^(key\s+)?skills(\s+&\s+\w+)?$/i.test(l));
  if (skillsIdx !== -1) {
    const skillLines: string[] = [];
    for (let i = skillsIdx + 1; i < lines.length && i < skillsIdx + 8; i++) {
      if (/^(experience|education|summary|achievements|employment|work)/i.test(lines[i])) break;
      skillLines.push(lines[i]);
    }
    skills = skillLines
      .join(", ")
      .split(/[,•|·\n]/)
      .map((s) => s.replace(/^[-–—*]\s*/, "").trim())
      .filter((s) => s.length > 1 && s.length < 50);
  }

  return { headline, skills, summary };
}

// Generate smart tips based on what's missing or weak in the CV
function generateTips(insights: CVInsights): string[] {
  const tips: string[] = [];
  if (!insights.headline) tips.push("Add a clear job title at the top of your CV so recruiters know your role at a glance.");
  if (!insights.summary) tips.push("Include a Professional Summary section — a 2–3 sentence overview significantly improves ATS ranking.");
  if (insights.skills.length < 5) tips.push("Expand your Skills section. Aim for 8–12 relevant skills to improve job match rates.");
  if (insights.skills.length >= 5 && insights.skills.length < 10) tips.push("Consider adding more technical or soft skills to strengthen your profile.");
  if (tips.length === 0) tips.push("Your CV structure looks strong. Keep it updated with your latest experience and achievements.");
  return tips.slice(0, 3);
}

function AnimatedCard({ index, children }: { index: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [cvInsights, setCvInsights] = useState<CVInsights | null>(null);
  const [cvLoaded, setCvLoaded] = useState(false);

  const rawFirstName =
    profile?.first_name ||
    (user?.name ? user.name.split(" ")[0] : null) ||
    (user?.email ? user.email.split("@")[0] : "there");

  const firstName = rawFirstName ?? "there";
  const userInitial = String(firstName).charAt(0).toUpperCase();

  const fetchProfile = useCallback(async () => {
    try {
      const data = await apiGet<Profile>("/api/profile");
      setProfile(data);
    } catch {
      // Silent — greeting falls back to auth user name
    }
  }, []);

  const loadCVInsights = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(USER_CV_KEY);
      if (saved && saved.trim().length > 0) {
        const insights = parseCVInsights(saved);
        setCvInsights(insights);
      }
    } catch {
      // Silent — shows Get Started card instead
    } finally {
      setCvLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    loadCVInsights();
  }, [fetchProfile, loadCVInsights]);

  const handleQuickAction = (label: string, route: string) => {
    console.log("[Dashboard] Quick action pressed:", label, "→", route);
    router.push(route as any);
  };

  const tips = cvInsights ? generateTips(cvInsights) : [];
  const hasCv = cvLoaded && cvInsights !== null;

  const cvHeadline = cvInsights?.headline ?? "";
  const cvSkills = cvInsights?.skills ?? [];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <BodyScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{"Good day, "}{firstName}</Text>
            <Text style={styles.appTitle}>Vantage AI</Text>
          </View>
          <View style={styles.headerRight}>
            <NotificationBell />
            <LinearGradient
              colors={["#7C3AED", "#EC4899"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{userInitial}</Text>
            </LinearGradient>
          </View>
        </View>

        {/* CV Card */}
        {!cvLoaded ? null : hasCv ? (
          // CV Insights card
          <View style={styles.card}>
            <View style={styles.insightsHeaderRow}>
              <LinearGradient
                colors={["rgba(124,58,237,0.15)", "rgba(236,72,153,0.08)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.insightsIconCircle}
              >
                <Ionicons name="document-text-outline" size={22} color={COLORS.primaryLight} />
              </LinearGradient>
              <View style={styles.insightsHeaderText}>
                <Text style={styles.cardTitle}>CV Insights</Text>
                {cvHeadline ? (
                  <Text style={styles.headlineText} numberOfLines={1}>{cvHeadline}</Text>
                ) : null}
              </View>
              <AnimatedPressable
                onPress={() => router.push("/(tabs)/cv-writer" as any)}
                style={styles.updateCvBtn}
              >
                <Ionicons name="pencil-outline" size={14} color={COLORS.primaryLight} />
                <Text style={styles.updateCvText}>Update</Text>
              </AnimatedPressable>
            </View>

            {/* Skills chips */}
            {cvSkills.length > 0 && (
              <View style={styles.skillsSection}>
                <Text style={styles.skillsLabel}>Top Skills</Text>
                <View style={styles.chipsRow}>
                  {cvSkills.slice(0, 5).map((skill, i) => (
                    <View key={`skill-${i}`} style={styles.chip}>
                      <Text style={styles.chipText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Tips */}
            <View style={styles.tipsSection}>
              <View style={styles.tipsHeader}>
                <Ionicons name="bulb-outline" size={15} color={COLORS.scoreAmber} />
                <Text style={styles.tipsLabel}>Suggestions</Text>
              </View>
              {tips.map((tip, i) => (
                <View key={`tip-${i}`} style={styles.tipRow}>
                  <Text style={[styles.tipBullet, { color: COLORS.scoreAmber }]}>{"•"}</Text>
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          // Get Started card
          <View style={styles.card}>
            <LinearGradient
              colors={["rgba(124,58,237,0.15)", "rgba(236,72,153,0.08)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.uploadIconCircle}
            >
              <Ionicons name="person-add-outline" size={28} color={COLORS.primaryLight} />
            </LinearGradient>
            <Text style={styles.cardTitle}>Create Your Profile</Text>
            <Text style={styles.cardSubtitle}>
              Build your CV in the AI CV Writer to unlock job matching, cover letters, and personalised suggestions.
            </Text>
            <AnimatedPressable
              style={styles.uploadButton}
              onPress={() => {
                console.log("[Dashboard] Get Started pressed → cv-writer");
                router.push("/(tabs)/cv-writer" as any);
              }}
            >
              <LinearGradient
                colors={["#7C3AED", "#4F46E5"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.uploadButtonGradient}
              >
                <Ionicons name="pencil-outline" size={18} color="#FFFFFF" style={styles.uploadButtonIcon} />
                <Text style={styles.uploadButtonText}>Get Started</Text>
              </LinearGradient>
            </AnimatedPressable>
          </View>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.grid}>
          {QUICK_ACTIONS.map((action, index) => (
            <AnimatedCard key={action.label} index={index}>
              <AnimatedPressable
                style={styles.gridItem}
                onPress={() => handleQuickAction(action.label, action.route)}
              >
                <LinearGradient
                  colors={action.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gridIconCircle}
                >
                  <Ionicons name={action.icon} size={20} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.gridLabel} numberOfLines={2}>{action.label}</Text>
              </AnimatedPressable>
            </AnimatedCard>
          ))}
        </View>
      </BodyScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  headerLeft: { flex: 1 },
  greeting: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 2 },
  appTitle: { fontSize: 26, fontWeight: "700", color: COLORS.text, letterSpacing: -0.3 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  card: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  // Insights card
  insightsHeaderRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  insightsIconCircle: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  insightsHeaderText: { flex: 1 },
  updateCvBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: COLORS.primary, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  updateCvText: { fontSize: 12, fontWeight: "600", color: COLORS.primaryLight },
  headlineText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  skillsSection: { marginBottom: 14 },
  skillsLabel: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    backgroundColor: COLORS.primaryMuted, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chipText: { fontSize: 12, fontWeight: "500", color: COLORS.primaryLight },
  tipsSection: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 14 },
  tipsHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  tipsLabel: { fontSize: 13, fontWeight: "700", color: COLORS.scoreAmber },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  tipBullet: { fontSize: 14, lineHeight: 18, flexShrink: 0 },
  tipText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  // Get Started card
  uploadIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: "center", justifyContent: "center", marginBottom: 16, alignSelf: "center",
  },
  cardTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text, marginBottom: 6 },
  cardSubtitle: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 20, textAlign: "center" },
  uploadButton: { borderRadius: 12, overflow: "hidden", minWidth: 200, alignSelf: "center" },
  uploadButtonGradient: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 14, paddingHorizontal: 28, justifyContent: "center",
  },
  uploadButtonIcon: { marginRight: 8 },
  uploadButtonText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  // Quick actions
  sectionTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP, justifyContent: "flex-start" },
  gridItem: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
    width: CARD_WIDTH, height: CARD_WIDTH,
    alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 6,
  },
  gridIconCircle: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  gridLabel: { fontSize: 11, fontWeight: "600", color: COLORS.text, textAlign: "center", lineHeight: 14 },
});
