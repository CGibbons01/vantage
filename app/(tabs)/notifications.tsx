import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  Alert,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, X, CheckCircle } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { COLORS } from '@/constants/theme';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { PremiumLock } from '@/components/PremiumLock';

const PREFS_KEY = 'notification_prefs';

type Frequency = 'instant' | 'daily' | 'weekly';

interface NotificationPrefs {
  newMatchingJobs: boolean;
  applicationUpdates: boolean;
  interviewReminders: boolean;
  salaryInsights: boolean;
  weeklyDigest: boolean;
  frequency: Frequency;
  keywords: string[];
}

const DEFAULT_PREFS: NotificationPrefs = {
  newMatchingJobs: true,
  applicationUpdates: true,
  interviewReminders: false,
  salaryInsights: false,
  weeklyDigest: true,
  frequency: 'daily',
  keywords: [],
};

const FREQUENCIES: { label: string; value: Frequency }[] = [
  { label: 'Instant', value: 'instant' },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
];

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: COLORS.border, true: COLORS.primaryMuted }}
        thumbColor={value ? COLORS.primaryLight : COLORS.textMuted}
        ios_backgroundColor={COLORS.border}
      />
    </View>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSubscribed } = useSubscription();

  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [keywordInput, setKeywordInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY).then(raw => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setPrefs({ ...DEFAULT_PREFS, ...parsed });
          console.log('[Notifications] Loaded prefs from storage');
        } catch {
          console.warn('[Notifications] Failed to parse stored prefs');
        }
      }
    });
  }, []);

  if (!isSubscribed) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <PremiumLock
          featureName="Job Alerts"
          description="Get instant, daily, or weekly alerts for matching jobs, application updates, and salary insights."
        />
      </View>
    );
  }

  const updatePref = <K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) => {
    console.log('[Notifications] Pref changed:', key, '->', value);
    setPrefs(prev => ({ ...prev, [key]: value }));
  };

  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    if (!trimmed) return;
    const newKws = trimmed.split(',').map(k => k.trim()).filter(Boolean);
    console.log('[Notifications] Adding keywords:', newKws);
    setPrefs(prev => ({
      ...prev,
      keywords: [...prev.keywords, ...newKws.filter(k => !prev.keywords.includes(k))],
    }));
    setKeywordInput('');
  };

  const removeKeyword = (kw: string) => {
    console.log('[Notifications] Removing keyword:', kw);
    setPrefs(prev => ({ ...prev, keywords: prev.keywords.filter(k => k !== kw) }));
  };

  const handleSave = async () => {
    console.log('[Notifications] Save preferences pressed');
    setSaving(true);
    try {
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      console.log('[Notifications] Preferences saved successfully');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error('[Notifications] Save error:', e);
      Alert.alert('Save failed', 'Could not save your preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => { console.log('[Notifications] Back button pressed'); router.replace('/(tabs)/(home)'); }}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
        <View style={styles.headerIconCircle}>
          <Bell size={20} color={COLORS.primaryLight} />
        </View>
        <Text style={styles.headerTitle}>Job Alerts</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Alert Preferences */}
        <Text style={styles.sectionTitle}>Alert Preferences</Text>
        <View style={styles.card}>
          <ToggleRow
            label="New matching jobs"
            value={prefs.newMatchingJobs}
            onValueChange={v => updatePref('newMatchingJobs', v)}
          />
          <View style={styles.divider} />
          <ToggleRow
            label="Application status updates"
            value={prefs.applicationUpdates}
            onValueChange={v => updatePref('applicationUpdates', v)}
          />
          <View style={styles.divider} />
          <ToggleRow
            label="Interview reminders"
            value={prefs.interviewReminders}
            onValueChange={v => updatePref('interviewReminders', v)}
          />
          <View style={styles.divider} />
          <ToggleRow
            label="Salary insights"
            value={prefs.salaryInsights}
            onValueChange={v => updatePref('salaryInsights', v)}
          />
          <View style={styles.divider} />
          <ToggleRow
            label="Weekly job digest"
            value={prefs.weeklyDigest}
            onValueChange={v => updatePref('weeklyDigest', v)}
          />
        </View>

        {/* Alert Frequency */}
        <Text style={styles.sectionTitle}>Alert Frequency</Text>
        <View style={styles.frequencyRow}>
          {FREQUENCIES.map(f => (
            <AnimatedPressable
              key={f.value}
              style={[styles.freqBtn, prefs.frequency === f.value && styles.freqBtnActive]}
              onPress={() => { console.log('[Notifications] Frequency selected:', f.value); updatePref('frequency', f.value); }}
            >
              <Text style={[styles.freqBtnText, prefs.frequency === f.value && styles.freqBtnTextActive]}>
                {f.label}
              </Text>
            </AnimatedPressable>
          ))}
        </View>

        {/* Job Keywords */}
        <Text style={styles.sectionTitle}>Job Keywords</Text>
        <View style={styles.keywordInputRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="React Native, Senior Developer..."
            placeholderTextColor={COLORS.textMuted}
            value={keywordInput}
            onChangeText={setKeywordInput}
            onSubmitEditing={addKeyword}
            returnKeyType="done"
          />
          <AnimatedPressable style={styles.addBtn} onPress={addKeyword}>
            <Text style={styles.addBtnText}>Add</Text>
          </AnimatedPressable>
        </View>
        {prefs.keywords.length > 0 && (
          <View style={styles.chipsRow}>
            {prefs.keywords.map(kw => (
              <View key={kw} style={styles.chip}>
                <Text style={styles.chipText}>{kw}</Text>
                <AnimatedPressable
                  onPress={() => removeKeyword(kw)}
                  style={styles.chipRemove}
                  accessibilityLabel={`Remove ${kw}`}
                >
                  <X size={12} color={COLORS.primaryLight} />
                </AnimatedPressable>
              </View>
            ))}
          </View>
        )}

        {/* Save Button */}
        <AnimatedPressable
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <LinearGradient
            colors={['#7C3AED', '#4F46E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtnGradient}
          >
            {saved ? (
              <>
                <CheckCircle size={18} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>Preferences saved!</Text>
              </>
            ) : (
              <Text style={styles.saveBtnText}>Save Preferences</Text>
            )}
          </LinearGradient>
        </AnimatedPressable>
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
  backBtn: {
    marginRight: 4,
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
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 20,
  },
  card: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  toggleLabel: { fontSize: 15, color: COLORS.text, fontWeight: '500', flex: 1 },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginHorizontal: 16 },
  frequencyRow: { flexDirection: 'row', gap: 10 },
  freqBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  freqBtnActive: { backgroundColor: COLORS.primaryMuted, borderColor: COLORS.primary },
  freqBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  freqBtnTextActive: { color: COLORS.primaryLight },
  keywordInputRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  input: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addBtn: {
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.primaryLight },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
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
  saveBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 28,
  },
  saveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
