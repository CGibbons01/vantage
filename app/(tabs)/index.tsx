import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Upload,
  FileText,
  Briefcase,
  List,
  User,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Bell,
  PenLine,
  Mail,
  Star,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedGet, getBearerToken, BACKEND_URL } from '@/utils/api';
import { COLORS, getScoreColor } from '@/constants/theme';
import { AnimatedPressable } from '@/components/AnimatedPressable';

const USER_CV_KEY = 'user_cv_text';

interface IndustryFit {
  industry: string;
  score: number;
  reasoning: string;
}

interface Profile {
  id: string;
  headline?: string;
  summary?: string;
  location?: string;
  skills?: string[];
  experience?: { title: string; company: string; start_date?: string; end_date?: string; description?: string }[];
  education?: { degree: string; institution: string; year?: string }[];
  cv_score?: number;
  industry_fit?: IndustryFit;
  cv_filename?: string;
  updated_at?: string;
}

interface UploadResult {
  cv_score?: number;
  score?: number;
  cv_text?: string;
  text?: string;
  extracted_text?: string;
  feedback?: string;
  suggestions?: string[];
}

function CircularScore({ score, size = 100 }: { score: number; size?: number }) {
  const color = getScoreColor(score);
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 6,
          borderColor: COLORS.border,
          justifyContent: 'center',
          alignItems: 'center',
          position: 'absolute',
        }}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 6,
          borderColor: color,
          borderTopColor: 'transparent',
          borderRightColor: score > 25 ? color : 'transparent',
          borderBottomColor: score > 50 ? color : 'transparent',
          borderLeftColor: score > 75 ? color : 'transparent',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'absolute',
          transform: [{ rotate: '-90deg' }],
        }}
      />
      <Text style={{ fontSize: 22, fontWeight: '800', color }}>{score}</Text>
      <Text style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 1 }}>/ 100</Text>
    </View>
  );
}

function ScoreRevealBanner({ score, feedback }: { score: number; feedback?: string }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const color = getScoreColor(score);
  const label = score <= 40 ? 'Needs Work' : score <= 70 ? 'Good' : 'Excellent';
  const desc = score <= 40
    ? 'Your CV needs significant improvements to stand out.'
    : score <= 70
    ? 'Your CV is solid. A few tweaks could make it great.'
    : 'Your CV is highly competitive. Keep it updated!';

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 8,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <Animated.View
      style={[
        styles.scoreRevealCard,
        { borderColor: color, opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
      ]}
    >
      <View style={styles.scoreRevealHeader}>
        <View style={[styles.scoreRevealBadge, { backgroundColor: color + '22' }]}>
          <Star size={14} color={color} />
          <Text style={[styles.scoreRevealBadgeText, { color }]}>CV Analysed</Text>
        </View>
        <CheckCircle size={18} color={COLORS.success} />
      </View>
      <View style={styles.scoreRevealBody}>
        <CircularScore score={score} size={96} />
        <View style={styles.scoreRevealInfo}>
          <Text style={[styles.scoreRevealLabel, { color }]}>{label}</Text>
          <Text style={styles.scoreRevealDesc}>{feedback || desc}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [freshScore, setFreshScore] = useState<UploadResult | null>(null);
  const [error, setError] = useState('');

  const fetchProfile = useCallback(async () => {
    console.log('[Dashboard] Fetching profile');
    try {
      const data = await authenticatedGet<Profile>('/api/profile');
      setProfile(data);
      setError('');
    } catch (e: any) {
      console.error('[Dashboard] Profile fetch error:', e);
      if (e?.message?.includes('404') || e?.message?.includes('not found')) {
        setProfile(null);
      } else {
        setError('Failed to load profile.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProfile();
  }, [fetchProfile]);

  const handleUploadCV = async () => {
    console.log('[Dashboard] Upload CV button pressed');
    let pickerResult: DocumentPicker.DocumentPickerResult | null = null;
    try {
      pickerResult = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
    } catch (e: any) {
      const msg = e?.message || JSON.stringify(e) || 'Unknown picker error';
      console.error('[Dashboard] Document picker error:', msg);
      Alert.alert('Upload Failed', `Could not open file picker: ${msg}`);
      return;
    }

    if (pickerResult.canceled) {
      console.log('[Dashboard] CV upload cancelled by user');
      return;
    }

    const asset = pickerResult.assets[0];
    if (!asset) {
      Alert.alert('Upload Failed', 'No file was selected.');
      return;
    }

    console.log('[Dashboard] CV selected:', asset.name, 'uri:', asset.uri, 'size:', asset.size, 'mimeType:', asset.mimeType);

    setUploading(true);
    setUploadSuccess(false);
    setFreshScore(null);

    try {
      const token = await getBearerToken();
      if (!token) {
        throw new Error('You are not signed in. Please sign in and try again.');
      }

      const formData = new FormData();

      // On web, fetch the file as a Blob and append it properly.
      // On native, use the { uri, name, type } object pattern.
      if (typeof document !== 'undefined') {
        console.log('[Dashboard] Web environment: fetching file as Blob');
        const blobResponse = await fetch(asset.uri);
        if (!blobResponse.ok) {
          throw new Error(`Could not read selected file (${blobResponse.status})`);
        }
        const blob = await blobResponse.blob();
        const fileName = asset.name || 'cv.pdf';
        formData.append('cv', blob, fileName);
        console.log('[Dashboard] Appended Blob to FormData, size:', blob.size);
      } else {
        // Native environment (iOS / Android)
        formData.append('cv', {
          uri: asset.uri,
          name: asset.name || 'cv.pdf',
          type: asset.mimeType || 'application/pdf',
        } as any);
        console.log('[Dashboard] Appended native file object to FormData');
      }

      console.log('[Dashboard] POSTing CV to /api/cv/score');
      const response = await fetch(`${BACKEND_URL}/api/cv/score`, {
        method: 'POST',
        headers: {
          // Do NOT set Content-Type — let fetch set multipart/form-data with boundary automatically
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      console.log('[Dashboard] Upload response status:', response.status);

      if (!response.ok) {
        const text = await response.text();
        console.error('[Dashboard] Upload failed response body:', text);
        throw new Error(`Server error ${response.status}: ${text.slice(0, 200)}`);
      }

      const data: UploadResult = await response.json();
      const resolvedScore = data?.cv_score ?? data?.score ?? null;
      console.log('[Dashboard] CV upload successful, score:', resolvedScore, 'full response:', JSON.stringify(data));

      setUploadSuccess(true);
      if (resolvedScore != null) {
        setFreshScore({ ...data, cv_score: resolvedScore });
      }

      // Save CV text to AsyncStorage for AI job matching
      const cvText = data?.cv_text || data?.text || data?.extracted_text || '';
      if (cvText) {
        await AsyncStorage.setItem(USER_CV_KEY, cvText);
        console.log('[Dashboard] Saved CV text to AsyncStorage for job matching, length:', cvText.length);
      } else {
        console.log('[Dashboard] No CV text in response to save');
      }

      // Refresh profile in background to update cv_filename and persistent score
      await fetchProfile();
    } catch (e: any) {
      const msg = e?.message || (typeof e === 'string' ? e : JSON.stringify(e)) || 'Unknown error';
      console.error('[Dashboard] CV upload error:', msg, e);
      Alert.alert('Upload Failed', msg);
    } finally {
      setUploading(false);
    }
  };

  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const topSkills = profile?.skills?.slice(0, 5) ?? [];

  // Use freshScore for immediate display; fall back to profile score
  const displayScore = freshScore?.cv_score ?? profile?.cv_score ?? null;
  const scoreColor = displayScore != null ? getScoreColor(displayScore) : COLORS.accent;
  const scoreLabel = displayScore != null
    ? displayScore <= 40 ? 'Needs Work' : displayScore <= 70 ? 'Good' : 'Excellent'
    : '';
  const scoreDesc = displayScore != null
    ? displayScore <= 40
      ? 'Your CV needs significant improvements to stand out.'
      : displayScore <= 70
      ? 'Your CV is solid. A few tweaks could make it great.'
      : 'Your CV is highly competitive. Keep it updated!'
    : '';

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 120 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.accent}
          colors={[COLORS.accent]}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Good day, {firstName}</Text>
          <Text style={styles.headerTitle}>Vantage AI</Text>
        </View>
        <View style={styles.headerRight}>
          <AnimatedPressable
            style={styles.bellBtn}
            onPress={() => {
              console.log('[Dashboard] Navigate to notifications');
              router.push('/notifications' as any);
            }}
            accessibilityLabel="Job alerts"
          >
            <Bell size={20} color={COLORS.textSecondary} />
          </AnimatedPressable>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <AlertCircle size={16} color={COLORS.error} />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}

      {/* CV Upload Card */}
      {!profile?.cv_filename ? (
        <View style={styles.uploadCard}>
          <View style={styles.uploadIconCircle}>
            <Upload size={28} color={COLORS.accent} />
          </View>
          <Text style={styles.uploadTitle}>Upload Your CV</Text>
          <Text style={styles.uploadSubtitle}>
            Let our AI analyse your CV, score it, and match you with the best opportunities.
          </Text>
          <AnimatedPressable
            style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
            onPress={handleUploadCV}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <ActivityIndicator color="#000" size="small" />
                <Text style={styles.uploadBtnText}>Analysing CV…</Text>
              </>
            ) : (
              <>
                <Upload size={18} color="#000" />
                <Text style={styles.uploadBtnText}>Upload PDF</Text>
              </>
            )}
          </AnimatedPressable>
          {uploadSuccess && !freshScore && (
            <View style={styles.successRow}>
              <CheckCircle size={16} color={COLORS.success} />
              <Text style={styles.successText}>CV uploaded successfully!</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.cvFileCard}>
          <FileText size={20} color={COLORS.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cvFileName} numberOfLines={1}>{profile.cv_filename}</Text>
            <Text style={styles.cvFileLabel}>CV on file</Text>
          </View>
          <AnimatedPressable
            style={styles.reuploadBtn}
            onPress={handleUploadCV}
            disabled={uploading}
          >
            {uploading
              ? <ActivityIndicator color={COLORS.accent} size="small" />
              : <Text style={styles.reuploadText}>Re-upload</Text>
            }
          </AnimatedPressable>
        </View>
      )}

      {/* Immediate Score Reveal after upload */}
      {freshScore?.cv_score != null && (
        <ScoreRevealBanner
          score={freshScore.cv_score}
          feedback={freshScore.feedback}
        />
      )}

      {/* CV Score Card (from profile — shown when no fresh score or after refresh) */}
      {displayScore != null && !freshScore && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>CV Score</Text>
          <View style={styles.scoreRow}>
            <CircularScore score={displayScore} size={100} />
            <View style={styles.scoreInfo}>
              <Text style={[styles.scoreLabel, { color: scoreColor }]}>{scoreLabel}</Text>
              <Text style={styles.scoreDesc}>{scoreDesc}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Industry Fit Card */}
      {profile?.industry_fit && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Industry Fit</Text>
          <View style={styles.industryRow}>
            <TrendingUp size={18} color={COLORS.accent} />
            <Text style={styles.industryName}>{profile.industry_fit.industry}</Text>
            <Text style={[styles.industryScore, { color: getScoreColor(profile.industry_fit.score) }]}>
              {profile.industry_fit.score}%
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${profile.industry_fit.score}%` as any,
                  backgroundColor: getScoreColor(profile.industry_fit.score),
                },
              ]}
            />
          </View>
          {profile.industry_fit.reasoning ? (
            <Text style={styles.industryReasoning} numberOfLines={3}>
              {profile.industry_fit.reasoning}
            </Text>
          ) : null}
        </View>
      )}

      {/* Skills */}
      {topSkills.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top Skills</Text>
          <View style={styles.skillsRow}>
            {topSkills.map((skill, i) => (
              <View key={i} style={styles.skillChip}>
                <Text style={styles.skillChipText}>{skill}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActions}>
        <AnimatedPressable
          style={styles.quickActionBtn}
          onPress={() => { console.log('[Dashboard] Navigate to Jobs'); router.push('/(tabs)/jobs'); }}
        >
          <Briefcase size={22} color={COLORS.accent} />
          <Text style={styles.quickActionText}>Search Jobs</Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={styles.quickActionBtn}
          onPress={() => { console.log('[Dashboard] Navigate to CV Writer'); router.push('/(tabs)/cv-writer'); }}
        >
          <PenLine size={22} color={COLORS.accent} />
          <Text style={styles.quickActionText}>AI CV Writer</Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={styles.quickActionBtn}
          onPress={() => { console.log('[Dashboard] Navigate to Cover Letter'); router.push('/(tabs)/cover-letter'); }}
        >
          <Mail size={22} color={COLORS.accent} />
          <Text style={styles.quickActionText}>Cover Letter</Text>
        </AnimatedPressable>
      </View>

      <View style={[styles.quickActions, { marginTop: 10 }]}>
        <AnimatedPressable
          style={styles.quickActionBtn}
          onPress={() => { console.log('[Dashboard] Navigate to Applications'); router.push('/(tabs)/applications'); }}
        >
          <List size={22} color={COLORS.accent} />
          <Text style={styles.quickActionText}>Applications</Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={styles.quickActionBtn}
          onPress={() => { console.log('[Dashboard] Navigate to Profile'); router.push('/(tabs)/profile'); }}
        >
          <User size={22} color={COLORS.accent} />
          <Text style={styles.quickActionText}>View Profile</Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={styles.quickActionBtn}
          onPress={() => { console.log('[Dashboard] Navigate to Notifications'); router.push('/notifications' as any); }}
        >
          <Bell size={22} color={COLORS.accent} />
          <Text style={styles.quickActionText}>Job Alerts</Text>
        </AnimatedPressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 20 },
  centered: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  greeting: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 2 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accentMuted,
    borderWidth: 2,
    borderColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: COLORS.accent },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.errorMuted,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  errorBannerText: { color: COLORS.error, fontSize: 13, flex: 1 },
  uploadCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
  },
  uploadIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  uploadSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    minWidth: 160,
    justifyContent: 'center',
  },
  uploadBtnDisabled: { opacity: 0.7 },
  uploadBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  successText: { fontSize: 13, color: COLORS.success, fontWeight: '500' },
  cvFileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cvFileName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  cvFileLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  reuploadBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  reuploadText: { fontSize: 12, fontWeight: '600', color: COLORS.accent },
  // Score reveal banner (animated, shown immediately after upload)
  scoreRevealCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  },
  scoreRevealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  scoreRevealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  scoreRevealBadgeText: { fontSize: 12, fontWeight: '700' },
  scoreRevealBody: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  scoreRevealInfo: { flex: 1 },
  scoreRevealLabel: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  scoreRevealDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  // Persistent score card
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 14 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  scoreInfo: { flex: 1 },
  scoreLabel: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  scoreDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  industryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  industryName: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.text },
  industryScore: { fontSize: 16, fontWeight: '700' },
  progressBarBg: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: { height: '100%', borderRadius: 4 },
  industryReasoning: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillChip: {
    backgroundColor: COLORS.accentDim,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.accentMuted,
  },
  skillChipText: { fontSize: 13, fontWeight: '500', color: COLORS.accent },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    marginTop: 4,
  },
  quickActions: { flexDirection: 'row', gap: 10 },
  quickActionBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickActionText: { fontSize: 12, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
});
