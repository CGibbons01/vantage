import React, { useEffect, useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { BodyScrollView } from "@/components/BodyScrollView";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { COLORS, getScoreColor } from "@/constants/theme";
import { apiGet, getBearerToken, BACKEND_URL } from "@/utils/api";

interface Profile {
  cv_score?: number | null;
  industry_fit?: string | null;
  first_name?: string | null;
  name?: string | null;
}

interface CvScoreResult {
  score?: number;
  industry_fit?: string;
  [key: string]: any;
}

const QUICK_ACTIONS = [
  { label: "Search Jobs", icon: "briefcase-outline" as const, route: "/(tabs)/jobs" },
  { label: "AI CV Writer", icon: "pencil-outline" as const, route: "/(tabs)/cv-writer" },
  { label: "Cover Letter", icon: "mail-outline" as const, route: "/(tabs)/cover-letter" },
  { label: "Applications", icon: "list-outline" as const, route: "/(tabs)/applications" },
  { label: "View Profile", icon: "person-outline" as const, route: "/profile/edit" },
  { label: "Job Alerts", icon: "notifications-outline" as const, route: "/(tabs)/jobs" },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [cvScore, setCvScore] = useState<number | null>(null);
  const [industryFit, setIndustryFit] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const firstName = profile?.first_name
    || (user?.name ? user.name.split(" ")[0] : null)
    || (user?.email ? user.email.split("@")[0] : "there");

  const userInitial = firstName ? String(firstName).charAt(0).toUpperCase() : "?";

  const scoreToShow = cvScore ?? (profile?.cv_score != null ? Number(profile.cv_score) : null);
  const industryFitToShow = industryFit ?? profile?.industry_fit ?? null;
  const scoreColor = scoreToShow != null ? getScoreColor(scoreToShow) : COLORS.accent;

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
    console.log("[Dashboard] Upload CV button pressed");
    setUploadError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        console.log("[Dashboard] Document picker cancelled");
        return;
      }

      const file = result.assets[0];
      console.log("[Dashboard] PDF selected:", file.name, file.uri);

      setUploading(true);

      const token = await getBearerToken();
      const formData = new FormData();
      formData.append("cv", {
        uri: file.uri,
        name: file.name ?? "cv.pdf",
        type: "application/pdf",
      } as any);

      console.log("[Dashboard] POST /api/cv/score — uploading CV");
      const response = await fetch(`${BACKEND_URL}/api/cv/score`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        console.log("[Dashboard] CV upload failed:", response.status, text);
        throw new Error(`Upload failed (${response.status})`);
      }

      const data: CvScoreResult = await response.json();
      console.log("[Dashboard] CV score result:", data);

      const score = data.score != null ? Number(data.score) : null;
      setCvScore(score);
      setIndustryFit(data.industry_fit ?? null);
    } catch (err: any) {
      console.log("[Dashboard] CV upload error:", err?.message ?? err);
      setUploadError(err?.message ?? "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleReupload = () => {
    console.log("[Dashboard] Re-upload CV pressed");
    setCvScore(null);
    setIndustryFit(null);
    setProfile((prev) => prev ? { ...prev, cv_score: null } : null);
  };

  const handleQuickAction = (label: string, route: string) => {
    console.log("[Dashboard] Quick action pressed:", label, "→", route);
    router.push(route as any);
  };

  return (
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
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userInitial}</Text>
          </View>
        </View>
      </View>

      {/* CV Card */}
      {scoreToShow == null ? (
        <View style={styles.card}>
          <View style={styles.uploadIconCircle}>
            <Ionicons name="cloud-upload-outline" size={28} color={COLORS.accent} />
          </View>
          <Text style={styles.cardTitle}>Upload Your CV</Text>
          <Text style={styles.cardSubtitle}>
            Let our AI analyse your CV, score it, and match you with the best opportunities.
          </Text>
          <TouchableOpacity
            style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
            onPress={handleUploadCV}
            disabled={uploading}
            activeOpacity={0.8}
          >
            {uploading ? (
              <ActivityIndicator color="#0F172A" size="small" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#0F172A" style={styles.uploadButtonIcon} />
                <Text style={styles.uploadButtonText}>Upload PDF</Text>
              </>
            )}
          </TouchableOpacity>
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
          <TouchableOpacity
            style={styles.reuploadButton}
            onPress={handleReupload}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-outline" size={16} color={COLORS.accent} style={styles.reuploadIcon} />
            <Text style={styles.reuploadText}>Re-upload CV</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.grid}>
        {QUICK_ACTIONS.map((action) => {
          const onPress = () => handleQuickAction(action.label, action.route);
          return (
            <TouchableOpacity
              key={action.label}
              style={styles.gridItem}
              onPress={onPress}
              activeOpacity={0.75}
            >
              <Ionicons name={action.icon} size={26} color={COLORS.accent} />
              <Text style={styles.gridLabel}>{action.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </BodyScrollView>
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
    paddingBottom: 32,
  },
  // Header
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
    letterSpacing: 0.2,
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
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  // Card
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  // Upload card
  uploadIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(245, 158, 11, 0.18)",
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 32,
    minWidth: 160,
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
    color: "#0F172A",
  },
  uploadError: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.error,
    textAlign: "center",
  },
  // Score card
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
    borderColor: COLORS.accent,
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
    color: COLORS.accent,
  },
  // Quick Actions
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  gridItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: "31.5%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  gridLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "center",
  },
});
