import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Clipboard,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileText, Copy, CheckCircle, ChevronDown, ChevronUp, X, Download, Upload } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { authenticatedPost, getBearerToken, BACKEND_URL } from '@/utils/api';
import { COLORS } from '@/constants/theme';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { PremiumLock } from '@/components/PremiumLock';

const USER_CV_KEY = 'user_cv_text';

type Mode = 'generate' | 'improve';
type CVSection = 'summary' | 'experience' | 'skills' | 'achievements';

const FOCUS_AREAS = [
  { label: 'Impact Statements', value: 'impact_statements' },
  { label: 'Keywords', value: 'keywords' },
  { label: 'Formatting', value: 'formatting' },
  { label: 'Achievements', value: 'achievements' },
  { label: 'Summary', value: 'summary' },
];

interface GenerateResult {
  cv_text: string;
  sections: {
    professional_summary?: string;
    experience?: string;
    education?: string;
    skills?: string;
    achievements?: string;
  };
}

interface ImproveResult {
  improved_cv_text: string;
  suggestions: string[];
  score_before: number;
  score_after: number;
}

interface ParseResult {
  raw_text: string;
  parsed?: {
    name?: string;
    email?: string;
    phone?: string;
    job_title?: string;
    skills?: string[];
    summary?: string;
  };
}

function SkillChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
      <AnimatedPressable onPress={onRemove} style={styles.chipRemove}>
        <X size={12} color={COLORS.accent} />
      </AnimatedPressable>
    </View>
  );
}

function FocusChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <AnimatedPressable
      style={[styles.focusChip, selected && styles.focusChipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.focusChipText, selected && styles.focusChipTextSelected]}>{label}</Text>
    </AnimatedPressable>
  );
}

function SectionTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <AnimatedPressable
      style={[styles.sectionTab, active && styles.sectionTabActive]}
      onPress={onPress}
    >
      <Text style={[styles.sectionTabText, active && styles.sectionTabTextActive]}>{label}</Text>
    </AnimatedPressable>
  );
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  const pct = Math.min(100, Math.max(0, score));
  return (
    <View style={styles.scoreBarRow}>
      <Text style={styles.scoreBarLabel}>{label}</Text>
      <View style={styles.scoreBarBg}>
        <View style={[styles.scoreBarFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.scoreBarValue, { color }]}>{score}</Text>
    </View>
  );
}

async function downloadPdf(content: string, title: string, filename: string): Promise<void> {
  console.log('[CVWriter] Download PDF pressed, title:', title);
  const token = await getBearerToken();
  if (!token) throw new Error('Not signed in');

  const url = `${BACKEND_URL}/api/cv/export-pdf`;
  console.log('[CVWriter] POST', url);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content, title }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[CVWriter] PDF export error:', response.status, text.slice(0, 200));
    throw new Error(`Server error ${response.status}`);
  }

  console.log('[CVWriter] PDF response received, processing...');

  if (Platform.OS === 'web') {
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(blobUrl);
    console.log('[CVWriter] PDF download triggered on web');
  } else {
    const FileSystem = await import('expo-file-system');
    const Sharing = await import('expo-sharing');
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    const fileUri = FileSystem.default.documentDirectory + filename;
    await FileSystem.default.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log('[CVWriter] PDF written to:', fileUri);
    const canShare = await Sharing.default.isAvailableAsync();
    if (canShare) {
      await Sharing.default.shareAsync(fileUri, { mimeType: 'application/pdf' });
      console.log('[CVWriter] Share sheet opened');
    } else {
      Alert.alert('Saved', `PDF saved to: ${fileUri}`);
    }
  }
}

export default function CVWriterScreen() {
  const insets = useSafeAreaInsets();
  const { isSubscribed } = useSubscription();

  const [mode, setMode] = useState<Mode>('generate');

  // Generate mode state
  const [genName, setGenName] = useState('');
  const [genEmail, setGenEmail] = useState('');
  const [genRole, setGenRole] = useState('');
  const [genSummary, setGenSummary] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState<GenerateResult | null>(null);
  const [activeSection, setActiveSection] = useState<CVSection>('summary');
  const [genCopied, setGenCopied] = useState(false);
  const [genDownloading, setGenDownloading] = useState(false);

  // Improve mode state
  const [impCV, setImpCV] = useState('');
  const [impRole, setImpRole] = useState('');
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [impLoading, setImpLoading] = useState(false);
  const [impResult, setImpResult] = useState<ImproveResult | null>(null);
  const [impCopied, setImpCopied] = useState(false);
  const [impDownloading, setImpDownloading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);

  if (!isSubscribed) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <PremiumLock
          featureName="AI CV Writer"
          description="Generate a polished, ATS-optimised CV or improve your existing one with AI-powered suggestions and scoring."
        />
      </View>
    );
  }

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed) return;
    const newSkills = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    console.log('[CVWriter] Adding skills:', newSkills);
    setSkills(prev => [...prev, ...newSkills.filter(s => !prev.includes(s))]);
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    console.log('[CVWriter] Removing skill:', skill);
    setSkills(prev => prev.filter(s => s !== skill));
  };

  const toggleFocusArea = (value: string) => {
    console.log('[CVWriter] Toggle focus area:', value);
    setFocusAreas(prev =>
      prev.includes(value) ? prev.filter(f => f !== value) : [...prev, value]
    );
  };

  const handleGenerate = async () => {
    if (!genName.trim() || !genEmail.trim() || !genRole.trim()) {
      Alert.alert('Missing fields', 'Please fill in your name, email, and target role.');
      return;
    }
    console.log('[CVWriter] Generate CV pressed - role:', genRole, 'skills:', skills.length);
    setGenLoading(true);
    setGenResult(null);
    try {
      const result = await authenticatedPost<GenerateResult>('/api/cv/generate', {
        name: genName.trim(),
        email: genEmail.trim(),
        target_role: genRole.trim(),
        experience: [],
        education: [],
        skills,
        summary: genSummary.trim(),
      });
      console.log('[CVWriter] CV generated successfully');
      setGenResult(result);
      if (result.cv_text) {
        await AsyncStorage.setItem(USER_CV_KEY, result.cv_text);
        console.log('[CVWriter] Saved generated CV to AsyncStorage');
      }
    } catch (e: any) {
      console.error('[CVWriter] Generate error:', e);
      Alert.alert('Generation failed', e?.message || 'Could not generate your CV. Please try again.');
    } finally {
      setGenLoading(false);
    }
  };

  const handleImprove = async () => {
    if (!impCV.trim() || !impRole.trim()) {
      Alert.alert('Missing fields', 'Please paste your CV and enter a target role.');
      return;
    }
    console.log('[CVWriter] Improve CV pressed - role:', impRole, 'focus areas:', focusAreas);
    setImpLoading(true);
    setImpResult(null);
    try {
      const result = await authenticatedPost<ImproveResult>('/api/cv/improve', {
        cv_text: impCV.trim(),
        target_role: impRole.trim(),
        focus_areas: focusAreas,
      });
      console.log('[CVWriter] CV improved - score:', result.score_before, '->', result.score_after);
      setImpResult(result);
      if (result.improved_cv_text) {
        await AsyncStorage.setItem(USER_CV_KEY, result.improved_cv_text);
        console.log('[CVWriter] Saved improved CV to AsyncStorage');
      }
    } catch (e: any) {
      console.error('[CVWriter] Improve error:', e);
      Alert.alert('Improvement failed', e?.message || 'Could not improve your CV. Please try again.');
    } finally {
      setImpLoading(false);
    }
  };

  const handleUploadFile = async () => {
    console.log('[CVWriter] Upload CV file pressed');
    let pickerResult: DocumentPicker.DocumentPickerResult | null = null;
    try {
      pickerResult = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });
    } catch (e: any) {
      console.error('[CVWriter] Document picker error:', e);
      Alert.alert('Error', 'Could not open file picker.');
      return;
    }

    if (pickerResult.canceled) {
      console.log('[CVWriter] File upload cancelled');
      return;
    }

    const asset = pickerResult.assets[0];
    if (!asset) return;

    console.log('[CVWriter] File selected:', asset.name, 'size:', asset.size);
    setUploadingFile(true);

    try {
      const token = await getBearerToken();
      if (!token) throw new Error('Not signed in');

      const formData = new FormData();
      if (typeof document !== 'undefined') {
        const blobResponse = await fetch(asset.uri);
        if (!blobResponse.ok) throw new Error('Could not read file');
        const blob = await blobResponse.blob();
        formData.append('file', blob, asset.name || 'cv.pdf');
        console.log('[CVWriter] Appended blob to FormData, size:', blob.size);
      } else {
        formData.append('file', {
          uri: asset.uri,
          name: asset.name || 'cv.pdf',
          type: asset.mimeType || 'application/pdf',
        } as any);
        console.log('[CVWriter] Appended native file to FormData');
      }

      const parseUrl = `${BACKEND_URL}/api/cv/parse`;
      console.log('[CVWriter] POST', parseUrl);
      const response = await fetch(parseUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('[CVWriter] Parse error:', response.status, text.slice(0, 200));
        throw new Error(`Server error ${response.status}`);
      }

      const data: ParseResult = await response.json();
      console.log('[CVWriter] CV parsed successfully, raw_text length:', data.raw_text?.length);

      if (data.raw_text) {
        setImpCV(data.raw_text);
      }
      if (data.parsed?.name) setGenName(data.parsed.name);
      if (data.parsed?.email) setGenEmail(data.parsed.email);

      Alert.alert('CV Loaded', 'Your CV text has been extracted and filled in below.');
    } catch (e: any) {
      console.error('[CVWriter] File upload/parse error:', e);
      Alert.alert('Upload Failed', e?.message || 'Could not parse your CV file.');
    } finally {
      setUploadingFile(false);
    }
  };

  const copyToClipboard = (text: string, type: 'gen' | 'imp') => {
    console.log('[CVWriter] Copy to clipboard pressed, type:', type);
    Clipboard.setString(text);
    if (type === 'gen') {
      setGenCopied(true);
      setTimeout(() => setGenCopied(false), 2000);
    } else {
      setImpCopied(true);
      setTimeout(() => setImpCopied(false), 2000);
    }
  };

  const handleGenDownloadPdf = async () => {
    if (!genResult?.cv_text) return;
    setGenDownloading(true);
    try {
      await downloadPdf(genResult.cv_text, 'My CV', 'cv.pdf');
    } catch (e: any) {
      console.error('[CVWriter] Gen PDF download error:', e);
      Alert.alert('Download Failed', e?.message || 'Could not generate PDF.');
    } finally {
      setGenDownloading(false);
    }
  };

  const handleImpDownloadPdf = async () => {
    if (!impResult?.improved_cv_text) return;
    setImpDownloading(true);
    try {
      await downloadPdf(impResult.improved_cv_text, 'My CV', 'cv.pdf');
    } catch (e: any) {
      console.error('[CVWriter] Imp PDF download error:', e);
      Alert.alert('Download Failed', e?.message || 'Could not generate PDF.');
    } finally {
      setImpDownloading(false);
    }
  };

  const sectionContent = genResult ? {
    summary: genResult.sections?.professional_summary || '',
    experience: genResult.sections?.experience || '',
    skills: genResult.sections?.skills || '',
    achievements: genResult.sections?.achievements || '',
  } : null;

  const scoreBefore = impResult ? Number(impResult.score_before) : 0;
  const scoreAfter = impResult ? Number(impResult.score_after) : 0;
  const scoreBeforeColor = scoreBefore >= 80 ? COLORS.success : scoreBefore >= 60 ? COLORS.accent : COLORS.textMuted;
  const scoreAfterColor = scoreAfter >= 80 ? COLORS.success : scoreAfter >= 60 ? COLORS.accent : COLORS.textMuted;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIconCircle}>
          <FileText size={20} color={COLORS.accent} />
        </View>
        <Text style={styles.headerTitle}>AI CV Writer</Text>
      </View>

      {/* Mode Toggle */}
      <View style={styles.modeToggle}>
        <AnimatedPressable
          style={[styles.modeBtn, mode === 'generate' && styles.modeBtnActive]}
          onPress={() => { console.log('[CVWriter] Switch to Generate mode'); setMode('generate'); }}
        >
          <Text style={[styles.modeBtnText, mode === 'generate' && styles.modeBtnTextActive]}>Generate CV</Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={[styles.modeBtn, mode === 'improve' && styles.modeBtnActive]}
          onPress={() => { console.log('[CVWriter] Switch to Improve mode'); setMode('improve'); }}
        >
          <Text style={[styles.modeBtnText, mode === 'improve' && styles.modeBtnTextActive]}>Improve CV</Text>
        </AnimatedPressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {mode === 'generate' ? (
          <>
            <Text style={styles.fieldLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Jane Smith"
              placeholderTextColor={COLORS.textMuted}
              value={genName}
              onChangeText={setGenName}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. jane@email.com"
              placeholderTextColor={COLORS.textMuted}
              value={genEmail}
              onChangeText={setGenEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Target Role</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Senior React Native Developer"
              placeholderTextColor={COLORS.textMuted}
              value={genRole}
              onChangeText={setGenRole}
            />

            <Text style={styles.fieldLabel}>Professional Summary</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Brief overview of your experience and goals..."
              placeholderTextColor={COLORS.textMuted}
              value={genSummary}
              onChangeText={setGenSummary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>Skills</Text>
            <View style={styles.skillInputRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="React Native, TypeScript..."
                placeholderTextColor={COLORS.textMuted}
                value={skillInput}
                onChangeText={setSkillInput}
                onSubmitEditing={addSkill}
                returnKeyType="done"
              />
              <AnimatedPressable style={styles.addSkillBtn} onPress={addSkill}>
                <Text style={styles.addSkillBtnText}>Add</Text>
              </AnimatedPressable>
            </View>
            {skills.length > 0 && (
              <View style={styles.chipsRow}>
                {skills.map(skill => (
                  <SkillChip key={skill} label={skill} onRemove={() => removeSkill(skill)} />
                ))}
              </View>
            )}

            <AnimatedPressable
              style={[styles.primaryBtn, genLoading && styles.primaryBtnDisabled]}
              onPress={handleGenerate}
              disabled={genLoading}
            >
              {genLoading
                ? <ActivityIndicator color="#000" size="small" />
                : <Text style={styles.primaryBtnText}>Generate CV</Text>
              }
            </AnimatedPressable>

            {genResult && (
              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>Your Generated CV</Text>
                  <View style={styles.actionBtnsRow}>
                    <AnimatedPressable
                      style={[styles.copyBtn, genDownloading && styles.copyBtnDisabled]}
                      onPress={handleGenDownloadPdf}
                      disabled={genDownloading}
                    >
                      {genDownloading
                        ? <ActivityIndicator size="small" color={COLORS.accent} style={{ width: 14, height: 14 }} />
                        : <Download size={14} color={COLORS.accent} />
                      }
                      <Text style={styles.copyBtnText}>PDF</Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                      style={[styles.copyBtn, genCopied && styles.copyBtnSuccess]}
                      onPress={() => copyToClipboard(genResult.cv_text, 'gen')}
                    >
                      {genCopied
                        ? <CheckCircle size={14} color={COLORS.success} />
                        : <Copy size={14} color={COLORS.accent} />
                      }
                      <Text style={[styles.copyBtnText, genCopied && { color: COLORS.success }]}>
                        {genCopied ? 'Copied!' : 'Copy'}
                      </Text>
                    </AnimatedPressable>
                  </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectionTabsScroll}>
                  <View style={styles.sectionTabs}>
                    {(['summary', 'experience', 'skills', 'achievements'] as CVSection[]).map(s => (
                      <SectionTab
                        key={s}
                        label={s.charAt(0).toUpperCase() + s.slice(1)}
                        active={activeSection === s}
                        onPress={() => { console.log('[CVWriter] Section tab:', s); setActiveSection(s); }}
                      />
                    ))}
                  </View>
                </ScrollView>

                <View style={styles.sectionContent}>
                  <Text style={styles.sectionContentText} selectable>
                    {sectionContent?.[activeSection] || genResult.cv_text}
                  </Text>
                </View>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Upload CV File button */}
            <AnimatedPressable
              style={[styles.uploadFileBtn, uploadingFile && styles.primaryBtnDisabled]}
              onPress={handleUploadFile}
              disabled={uploadingFile}
            >
              {uploadingFile ? (
                <>
                  <ActivityIndicator color={COLORS.accent} size="small" />
                  <Text style={styles.uploadFileBtnText}>Parsing CV…</Text>
                </>
              ) : (
                <>
                  <Upload size={16} color={COLORS.accent} />
                  <Text style={styles.uploadFileBtnText}>Upload CV File</Text>
                </>
              )}
            </AnimatedPressable>

            <Text style={styles.fieldLabel}>Paste Your CV</Text>
            <TextInput
              style={[styles.input, styles.textareaLarge]}
              placeholder="Paste your CV here or upload a file above..."
              placeholderTextColor={COLORS.textMuted}
              value={impCV}
              onChangeText={setImpCV}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>Target Role</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Product Manager"
              placeholderTextColor={COLORS.textMuted}
              value={impRole}
              onChangeText={setImpRole}
            />

            <Text style={styles.fieldLabel}>Focus Areas</Text>
            <View style={styles.chipsRow}>
              {FOCUS_AREAS.map(fa => (
                <FocusChip
                  key={fa.value}
                  label={fa.label}
                  selected={focusAreas.includes(fa.value)}
                  onPress={() => toggleFocusArea(fa.value)}
                />
              ))}
            </View>

            <AnimatedPressable
              style={[styles.primaryBtn, impLoading && styles.primaryBtnDisabled]}
              onPress={handleImprove}
              disabled={impLoading}
            >
              {impLoading
                ? <ActivityIndicator color="#000" size="small" />
                : <Text style={styles.primaryBtnText}>Improve My CV</Text>
              }
            </AnimatedPressable>

            {impResult && (
              <>
                {/* Score comparison */}
                <View style={styles.scoreCard}>
                  <Text style={styles.resultTitle}>Score Comparison</Text>
                  <View style={styles.scoreArrowRow}>
                    <View style={styles.scoreBox}>
                      <Text style={[styles.scoreNum, { color: scoreBeforeColor }]}>{scoreBefore}</Text>
                      <Text style={styles.scoreBoxLabel}>Before</Text>
                    </View>
                    <Text style={styles.scoreArrow}>→</Text>
                    <View style={styles.scoreBox}>
                      <Text style={[styles.scoreNum, { color: scoreAfterColor }]}>{scoreAfter}</Text>
                      <Text style={styles.scoreBoxLabel}>After</Text>
                    </View>
                  </View>
                  <ScoreBar label="Before" score={scoreBefore} color={scoreBeforeColor} />
                  <ScoreBar label="After" score={scoreAfter} color={scoreAfterColor} />
                </View>

                {/* Suggestions */}
                {impResult.suggestions?.length > 0 && (
                  <View style={styles.suggestionsCard}>
                    <AnimatedPressable
                      style={styles.suggestionsHeader}
                      onPress={() => { console.log('[CVWriter] Toggle suggestions'); setShowSuggestions(v => !v); }}
                    >
                      <Text style={styles.resultTitle}>Suggestions</Text>
                      {showSuggestions
                        ? <ChevronUp size={18} color={COLORS.textSecondary} />
                        : <ChevronDown size={18} color={COLORS.textSecondary} />
                      }
                    </AnimatedPressable>
                    {showSuggestions && impResult.suggestions.map((s, i) => (
                      <View key={i} style={styles.suggestionRow}>
                        <View style={styles.suggestionDot} />
                        <Text style={styles.suggestionText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Improved CV */}
                <View style={styles.resultCard}>
                  <View style={styles.resultHeader}>
                    <Text style={styles.resultTitle}>Improved CV</Text>
                    <View style={styles.actionBtnsRow}>
                      <AnimatedPressable
                        style={[styles.copyBtn, impDownloading && styles.copyBtnDisabled]}
                        onPress={handleImpDownloadPdf}
                        disabled={impDownloading}
                      >
                        {impDownloading
                          ? <ActivityIndicator size="small" color={COLORS.accent} style={{ width: 14, height: 14 }} />
                          : <Download size={14} color={COLORS.accent} />
                        }
                        <Text style={styles.copyBtnText}>PDF</Text>
                      </AnimatedPressable>
                      <AnimatedPressable
                        style={[styles.copyBtn, impCopied && styles.copyBtnSuccess]}
                        onPress={() => copyToClipboard(impResult.improved_cv_text, 'imp')}
                      >
                        {impCopied
                          ? <CheckCircle size={14} color={COLORS.success} />
                          : <Copy size={14} color={COLORS.accent} />
                        }
                        <Text style={[styles.copyBtnText, impCopied && { color: COLORS.success }]}>
                          {impCopied ? 'Copied!' : 'Copy'}
                        </Text>
                      </AnimatedPressable>
                    </View>
                  </View>
                  <View style={styles.sectionContent}>
                    <Text style={styles.sectionContentText} selectable>{impResult.improved_cv_text}</Text>
                  </View>
                </View>
              </>
            )}
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
  modeToggle: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: COLORS.accent },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  modeBtnTextActive: { color: '#000' },
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
  textareaLarge: { height: 160, paddingTop: 13 },
  skillInputRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  addSkillBtn: {
    backgroundColor: COLORS.accentMuted,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  addSkillBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.accent },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.accentDim,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  chipText: { fontSize: 13, fontWeight: '500', color: COLORS.accent },
  chipRemove: { padding: 2 },
  focusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  focusChipSelected: { backgroundColor: COLORS.accentMuted, borderColor: 'rgba(245,158,11,0.4)' },
  focusChipText: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  focusChipTextSelected: { color: COLORS.accent, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
    boxShadow: '0 4px 16px rgba(245,158,11,0.3)',
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },
  uploadFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    borderStyle: 'dashed',
  },
  uploadFileBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.accent },
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
  resultTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  actionBtnsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  copyBtnDisabled: { opacity: 0.5 },
  copyBtnSuccess: { backgroundColor: COLORS.successMuted, borderColor: 'rgba(34,197,94,0.3)' },
  copyBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.accent },
  sectionTabsScroll: { marginBottom: 12 },
  sectionTabs: { flexDirection: 'row', gap: 8 },
  sectionTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTabActive: { backgroundColor: COLORS.accentMuted, borderColor: 'rgba(245,158,11,0.4)' },
  sectionTabText: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  sectionTabTextActive: { color: COLORS.accent, fontWeight: '600' },
  sectionContent: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  sectionContentText: { fontSize: 13, color: COLORS.text, lineHeight: 20 },
  scoreCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  },
  scoreArrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginVertical: 16,
  },
  scoreBox: { alignItems: 'center' },
  scoreNum: { fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  scoreBoxLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  scoreArrow: { fontSize: 24, color: COLORS.textMuted },
  scoreBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  scoreBarLabel: { fontSize: 12, color: COLORS.textSecondary, width: 40 },
  scoreBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreBarFill: { height: '100%', borderRadius: 4 },
  scoreBarValue: { fontSize: 13, fontWeight: '700', width: 28, textAlign: 'right' },
  suggestionsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  },
  suggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  suggestionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  suggestionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
    marginTop: 7,
    flexShrink: 0,
  },
  suggestionText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
});
