import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, DollarSign, Tag, ExternalLink, Bookmark, BookmarkCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { authenticatedGet, authenticatedPost } from '@/utils/api';
import { COLORS } from '@/constants/theme';
import { AnimatedPressable } from '@/components/AnimatedPressable';

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  salary_min?: number;
  salary_max?: number;
  redirect_url: string;
  created: string;
  category?: string;
}

interface Application {
  id: string;
  job_id: string;
  status: string;
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedApplication, setSavedApplication] = useState<Application | null>(null);

  const fetchJob = useCallback(async () => {
    console.log('[JobDetail] Fetching job:', id);
    try {
      const data = await authenticatedGet<Job>(`/api/jobs/${id}`);
      setJob(data);
    } catch (e: any) {
      console.error('[JobDetail] Fetch error:', e);
      setError('Could not load job details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const checkSaved = useCallback(async () => {
    console.log('[JobDetail] Checking if job is saved:', id);
    try {
      const apps = await authenticatedGet<Application[]>('/api/applications');
      const existing = Array.isArray(apps) ? apps.find((a) => a.job_id === id) : null;
      if (existing) setSavedApplication(existing);
    } catch (e) {
      // Silently ignore
    }
  }, [id]);

  useEffect(() => {
    Promise.all([fetchJob(), checkSaved()]);
  }, [fetchJob, checkSaved]);

  const handleSave = async () => {
    if (!job) return;
    console.log('[JobDetail] Save job pressed:', job.id, job.title);
    setSaving(true);
    try {
      const result = await authenticatedPost<Application>('/api/applications', {
        job_id: job.id,
        job_title: job.title,
        company: job.company,
        location: job.location,
        job_url: job.redirect_url,
        status: 'saved',
      });
      setSavedApplication(result);
      console.log('[JobDetail] Job saved successfully, application id:', result?.id);
    } catch (e: any) {
      console.error('[JobDetail] Save error:', e);
      Alert.alert('Error', 'Could not save job. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async () => {
    if (!job?.redirect_url) return;
    console.log('[JobDetail] Apply Now pressed, opening URL:', job.redirect_url);
    try {
      const canOpen = await Linking.canOpenURL(job.redirect_url);
      if (canOpen) {
        await Linking.openURL(job.redirect_url);
        if (savedApplication) {
          try {
            await authenticatedPost(`/api/applications/${savedApplication.id}/status`, { status: 'applied' });
          } catch (_) {}
        }
      } else {
        Alert.alert('Cannot Open Link', 'Unable to open the application URL.');
      }
    } catch (e: any) {
      console.error('[JobDetail] Apply error:', e);
      Alert.alert('Error', 'Could not open application link.');
    }
  };

  const salaryMin = job?.salary_min ? Number(job.salary_min) : null;
  const salaryMax = job?.salary_max ? Number(job.salary_max) : null;
  const hasSalary = salaryMin != null || salaryMax != null;
  const salaryText = hasSalary
    ? salaryMin && salaryMax
      ? `$${Math.round(salaryMin / 1000)}k – $${Math.round(salaryMax / 1000)}k/yr`
      : salaryMin
      ? `From $${Math.round(salaryMin / 1000)}k/yr`
      : `Up to $${Math.round((salaryMax ?? 0) / 1000)}k/yr`
    : null;

  const cleanDescription = job?.description?.replace(/<[^>]*>/g, '') ?? '';
  const companyInitial = (job?.company?.[0] || 'J').toUpperCase();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primaryLight} />
      </View>
    );
  }

  if (error || !job) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || 'Job not found.'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Job Header */}
        <View style={styles.jobHeader}>
          <LinearGradient
            colors={['#7C3AED', '#4F46E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.companyCircle}
          >
            <Text style={styles.companyInitial}>{companyInitial}</Text>
          </LinearGradient>
          <Text style={styles.jobTitle}>{job.title}</Text>
          <Text style={styles.jobCompany}>{job.company}</Text>
        </View>

        {/* Meta Chips */}
        <View style={styles.metaChips}>
          <View style={styles.metaChip}>
            <MapPin size={13} color={COLORS.textSecondary} />
            <Text style={styles.metaChipText}>{job.location || 'Remote'}</Text>
          </View>
          {salaryText && (
            <View style={styles.metaChip}>
              <DollarSign size={13} color={COLORS.textSecondary} />
              <Text style={styles.metaChipText}>{salaryText}</Text>
            </View>
          )}
          {job.category && (
            <View style={[styles.metaChip, styles.categoryChip]}>
              <Tag size={13} color={COLORS.info} />
              <Text style={[styles.metaChipText, { color: COLORS.info }]}>{job.category}</Text>
            </View>
          )}
        </View>

        {/* Description */}
        <View style={styles.descCard}>
          <Text style={styles.descTitle}>Job Description</Text>
          <Text style={styles.descText}>{cleanDescription}</Text>
        </View>
      </ScrollView>

      {/* Bottom Action Buttons */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <AnimatedPressable
          style={[styles.saveBtn, savedApplication && styles.savedBtn]}
          onPress={handleSave}
          disabled={saving || !!savedApplication}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.primaryLight} size="small" />
          ) : savedApplication ? (
            <>
              <BookmarkCheck size={18} color={COLORS.success} />
              <Text style={[styles.saveBtnText, { color: COLORS.success }]}>Saved</Text>
            </>
          ) : (
            <>
              <Bookmark size={18} color={COLORS.primaryLight} />
              <Text style={styles.saveBtnText}>Save Job</Text>
            </>
          )}
        </AnimatedPressable>

        <AnimatedPressable style={styles.applyBtn} onPress={handleApply}>
          <LinearGradient
            colors={['#7C3AED', '#4F46E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.applyBtnGradient}
          >
            <ExternalLink size={18} color="#FFFFFF" />
            <Text style={styles.applyBtnText}>Apply Now</Text>
          </LinearGradient>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  jobHeader: { alignItems: 'center', marginBottom: 20 },
  companyCircle: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  companyInitial: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  jobTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, textAlign: 'center', marginBottom: 6, letterSpacing: -0.3 },
  jobCompany: { fontSize: 15, color: COLORS.primaryLight, fontWeight: '600' },
  metaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChip: { backgroundColor: COLORS.infoMuted, borderColor: COLORS.info },
  metaChipText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  descCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  descTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  descText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },
  errorText: { color: COLORS.error, fontSize: 15 },
  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  savedBtn: { borderColor: COLORS.success },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.primaryLight },
  applyBtn: {
    flex: 2,
    borderRadius: 14,
    overflow: 'hidden',
  },
  applyBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  applyBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
