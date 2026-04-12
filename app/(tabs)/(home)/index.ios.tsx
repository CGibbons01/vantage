import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  Platform,
  Dimensions,
  Animated,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BodyScrollView } from "@/components/BodyScrollView";
import { NotificationBell } from "@/components/NotificationBell";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useAuth } from "@/contexts/AuthContext";
import { COLORS, getScoreColor } from "@/constants/theme";
import { apiGet, authenticatedPost } from "@/utils/api";

const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_PADDING = 16;
const GRID_GAP = 10;
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * 2) / 3);

interface SectionScore {
  name: string;
  score: number;
}

interface Profile {
  cv_score?: number | null;
  industry_fit?: string | null;
  first_name?: string | null;
  name?: string | null;
  section_scores?: SectionScore[] | null;
  strengths?: string[] | null;
  improvements?: string[] | null;
  analysis?: {
    strengths?: string[];
    improvements?: string[];
    section_scores?: SectionScore[];
  } | null;
}

const QUICK_ACTIONS = [
  { label: "Search Jobs", icon: "briefcase-outline" as const, route: "/(tabs)/jobs", gradient: ['#7C3AED', '#4F46E5'] as const },
  { label: "AI CV Writer", icon: "pencil-outline" as const, route: "/(tabs)/cv-writer", gradient: ['#4F46E5', '#3B82F6'] as const },
  { label: "Cover Letter", icon: "mail-outline" as const, route: "/(tabs)/cover-letter", gradient: ['#3B82F6', '#06B6D4'] as const },
  { label: "Applications", icon: "list-outline" as const, route: "/(tabs)/applications", gradient: ['#EC4899', '#7C3AED'] as const },
  { label: "View Profile", icon: "person-outline" as const, route: "/profile/edit", gradient: ['#7C3AED', '#EC4899'] as const },
  { label: "Job Alerts", icon: "notifications-outline" as const, route: "/(tabs)/notifications", gradient: ['#F59E0B', '#EC4899'] as const },
];

function getChipColor(score: number): string {
  if (score >= 75) return COLORS.scoreGreen;
  if (score >= 50) return COLORS.scoreAmber;
  return COLORS.scoreRed;
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
  const [cvScore, setCvScore] = useState<number | null>(null);
  const [industryFit, setIndustryFit] = useState<string | null>(null);
  const [industryScores, setIndustryScores] = useState<{ industry: string; score: number }[] | null>(null);
  const [improvementTips, setImprovementTips] = useState<string[] | null>(null);
  const [uploadStrengths, setUploadStrengths] = useState<string[] | null>(null);
  const [uploadImprovements, setUploadImprovements] = useState<string[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const firstName = profile?.first_name
    || (user?.name ? user.name.split(" ")[0] : null)
    || (user?.email ? user.email.split("@")[0] : "there");

  const userInitial = firstName ? String(firstName).charAt(0).toUpperCase() : "?";

  const scoreToShow = cvScore ?? (profile?.cv_score != null ? Number(profile.cv_score) : null);
  const industryFitToShow = industryFit ?? profile?.industry_fit ?? null;
  const scoreColor = scoreToShow != null ? getScoreColor(scoreToShow) : COLORS.primaryLight;

  const strengths: string[] | null =
    uploadStrengths ?? profile?.strengths ?? profile?.analysis?.strengths ?? null;

  const tipsToShow: string[] | null =
    improvementTips ?? uploadImprovements ?? profile?.improvements ?? profile?.analysis?.improvements ?? null;

  const hasInsights = scoreToShow != null;

  const fetchProfile = useCallback(async () => {
    console.log("[Dashboard] Fetching profile");
    try {
      const data = await apiGet<Profile>("/api/profile");
      console.log("[Dashboard] Profile fetched:", data);
      setProfile(data);
    } catch (err) {
      console.log("[Dashboard] Profile fetch failed (showing upload card as default):", err);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleUploadCV = async () => {
    console.log('[Dashboard] Upload CV button pressed');
    setUploadError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        console.log('[Dashboard] Document picker cancelled');
        return;
      }

      const file = result.assets[0];
      const fileName = file.name ?? 'cv.pdf';
      const lower = fileName.toLowerCase();
      const mimeType = lower.endsWith('.docx')
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : lower.endsWith('.doc')
        ? 'application/msword'
        : 'application/pdf';

      console.log('[Dashboard] CV file selected:', fileName, 'mime:', mimeType);
      setUploading(true);

      let base64: string;
      if (Platform.OS === 'web') {
        console.log('[Dashboard] Web platform — reading file via FileReader');
        const blob = await fetch(file.uri).then((r) => r.blob());
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const raw = dataUrl.split(',')[1] ?? '';
            resolve(raw);
          };
          reader.onerror = () => reject(new Error('FileReader failed'));
          reader.readAsDataURL(blob);
        });
      } else {
        const FileSystem = await import('expo-file-system/legacy');
        base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      }
      console.log('[Dashboard] File read as base64, length:', base64.length);

      console.log('[Dashboard] POST /api/cv/score — sending base64 JSON to backend');
      const data = await authenticatedPost('/api/cv/score', {
        file_base64: base64,
        file_name: fileName,
        mime_type: mimeType,
      });
      console.log('[Dashboard] CV score result:', data);

      setCvScore(data.overall_score ?? data.score ?? null);
      setIndustryFit(data.industry_fit ?? null);
      setIndustryScores(data.industry_scores ?? null);
      setImprovementTips(data.improvement_tips ?? null);
      setUploadStrengths(data.strengths ?? null);
      setUploadImprovements(data.improvements ?? null);
    } catch (err: any) {
      console.log('[Dashboard] CV upload error:', err?.message ?? err);
      setUploadError(err?.message ?? 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleReupload = () => {
    console.log("[Dashboard] Re-upload CV pressed");
    setCvScore(null);
    setIndustryFit(null);
    setIndustryScores(null);
    setImprovementTips(null);
    setUploadStrengths(null);
    setUploadImprovements(null);
    setProfile((prev) => prev ? { ...prev, cv_score: null } : null);
  };

  const handleQuickAction = (label: string, route: string) => {
    console.log("[Dashboard] Quick action pressed:", label, "→", route);
    router.push(route as any);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <BodyScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>
              {"Good day, "}
              {firstName}
            </Text>
            <Text style={styles.appTitle}>Vantage AI</Text>
          </View>
          <View style={styles.headerRight}>
            <NotificationBell />
            <LinearGradient
              colors={['#7C3AED', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{userInitial}</Text>
            </LinearGradient>
          </View>
        </View>

        {/* CV Card */}
        {scoreToShow == null ? (
          <View style={styles.card}>
            <LinearGradient
              colors={['rgba(124, 58, 237, 0.15)', 'rgba(236, 72, 153, 0.08)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.uploadIconCircle}
            >
              <Ionicons name="cloud-upload-outline" size={28} color={COLORS.primaryLight} />
            </LinearGradient>
            <Text style={styles.cardTitle}>Upload Your CV</Text>
            <Text style={styles.cardSubtitle}>
              Let our AI analyse your CV, score it, and match you with the best opportunities.
            </Text>
            <AnimatedPressable
              style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
              onPress={handleUploadCV}
              disabled={uploading}
            >
              <LinearGradient
                colors={['#7C3AED', '#4F46E5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.uploadButtonGradient}
              >
                {uploading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" style={styles.uploadButtonIcon} />
                    <Text style={styles.uploadButtonText}>Upload CV (PDF or Word)</Text>
                  </>
                )}
              </LinearGradient>
            </AnimatedPressable>
            {uploadError != null && (
              <Text style={styles.uploadError}>{uploadError}</Text>
            )}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.scoreLabel}>CV Score</Text>
            <Text style={[styles.scoreValue, { color: scoreColor }]}>{scoreToShow}</Text>
            {industryFitToShow != null && (
              <Text style={styles.industryFit}>{industryFitToShow}</Text>
            )}
            <AnimatedPressable
              style={styles.reuploadButton}
              onPress={handleReupload}
            >
              <Ionicons name="refresh-outline" size={16} color={COLORS.primaryLight} style={styles.reuploadIcon} />
              <Text style={styles.reuploadText}>Re-upload CV</Text>
            </AnimatedPressable>
          </View>
        )}

        {/* Industry Fit Bars */}
        {hasInsights && industryScores != null && industryScores.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Industry Fit</Text>
            <View style={styles.industryCard}>
              {industryScores.map((item) => {
                const barColor = getChipColor(item.score);
                const barWidth = `${item.score}%` as any;
                return (
                  <View key={item.industry} style={styles.industryRow}>
                    <Text style={styles.industryName}>{item.industry}</Text>
                    <View style={styles.barBackground}>
                      <View style={[styles.barFill, { width: barWidth, backgroundColor: barColor }]} />
                    </View>
                    <Text style={[styles.industryScore, { color: barColor }]}>{item.score}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Strengths & Improvement Tips */}
        {hasInsights && (
          <View style={styles.insightsRow}>
            <View style={[styles.insightCard, styles.strengthsCard]}>
              <View style={styles.insightHeader}>
                <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.scoreGreen} />
                <Text style={[styles.insightTitle, { color: COLORS.scoreGreen }]}>Strengths</Text>
              </View>
              {strengths != null && strengths.length > 0 ? (
                strengths.slice(0, 3).map((item, i) => (
                  <View key={`strength-${i}`} style={styles.bulletRow}>
                    <Text style={[styles.bullet, { color: COLORS.scoreGreen }]}>{"\u2022"}</Text>
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.insightPlaceholder}>Upload your CV to see personalized insights</Text>
              )}
            </View>

            <View style={[styles.insightCard, styles.improvementsCard]}>
              <View style={styles.insightHeader}>
                <Ionicons name="bulb-outline" size={18} color={COLORS.scoreAmber} />
                <Text style={[styles.insightTitle, { color: COLORS.scoreAmber }]}>Improvement Tips</Text>
              </View>
              {tipsToShow != null && tipsToShow.length > 0 ? (
                tipsToShow.slice(0, 4).map((item, i) => (
                  <View key={`tip-${i}`} style={styles.bulletRow}>
                    <Text style={[styles.bullet, { color: COLORS.scoreAmber }]}>{"\u2022"}</Text>
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.insightPlaceholder}>Upload your CV to see personalized insights</Text>
              )}
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.grid}>
          {QUICK_ACTIONS.map((action, index) => {
            const onPress = () => handleQuickAction(action.label, action.route);
            return (
              <AnimatedCard key={action.label} index={index}>
                <AnimatedPressable
                  style={styles.gridItem}
                  onPress={onPress}
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
            );
          })}
        </View>
      </BodyScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  card: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  uploadIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 8,
    textAlign: "center",
  },
  cardSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  uploadButton: {
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 200,
  },
  uploadButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 28,
    justifyContent: "center",
  },
  uploadButtonDisabled: {
    opacity: 0.7,
  },
  uploadButtonIcon: {
    marginRight: 8,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  uploadError: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.error,
    textAlign: "center",
  },
  scoreLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  scoreValue: {
    fontSize: 64,
    fontWeight: "800",
    marginBottom: 8,
    lineHeight: 72,
  },
  industryFit: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 20,
  },
  reuploadButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  reuploadIcon: {
    marginRight: 6,
  },
  reuploadText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primaryLight,
  },
  industryCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  industryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  industryName: {
    width: 110,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },
  barBackground: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.surfaceElevated,
    marginHorizontal: 10,
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  industryScore: {
    width: 28,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
  insightsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  insightCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  strengthsCard: {
    borderColor: "rgba(16, 185, 129, 0.25)",
    backgroundColor: "rgba(16, 185, 129, 0.07)",
  },
  improvementsCard: {
    borderColor: "rgba(245, 158, 11, 0.25)",
    backgroundColor: "rgba(245, 158, 11, 0.07)",
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 6,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 18,
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  insightPlaceholder: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
    justifyContent: "flex-start",
  },
  gridItem: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 6,
  },
  gridIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "center",
    lineHeight: 14,
  },
});
