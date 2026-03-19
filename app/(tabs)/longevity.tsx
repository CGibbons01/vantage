import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Globe,
  MapPin,
  TrendingUp,
  Zap,
} from 'lucide-react-native';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { authenticatedGet, authenticatedPost } from '@/utils/api';
import { COLORS } from '@/constants/theme';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { PremiumLock } from '@/components/PremiumLock';

const USER_CV_KEY = 'user_cv_text';

interface AutomationRisk {
  level: 'Low' | 'Medium' | 'High' | 'Very High';
  score: number;
  summary: string;
}

interface PivotRole {
  title: string;
  skill_overlap: string;
  longevity_score: number;
  reason: string;
}

interface UpskillRecommendation {
  skill: string;
  priority: 'High' | 'Medium' | 'Low';
  reason: string;
}

interface LongevityResult {
  longevity_score: number;
  automation_risk: AutomationRisk;
  industry_outlook: string;
  at_risk_skills: string[];
  future_proof_skills: string[];
  pivot_roles: PivotRole[];
  upskill_recommendations: UpskillRecommendation[];
  bridge_plan: string;
}

interface Profile {
  job_title?: string;
  industry?: string;
}

function getRiskColor(level: string): string {
  if (level === 'Low') return COLORS.success;
  if (level === 'Medium') return COLORS.accent;
  if (level === 'High') return '#F97316';
  return COLORS.error;
}

function getRiskBg(level: string): string {
  if (level === 'Low') return 'rgba(34,197,94,0.15)';
  if (level === 'Medium') return 'rgba(245,158,11,0.15)';
  if (level === 'High') return 'rgba(249,115,22,0.15)';
  return 'rgba(239,68,68,0.15)';
}

function getPriorityColor(priority: string): string {
  if (priority === 'High') return COLORS.error;
  if (priority === 'Medium') return COLORS.accent;
  return COLORS.success;
}

function getPriorityBg(priority: string): string {
  if (priority === 'High') return 'rgba(239,68,68,0.15)';
  if (priority === 'Medium') return 'rgba(245,158,11,0.15)';
  return 'rgba(34,197,94,0.15)';
}

function getLongevityColor(score: number): string {
  if (score > 70) return COLORS.success;
  if (score >= 40) return COLORS.accent;
  return COLORS.error;
}

function CircularScore({ score, size = 100 }: { score: number; size?: number }) {
  const color = getLongevityColor(score);
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

function PulseLoader() {
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <View style={styles.pulseContainer}>
      <Animated.View style={[styles.pulseCircle, { opacity: pulse }]}>
        <Shield size={36} color={COLORS.accent} />
      </Animated.View>
      <Text style={styles.pulseTitle}>Analysing Your Career</Text>
      <Text style={styles.pulseSubtitle}>This may take a few seconds…</Text>
      <View style={styles.pulseDotsRow}>
        {[0, 1, 2].map(i => (
          <Animated.View
            key={i}
            style={[styles.pulseDot, { opacity: pulse }]}
          />
        ))}
      </View>
    </View>
  );
}

export default function LongevityScreen() {
  const insets = useSafeAreaInsets();
  const { isSubscribed } = useSubscription();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LongevityResult | null>(null);
  const [analyseError, setAnalyseError] = useState<string | null>(null);

  const handleAnalyse = async () => {
    console.log('[Longevity] Analyse My Career pressed');
    setLoading(true);
    setResult(null);
    setAnalyseError(null);
    try {
      const [cvText, profile] = await Promise.all([
        AsyncStorage.getItem(USER_CV_KEY),
        authenticatedGet<Profile>('/api/profile').catch(() => ({} as Profile)),
      ]);

      console.log('[Longevity] CV text length:', cvText?.length ?? 0, 'job_title:', profile?.job_title, 'industry:', profile?.industry);

      if (!cvText) {
        console.log('[Longevity] No CV found in AsyncStorage');
        Alert.alert(
          'No CV Found',
          'Please upload your CV on the Dashboard first so we can analyse your career.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      const payload = {
        cv_text: cvText,
        job_title: profile?.job_title || '',
        industry: profile?.industry || '',
      };

      console.log('[Longevity] POST /api/longevity/analyze — payload cv_text length:', cvText.length);
      const data = await authenticatedPost<LongevityResult>('/api/longevity/analyze', payload);
      console.log('[Longevity] Analysis complete, longevity_score:', data.longevity_score);
      setResult(data);
    } catch (e: any) {
      console.error('[Longevity] Analysis error:', e);
      const msg = e?.message || 'Could not analyse your career. Please try again.';
      setAnalyseError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReanalyse = () => {
    console.log('[Longevity] Re-analyse pressed');
    setResult(null);
    handleAnalyse();
  };

  if (!isSubscribed) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <PremiumLock
          featureName="Career Longevity & AI Risk"
          description="Discover how AI will impact your career and find roles with better long-term prospects."
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerIconCircle}>
            <Shield size={20} color={COLORS.accent} />
          </View>
          <Text style={styles.headerTitle}>Career Longevity</Text>
        </View>
        <View style={styles.centered}>
          <PulseLoader />
        </View>
      </View>
    );
  }

  const longevityScore = result ? Number(result.longevity_score) : 0;
  const longevityColor = getLongevityColor(longevityScore);
  const longevityLabel = longevityScore > 70 ? 'Strong Longevity' : longevityScore >= 40 ? 'Moderate Risk' : 'High Risk';

  const riskScore = result ? Number(result.automation_risk?.score ?? 0) : 0;
  const riskLevel = result?.automation_risk?.level ?? 'Medium';
  const riskColor = getRiskColor(riskLevel);
  const riskBg = getRiskBg(riskLevel);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIconCircle}>
          <Shield size={20} color={COLORS.accent} />
        </View>
        <Text style={styles.headerTitle}>Career Longevity</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!result ? (
          /* Empty state */
          <View style={styles.emptyCard}>
            {analyseError != null && (
              <View style={styles.errorBanner}>
                <AlertTriangle size={14} color={COLORS.error} />
                <Text style={styles.errorBannerText}>{analyseError}</Text>
              </View>
            )}
            <View style={styles.emptyIconRing}>
              <Shield size={40} color={COLORS.accent} />
            </View>
            <Text style={styles.emptyTitle}>AI Career Longevity Analysis</Text>
            <Text style={styles.emptyDesc}>
              Discover how AI will impact your career and find roles with better long-term prospects.
            </Text>
            <View style={styles.emptyFeatures}>
              {[
                { icon: <Shield size={16} color={COLORS.accent} />, text: 'Automation risk score' },
                { icon: <TrendingUp size={16} color={COLORS.accent} />, text: 'Industry outlook' },
                { icon: <Zap size={16} color={COLORS.accent} />, text: 'Future-proof skill gaps' },
                { icon: <MapPin size={16} color={COLORS.accent} />, text: 'Career pivot roadmap' },
              ].map((featureItem, featureIndex) => (
                <View key={featureIndex} style={styles.emptyFeatureRow}>
                  {featureItem.icon}
                  <Text style={styles.emptyFeatureText}>{featureItem.text}</Text>
                </View>
              ))}
            </View>
            <AnimatedPressable style={styles.primaryBtn} onPress={handleAnalyse}>
              <Shield size={18} color="#000" />
              <Text style={styles.primaryBtnText}>Analyse My Career</Text>
            </AnimatedPressable>
          </View>
        ) : (
          <>
            {/* Longevity Score Card */}
            <View style={styles.card}>
              <View style={styles.scoreCardRow}>
                <View style={styles.scoreCardLeft}>
                  <View style={[styles.scoreBadge, { backgroundColor: longevityColor + '22' }]}>
                    <Shield size={13} color={longevityColor} />
                    <Text style={[styles.scoreBadgeText, { color: longevityColor }]}>Career Longevity Score</Text>
                  </View>
                  <Text style={[styles.scoreLabel, { color: longevityColor }]}>{longevityLabel}</Text>
                  <Text style={styles.scoreDesc}>
                    {longevityScore > 70
                      ? 'Your career has strong long-term prospects.'
                      : longevityScore >= 40
                      ? 'Some areas of your career face moderate AI risk.'
                      : 'Your current role faces significant automation risk.'}
                  </Text>
                </View>
                <CircularScore score={longevityScore} size={96} />
              </View>
            </View>

            {/* Automation Risk Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconCircle, { backgroundColor: riskBg }]}>
                  <AlertTriangle size={16} color={riskColor} />
                </View>
                <Text style={styles.cardTitle}>AI Automation Risk</Text>
                <View style={[styles.riskBadge, { backgroundColor: riskBg }]}>
                  <Text style={[styles.riskBadgeText, { color: riskColor }]}>{riskLevel}</Text>
                </View>
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(100, riskScore)}%` as any, backgroundColor: riskColor },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>{riskScore}% automation probability</Text>
              {result.automation_risk?.summary ? (
                <Text style={styles.bodyText}>{result.automation_risk.summary}</Text>
              ) : null}
            </View>

            {/* Industry Outlook Card */}
            {result.industry_outlook ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIconCircle, { backgroundColor: COLORS.infoMuted }]}>
                    <Globe size={16} color={COLORS.info} />
                  </View>
                  <Text style={styles.cardTitle}>Industry Outlook</Text>
                </View>
                <Text style={styles.bodyText}>{result.industry_outlook}</Text>
              </View>
            ) : null}

            {/* Skills Analysis */}
            {((result.at_risk_skills?.length ?? 0) > 0 || (result.future_proof_skills?.length ?? 0) > 0) && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Skills Analysis</Text>
                <View style={styles.skillsColumns}>
                  {/* At Risk */}
                  <View style={styles.skillsColumn}>
                    <Text style={styles.skillsColumnTitle}>At Risk</Text>
                    {(result.at_risk_skills ?? []).map((skill, i) => (
                      <View key={i} style={styles.skillRow}>
                        <AlertTriangle size={13} color={COLORS.error} />
                        <Text style={styles.skillText} numberOfLines={2}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                  {/* Future-Proof */}
                  <View style={styles.skillsColumn}>
                    <Text style={styles.skillsColumnTitle}>Future-Proof</Text>
                    {(result.future_proof_skills ?? []).map((skill, i) => (
                      <View key={i} style={styles.skillRow}>
                        <CheckCircle size={13} color={COLORS.success} />
                        <Text style={styles.skillText} numberOfLines={2}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Pivot Roles */}
            {(result.pivot_roles?.length ?? 0) > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Recommended Pivot Roles</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pivotScroll}>
                  <View style={styles.pivotRow}>
                    {result.pivot_roles.map((role, i) => {
                      const roleScore = Number(role.longevity_score);
                      const roleColor = getLongevityColor(roleScore);
                      return (
                        <View key={i} style={styles.pivotCard}>
                          <Text style={styles.pivotTitle} numberOfLines={2}>{role.title}</Text>
                          <View style={styles.pivotBadgesRow}>
                            <View style={styles.pivotOverlapBadge}>
                              <Text style={styles.pivotOverlapText}>{role.skill_overlap}</Text>
                            </View>
                            <View style={[styles.pivotScoreBadge, { backgroundColor: roleColor + '22' }]}>
                              <Text style={[styles.pivotScoreText, { color: roleColor }]}>{roleScore}</Text>
                            </View>
                          </View>
                          <Text style={styles.pivotReason} numberOfLines={2}>{role.reason}</Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Upskill Recommendations */}
            {(result.upskill_recommendations?.length ?? 0) > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIconCircle, { backgroundColor: COLORS.accentMuted }]}>
                    <TrendingUp size={16} color={COLORS.accent} />
                  </View>
                  <Text style={styles.cardTitle}>Upskill Recommendations</Text>
                </View>
                {result.upskill_recommendations.map((rec, i) => {
                  const pColor = getPriorityColor(rec.priority);
                  const pBg = getPriorityBg(rec.priority);
                  return (
                    <View key={i} style={styles.upskillRow}>
                      <View style={styles.upskillTop}>
                        <Text style={styles.upskillSkill}>{rec.skill}</Text>
                        <View style={[styles.priorityBadge, { backgroundColor: pBg }]}>
                          <Text style={[styles.priorityText, { color: pColor }]}>{rec.priority}</Text>
                        </View>
                      </View>
                      <Text style={styles.upskillReason}>{rec.reason}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Bridge Plan */}
            {result.bridge_plan ? (
              <View style={[styles.card, styles.bridgeCard]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIconCircle, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
                    <MapPin size={16} color="#8B5CF6" />
                  </View>
                  <Text style={styles.cardTitle}>Your Transition Plan</Text>
                </View>
                <Text style={styles.bodyText}>{result.bridge_plan}</Text>
              </View>
            ) : null}

            {/* Re-analyse button */}
            <AnimatedPressable style={styles.reanalyseBtn} onPress={handleReanalyse}>
              <Shield size={16} color={COLORS.accent} />
              <Text style={styles.reanalyseBtnText}>Re-analyse</Text>
            </AnimatedPressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.accentDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, letterSpacing: -0.4 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Pulse loader
  pulseContainer: { alignItems: 'center', paddingVertical: 40 },
  pulseCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  pulseTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  pulseSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 20 },
  pulseDotsRow: { flexDirection: 'row', gap: 8 },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },

  // Empty state
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 8,
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  },
  emptyIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  emptyDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  emptyFeatures: { width: '100%', marginBottom: 28, gap: 12 },
  emptyFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyFeatureText: { fontSize: 14, color: COLORS.text, fontWeight: '500' },

  // Primary button
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 16,
    boxShadow: '0 4px 16px rgba(245,158,11,0.35)',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },

  // Cards
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  },
  bridgeCard: {
    borderColor: 'rgba(139,92,246,0.3)',
    backgroundColor: 'rgba(139,92,246,0.06)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  cardIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  bodyText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 21 },

  // Score card
  scoreCardRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  scoreCardLeft: { flex: 1 },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  scoreBadgeText: { fontSize: 12, fontWeight: '700' },
  scoreLabel: { fontSize: 20, fontWeight: '800', marginBottom: 6, letterSpacing: -0.3 },
  scoreDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },

  // Risk badge
  riskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  riskBadgeText: { fontSize: 12, fontWeight: '700' },

  // Progress bar
  progressBarBg: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: { height: '100%', borderRadius: 4 },
  progressLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 12 },

  // Skills columns
  skillsColumns: { flexDirection: 'row', gap: 12, marginTop: 12 },
  skillsColumn: { flex: 1, gap: 8 },
  skillsColumnTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  skillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  skillText: { flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 18 },

  // Pivot roles
  pivotScroll: { marginTop: 12 },
  pivotRow: { flexDirection: 'row', gap: 12, paddingBottom: 4 },
  pivotCard: {
    width: 160,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pivotTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 8, lineHeight: 19 },
  pivotBadgesRow: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  pivotOverlapBadge: {
    backgroundColor: COLORS.infoMuted,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pivotOverlapText: { fontSize: 11, fontWeight: '600', color: COLORS.info },
  pivotScoreBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pivotScoreText: { fontSize: 11, fontWeight: '700' },
  pivotReason: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },

  // Upskill
  upskillRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  upskillTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  upskillSkill: { fontSize: 14, fontWeight: '600', color: COLORS.text, flex: 1, marginRight: 8 },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityText: { fontSize: 11, fontWeight: '700' },
  upskillReason: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },

  // Re-analyse
  reanalyseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  reanalyseBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.accent },
});
