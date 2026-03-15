import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
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

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
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
    console.log('[Dashboard] Opening document picker for CV upload');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        console.log('[Dashboard] CV upload cancelled');
        return;
      }

      const file = result.assets[0];
      console.log('[Dashboard] CV selected:', file.name, 'size:', file.size);

      setUploading(true);
      setUploadSuccess(false);

      const token = await getBearerToken();
      const formData = new FormData();
      formData.append('cv', {
        uri: file.uri,
        name: file.name,
        type: 'application/pdf',
      } as any);

      console.log('[Dashboard] Uploading CV to /api/profile/upload-cv');
      const response = await fetch(`${BACKEND_URL}/api/profile/upload-cv`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          // Do NOT set Content-Type here — fetch must set it automatically
          // with the multipart boundary when using FormData
        },
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${text}`);
      }

      const data = await response.json();
      console.log('[Dashboard] CV upload successful, score:', data?.cv_score);
      setUploadSuccess(true);

      // Save CV text to AsyncStorage for AI job matching
      if (data?.cv_text) {
        await AsyncStorage.setItem(USER_CV_KEY, data.cv_text);
        console.log('[Dashboard] Saved CV text to AsyncStorage for job matching');
      }

      await fetchProfile();
    } catch (e: any) {
      console.error('[Dashboard] CV upload error:', e);
      Alert.alert('Upload Failed', e?.message || 'Could not upload your CV. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const topSkills = profile?.skills?.slice(0, 5) ?? [];
  const scoreColor = profile?.cv_score != null ? getScoreColor(profile.cv_score) : COLORS.accent;
  const scoreLabel = profile?.cv_score != null
    ? profile.cv_score <= 40 ? 'Needs Work' : profile.cv_score <= 70 ? 'Good' : 'Excellent'
    : '';
  const scoreDesc = profile?.cv_score != null
    ? profile.cv_score <= 40
      ? 'Your CV needs significant improvements to stand out.'
      : profile.cv_score <= 70
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
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <>
                <Upload size={18} color="#000" />
                <Text style={styles.uploadBtnText}>Upload PDF</Text>
              </>
            )}
          </AnimatedPressable>
          {uploadSuccess && (
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

      {/* CV Score Card */}
      {profile?.cv_score != null && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>CV Score</Text>
          <View style={styles.scoreRow}>
            <CircularScore score={profile.cv_score} size={100} />
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
  },
  uploadBtnDisabled: { opacity: 0.6 },
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
