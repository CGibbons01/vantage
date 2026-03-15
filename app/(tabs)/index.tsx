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
  Check,
  AlertTriangle,
  Lightbulb,
  ChevronRight,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedGet, getBearerToken, BACKEND_URL } from '@/utils/api';
import { COLORS, getScoreColor } from '@/constants/theme';
import { AnimatedPressable } from '@/components/AnimatedPressable';

const USER_CV_KEY = 'user_cv_text';

// Card background matching the navy/amber theme spec
const CARD_BG = '#1A3A6B';

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

type CVResult = {
  score: number;
  industry_fit: string;
  skills: string[];
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  improvements?: string[];
  section_scores?: {
    summary: number;
    experience: number;
    education: number;
    skills: number;
    formatting: number;
  };
};

// Legacy shape from upload response
interface UploadResult {
  cv_score?: number;
  score?: number;
  cv_text?: string;
  text?: string;
  extracted_text?: string;
  feedback?: string;
  suggestions?: string[];
  // enriched fields
  industry_fit?: string;
  skills?: string[];
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  improvements?: string[];
  section_scores?: CVResult['section_scores'];
}

function getSectionScoreColor(score: number): string {
  if (score >= 80) return COLORS.success;
  if (score >= 60) return COLORS.accent;
  return COLORS.error;
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
          borderColor: 'rgba(255,255,255,0.1)',
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

function SectionScorePill({ label, score }: { label: string; score: number }) {
  const color = getSectionScoreColor(score);
  const bgColor = score >= 80
    ? 'rgba(34,197,94,0.12)'
    : score >= 60
    ? 'rgba(245,158,11,0.12)'
    : 'rgba(239,68,68,0.12)';
  return (
    <View style={[styles.sectionPill, { borderColor: color, backgroundColor: bgColor }]}>
      <Text style={[styles.sectionPillScore, { color }]}>{score}</Text>
      <Text style={styles.sectionPillLabel}>{label}</Text>
    </View>
  );
}

function StrengthsCard({ strengths }: { strengths: string[] }) {
  return (
    <View style={styles.analysisCard}>
      <View style={styles.analysisCardHeader}>
        <View style={[styles.analysisIconCircle, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
          <Check size={16} color={COLORS.success} />
        </View>
        <Text style={styles.analysisCardTitle}>Strengths</Text>
      </View>
      {strengths.map((item, i) => (
        <View key={i} style={styles.analysisRow}>
          <View style={[styles.analysisBullet, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
            <Check size={12} color={COLORS.success} />
          </View>
          <Text style={styles.analysisRowText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function WeaknessesCard({ weaknesses }: { weaknesses: string[] }) {
  return (
    <View style={styles.analysisCard}>
      <View style={styles.analysisCardHeader}>
        <View style={[styles.analysisIconCircle, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
          <AlertTriangle size={16} color={COLORS.accent} />
        </View>
        <Text style={styles.analysisCardTitle}>Areas to Watch</Text>
      </View>
      {weaknesses.map((item, i) => (
        <View key={i} style={styles.analysisRow}>
          <View style={[styles.analysisBullet, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
            <AlertTriangle size={12} color={COLORS.accent} />
          </View>
          <Text style={styles.analysisRowText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function ImprovementsCard({ improvements }: { improvements: string[] }) {
  return (
    <View style={styles.analysisCard}>
      <View style={styles.analysisCardHeader}>
        <View style={[styles.analysisIconCircle, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
          <Lightbulb size={16} color={COLORS.accent} />
        </View>
        <Text style={styles.analysisCardTitle}>How to Improve</Text>
      </View>
      {improvements.map((item, i) => {
        const num = i + 1;
        return (
          <View key={i} style={styles.analysisRow}>
            <View style={styles.improvementBadge}>
              <Text style={styles.improvementBadgeText}>{num}</Text>
            </View>
            <Text style={styles.analysisRowText}>{item}</Text>
          </View>
        );
      })}
    </View>
  );
}

function CVAnalysisSection({ result }: { result: CVResult }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, translateY]);

  const scoreColor = getScoreColor(result.score);
  const scoreLabel = result.score <= 40 ? 'Needs Work' : result.score <= 70 ? 'Good' : 'Excellent';
  const scoreDesc = result.score <= 40
    ? 'Your CV needs significant improvements to stand out.'
    : result.score <= 70
    ? 'Your CV is solid. A few tweaks could make it great.'
    : 'Your CV is highly competitive. Keep it updated!';

  const sectionScores = result.section_scores;
  const sectionEntries: { label: string; key: keyof NonNullable<CVResult['section_scores']> }[] = [
    { label: 'Summary', key: 'summary' },
    { label: 'Experience', key: 'experience' },
    { label: 'Education', key: 'education' },
    { label: 'Skills', key: 'skills' },
    { label: 'Formatting', key: 'formatting' },
  ];

  const hasStrengths = result.strengths && result.strengths.length > 0;
  const hasWeaknesses = result.weaknesses && result.weaknesses.length > 0;
  const hasImprovements = result.improvements && result.improvements.length > 0;
  const hasSkills = result.skills && result.skills.length > 0;

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }] }}>
      {/* Score Card */}
      <View style={[styles.analysisCard, styles.scoreCardLayout]}>
        <View style={styles.scoreCardLeft}>
          <View style={[styles.scoreRevealBadge, { backgroundColor: scoreColor + '22' }]}>
            <Star size={13} color={scoreColor} />
            <Text style={[styles.scoreRevealBadgeText, { color: scoreColor }]}>CV Analysed</Text>
          </View>
          <Text style={[styles.scoreMainLabel, { color: scoreColor }]}>{scoreLabel}</Text>
          <Text style={styles.scoreMainDesc}>{scoreDesc}</Text>
          {result.summary ? (
            <Text style={styles.scoreSummaryText} numberOfLines={3}>{result.summary}</Text>
          ) : null}
        </View>
        <CircularScore score={result.score} size={96} />
      </View>

      {/* Section Scores */}
      {sectionScores ? (
        <View style={styles.analysisCard}>
          <View style={styles.analysisCardHeader}>
            <Text style={styles.analysisCardTitle}>Section Scores</Text>
          </View>
          <View style={styles.sectionPillsRow}>
            {sectionEntries.map(({ label, key }) => {
              const val = sectionScores[key];
              return val != null ? (
                <SectionScorePill key={key} label={label} score={val} />
              ) : null;
            })}
          </View>
        </View>
      ) : null}

      {/* Strengths */}
      {hasStrengths ? <StrengthsCard strengths={result.strengths!} /> : null}

      {/* Weaknesses */}
      {hasWeaknesses ? <WeaknessesCard weaknesses={result.weaknesses!} /> : null}

      {/* Improvements */}
      {hasImprovements ? <ImprovementsCard improvements={result.improvements!} /> : null}

      {/* Skills */}
      {hasSkills ? (
        <View style={styles.analysisCard}>
          <View style={styles.analysisCardHeader}>
            <Text style={styles.analysisCardTitle}>Detected Skills</Text>
          </View>
          <View style={styles.skillsRow}>
            {result.skills.map((skill, i) => (
              <View key={i} style={styles.skillChip}>
                <Text style={styles.skillChipText}>{skill}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Industry Fit */}
      {result.industry_fit ? (
        <View style={styles.analysisCard}>
          <View style={styles.analysisCardHeader}>
            <View style={[styles.analysisIconCircle, { backgroundColor: COLORS.accentMuted }]}>
              <TrendingUp size={16} color={COLORS.accent} />
            </View>
            <Text style={styles.analysisCardTitle}>Industry Fit</Text>
          </View>
          <View style={styles.industryFitRow}>
            <Text style={styles.industryFitName}>{result.industry_fit}</Text>
            <View style={[styles.industryFitBadge, { backgroundColor: COLORS.accentMuted }]}>
              <ChevronRight size={14} color={COLORS.accent} />
            </View>
          </View>
        </View>
      ) : null}
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
  const [cvResult, setCvResult] = useState<CVResult | null>(null);
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
    console.log('[Dashboard] CV upload started');
    console.log('[Dashboard] BACKEND_URL:', BACKEND_URL || '(empty — not configured)');

    if (!BACKEND_URL) {
      const msg = 'Backend not configured. Please try again later.';
      console.error('[Dashboard]', msg);
      setError(msg);
      Alert.alert('Upload Failed', msg);
      return;
    }

    let pickerResult: DocumentPicker.DocumentPickerResult | null = null;
    try {
      pickerResult = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
    } catch (e: any) {
      const msg = e?.message || JSON.stringify(e) || 'Unknown picker error';
      console.error('[Dashboard] Document picker error:', msg);
      setError(`Could not open file picker: ${msg}`);
      Alert.alert('Upload Failed', `Could not open file picker: ${msg}`);
      return;
    }

    if (pickerResult.canceled) {
      console.log('[Dashboard] CV upload cancelled by user');
      return;
    }

    const asset = pickerResult.assets[0];
    if (!asset) {
      const msg = 'No file was selected.';
      setError(msg);
      Alert.alert('Upload Failed', msg);
      return;
    }

    console.log('[Dashboard] CV selected:', asset.name, 'uri:', asset.uri, 'size:', asset.size, 'mimeType:', asset.mimeType);

    setUploading(true);
    setUploadSuccess(false);
    setCvResult(null);
    setError('');

    try {
      const token = await getBearerToken();
      console.log('[Dashboard] Token retrieved:', token ? 'yes' : 'no');
      if (!token) {
        const msg = 'You are not signed in. Please sign in and try again.';
        setError(msg);
        Alert.alert('Not Signed In', msg);
        return;
      }

      const formData = new FormData();

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
        formData.append('cv', {
          uri: asset.uri,
          name: asset.name || 'cv.pdf',
          type: asset.mimeType || 'application/pdf',
        } as any);
        console.log('[Dashboard] Appended native file object to FormData');
      }

      const uploadUrl = `${BACKEND_URL}/api/cv/score`;
      console.log('[Dashboard] FormData built, sending request to', uploadUrl);
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
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
      const resolvedScore = data?.score ?? data?.cv_score ?? null;
      console.log('[Dashboard] Upload success, data:', JSON.stringify(data));

      setUploadSuccess(true);

      if (resolvedScore != null) {
        const result: CVResult = {
          score: Number(resolvedScore),
          industry_fit: data.industry_fit ?? '',
          skills: data.skills ?? [],
          summary: data.summary,
          strengths: data.strengths,
          weaknesses: data.weaknesses,
          improvements: data.improvements,
          section_scores: data.section_scores,
        };
        console.log('[Dashboard] Setting CV result with enriched analysis:', JSON.stringify(result));
        setCvResult(result);
      }

      const cvText = data?.cv_text || data?.text || data?.extracted_text || '';
      if (cvText) {
        await AsyncStorage.setItem(USER_CV_KEY, cvText);
        console.log('[Dashboard] Saved CV text to AsyncStorage for job matching, length:', cvText.length);
      } else {
        console.log('[Dashboard] No CV text in response to save');
      }

      await fetchProfile();
    } catch (e: any) {
      const msg = e?.message || (typeof e === 'string' ? e : JSON.stringify(e)) || 'Unknown error';
      console.error('[Dashboard] CV upload error:', msg, e);
      setError(msg);
      Alert.alert('Upload Failed', msg);
    } finally {
      setUploading(false);
    }
  };

  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const topSkills = profile?.skills?.slice(0, 5) ?? [];

  // Persistent score from profile (shown when no fresh cvResult)
  const displayScore = profile?.cv_score ?? null;
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
          {uploadSuccess && !cvResult && (
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

      {/* Rich CV Analysis (shown immediately after upload) */}
      {cvResult ? (
        <CVAnalysisSection result={cvResult} />
      ) : (
        <>
          {/* Persistent score card from profile (shown when no fresh analysis) */}
          {displayScore != null && (
            <View style={styles.persistentScoreCard}>
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

          {/* Industry Fit Card (from profile) */}
          {profile?.industry_fit && (
            <View style={styles.persistentScoreCard}>
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

          {/* Skills (from profile) */}
          {topSkills.length > 0 && (
            <View style={styles.persistentScoreCard}>
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
        </>
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

  // Header
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

  // Error
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

  // Upload
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

  // Score reveal badge (inside CVAnalysisSection)
  scoreRevealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  scoreRevealBadgeText: { fontSize: 12, fontWeight: '700' },

  // Analysis cards (navy #1A3A6B bg)
  analysisCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
  },
  analysisCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  analysisIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  analysisCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.2,
  },

  // Score card layout inside analysis
  scoreCardLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scoreCardLeft: { flex: 1 },
  scoreMainLabel: { fontSize: 22, fontWeight: '800', marginBottom: 6, letterSpacing: -0.3 },
  scoreMainDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginBottom: 8 },
  scoreSummaryText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    fontStyle: 'italic',
    borderLeftWidth: 2,
    borderLeftColor: COLORS.accent,
    paddingLeft: 10,
    marginTop: 4,
  },

  // Section score pills
  sectionPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionPill: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 72,
  },
  sectionPillScore: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionPillLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Analysis rows (strengths / weaknesses)
  analysisRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  analysisBullet: {
    width: 24,
    height: 24,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  analysisRowText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },

  // Improvement numbered badges
  improvementBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: COLORS.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  improvementBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.accent,
  },

  // Industry fit inside analysis card
  industryFitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  industryFitName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  industryFitBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Skills chips
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

  // Persistent profile score card (shown when no fresh analysis)
  persistentScoreCard: {
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

  // Quick actions
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
