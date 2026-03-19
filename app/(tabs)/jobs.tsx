import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, MapPin, Briefcase, Lock, ChevronRight, DollarSign, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { authenticatedGet, authenticatedPost } from '@/utils/api';
import { COLORS } from '@/constants/theme';
import { AnimatedPressable } from '@/components/AnimatedPressable';

const USER_CV_KEY = 'user_cv_text';

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

interface JobsResponse {
  jobs: Job[];
  total?: number;
  page?: number;
}

interface MatchResult {
  job_id: string;
  match_percentage: number;
  matched_skills: string[];
  missing_skills: string[];
  recommendation: string;
}

interface MatchResponse {
  matches: MatchResult[];
}

function MatchBadge({ pct }: { pct: number }) {
  const pctNum = Number(pct);
  const badgeColor = pctNum >= 80 ? COLORS.success : pctNum >= 60 ? COLORS.accent : COLORS.textMuted;
  const badgeBg = pctNum >= 80 ? COLORS.successMuted : pctNum >= 60 ? COLORS.accentMuted : 'rgba(100,116,139,0.15)';
  const pctText = `${pctNum}% Match`;
  return (
    <View style={[styles.matchBadge, { backgroundColor: badgeBg, borderColor: badgeColor + '55' }]}>
      <Text style={[styles.matchBadgeText, { color: badgeColor }]}>{pctText}</Text>
    </View>
  );
}

function JobCard({
  job,
  matchResult,
  isSubscribed,
  onPress,
}: {
  job: Job;
  matchResult?: MatchResult;
  isSubscribed: boolean;
  onPress: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const salaryMin = job.salary_min ? Number(job.salary_min) : null;
  const salaryMax = job.salary_max ? Number(job.salary_max) : null;
  const hasSalary = salaryMin != null || salaryMax != null;
  const salaryText = hasSalary
    ? salaryMin && salaryMax
      ? `$${Math.round(salaryMin / 1000)}k – $${Math.round(salaryMax / 1000)}k`
      : salaryMin
      ? `From $${Math.round(salaryMin / 1000)}k`
      : `Up to $${Math.round((salaryMax ?? 0) / 1000)}k`
    : null;

  const snippet = job.description?.replace(/<[^>]*>/g, '').slice(0, 100) ?? '';
  const hasMatchData = isSubscribed && matchResult;
  const hasSkillData = hasMatchData && (matchResult.matched_skills?.length > 0 || matchResult.missing_skills?.length > 0);

  return (
    <AnimatedPressable style={styles.jobCard} onPress={onPress}>
      <View style={styles.jobCardHeader}>
        <View style={styles.jobIconCircle}>
          <Briefcase size={18} color={COLORS.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
          <Text style={styles.jobCompany} numberOfLines={1}>{job.company}</Text>
        </View>
        <View style={styles.badgeCol}>
          {hasMatchData ? (
            <MatchBadge pct={matchResult.match_percentage} />
          ) : isSubscribed ? null : (
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedText}>Recommended</Text>
            </View>
          )}
          <ChevronRight size={18} color={COLORS.textMuted} />
        </View>
      </View>

      <View style={styles.jobMeta}>
        <View style={styles.metaItem}>
          <MapPin size={13} color={COLORS.textSecondary} />
          <Text style={styles.metaText} numberOfLines={1}>{job.location || 'Remote'}</Text>
        </View>
        {salaryText && (
          <View style={styles.metaItem}>
            <DollarSign size={13} color={COLORS.textSecondary} />
            <Text style={styles.metaText}>{salaryText}</Text>
          </View>
        )}
      </View>

      {snippet ? <Text style={styles.jobSnippet} numberOfLines={2}>{snippet}</Text> : null}

      {job.category ? (
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{job.category}</Text>
        </View>
      ) : null}

      {hasSkillData && (
        <AnimatedPressable
          style={styles.whyMatchRow}
          onPress={(e) => {
            console.log('[Jobs] Why this match? toggled for job:', job.id);
            setExpanded(v => !v);
          }}
        >
          <Text style={styles.whyMatchText}>Why this match?</Text>
          {expanded
            ? <ChevronUp size={14} color={COLORS.accent} />
            : <ChevronDown size={14} color={COLORS.accent} />
          }
        </AnimatedPressable>
      )}

      {expanded && hasMatchData && (
        <View style={styles.matchDetails}>
          {matchResult.matched_skills?.length > 0 && (
            <View style={styles.skillSection}>
              <Text style={styles.skillSectionLabel}>Matched skills</Text>
              <View style={styles.skillChips}>
                {matchResult.matched_skills.map((s, i) => (
                  <View key={i} style={styles.matchedChip}>
                    <Text style={styles.matchedChipText}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {matchResult.missing_skills?.length > 0 && (
            <View style={styles.skillSection}>
              <Text style={styles.skillSectionLabel}>Missing skills</Text>
              <View style={styles.skillChips}>
                {matchResult.missing_skills.map((s, i) => (
                  <View key={i} style={styles.missingChip}>
                    <Text style={styles.missingChipText}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </AnimatedPressable>
  );
}

const CATEGORY_CHIPS = [
  { label: 'Hospitality', keywords: 'Hospitality' },
  { label: 'Technology', keywords: 'Software Engineer' },
  { label: 'Finance', keywords: 'Finance' },
  { label: 'Healthcare', keywords: 'Nurse' },
  { label: 'Trades', keywords: 'Electrician' },
  { label: 'Retail', keywords: 'Retail' },
  { label: 'Executive', keywords: 'CEO' },
  { label: 'Creative', keywords: 'Designer' },
];

export default function JobsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSubscribed } = useSubscription();

  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [matchMap, setMatchMap] = useState<Record<string, MatchResult>>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const runJobMatching = useCallback(async (fetchedJobs: Job[]) => {
    if (!isSubscribed || fetchedJobs.length === 0) return;
    try {
      const cvText = await AsyncStorage.getItem(USER_CV_KEY);
      if (!cvText) {
        console.log('[Jobs] No CV stored, skipping AI matching');
        return;
      }
      console.log('[Jobs] Running AI job matching for', fetchedJobs.length, 'jobs');
      const payload = {
        cv_text: cvText,
        jobs: fetchedJobs.map(j => ({
          id: j.id,
          title: j.title,
          description: j.description?.replace(/<[^>]*>/g, '').slice(0, 500) ?? '',
          company: j.company,
          required_skills: [],
        })),
      };
      const result = await authenticatedPost<MatchResponse>('/api/jobs/match', payload);
      console.log('[Jobs] AI matching complete, got', result.matches?.length, 'matches');
      const map: Record<string, MatchResult> = {};
      result.matches?.forEach(m => { map[m.job_id] = m; });
      setMatchMap(map);
    } catch (e: any) {
      console.error('[Jobs] AI matching error:', e);
      // Non-fatal — just skip match badges
    }
  }, [isSubscribed]);

  const searchJobs = useCallback(async (pageNum = 1, append = false) => {
    console.log(`[Jobs] Searching jobs - keywords: "${keywords}", location: "${location}", page: ${pageNum}`);
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (keywords.trim()) params.set('keywords', keywords.trim());
      if (location.trim()) params.set('location', location.trim());
      params.set('page', String(pageNum));

      const data = await authenticatedGet<JobsResponse>(`/api/jobs/search?${params.toString()}`);
      const newJobs = data?.jobs ?? [];
      console.log(`[Jobs] Got ${newJobs.length} jobs`);

      if (append) {
        setJobs((prev) => {
          const combined = [...prev, ...newJobs];
          runJobMatching(combined);
          return combined;
        });
      } else {
        setJobs(newJobs);
        setMatchMap({});
        runJobMatching(newJobs);
      }
      setHasMore(newJobs.length >= 10);
      setPage(pageNum);
      setSearched(true);
    } catch (e: any) {
      console.error('[Jobs] Search error:', e);
      setError('Failed to search jobs. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [keywords, location, runJobMatching]);

  const handleSearch = () => {
    console.log('[Jobs] Search button pressed');
    searchJobs(1, false);
  };

  const handleCategoryChip = (chip: { label: string; keywords: string }) => {
    console.log('[Jobs] Category chip pressed:', chip.label, '→', chip.keywords);
    setKeywords(chip.keywords);
    // Trigger search with the chip keywords directly
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    params.set('keywords', chip.keywords);
    if (location.trim()) params.set('location', location.trim());
    params.set('page', '1');
    authenticatedGet<JobsResponse>(`/api/jobs/search?${params.toString()}`)
      .then((data) => {
        const newJobs = data?.jobs ?? [];
        console.log(`[Jobs] Category search got ${newJobs.length} jobs`);
        setJobs(newJobs);
        setMatchMap({});
        runJobMatching(newJobs);
        setHasMore(newJobs.length >= 10);
        setPage(1);
        setSearched(true);
      })
      .catch((e: any) => {
        console.error('[Jobs] Category search error:', e);
        setError('Failed to search jobs. Please try again.');
      })
      .finally(() => setLoading(false));
  };

  const handleLoadMore = () => {
    console.log('[Jobs] Load more pressed, page:', page + 1);
    searchJobs(page + 1, true);
  };

  const onRefresh = () => {
    setRefreshing(true);
    searchJobs(1, false);
  };

  if (!isSubscribed) {
    return (
      <View style={[styles.lockedContainer, { paddingTop: insets.top }]}>
        <View style={styles.lockIconCircle}>
          <Lock size={36} color={COLORS.accent} />
        </View>
        <Text style={styles.lockedTitle}>Premium Feature</Text>
        <Text style={styles.lockedSubtitle}>
          Unlock unlimited job search across millions of roles with a Vantage AI Premium subscription.
        </Text>
        <AnimatedPressable
          style={styles.unlockBtn}
          onPress={() => { console.log('[Jobs] Navigate to paywall'); router.push('/paywall'); }}
        >
          <Text style={styles.unlockBtnText}>Unlock Job Search — $15/month</Text>
        </AnimatedPressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Job Search</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchInput}>
          <Search size={16} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchText}
            placeholder="e.g. Barista, Software Engineer, CEO, Nurse..."
            placeholderTextColor={COLORS.textMuted}
            value={keywords}
            onChangeText={setKeywords}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
        </View>
        <Text style={styles.searchHint}>Search any role across all industries</Text>
        <View style={styles.searchInput}>
          <MapPin size={16} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchText}
            placeholder="Location..."
            placeholderTextColor={COLORS.textMuted}
            value={location}
            onChangeText={setLocation}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
        </View>
        <AnimatedPressable style={styles.searchBtn} onPress={handleSearch} disabled={loading}>
          {loading && !refreshing
            ? <ActivityIndicator color="#000" size="small" />
            : <Text style={styles.searchBtnText}>Search</Text>
          }
        </AnimatedPressable>
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsContent}
      >
        {CATEGORY_CHIPS.map((chip) => (
          <AnimatedPressable
            key={chip.label}
            style={[styles.categoryChip, keywords === chip.keywords && styles.categoryChipActive]}
            onPress={() => handleCategoryChip(chip)}
          >
            <Text style={[styles.categoryChipText, keywords === chip.keywords && styles.categoryChipTextActive]}>
              {chip.label}
            </Text>
          </AnimatedPressable>
        ))}
      </ScrollView>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Results */}
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} colors={[COLORS.accent]} />
        }
        renderItem={({ item }) => (
          <JobCard
            job={item}
            matchResult={matchMap[item.id]}
            isSubscribed={isSubscribed}
            onPress={() => {
              console.log('[Jobs] Navigate to job detail:', item.id, item.title);
              router.push(`/job/${item.id}` as any);
            }}
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Briefcase size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>
                {searched ? 'No jobs found' : 'Find your next opportunity'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searched
                  ? 'Try different keywords or broaden your location.'
                  : 'Search any job title or industry — from barista to CEO, we\'ve got you covered'}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          hasMore && jobs.length > 0 ? (
            <AnimatedPressable style={styles.loadMoreBtn} onPress={handleLoadMore} disabled={loading}>
              {loading
                ? <ActivityIndicator color={COLORS.accent} size="small" />
                : <Text style={styles.loadMoreText}>Load More</Text>
              }
            </AnimatedPressable>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  lockedContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  lockIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  lockedTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  lockedSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  unlockBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  unlockBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  searchSection: { paddingHorizontal: 20, gap: 10, marginBottom: 4 },
  searchHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: -4,
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  chipsScroll: { marginBottom: 10 },
  chipsContent: { paddingHorizontal: 20, gap: 8, paddingVertical: 4 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipActive: {
    backgroundColor: COLORS.accentMuted,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  categoryChipTextActive: { color: COLORS.accent },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchText: { flex: 1, fontSize: 15, color: COLORS.text },
  searchBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
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
  jobCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  },
  jobCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  jobIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.accentDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeCol: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  matchBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  matchBadgeText: { fontSize: 11, fontWeight: '700' },
  recommendedBadge: {
    backgroundColor: COLORS.infoMuted,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  recommendedText: { fontSize: 11, fontWeight: '600', color: COLORS.info },
  jobTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  jobCompany: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  jobMeta: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: COLORS.textSecondary },
  jobSnippet: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18, marginBottom: 8 },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.infoMuted,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  categoryText: { fontSize: 11, fontWeight: '600', color: COLORS.info },
  whyMatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  whyMatchText: { fontSize: 12, fontWeight: '600', color: COLORS.accent },
  matchDetails: { paddingTop: 10, gap: 10 },
  skillSection: { gap: 6 },
  skillSectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  skillChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  matchedChip: {
    backgroundColor: COLORS.successMuted,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  matchedChipText: { fontSize: 11, fontWeight: '600', color: COLORS.success },
  missingChip: {
    backgroundColor: COLORS.errorMuted,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  missingChipText: { fontSize: 11, fontWeight: '600', color: COLORS.error },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 16, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  loadMoreBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadMoreText: { fontSize: 14, fontWeight: '600', color: COLORS.accent },
});
