import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mail, Copy, CheckCircle, ChevronDown, ChevronUp, Lightbulb, RotateCcw } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { COLORS } from '@/constants/theme';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { PremiumLock } from '@/components/PremiumLock';
import { authenticatedPost } from '@/utils/api';

type Tone = 'professional' | 'enthusiastic' | 'concise';

interface CoverLetterResult {
  cover_letter: string;
  word_count: number;
}

const TONES: { label: string; value: Tone; description: string }[] = [
  { label: 'Professional', value: 'professional', description: 'Formal & polished' },
  { label: 'Enthusiastic', value: 'enthusiastic', description: 'Energetic & passionate' },
  { label: 'Concise', value: 'concise', description: 'Brief & to the point' },
];

const TIPS = [
  'Tailor your cover letter to each specific job — mention the company by name.',
  'Lead with your strongest achievement, not "I am applying for...".',
  'Keep it to one page (250–400 words is ideal).',
  'Mirror keywords from the job description to pass ATS filters.',
  'End with a clear call to action — ask for an interview.',
];

const STEPS = ['Job Details', 'Your Info', 'Generate'];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <View style={styles.stepRow}>
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isDone = stepNum < currentStep;
        const stepStyle = isDone ? styles.stepCircleDone : isActive ? styles.stepCircleActive : styles.stepCircle;
        const textStyle = isDone || isActive ? styles.stepNumActive : styles.stepNum;
        const labelStyle = isActive ? styles.stepLabelActive : styles.stepLabel;
        return (
          <React.Fragment key={label}>
            <View style={styles.stepItem}>
              <View style={stepStyle}>
                {isDone ? (
                  <CheckCircle size={14} color="#FFFFFF" />
                ) : (
                  <Text style={textStyle}>{stepNum}</Text>
                )}
              </View>
              <Text style={labelStyle}>{label}</Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={[styles.stepConnector, isDone && styles.stepConnectorDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// Local cover letter template generation — no backend needed
function generateCoverLetterLocally(params: {
  applicantName: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  cvSummary: string;
  tone: Tone;
}): CoverLetterResult {
  const { applicantName, jobTitle, companyName, cvSummary, tone } = params;

  const openingMap: Record<Tone, string> = {
    professional: `I am writing to express my strong interest in the ${jobTitle} position at ${companyName}.`,
    enthusiastic: `I am thrilled to apply for the ${jobTitle} role at ${companyName} — a company whose work I have long admired.`,
    concise: `Please consider my application for the ${jobTitle} position at ${companyName}.`,
  };

  const closingMap: Record<Tone, string> = {
    professional: `I am confident that my background makes me an excellent candidate for this role. I would welcome the opportunity to discuss how my experience aligns with your needs.`,
    enthusiastic: `I am genuinely excited about the opportunity to bring my skills and passion to ${companyName}. I would love to discuss how I can contribute to your team.`,
    concise: `I believe my skills are a strong match for this role and would welcome a conversation at your convenience.`,
  };

  const summaryParagraph = cvSummary.trim()
    ? cvSummary.trim()
    : `With a strong background relevant to the ${jobTitle} role, I bring a combination of technical expertise and a proven track record of delivering results.`;

  const coverLetter = [
    'Dear Hiring Manager,',
    '',
    openingMap[tone],
    '',
    summaryParagraph,
    '',
    `Having reviewed the requirements for this position, I am confident that my experience and skills align well with what ${companyName} is looking for. I am particularly drawn to the opportunity to contribute to your team and help drive meaningful outcomes.`,
    '',
    closingMap[tone],
    '',
    'Yours sincerely,',
    applicantName,
  ].join('\n');

  const wordCount = coverLetter.split(/\s+/).filter(Boolean).length;

  return { cover_letter: coverLetter, word_count: wordCount };
}

export default function CoverLetterScreen() {
  const insets = useSafeAreaInsets();
  const { isSubscribed } = useSubscription();

  const [applicantName, setApplicantName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [cvSummary, setCvSummary] = useState('');
  const [tone, setTone] = useState<Tone>('professional');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CoverLetterResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [tipsExpanded, setTipsExpanded] = useState(false);

  if (!isSubscribed) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <PremiumLock
          featureName="AI Cover Letter Writer"
          description="Generate tailored, compelling cover letters for any role in seconds with AI-powered personalisation."
        />
      </View>
    );
  }

  const hasJobDetails = jobTitle.trim().length > 0 && companyName.trim().length > 0;
  const hasUserInfo = applicantName.trim().length > 0;
  const currentStep = result ? 3 : hasJobDetails && hasUserInfo ? 3 : hasJobDetails ? 2 : 1;

  const handleGenerate = async () => {
    if (!applicantName.trim() || !jobTitle.trim() || !companyName.trim() || !jobDescription.trim()) {
      Alert.alert('Missing fields', 'Please fill in your name, job title, company, and job description.');
      return;
    }
    console.log('[CoverLetter] Generate pressed - role:', jobTitle, 'company:', companyName, 'tone:', tone);
    setLoading(true);
    setResult(null);
    try {
      console.log('[CoverLetter] Calling POST /api/generate-cover-letter');
      const data = await authenticatedPost<CoverLetterResult>('/api/generate-cover-letter', {
        applicantName: applicantName.trim(),
        jobTitle: jobTitle.trim(),
        companyName: companyName.trim(),
        jobDescription: jobDescription.trim(),
        cvSummary: cvSummary.trim(),
        tone,
      });
      console.log('[CoverLetter] AI generation succeeded, word count:', data.word_count);
      setResult(data);
    } catch (e: any) {
      console.warn('[CoverLetter] AI generation failed, falling back to local:', e?.message);
      try {
        const data = generateCoverLetterLocally({
          applicantName: applicantName.trim(),
          jobTitle: jobTitle.trim(),
          companyName: companyName.trim(),
          jobDescription: jobDescription.trim(),
          cvSummary: cvSummary.trim(),
          tone,
        });
        console.log('[CoverLetter] Local fallback succeeded, word count:', data.word_count);
        setResult(data);
        Alert.alert('Generated offline', 'Generated offline — connect to internet for AI-enhanced results.');
      } catch (fallbackErr: any) {
        console.error('[CoverLetter] Local fallback also failed:', fallbackErr);
        Alert.alert('Generation failed', fallbackErr?.message || 'Could not generate your cover letter. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartOver = () => {
    console.log('[CoverLetter] Start Over pressed');
    setResult(null);
    setJobTitle('');
    setCompanyName('');
    setJobDescription('');
    setApplicantName('');
    setCvSummary('');
    setTone('professional');
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!result) return;
    console.log('[CoverLetter] Copy to clipboard pressed');
    await Clipboard.setStringAsync(result.cover_letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    Alert.alert('Copied!', 'Copied to clipboard. You can paste this into a Word document or Google Docs.');
  };

  const wordCount = result ? Number(result.word_count) : 0;
  const tipsLabel = tipsExpanded ? 'Hide Tips' : 'Writing Tips';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIconCircle}>
          <Mail size={20} color={COLORS.primaryLight} />
        </View>
        <Text style={styles.headerTitle}>Cover Letter</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} />

        {/* Tips collapsible */}
        <AnimatedPressable
          style={styles.tipsToggle}
          onPress={() => {
            console.log('[CoverLetter] Tips toggled, expanded:', !tipsExpanded);
            setTipsExpanded(v => !v);
          }}
        >
          <View style={styles.tipsToggleLeft}>
            <Lightbulb size={15} color={COLORS.primaryLight} />
            <Text style={styles.tipsToggleText}>{tipsLabel}</Text>
          </View>
          {tipsExpanded
            ? <ChevronUp size={16} color={COLORS.textSecondary} />
            : <ChevronDown size={16} color={COLORS.textSecondary} />
          }
        </AnimatedPressable>
        {tipsExpanded && (
          <View style={styles.tipsCard}>
            {TIPS.map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <View style={styles.tipDot} />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Section 1: Job Details */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionNumCircle}>
            <Text style={styles.sectionNum}>1</Text>
          </View>
          <Text style={styles.sectionTitle}>Job Details</Text>
        </View>

        <Text style={styles.fieldLabel}>Job Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Senior Product Manager"
          placeholderTextColor={COLORS.textMuted}
          value={jobTitle}
          onChangeText={setJobTitle}
        />

        <Text style={styles.fieldLabel}>Company Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Acme Corp"
          placeholderTextColor={COLORS.textMuted}
          value={companyName}
          onChangeText={setCompanyName}
        />

        <Text style={styles.fieldLabel}>Job Description</Text>
        <TextInput
          style={[styles.input, styles.textareaLarge]}
          placeholder="Paste the job ad here — the more detail, the better your letter will be..."
          placeholderTextColor={COLORS.textMuted}
          value={jobDescription}
          onChangeText={setJobDescription}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        {/* Section 2: Your Info */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionNumCircle}>
            <Text style={styles.sectionNum}>2</Text>
          </View>
          <Text style={styles.sectionTitle}>Your Info</Text>
        </View>

        <Text style={styles.fieldLabel}>Your Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Jane Smith"
          placeholderTextColor={COLORS.textMuted}
          value={applicantName}
          onChangeText={setApplicantName}
          autoCapitalize="words"
        />

        <Text style={styles.fieldLabel}>CV Summary</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="e.g. 5 years in product management at SaaS companies, led teams of 8, shipped 3 major product launches..."
          placeholderTextColor={COLORS.textMuted}
          value={cvSummary}
          onChangeText={setCvSummary}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
        {cvSummary.trim().length > 0 && cvSummary.trim().length < 20 ? (
          <Text style={styles.cvSummaryWarning}>
            Add a brief CV summary for a more personalised letter
          </Text>
        ) : null}

        {/* Section 3: Generate */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionNumCircle}>
            <Text style={styles.sectionNum}>3</Text>
          </View>
          <Text style={styles.sectionTitle}>Tone & Generate</Text>
        </View>

        <Text style={styles.fieldLabel}>Tone</Text>
        <View style={styles.toneRow}>
          {TONES.map(t => {
            const isActive = tone === t.value;
            return (
              <AnimatedPressable
                key={t.value}
                style={[styles.toneBtn, isActive && styles.toneBtnActive]}
                onPress={() => { console.log('[CoverLetter] Tone selected:', t.value); setTone(t.value); }}
              >
                <Text style={[styles.toneBtnLabel, isActive && styles.toneBtnLabelActive]}>{t.label}</Text>
                <Text style={[styles.toneBtnDesc, isActive && styles.toneBtnDescActive]}>{t.description}</Text>
              </AnimatedPressable>
            );
          })}
        </View>

        <AnimatedPressable
          style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
          onPress={handleGenerate}
          disabled={loading}
        >
          <LinearGradient
            colors={['#7C3AED', '#4F46E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryBtnGradient}
          >
            {loading ? (
              <>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.primaryBtnText}>Generating with AI…</Text>
              </>
            ) : (
              <>
                <Mail size={18} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Generate Cover Letter</Text>
              </>
            )}
          </LinearGradient>
        </AnimatedPressable>

        {result && (
          <View style={styles.resultCard}>
            {/* Result header */}
            <View style={styles.resultBanner}>
              <CheckCircle size={20} color={COLORS.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.resultBannerTitle}>Your Cover Letter is Ready!</Text>
                <Text style={styles.resultBannerSub}>
                  {wordCount}
                  {' words'}
                </Text>
              </View>
            </View>

            <View style={styles.resultActions}>
              <AnimatedPressable
                style={[styles.actionBtn, copied && styles.actionBtnSuccess]}
                onPress={handleCopy}
              >
                {copied
                  ? <CheckCircle size={14} color={COLORS.success} />
                  : <Copy size={14} color={COLORS.primaryLight} />
                }
                <Text style={[styles.actionBtnText, copied && { color: COLORS.success }]}>
                  {copied ? 'Copied!' : 'Copy to Clipboard'}
                </Text>
              </AnimatedPressable>
              <AnimatedPressable style={styles.startOverBtn} onPress={handleStartOver}>
                <RotateCcw size={14} color={COLORS.textSecondary} />
                <Text style={styles.startOverText}>Start Over</Text>
              </AnimatedPressable>
            </View>

            <View style={styles.letterContent}>
              <Text style={styles.letterText} selectable>{result.cover_letter}</Text>
            </View>
          </View>
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
    backgroundColor: COLORS.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, letterSpacing: -0.4 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },

  // Step indicator
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  stepItem: { alignItems: 'center', gap: 4 },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleDone: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNum: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  stepNumActive: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  stepLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '500' },
  stepLabelActive: { fontSize: 10, color: COLORS.primaryLight, fontWeight: '700' },
  stepConnector: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 14,
    marginHorizontal: 4,
  },
  stepConnectorDone: { backgroundColor: COLORS.primary },

  // Tips
  tipsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tipsToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipsToggleText: { fontSize: 14, fontWeight: '600', color: COLORS.primaryLight },
  tipsCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tipDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.primaryLight,
    marginTop: 7,
    flexShrink: 0,
  },
  tipText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    marginTop: 8,
  },
  sectionNumCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionNum: { fontSize: 12, fontWeight: '800', color: COLORS.primaryLight },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },

  // Form
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  textarea: { height: 100, paddingTop: 13 },
  cvSummaryWarning: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: -10,
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  textareaLarge: { height: 140, paddingTop: 13 },

  // Tone
  toneRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  toneBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 3,
  },
  toneBtnActive: { backgroundColor: COLORS.primaryMuted, borderColor: COLORS.primary },
  toneBtnLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  toneBtnLabelActive: { color: COLORS.primaryLight },
  toneBtnDesc: { fontSize: 10, color: COLORS.textMuted, textAlign: 'center' },
  toneBtnDescActive: { color: COLORS.primaryLight, opacity: 0.8 },

  // Generate button
  primaryBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
  },
  primaryBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },

  // Result
  resultCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.successMuted,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
  },
  resultBannerTitle: { fontSize: 15, fontWeight: '700', color: COLORS.success },
  resultBannerSub: { fontSize: 12, color: COLORS.success, opacity: 0.8, marginTop: 1 },
  resultActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionBtnSuccess: { backgroundColor: COLORS.successMuted, borderColor: 'rgba(34,197,94,0.3)' },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.primaryLight },
  startOverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginLeft: 'auto',
  },
  startOverText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  letterContent: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  letterText: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
});
