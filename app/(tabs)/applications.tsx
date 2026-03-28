import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Briefcase, Trash2, ChevronRight, ClipboardList } from 'lucide-react-native';
import { authenticatedGet, authenticatedDelete } from '@/utils/api';
import { COLORS, STATUS_COLORS } from '@/constants/theme';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { LinearGradient } from 'expo-linear-gradient';

interface Application {
  id: string;
  user_id: string;
  job_id: string;
  job_title: string;
  company: string;
  location?: string;
  job_url?: string;
  status: 'saved' | 'applied' | 'interviewing' | 'offered' | 'rejected';
  applied_at?: string;
  notes?: string;
  created_at: string;
}

const STATUS_FILTERS = ['All', 'Saved', 'Applied', 'Interviewing', 'Offered'] as const;

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.saved;
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.statusText, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

export default function ApplicationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [error, setError] = useState('');

  const fetchApplications = useCallback(async () => {
    console.log('[Applications] Fetching applications');
    try {
      const data = await authenticatedGet<Application[]>('/api/applications');
      setApplications(Array.isArray(data) ? data : []);
      setError('');
    } catch (e: any) {
      console.error('[Applications] Fetch error:', e);
      setError('Failed to load applications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchApplications();
  }, [fetchApplications]);

  const handleDelete = (app: Application) => {
    console.log('[Applications] Delete pressed for:', app.id, app.job_title);
    Alert.alert(
      'Remove Application',
      `Remove "${app.job_title}" from your applications?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            console.log('[Applications] Deleting application:', app.id);
            try {
              await authenticatedDelete(`/api/applications/${app.id}`);
              setApplications((prev) => prev.filter((a) => a.id !== app.id));
              console.log('[Applications] Deleted successfully:', app.id);
            } catch (e: any) {
              console.error('[Applications] Delete error:', e);
              Alert.alert('Error', 'Could not remove application. Please try again.');
            }
          },
        },
      ]
    );
  };

  const filtered = activeFilter === 'All'
    ? applications
    : applications.filter((a) => a.status === activeFilter.toLowerCase());

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primaryLight} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Applications</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{applications.length}</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((filter) => {
          const isActive = activeFilter === filter;
          return (
            <AnimatedPressable
              key={filter}
              style={[styles.filterTab, isActive && styles.filterTabActive]}
              onPress={() => {
                console.log('[Applications] Filter changed to:', filter);
                setActiveFilter(filter);
              }}
            >
              <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                {filter}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primaryLight}
            colors={[COLORS.primaryLight]}
          />
        }
        renderItem={({ item }) => (
          <AnimatedPressable
            style={styles.appCard}
            onPress={() => {
              console.log('[Applications] Navigate to job detail:', item.job_id);
              router.push(`/job/${item.job_id}` as any);
            }}
          >
            <View style={styles.appCardMain}>
              <View style={styles.appIconCircle}>
                <Briefcase size={18} color={COLORS.primaryLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.appTitle} numberOfLines={1}>{item.job_title}</Text>
                <Text style={styles.appCompany} numberOfLines={1}>{item.company}</Text>
                {item.location ? (
                  <Text style={styles.appLocation} numberOfLines={1}>{item.location}</Text>
                ) : null}
              </View>
              <View style={styles.appRight}>
                <StatusBadge status={item.status} />
                <ChevronRight size={16} color={COLORS.textMuted} style={{ marginTop: 8 }} />
              </View>
            </View>
            <View style={styles.appCardFooter}>
              <Text style={styles.appDate}>
                {item.applied_at
                  ? new Date(item.applied_at).toLocaleDateString()
                  : new Date(item.created_at).toLocaleDateString()}
              </Text>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Trash2 size={16} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          </AnimatedPressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <ClipboardList size={32} color={COLORS.primaryLight} />
            </View>
            <Text style={styles.emptyTitle}>
              {activeFilter === 'All' ? 'No applications yet' : `No ${activeFilter.toLowerCase()} applications`}
            </Text>
            <Text style={styles.emptySubtitle}>
              Start searching for jobs and save or apply to track them here.
            </Text>
            <AnimatedPressable
              style={styles.emptyBtn}
              onPress={() => {
                console.log('[Applications] Navigate to Jobs from empty state');
                router.push('/(tabs)/jobs');
              }}
            >
              <LinearGradient
                colors={['#7C3AED', '#4F46E5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.emptyBtnGradient}
              >
                <Text style={styles.emptyBtnText}>Search Jobs</Text>
              </LinearGradient>
            </AnimatedPressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  countBadge: {
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countText: { fontSize: 13, fontWeight: '700', color: COLORS.primaryLight },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterTabText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  filterTabTextActive: { color: '#FFFFFF' },
  errorBanner: {
    marginHorizontal: 20,
    backgroundColor: COLORS.errorMuted,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  errorText: { color: COLORS.error, fontSize: 13 },
  listContent: { paddingHorizontal: 20, paddingBottom: 120 },
  appCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  appCardMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  appIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  appCompany: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  appLocation: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  appRight: { alignItems: 'flex-end' },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  appCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  appDate: { fontSize: 12, color: COLORS.textMuted },
  deleteBtn: { padding: 4 },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: COLORS.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 0, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 160,
  },
  emptyBtnGradient: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
