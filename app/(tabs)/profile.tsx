import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Edit2,
  LogOut,
  MapPin,
  Phone,
  Linkedin,
  Briefcase,
  GraduationCap,
  Upload,
} from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedGet } from '@/utils/api';
import { COLORS } from '@/constants/theme';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { resetOnboarding } from '@/utils/onboardingStorage';

interface Experience {
  title: string;
  company: string;
  start_date?: string;
  end_date?: string;
  description?: string;
}

interface Education {
  degree: string;
  institution: string;
  year?: string;
}

interface Profile {
  id: string;
  headline?: string;
  summary?: string;
  location?: string;
  phone?: string;
  linkedin_url?: string;
  skills?: string[];
  experience?: Experience[];
  education?: Education[];
  cv_score?: number;
  cv_filename?: string;
  updated_at?: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const fetchProfile = useCallback(async () => {
    console.log('[Profile] Fetching profile');
    try {
      const data = await authenticatedGet<Profile>('/api/profile');
      setProfile(data);
      setError('');
    } catch (e: any) {
      console.error('[Profile] Fetch error:', e);
      if (!e?.message?.includes('404')) {
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

  const handleSignOut = async () => {
    console.log('[Profile] Sign out confirmed');
    setShowSignOutModal(false);
    try {
      await signOut();
      try {
        await resetOnboarding();
      } catch (resetErr) {
        console.warn('[Profile] resetOnboarding failed (non-fatal):', resetErr);
      }
      router.replace('/welcome');
    } catch (e: any) {
      console.error('[Profile] Sign out error:', e);
    }
  };

  const initials = (user?.name || user?.email || 'U')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primaryLight} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primaryLight}
            colors={[COLORS.primaryLight]}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Pressable
              onPress={() => { console.log('[Profile] Back button pressed'); router.back(); }}
              style={styles.backBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={24} color={COLORS.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Profile</Text>
          </View>
          <AnimatedPressable
            style={styles.editBtn}
            onPress={() => {
              console.log('[Profile] Navigate to edit profile');
              router.push('/profile/edit');
            }}
          >
            <Edit2 size={16} color={COLORS.primaryLight} />
            <Text style={styles.editBtnText}>Edit</Text>
          </AnimatedPressable>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Avatar + Name */}
        <View style={styles.avatarSection}>
          <LinearGradient
            colors={['#7C3AED', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarCircle}
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </LinearGradient>
          <Text style={styles.userName}>{user?.name || 'Your Name'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          {profile?.headline ? (
            <Text style={styles.headline}>{profile.headline}</Text>
          ) : null}
        </View>

        {/* Meta Info */}
        {(profile?.location || profile?.phone || profile?.linkedin_url) && (
          <View style={styles.card}>
            {profile.location ? (
              <View style={styles.metaRow}>
                <MapPin size={16} color={COLORS.textSecondary} />
                <Text style={styles.metaText}>{profile.location}</Text>
              </View>
            ) : null}
            {profile.phone ? (
              <View style={styles.metaRow}>
                <Phone size={16} color={COLORS.textSecondary} />
                <Text style={styles.metaText}>{profile.phone}</Text>
              </View>
            ) : null}
            {profile.linkedin_url ? (
              <View style={styles.metaRow}>
                <Linkedin size={16} color={COLORS.textSecondary} />
                <Text style={styles.metaText} numberOfLines={1}>{profile.linkedin_url}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Summary */}
        {profile?.summary ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>About</Text>
            <Text style={styles.summaryText}>{profile.summary}</Text>
          </View>
        ) : null}

        {/* Skills */}
        {profile?.skills && profile.skills.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Skills</Text>
            <View style={styles.skillsRow}>
              {profile.skills.map((skill, i) => (
                <View key={i} style={styles.skillChip}>
                  <Text style={styles.skillChipText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Experience */}
        {profile?.experience && profile.experience.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Briefcase size={16} color={COLORS.primaryLight} />
              <Text style={styles.cardTitle}>Experience</Text>
            </View>
            {profile.experience.map((exp, i) => (
              <View key={i} style={[styles.timelineItem, i < profile.experience!.length - 1 && styles.timelineItemBorder]}>
                <Text style={styles.expTitle}>{exp.title}</Text>
                <Text style={styles.expCompany}>{exp.company}</Text>
                {(exp.start_date || exp.end_date) ? (
                  <Text style={styles.expDates}>
                    {exp.start_date || ''}{exp.start_date && exp.end_date ? ' – ' : ''}{exp.end_date || 'Present'}
                  </Text>
                ) : null}
                {exp.description ? (
                  <Text style={styles.expDesc} numberOfLines={3}>{exp.description}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Education */}
        {profile?.education && profile.education.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <GraduationCap size={16} color={COLORS.primaryLight} />
              <Text style={styles.cardTitle}>Education</Text>
            </View>
            {profile.education.map((edu, i) => (
              <View key={i} style={[styles.timelineItem, i < profile.education!.length - 1 && styles.timelineItemBorder]}>
                <Text style={styles.expTitle}>{edu.degree}</Text>
                <Text style={styles.expCompany}>{edu.institution}</Text>
                {edu.year ? <Text style={styles.expDates}>{edu.year}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Empty State */}
        {!profile ? (
          <View style={styles.emptyStateCard}>
            <View style={styles.emptyStateIconCircle}>
              <Upload size={24} color={COLORS.primaryLight} />
            </View>
            <Text style={styles.emptyStateTitle}>Complete your profile</Text>
            <Text style={styles.emptyStateSubtext}>
              Upload your CV to unlock AI-powered job matching and career insights
            </Text>
            <AnimatedPressable
              style={styles.emptyStateBtn}
              onPress={() => {
                console.log('[Profile] Upload CV empty state button pressed');
                router.push('/(tabs)/cv-writer');
              }}
            >
              <LinearGradient
                colors={['#7C3AED', '#4F46E5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.emptyStateBtnGradient}
              >
                <Upload size={16} color="#FFFFFF" />
                <Text style={styles.emptyStateBtnText}>Upload CV</Text>
              </LinearGradient>
            </AnimatedPressable>
          </View>
        ) : null}

        {/* Sign Out */}
        <AnimatedPressable
          style={styles.signOutBtn}
          onPress={() => {
            console.log('[Profile] Sign out button pressed');
            setShowSignOutModal(true);
          }}
        >
          <LogOut size={18} color={COLORS.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </AnimatedPressable>
      </ScrollView>

      {/* Sign Out Confirmation Modal */}
      <Modal
        visible={showSignOutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignOutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sign Out</Text>
            <Text style={styles.modalMessage}>Are you sure you want to sign out?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowSignOutModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleSignOut}
              >
                <Text style={styles.modalConfirmText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 20 },
  centered: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    marginRight: 4,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.primaryLight },
  errorBanner: {
    backgroundColor: COLORS.errorMuted,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  errorText: { color: COLORS.error, fontSize: 13 },
  avatarSection: { alignItems: 'center', marginBottom: 20 },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  userName: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  userEmail: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 6 },
  headline: { fontSize: 14, color: COLORS.primaryLight, fontWeight: '500', textAlign: 'center' },
  card: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  metaText: { fontSize: 14, color: COLORS.textSecondary, flex: 1 },
  summaryText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 21 },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillChip: {
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  skillChipText: { fontSize: 13, fontWeight: '500', color: COLORS.primaryLight },
  timelineItem: { paddingBottom: 14, marginBottom: 14 },
  timelineItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  expTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  expCompany: { fontSize: 13, color: COLORS.primaryLight, marginBottom: 2 },
  expDates: { fontSize: 12, color: COLORS.textMuted, marginBottom: 4 },
  expDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.errorMuted,
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: COLORS.error },
  emptyStateCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 16,
    padding: 24,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  emptyStateIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyStateTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  emptyStateSubtext: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyStateBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyStateBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyStateBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  modalMessage: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 24, lineHeight: 20 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  modalConfirmBtn: {
    flex: 1,
    backgroundColor: COLORS.error,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  modalConfirmText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
