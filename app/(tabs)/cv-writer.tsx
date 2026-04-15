import React, { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileText, Copy, CheckCircle, X, Upload, Save, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { COLORS } from '@/constants/theme';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { PremiumLock } from '@/components/PremiumLock';
import { authenticatedPut, authenticatedPost } from '@/utils/api';
import * as FS from 'expo-file-system/legacy';
import * as fflate from 'fflate';

const USER_CV_KEY = 'user_cv_text';

type Mode = 'generate' | 'upload';
type CVSection = 'summary' | 'experience' | 'skills' | 'achievements';

// --- Regex helpers for auto-population ---
const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;
const SECTION_HEADER_REGEX = /^(summary|profile|about|experience|employment|work|education|skills|achievements|contact|references|objective|qualifications)/i;

function detectNameFromText(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 6)) {
    // Skip lines that look like section headers, emails, phone numbers, URLs
    if (SECTION_HEADER_REGEX.test(line)) break;
    if (EMAIL_REGEX.test(line)) continue;
    if (/\d{4,}/.test(line)) continue; // phone numbers / years
    if (/https?:\/\/|www\.|linkedin\.com/i.test(line)) continue;
    if (/[,|•·@]/.test(line)) continue; // address lines, combined fields
    // A name is typically 2-4 words, each capitalised, under 50 chars
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 5 && line.length < 50) {
      const looksLikeName = words.every(w => /^[A-Z][a-zA-Z'-]+$/.test(w));
      if (looksLikeName) return line;
    }
  }
  return '';
}

function detectEmailFromText(text: string): string {
  const match = text.match(EMAIL_REGEX);
  return match ? match[0] : '';
}

function parseCVText(text: string): {
  summary: string;
  skills: string[];
  headline: string;
} {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let summary = '';
  const summaryHeadingIdx = lines.findIndex(l =>
    /^(professional\s+)?summary|profile|about\s*me?$/i.test(l)
  );
  if (summaryHeadingIdx !== -1) {
    const summaryLines: string[] = [];
    for (let i = summaryHeadingIdx + 1; i < lines.length && i < summaryHeadingIdx + 6; i++) {
      if (/^(experience|education|skills|achievements|employment|work)/i.test(lines[i])) break;
      summaryLines.push(lines[i]);
    }
    summary = summaryLines.join(' ').trim();
  }

  let skills: string[] = [];
  const skillsHeadingIdx = lines.findIndex(l => /^(key\s+)?skills(\s+&\s+\w+)?$/i.test(l));
  if (skillsHeadingIdx !== -1) {
    const skillLines: string[] = [];
    for (let i = skillsHeadingIdx + 1; i < lines.length && i < skillsHeadingIdx + 8; i++) {
      if (/^(experience|education|summary|achievements|employment|work)/i.test(lines[i])) break;
      skillLines.push(lines[i]);
    }
    const raw = skillLines.join(', ');
    skills = raw
      .split(/[,•|·\n]/)
      .map(s => s.replace(/^[-–—*]\s*/, '').trim())
      .filter(s => s.length > 1 && s.length < 50);
  }

  let headline = '';
  const titlePatterns = /\b(engineer|developer|manager|analyst|designer|consultant|director|lead|architect|specialist|coordinator|executive|officer)\b/i;
  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    if (titlePatterns.test(lines[i]) && lines[i].length < 80) {
      headline = lines[i];
      break;
    }
  }

  return { summary, skills, headline };
}

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

function SkillChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
      <AnimatedPressable onPress={onRemove} style={styles.chipRemove}>
        <X size={12} color={COLORS.primaryLight} />
      </AnimatedPressable>
    </View>
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

// Local CV generation — formats user input into a structured CV text
function generateCVLocally(params: {
  name: string;
  email: string;
  targetRole: string;
  summary: string;
  experience: { title: string; company: string; duration: string; description: string }[];
  education: { degree: string; institution: string; year: string }[];
  skills: string[];
}): GenerateResult {
  const { name, email, targetRole, summary, experience, education, skills } = params;

  const summarySection = summary.trim()
    ? summary.trim()
    : `Experienced professional seeking a ${targetRole} role. Committed to delivering high-quality results and contributing to team success.`;

  const experienceLines = experience
    .filter(e => e.title.trim() || e.company.trim())
    .map(e => {
      const lines = [`${e.title || 'Role'} — ${e.company || 'Company'}${e.duration ? ` (${e.duration})` : ''}`];
      if (e.description.trim()) lines.push(e.description.trim());
      return lines.join('\n');
    });

  const educationLines = education
    .filter(e => e.degree.trim() || e.institution.trim())
    .map(e => `${e.degree || 'Degree'} — ${e.institution || 'Institution'}${e.year ? ` (${e.year})` : ''}`);

  const experienceSection = experienceLines.length > 0
    ? experienceLines.join('\n\n')
    : 'Please add your work experience.';

  const educationSection = educationLines.length > 0
    ? educationLines.join('\n')
    : 'Please add your education.';

  const skillsSection = skills.length > 0
    ? skills.join(' • ')
    : 'Please add your skills.';

  const cvText = [
    `${name.toUpperCase()}`,
    `${email}`,
    '',
    `TARGET ROLE: ${targetRole}`,
    '',
    '─────────────────────────────────',
    'PROFESSIONAL SUMMARY',
    '─────────────────────────────────',
    summarySection,
    '',
    '─────────────────────────────────',
    'EXPERIENCE',
    '─────────────────────────────────',
    experienceSection,
    '',
    '─────────────────────────────────',
    'EDUCATION',
    '─────────────────────────────────',
    educationSection,
    '',
    '─────────────────────────────────',
    'SKILLS',
    '─────────────────────────────────',
    skillsSection,
  ].join('\n');

  return {
    cv_text: cvText,
    sections: {
      professional_summary: summarySection,
      experience: experienceSection,
      education: educationSection,
      skills: skillsSection,
      achievements: '',
    },
  };
}

export default function CVWriterScreen() {
  const insets = useSafeAreaInsets();
  const { isSubscribed } = useSubscription();

  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [mode, setMode] = useState<Mode>(tab === 'upload' ? 'upload' : 'generate');

  // Generate mode state
  const [genName, setGenName] = useState('');
  const [genEmail, setGenEmail] = useState('');
  const [genRole, setGenRole] = useState('');
  const [genSummary, setGenSummary] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);

  // Experience entries
  const [experienceEntries, setExperienceEntries] = useState([
    { title: '', company: '', duration: '', description: '' },
  ]);

  // Education entries
  const [educationEntries, setEducationEntries] = useState([
    { degree: '', institution: '', year: '' },
  ]);
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState<GenerateResult | null>(null);
  const [activeSection, setActiveSection] = useState<CVSection>('summary');
  const [genCopied, setGenCopied] = useState(false);

  // Upload mode state
  const [impCV, setImpCV] = useState('');
  const [savingCV, setSavingCV] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Parsed CV panel state
  const [parsedText, setParsedText] = useState('');
  const [parsedPanelExpanded, setParsedPanelExpanded] = useState(true);
  const [parsedCopied, setParsedCopied] = useState(false);

  if (!isSubscribed) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <PremiumLock
          featureName="AI CV Writer"
          description="Generate a polished, ATS-optimised CV or improve your existing one with AI-powered suggestions."
        />
      </View>
    );
  }

  // Experience helpers
  const addExperience = () => {
    console.log('[CVWriter] Add experience entry');
    setExperienceEntries(prev => [...prev, { title: '', company: '', duration: '', description: '' }]);
  };
  const removeExperience = (index: number) => {
    console.log('[CVWriter] Remove experience entry at index:', index);
    setExperienceEntries(prev => prev.filter((_, i) => i !== index));
  };
  const updateExperience = (index: number, field: string, value: string) => {
    setExperienceEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  };

  // Education helpers
  const addEducation = () => {
    console.log('[CVWriter] Add education entry');
    setEducationEntries(prev => [...prev, { degree: '', institution: '', year: '' }]);
  };
  const removeEducation = (index: number) => {
    console.log('[CVWriter] Remove education entry at index:', index);
    setEducationEntries(prev => prev.filter((_, i) => i !== index));
  };
  const updateEducation = (index: number, field: string, value: string) => {
    setEducationEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  };

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

  const handleGenerate = async () => {
    if (!genName.trim() || !genEmail.trim() || !genRole.trim()) {
      Alert.alert('Missing fields', 'Please fill in your name, email, and target role.');
      return;
    }
    console.log('[CVWriter] Generate CV pressed - role:', genRole, 'skills:', skills.length);
    setGenLoading(true);
    setGenResult(null);
    try {
      console.log('[CVWriter] POST /api/generate-cv-content');
      const result = await authenticatedPost<GenerateResult>('/api/generate-cv-content', {
        name: genName.trim(),
        email: genEmail.trim(),
        targetRole: genRole.trim(),
        summary: genSummary.trim(),
        experience: experienceEntries,
        education: educationEntries,
        skills,
      });
      console.log('[CVWriter] AI CV generated successfully');
      setGenResult(result);
      await AsyncStorage.setItem(USER_CV_KEY, result.cv_text);
      console.log('[CVWriter] Saved AI-generated CV to AsyncStorage');
    } catch (e: any) {
      console.error('[CVWriter] AI generate error, falling back to local:', e);
      try {
        const result = generateCVLocally({
          name: genName.trim(),
          email: genEmail.trim(),
          targetRole: genRole.trim(),
          summary: genSummary.trim(),
          experience: experienceEntries,
          education: educationEntries,
          skills,
        });
        console.log('[CVWriter] CV generated locally (fallback)');
        setGenResult({
          ...result,
          sections: {
            ...result.sections,
            professional_summary: (result.sections.professional_summary || '') +
              '\n\n⚠ Generated offline — connect to internet for AI-enhanced CV.',
          },
        });
        await AsyncStorage.setItem(USER_CV_KEY, result.cv_text);
        console.log('[CVWriter] Saved fallback CV to AsyncStorage');
      } catch (fallbackErr: any) {
        console.error('[CVWriter] Fallback generate error:', fallbackErr);
        Alert.alert('Generation failed', fallbackErr?.message || 'Could not generate your CV. Please try again.');
      }
    } finally {
      setGenLoading(false);
    }
  };

  const handleClearGenerate = () => {
    console.log('[CVWriter] Clear generate form pressed');
    setGenName('');
    setGenEmail('');
    setGenRole('');
    setGenSummary('');
    setSkills([]);
    setSkillInput('');
    setExperienceEntries([{ title: '', company: '', duration: '', description: '' }]);
    setEducationEntries([{ degree: '', institution: '', year: '' }]);
    setGenResult(null);
  };

  const handleSaveCV = async () => {
    if (!impCV.trim()) {
      Alert.alert('No CV text', 'Please paste your CV text or upload a .txt file first.');
      return;
    }
    console.log('[CVWriter] Save CV pressed, text length:', impCV.trim().length);
    setSavingCV(true);
    try {
      const parsed = parseCVText(impCV.trim());
      console.log('[CVWriter] Parsed CV — headline:', parsed.headline, 'skills:', parsed.skills.length, 'summary length:', parsed.summary.length);

      await AsyncStorage.setItem(USER_CV_KEY, impCV.trim());
      console.log('[CVWriter] Raw CV saved to AsyncStorage');

      const profilePayload: Record<string, any> = {};
      if (parsed.summary) profilePayload.summary = parsed.summary;
      if (parsed.skills.length > 0) profilePayload.skills = parsed.skills;
      if (parsed.headline) profilePayload.headline = parsed.headline;

      if (Object.keys(profilePayload).length > 0) {
        await authenticatedPut('/api/profile', profilePayload);
        console.log('[CVWriter] Profile updated with parsed CV data');
      }

      const skillCount = parsed.skills.length;
      const hasSummary = !!parsed.summary;
      const skillWord = skillCount !== 1 ? 'skills' : 'skill';
      const detailMsg = skillCount > 0 || hasSummary
        ? `Your CV has been saved and your profile has been updated with ${skillCount} ${skillWord}${hasSummary ? ' and a summary' : ''}.`
        : 'Your CV has been saved. You can edit your profile to add more details.';

      Alert.alert('CV Saved', detailMsg, [{ text: 'Done' }]);
    } catch (e: any) {
      console.error('[CVWriter] Save CV error:', e);
      Alert.alert('Save Failed', e?.message || 'Could not save your CV. Please try again.');
    } finally {
      setSavingCV(false);
    }
  };

  const handleClearUpload = () => {
    console.log('[CVWriter] Clear upload pressed');
    setImpCV('');
    setParsedText('');
  };

  // Called after text is extracted from a file — auto-populates fields and shows parsed panel
  const handleExtractedText = (text: string) => {
    setImpCV(text);
    setParsedText(text);
    setParsedPanelExpanded(true);

    // Auto-populate Name if empty
    if (!genName.trim()) {
      const detectedName = detectNameFromText(text);
      if (detectedName) {
        console.log('[CVWriter] Auto-populated name from CV:', detectedName);
        setGenName(detectedName);
      }
    }

    // Auto-populate Email if empty
    if (!genEmail.trim()) {
      const detectedEmail = detectEmailFromText(text);
      if (detectedEmail) {
        console.log('[CVWriter] Auto-populated email from CV:', detectedEmail);
        setGenEmail(detectedEmail);
      }
    }
  };

  const handleUploadFile = async () => {
    console.log('[CVWriter] Upload CV file pressed');
    let pickerResult: DocumentPicker.DocumentPickerResult | null = null;
    try {
      pickerResult = await DocumentPicker.getDocumentAsync({
        type: [
          'text/plain',
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

    const assetName = asset.name || 'cv';
    const assetMime = asset.mimeType || '';
    console.log('[CVWriter] File selected:', assetName, 'mime:', assetMime, 'size:', asset.size);
    setUploadingFile(true);

    try {
      if (assetName.toLowerCase().endsWith('.txt')) {
        // Plain text — read directly, no backend needed
        const text = await FS.readAsStringAsync(asset.uri, { encoding: 'utf8' as any });
        console.log('[CVWriter] TXT file read, length:', text.length);
        handleExtractedText(text);
        Alert.alert('CV Loaded', 'Your CV text has been loaded. Fields have been pre-filled where possible — review below and tap Save to Profile.');
        return;
      }

      // DOCX — parse on-device using fflate
      const isPdf = assetName.toLowerCase().endsWith('.pdf') || assetMime === 'application/pdf';
      const isDocx =
        assetName.toLowerCase().endsWith('.docx') ||
        assetMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      if (!isPdf && !isDocx) {
        Alert.alert('Unsupported File', 'Please upload a Word document (.docx) or plain text (.txt) file. Old .doc format is not supported.');
        return;
      }

      if (isPdf) {
        Alert.alert('PDF Not Supported', 'PDF parsing is not supported. Please upload a .docx or .txt file instead.');
        return;
      }

      console.log('[CVWriter] Reading DOCX file as base64 for on-device parsing');
      const base64 = await FS.readAsStringAsync(asset.uri, { encoding: 'base64' as any });

      // Decode base64 → Uint8Array
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // Unzip the DOCX (it's a ZIP archive)
      const unzipped = fflate.unzipSync(bytes);

      // Extract word/document.xml
      const xmlBytes = unzipped['word/document.xml'];
      if (!xmlBytes) throw new Error('Not a valid Word document. Please try saving as .docx and uploading again.');

      // Decode XML to string
      const xmlStr = new TextDecoder().decode(xmlBytes);

      // Strip XML tags to get plain text
      const text = xmlStr
        .replace(/<w:p[ >]/g, '\n<w:p ')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (!text) throw new Error('No text could be extracted from the document.');

      console.log('[CVWriter] DOCX parsed on-device, text length:', text.length);
      handleExtractedText(text);
      Alert.alert('CV Loaded', 'Your CV has been extracted. Fields have been pre-filled where possible — review below and tap Save to Profile.');
    } catch (e: any) {
      console.error('[CVWriter] File upload/parse error:', e);
      const msg = e?.message || 'Could not read the file.';
      Alert.alert(
        'Upload Failed',
        msg.includes('image-based') || msg.includes('password') || msg.includes('.doc format')
          ? msg
          : `${msg}\n\nYou can also paste your CV text manually in the field below.`
      );
    } finally {
      setUploadingFile(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'gen' | 'imp') => {
    console.log('[CVWriter] Copy to clipboard pressed, type:', type);
    await Clipboard.setStringAsync(text);
    if (type === 'gen') {
      setGenCopied(true);
      setTimeout(() => setGenCopied(false), 2000);
    }
    Alert.alert('Copied!', 'Copied to clipboard. You can paste this into a Word document or Google Docs.');
  };

  const handleGenCopyAndExport = async () => {
    if (!genResult?.cv_text) return;
    console.log('[CVWriter] Export/copy CV pressed');
    await copyToClipboard(genResult.cv_text, 'gen');
  };

  const handleCopyParsedText = async () => {
    if (!parsedText) return;
    console.log('[CVWriter] Copy parsed CV text pressed, length:', parsedText.length);
    await Clipboard.setStringAsync(parsedText);
    setParsedCopied(true);
    setTimeout(() => setParsedCopied(false), 2000);
  };

  const sectionContent = genResult ? {
    summary: genResult.sections?.professional_summary || '',
    experience: genResult.sections?.experience || '',
    skills: genResult.sections?.skills || '',
    achievements: genResult.sections?.achievements || '',
  } : null;

  const parsedPanelChevron = parsedPanelExpanded ? (
    <ChevronUp size={16} color={COLORS.textSecondary} />
  ) : (
    <ChevronDown size={16} color={COLORS.textSecondary} />
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIconCircle}>
          <FileText size={20} color={COLORS.primaryLight} />
        </View>
        <Text style={styles.headerTitle}>AI CV Writer</Text>
      </View>

      {/* Mode toggle */}
      <View style={styles.modeToggle}>
        <Pressable
          style={[styles.modeBtn, mode === 'generate' && styles.modeBtnActive]}
          onPress={() => { console.log('[CVWriter] Mode toggle: generate'); setMode('generate'); }}
        >
          {mode === 'generate' ? (
            <LinearGradient
              colors={['#7C3AED', '#4F46E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.modeBtnGradient}
            >
              <Text style={[styles.modeBtnText, styles.modeBtnTextActive]}>Generate CV</Text>
            </LinearGradient>
          ) : (
            <View style={styles.modeBtnInner}>
              <Text style={styles.modeBtnText}>Generate CV</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          style={[styles.modeBtn, mode === 'upload' && styles.modeBtnActive]}
          onPress={() => { console.log('[CVWriter] Mode toggle: upload'); setMode('upload'); }}
        >
          {mode === 'upload' ? (
            <LinearGradient
              colors={['#7C3AED', '#4F46E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.modeBtnGradient}
            >
              <Text style={[styles.modeBtnText, styles.modeBtnTextActive]}>Upload CV</Text>
            </LinearGradient>
          ) : (
            <View style={styles.modeBtnInner}>
              <Text style={styles.modeBtnText}>Upload CV</Text>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {mode === 'generate' ? (
          <>
            {/* Primary action row — Generate first, Clear second */}
            <View style={styles.topActionRow}>
              <AnimatedPressable
                style={[styles.topActionBtn, styles.topActionBtnPrimary, genLoading && styles.topBtnDisabled]}
                onPress={handleGenerate}
                disabled={genLoading}
              >
                {genLoading ? (
                  <>
                    <ActivityIndicator color="#FFFFFF" size="small" style={{ width: 15, height: 15 }} />
                    <Text style={[styles.topActionBtnText, { color: '#FFFFFF' }]}>Generating with AI…</Text>
                  </>
                ) : (
                  <>
                    <FileText size={15} color="#FFFFFF" />
                    <Text style={[styles.topActionBtnText, { color: '#FFFFFF' }]}>Generate CV</Text>
                  </>
                )}
              </AnimatedPressable>

              <AnimatedPressable
                style={styles.topActionBtn}
                onPress={handleClearGenerate}
              >
                <X size={15} color={COLORS.textSecondary} />
                <Text style={styles.topActionBtnText}>Clear</Text>
              </AnimatedPressable>
            </View>

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

            {/* Experience Section */}
            <Text style={styles.sectionHeading}>Experience</Text>
            {experienceEntries.map((entry, index) => {
              const isFirst = index === 0;
              return (
                <View key={index} style={styles.entryCard}>
                  {!isFirst && (
                    <AnimatedPressable
                      style={styles.entryRemoveBtn}
                      onPress={() => removeExperience(index)}
                    >
                      <X size={14} color={COLORS.textMuted} />
                    </AnimatedPressable>
                  )}
                  <Text style={styles.fieldLabel}>Job Title</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Senior Software Engineer"
                    placeholderTextColor={COLORS.textMuted}
                    value={entry.title}
                    onChangeText={v => updateExperience(index, 'title', v)}
                  />
                  <Text style={styles.fieldLabel}>Company</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Acme Corp"
                    placeholderTextColor={COLORS.textMuted}
                    value={entry.company}
                    onChangeText={v => updateExperience(index, 'company', v)}
                  />
                  <Text style={styles.fieldLabel}>Duration</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Jan 2020 – Mar 2023"
                    placeholderTextColor={COLORS.textMuted}
                    value={entry.duration}
                    onChangeText={v => updateExperience(index, 'duration', v)}
                  />
                  <Text style={styles.fieldLabel}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.textareaSmall]}
                    placeholder="Key responsibilities and achievements..."
                    placeholderTextColor={COLORS.textMuted}
                    value={entry.description}
                    onChangeText={v => updateExperience(index, 'description', v)}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              );
            })}
            <AnimatedPressable style={styles.addEntryBtn} onPress={addExperience}>
              <Text style={styles.addEntryBtnText}>+ Add Experience</Text>
            </AnimatedPressable>

            {/* Education Section */}
            <Text style={styles.sectionHeading}>Education</Text>
            {educationEntries.map((entry, index) => {
              const isFirst = index === 0;
              return (
                <View key={index} style={styles.entryCard}>
                  {!isFirst && (
                    <AnimatedPressable
                      style={styles.entryRemoveBtn}
                      onPress={() => removeEducation(index)}
                    >
                      <X size={14} color={COLORS.textMuted} />
                    </AnimatedPressable>
                  )}
                  <Text style={styles.fieldLabel}>Degree</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. BSc Computer Science"
                    placeholderTextColor={COLORS.textMuted}
                    value={entry.degree}
                    onChangeText={v => updateEducation(index, 'degree', v)}
                  />
                  <Text style={styles.fieldLabel}>Institution</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. University of Manchester"
                    placeholderTextColor={COLORS.textMuted}
                    value={entry.institution}
                    onChangeText={v => updateEducation(index, 'institution', v)}
                  />
                  <Text style={styles.fieldLabel}>Year</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 2019"
                    placeholderTextColor={COLORS.textMuted}
                    value={entry.year}
                    onChangeText={v => updateEducation(index, 'year', v)}
                    keyboardType="numeric"
                  />
                </View>
              );
            })}
            <AnimatedPressable style={styles.addEntryBtn} onPress={addEducation}>
              <Text style={styles.addEntryBtnText}>+ Add Education</Text>
            </AnimatedPressable>

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

            {/* Bottom Generate button (duplicate for convenience after long form) */}
            <AnimatedPressable
              style={[styles.primaryBtn, genLoading && styles.primaryBtnDisabled]}
              onPress={handleGenerate}
              disabled={genLoading}
            >
              <LinearGradient
                colors={['#7C3AED', '#4F46E5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryBtnGradient}
              >
                {genLoading
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <Text style={styles.primaryBtnText}>Generate CV</Text>
                }
              </LinearGradient>
            </AnimatedPressable>

            {genResult && (
              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>Your Generated CV</Text>
                  <AnimatedPressable
                    style={[styles.copyBtn, genCopied && styles.copyBtnSuccess]}
                    onPress={handleGenCopyAndExport}
                  >
                    {genCopied
                      ? <CheckCircle size={14} color={COLORS.success} />
                      : <Copy size={14} color={COLORS.primaryLight} />
                    }
                    <Text style={[styles.copyBtnText, genCopied && { color: COLORS.success }]}>
                      {genCopied ? 'Copied!' : 'Copy'}
                    </Text>
                  </AnimatedPressable>
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
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>
                {"Paste or upload your CV below. We'll extract your skills, summary, and headline to update your profile, and pre-fill your name and email in the CV Writer."}
              </Text>
            </View>

            {/* Primary action row — Upload first, Save second, Clear third */}
            <View style={styles.topActionRow}>
              <AnimatedPressable
                style={[styles.topActionBtn, uploadingFile && styles.topBtnDisabled]}
                onPress={handleUploadFile}
                disabled={uploadingFile}
              >
                {uploadingFile ? (
                  <ActivityIndicator color={COLORS.primaryLight} size="small" style={{ width: 15, height: 15 }} />
                ) : (
                  <Upload size={15} color={COLORS.primaryLight} />
                )}
                <Text style={[styles.topActionBtnText, { color: COLORS.primaryLight }]}>
                  {uploadingFile ? 'Reading…' : 'Upload File'}
                </Text>
              </AnimatedPressable>

              <AnimatedPressable
                style={[styles.topActionBtn, styles.topActionBtnPrimary, savingCV && styles.topBtnDisabled]}
                onPress={handleSaveCV}
                disabled={savingCV}
              >
                {savingCV ? (
                  <ActivityIndicator color="#FFFFFF" size="small" style={{ width: 15, height: 15 }} />
                ) : (
                  <Save size={15} color="#FFFFFF" />
                )}
                <Text style={[styles.topActionBtnText, { color: '#FFFFFF' }]}>
                  {savingCV ? 'Saving…' : 'Save to Profile'}
                </Text>
              </AnimatedPressable>

              <AnimatedPressable
                style={styles.topActionBtn}
                onPress={handleClearUpload}
              >
                <X size={15} color={COLORS.textSecondary} />
                <Text style={styles.topActionBtnText}>Clear</Text>
              </AnimatedPressable>
            </View>

            <Text style={styles.fieldLabel}>Paste Your CV</Text>
            <TextInput
              style={[styles.input, styles.textareaLarge]}
              placeholder="Paste your CV here or upload a .docx / .txt file above..."
              placeholderTextColor={COLORS.textMuted}
              value={impCV}
              onChangeText={text => {
                setImpCV(text);
                // When user manually pastes text, also populate the parsed panel
                if (text.length > 50) {
                  setParsedText(text);
                  setParsedPanelExpanded(true);
                }
              }}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />

            {/* Parsed CV Text Panel */}
            {parsedText.length > 0 && (
              <View style={styles.parsedPanel}>
                <AnimatedPressable
                  style={styles.parsedPanelHeader}
                  onPress={() => {
                    console.log('[CVWriter] Toggle parsed CV panel, expanded:', !parsedPanelExpanded);
                    setParsedPanelExpanded(prev => !prev);
                  }}
                >
                  <View style={styles.parsedPanelHeaderLeft}>
                    <FileText size={14} color={COLORS.textSecondary} />
                    <Text style={styles.parsedPanelTitle}>Parsed CV Text</Text>
                    <Text style={styles.parsedPanelSubtitle}>— copy &amp; paste into fields above</Text>
                  </View>
                  <View style={styles.parsedPanelHeaderRight}>
                    <AnimatedPressable
                      style={[styles.parsedCopyBtn, parsedCopied && styles.parsedCopyBtnSuccess]}
                      onPress={handleCopyParsedText}
                    >
                      {parsedCopied ? (
                        <CheckCircle size={13} color={COLORS.success} />
                      ) : (
                        <Copy size={13} color={COLORS.primaryLight} />
                      )}
                      <Text style={[styles.parsedCopyBtnText, parsedCopied && { color: COLORS.success }]}>
                        {parsedCopied ? 'Copied!' : 'Copy All'}
                      </Text>
                    </AnimatedPressable>
                    {parsedPanelChevron}
                  </View>
                </AnimatedPressable>

                {parsedPanelExpanded && (
                  <ScrollView
                    style={styles.parsedTextScroll}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                  >
                    <Text style={styles.parsedText} selectable>
                      {parsedText}
                    </Text>
                  </ScrollView>
                )}
              </View>
            )}

            {/* Bottom Save button (convenience duplicate) */}
            <AnimatedPressable
              style={[styles.primaryBtn, savingCV && styles.primaryBtnDisabled]}
              onPress={handleSaveCV}
              disabled={savingCV}
            >
              <LinearGradient
                colors={['#7C3AED', '#4F46E5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryBtnGradient}
              >
                {savingCV
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <Text style={styles.primaryBtnText}>Save to Profile</Text>
                }
              </LinearGradient>
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
    backgroundColor: COLORS.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, letterSpacing: -0.4 },
  modeToggle: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeBtn: {
    flex: 1,
    borderRadius: 9,
    alignItems: 'center',
    overflow: 'hidden',
  },
  modeBtnInner: {
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeBtnActive: {},
  modeBtnGradient: {
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  modeBtnTextActive: { color: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },

  // Top action row — all buttons equal width, wrapping
  topActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  topActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
    minWidth: 90,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  topActionBtnPrimary: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  topActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  topBtnDisabled: { opacity: 0.6 },

  infoBox: {
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoBoxText: { fontSize: 13, color: COLORS.primaryLight, lineHeight: 19 },
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
  textareaSmall: { height: 76, paddingTop: 13 },
  textareaLarge: { height: 160, paddingTop: 13 },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  entryCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  entryRemoveBtn: {
    alignSelf: 'flex-end',
    padding: 4,
    marginBottom: 4,
    marginTop: -4,
  },
  addEntryBtn: {
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  addEntryBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.primaryLight },
  skillInputRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  addSkillBtn: {
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addSkillBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.primaryLight },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipText: { fontSize: 13, fontWeight: '500', color: COLORS.primaryLight },
  chipRemove: { padding: 2 },
  primaryBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 20,
  },
  primaryBtnGradient: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  resultCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  copyBtnSuccess: { backgroundColor: COLORS.successMuted, borderColor: 'rgba(34,197,94,0.3)' },
  copyBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.primaryLight },
  sectionTabsScroll: { marginBottom: 12 },
  sectionTabs: { flexDirection: 'row', gap: 8 },
  sectionTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTabActive: { backgroundColor: COLORS.primaryMuted, borderColor: COLORS.primary },
  sectionTabText: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  sectionTabTextActive: { color: COLORS.primaryLight, fontWeight: '600' },
  sectionContent: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  sectionContentText: { fontSize: 13, color: COLORS.text, lineHeight: 20 },

  // Parsed CV panel
  parsedPanel: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  parsedPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  parsedPanelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    flexWrap: 'wrap',
  },
  parsedPanelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  parsedPanelSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  parsedPanelHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  parsedCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  parsedCopyBtnSuccess: {
    backgroundColor: COLORS.successMuted,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  parsedCopyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primaryLight,
  },
  parsedTextScroll: {
    maxHeight: 240,
  },
  parsedText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    fontFamily: 'Courier',
    padding: 14,
  },

  successBanner: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  successBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.success,
    lineHeight: 18,
  },
});
