import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Clipboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mail, Copy, CheckCircle } from 'lucide-react-native';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { authenticatedPost } from '@/utils/api';
import { COLORS } from '@/constants/theme';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { PremiumLock } from '@/components/PremiumLock';

type Tone = 'professional' | 'enthusiastic' | 'concise';

interface CoverLetterResult {
  cover_letter: string;
  word_count: number;
}

const TONES: { label: string; value: Tone }[] = [
  { label: 'Professional', value: 'professional' },
  { label: 'Enthusiastic', value: 'enthusiastic' },
  { label: 'Concise', value: 'concise' },
];

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

  const handleGenerate = async () => {
    if (!applicantName.trim() || !jobTitle.trim() || !companyName.trim() || !jobDescription.trim()) {
      Alert.alert('Missing fields', 'Please fill in your name, job title, company, and job description.');
      return;
    }
    console.log('[CoverLetter] Generate pressed - role:', jobTitle, 'company:', companyName, 'tone:', tone);
    setLoading(true);
    setResult(null);
    try {
      const data = await authenticatedPost<CoverLetterResult>('/api/cover-letter/generate', {
        applicant_name: applicantName.trim(),
        job_title: jobTitle.trim(),
        company_name: companyName.trim(),
        job_description: jobDescription.trim(),
        cv_summary: cvSummary.trim(),
        tone,
      });
      console.log('[CoverLetter] Generated successfully, word count:', data.word_count);
      setResult(data);
    } catch (e: any) {
      console.error('[CoverLetter] Generate error:', e);
      Alert.alert('Generation failed', e?.message || 'Could not generate your cover letter. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    console.log('[CoverLetter] Copy to clipboard pressed');
    Clipboard.setString(result.cover_letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const wordCount = result ? Number(result.word_count) : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIconCircle}>
          <Mail size={20} color={COLORS.accent} />
        </View>
        <Text style={styles.headerTitle}>Cover Letter</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.fieldLabel}>Your Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Jane Smith"
          placeholderTextColor={COLORS.textMuted}
          value={applicantName}
          onChangeText={setApplicantName}
          autoCapitalize="words"
        />

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
          placeholder="Paste the job description here..."
          placeholderTextColor={COLORS.textMuted}
          value={jobDescription}
          onChangeText={setJobDescription}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        <Text style={styles.fieldLabel}>Your CV Summary</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Brief summary of your experience..."
          placeholderTextColor={COLORS.textMuted}
          value={cvSummary}
          onChangeText={setCvSummary}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={styles.fieldLabel}>Tone</Text>
        <View style={styles.toneRow}>
          {TONES.map(t => (
            <AnimatedPressable
              key={t.value}
              style={[styles.toneBtn, tone === t.value && styles.toneBtnActive]}
              onPress={() => { console.log('[CoverLetter] Tone selected:', t.value); setTone(t.value); }}
            >
              <Text style={[styles.toneBtnText, tone === t.value && styles.toneBtnTextActive]}>
                {t.label}
              </Text>
            </AnimatedPressable>
          ))}
        </View>

        <AnimatedPressable
          style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
          onPress={handleGenerate}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#000" size="small" />
            : <Text style={styles.primaryBtnText}>Generate Cover Letter</Text>
          }
        </AnimatedPressable>

        {result && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Your Cover Letter</Text>
              <View style={styles.resultHeaderRight}>
                <View style={styles.wordCountBadge}>
                  <Text style={styles.wordCountText}>{wordCount} words</Text>
                </View>
                <AnimatedPressable
                  style={[styles.copyBtn, copied && styles.copyBtnSuccess]}
                  onPress={handleCopy}
                >
                  {copied
                    ? <CheckCircle size={14} color={COLORS.success} />
                    : <Copy size={14} color={COLORS.accent} />
                  }
                  <Text style={[styles.copyBtnText, copied && { color: COLORS.success }]}>
                    {copied ? 'Copied!' : 'Copy'}
                  </Text>
                </AnimatedPressable>
              </View>
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
    backgroundColor: COLORS.accentDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, letterSpacing: -0.4 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: COLORS.surface,
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
  textareaLarge: { height: 140, paddingTop: 13 },
  toneRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  toneBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  toneBtnActive: { backgroundColor: COLORS.accentMuted, borderColor: 'rgba(245,158,11,0.4)' },
  toneBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  toneBtnTextActive: { color: COLORS.accent },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    boxShadow: '0 4px 16px rgba(245,158,11,0.3)',
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },
  resultCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  wordCountBadge: {
    backgroundColor: COLORS.infoMuted,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  wordCountText: { fontSize: 11, fontWeight: '600', color: COLORS.info },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.accentDim,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  copyBtnSuccess: { backgroundColor: COLORS.successMuted, borderColor: 'rgba(34,197,94,0.3)' },
  copyBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.accent },
  letterContent: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  letterText: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
});
