import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, X, Check } from 'lucide-react-native';
import { authenticatedGet, authenticatedPut } from '@/utils/api';
import { COLORS } from '@/constants/theme';
import { AnimatedPressable } from '@/components/AnimatedPressable';

interface ProfileForm {
  headline: string;
  summary: string;
  location: string;
  phone: string;
  linkedin_url: string;
  skills: string[];
}

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState<ProfileForm>({
    headline: '',
    summary: '',
    location: '',
    phone: '',
    linkedin_url: '',
    skills: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [error, setError] = useState('');

  const handleSave = useCallback(async () => {
    console.log('[EditProfile] Save pressed');
    setSaving(true);
    setError('');
    try {
      await authenticatedPut('/api/profile', {
        headline: form.headline,
        summary: form.summary,
        location: form.location,
        phone: form.phone,
        linkedin_url: form.linkedin_url,
        skills: form.skills,
      });
      console.log('[EditProfile] Profile saved successfully');
      setShowSuccessModal(true);
    } catch (e: any) {
      console.error('[EditProfile] Save error:', e);
      setError(e?.message || 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [form]);

  const fetchProfile = useCallback(async () => {
    console.log('[EditProfile] Fetching profile for editing');
    try {
      const data = await authenticatedGet<any>('/api/profile');
      setForm({
        headline: data?.headline ?? '',
        summary: data?.summary ?? '',
        location: data?.location ?? '',
        phone: data?.phone ?? '',
        linkedin_url: data?.linkedin_url ?? '',
        skills: Array.isArray(data?.skills) ? data.skills : [],
      });
    } catch (e: any) {
      console.error('[EditProfile] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Set Save button in header
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={{ marginRight: 4, paddingHorizontal: 8, paddingVertical: 4 }}
        >
          {saving
            ? <ActivityIndicator color={COLORS.accent} size="small" />
            : <Text style={{ color: COLORS.accent, fontSize: 16, fontWeight: '700' }}>Save</Text>
          }
        </TouchableOpacity>
      ),
    });
  }, [navigation, saving, handleSave]);

  const addSkill = () => {
    const skill = newSkill.trim();
    if (!skill) return;
    if (form.skills.includes(skill)) {
      setNewSkill('');
      return;
    }
    console.log('[EditProfile] Adding skill:', skill);
    setForm((prev) => ({ ...prev, skills: [...prev.skills, skill] }));
    setNewSkill('');
  };

  const removeSkill = (skill: string) => {
    console.log('[EditProfile] Removing skill:', skill);
    setForm((prev) => ({ ...prev, skills: prev.skills.filter((s) => s !== skill) }));
  };

  const updateField = (field: keyof ProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Headline */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Headline</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Senior Software Engineer"
            placeholderTextColor={COLORS.textMuted}
            value={form.headline}
            onChangeText={(v) => updateField('headline', v)}
            returnKeyType="next"
          />
        </View>

        {/* Summary */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Summary</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Brief professional summary..."
            placeholderTextColor={COLORS.textMuted}
            value={form.summary}
            onChangeText={(v) => updateField('summary', v)}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Location */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Location</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. New York, NY"
            placeholderTextColor={COLORS.textMuted}
            value={form.location}
            onChangeText={(v) => updateField('location', v)}
            returnKeyType="next"
          />
        </View>

        {/* Phone */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Phone</Text>
          <TextInput
            style={styles.input}
            placeholder="+1 (555) 000-0000"
            placeholderTextColor={COLORS.textMuted}
            value={form.phone}
            onChangeText={(v) => updateField('phone', v)}
            keyboardType="phone-pad"
            returnKeyType="next"
          />
        </View>

        {/* LinkedIn */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>LinkedIn URL</Text>
          <TextInput
            style={styles.input}
            placeholder="https://linkedin.com/in/yourprofile"
            placeholderTextColor={COLORS.textMuted}
            value={form.linkedin_url}
            onChangeText={(v) => updateField('linkedin_url', v)}
            keyboardType="url"
            autoCapitalize="none"
            returnKeyType="next"
          />
        </View>

        {/* Skills */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Skills</Text>
          <View style={styles.skillInputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Add a skill..."
              placeholderTextColor={COLORS.textMuted}
              value={newSkill}
              onChangeText={setNewSkill}
              returnKeyType="done"
              onSubmitEditing={addSkill}
            />
            <AnimatedPressable style={styles.addSkillBtn} onPress={addSkill}>
              <Plus size={18} color="#000" />
            </AnimatedPressable>
          </View>
          {form.skills.length > 0 && (
            <View style={styles.skillsRow}>
              {form.skills.map((skill, i) => (
                <View key={i} style={styles.skillChip}>
                  <Text style={styles.skillChipText}>{skill}</Text>
                  <TouchableOpacity onPress={() => removeSkill(skill)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <X size={13} color={COLORS.accent} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Save Button */}
        <AnimatedPressable
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#000" size="small" />
            : <Text style={styles.saveBtnText}>Save Changes</Text>
          }
        </AnimatedPressable>
      </ScrollView>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.successIcon}>
              <Check size={28} color={COLORS.success} />
            </View>
            <Text style={styles.modalTitle}>Profile Updated</Text>
            <Text style={styles.modalMessage}>Your profile has been saved successfully.</Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.modalBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  centered: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  errorBanner: {
    backgroundColor: COLORS.errorMuted,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  errorText: { color: COLORS.error, fontSize: 13 },
  fieldGroup: { marginBottom: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: COLORS.text,
  },
  textArea: { height: 100, paddingTop: 13 },
  skillInputRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  addSkillBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.accentDim,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.accentMuted,
  },
  skillChipText: { fontSize: 13, fontWeight: '500', color: COLORS.accent },
  saveBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  successIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.successMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  modalMessage: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  modalBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  modalBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
});
