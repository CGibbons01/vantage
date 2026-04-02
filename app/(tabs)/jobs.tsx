import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, MapPin, Briefcase, Lock, ChevronRight, DollarSign, ChevronDown, ChevronUp, Clock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  contract_type?: string;
  job_type?: string;
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

function formatPostedDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  } catch {
    return '';
  }
}

function SkeletonLine({ width, height = 14 }: { width: number | string; height?: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={{ width, height, borderRadius: height / 2, backgroundColor: COLORS.surfaceElevated, opacity }}
    />
  );
}

function JobCardSkeleton() {
  return (
    <View style={styles.jobCard}>
      <View style={styles.jobCardHeader}>
        <View style={[styles.jobIconCircle, { backgroundColor: COLORS.surfaceElevated }]} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonLine width="70%" height={14} />
          <SkeletonLine width="45%" height={12} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
        <SkeletonLine width={80} height={11} />
        <SkeletonLine width={60} height={11} />
      </View>
      <SkeletonLine width="90%" height={11} />
      <View style={{ marginTop: 6 }}>
        <SkeletonLine width="75%" height={11} />
      </View>
    </View>
  );
}

function MatchBadge({ pct }: { pct: number }) {
  const pctNum = Number(pct);
  const badgeColor = pctNum >= 80 ? COLORS.success : pctNum >= 60 ? COLORS.primaryLight : COLORS.textMuted;
  const badgeBg = pctNum >= 80 ? COLORS.successMuted : pctNum >= 60 ? COLORS.primaryMuted : 'rgba(100,116,139,0.15)';
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
  index,
}: {
  job: Job;
  matchResult?: MatchResult;
  isSubscribed: boolean;
  onPress: () => void;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: Math.min(index * 50, 400), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, delay: Math.min(index * 50, 400), useNativeDriver: true }),
    ]).start();
  }, []);

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

  const snippet = job.description?.replace(/<[^>]*>/g, '').slice(0, 120) ?? '';
  const hasMatchData = isSubscribed && matchResult;
  const hasSkillData = hasMatchData && (matchResult.matched_skills?.length > 0 || matchResult.missing_skills?.length > 0);
  const postedDate = formatPostedDate(job.created);
  const jobType = job.contract_type || job.job_type || null;
  const companyInitial = (job.company?.[0] || 'J').toUpperCase();

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <AnimatedPressable style={styles.jobCard} onPress={onPress}>
        <View style={styles.jobCardHeader}>
          <View style={styles.jobIconCircle}>
            <Text style={styles.jobIconInitial}>{companyInitial}</Text>
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
                <Text style={styles.recommendedText}>New</Text>
              </View>
            )}
            <ChevronRight size={16} color={COLORS.textMuted} />
          </View>
        </View>

        <View style={styles.jobMeta}>
          <View style={styles.metaItem}>
            <MapPin size={12} color={COLORS.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>{job.location || 'Remote'}</Text>
          </View>
          {salaryText && (
            <View style={styles.metaItem}>
              <DollarSign size={12} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{salaryText}</Text>
            </View>
          )}
          {postedDate ? (
            <View style={styles.metaItem}>
              <Clock size={12} color={COLORS.textMuted} />
              <Text style={[styles.metaText, { color: COLORS.textMuted }]}>{postedDate}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.badgeRow}>
          {job.category ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{job.category}</Text>
            </View>
          ) : null}
          {jobType ? (
            <View style={styles.jobTypeBadge}>
              <Text style={styles.jobTypeText}>{jobType}</Text>
            </View>
          ) : null}
        </View>

        {snippet ? <Text style={styles.jobSnippet} numberOfLines={2}>{snippet}</Text> : null}

        {hasSkillData && (
          <AnimatedPressable
            style={styles.whyMatchRow}
            onPress={() => {
              console.log('[Jobs] Why this match? toggled for job:', job.id);
              setExpanded(v => !v);
            }}
          >
            <Text style={styles.whyMatchText}>Why this match?</Text>
            {expanded
              ? <ChevronUp size={14} color={COLORS.primaryLight} />
              : <ChevronDown size={14} color={COLORS.primaryLight} />
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
    </Animated.View>
  );
}

const CATEGORY_CHIPS = [
  { label: 'Technology', keywords: 'Software Engineer' },
  { label: 'Healthcare', keywords: 'Nurse' },
  { label: 'Finance', keywords: 'Finance' },
  { label: 'Legal', keywords: 'Lawyer' },
  { label: 'Education', keywords: 'Teacher' },
  { label: 'Engineering', keywords: 'Engineer' },
  { label: 'Marketing', keywords: 'Marketing' },
  { label: 'Sales', keywords: 'Sales' },
  { label: 'HR', keywords: 'Human Resources' },
  { label: 'Creative', keywords: 'Designer' },
  { label: 'Construction', keywords: 'Construction' },
  { label: 'Hospitality', keywords: 'Hospitality' },
  { label: 'Retail', keywords: 'Retail' },
  { label: 'Logistics', keywords: 'Logistics' },
  { label: 'Science', keywords: 'Scientist' },
];

export default function JobsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSubscribed, packages } = useSubscription();

  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [matchMap, setMatchMap] = useState<Record<string, MatchResult>>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [matchingUnavailable, setMatchingUnavailable] = useState(false);

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
      const newMap: Record<string, MatchResult> = {};
      result.matches?.forEach(m => { newMap[m.job_id] = m; });
      setMatchMap(prev => ({ ...prev, ...newMap }));
      setMatchingUnavailable(false);
    } catch (e: any) {
      console.error('[Jobs] AI matching error:', e);
      setMatchingUnavailable(true);
    }
  }, [isSubscribed]);

  const searchJobs = useCallback(async (pageNum = 1, append = false, overrideKeywords?: string) => {
    const kw = overrideKeywords !== undefined ? overrideKeywords : keywords;
    console.log(`[Jobs] Searching jobs - keywords: "${kw}", location: "${location}", page: ${pageNum}`);
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const params = new URLSearchParams();
      if (kw.trim()) params.set('keywords', kw.trim());
      if (location.trim()) params.set('location', location.trim());
      params.set('page', String(pageNum));

      const data = await authenticatedGet<JobsResponse>(`/api/jobs/search?${params.toString()}`);
      const newJobs = data?.jobs ?? [];
      console.log(`[Jobs] Got ${newJobs.length} jobs`);

      const total = data?.total ?? 0;

      if (append) {
        setJobs(prev => [...prev, ...newJobs]);
        runJobMatching(newJobs);
      } else {
        setJobs(newJobs);
        setMatchMap({});
        setMatchingUnavailable(false);
        runJobMatching(newJobs);
      }
      setHasMore((pageNum * 10) < total);
      setPage(pageNum);
      setSearched(true);
    } catch (e: any) {
      console.error('[Jobs] Search error:', e);
      setError('Couldn\'t load jobs. Check your connection and try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [keywords, location, runJobMatching]);

  const handleSearch = () => {
    console.log('[Jobs] Search button pressed - keywords:', keywords, 'location:', location);
    setActiveCategory(null);
    searchJobs(1, false);
  };

  const handleCategoryChip = (chip: { label: string; keywords: string }) => {
    console.log('[Jobs] Category chip pressed:', chip.label, '→', chip.keywords);
    const isAlreadyActive = activeCategory === chip.label;
    if (isAlreadyActive) {
      setActiveCategory(null);
      setKeywords('');
      searchJobs(1, false, '');
    } else {
      setActiveCategory(chip.label);
      setKeywords(chip.keywords);
      searchJobs(1, false, chip.keywords);
    }
  };

  const handleLoadMore = () => {
    if (loadingMore) return;
    console.log('[Jobs] Load more pressed, page:', page + 1);
    searchJobs(page + 1, true);
  };

  const onRefresh = () => {
    setRefreshing(true);
    searchJobs(1, false);
  };

  const priceString = packages[0]?.product?.priceString ?? '$15';

  if (!isSubscribed) {
    return (
      <View style={[styles.lockedContainer, { paddingTop: insets.top }]}>
        <View style={styles.lockIconCircle}>
          <Lock size={36} color={COLORS.primaryLight} />
        </View>
        <Text style={styles.lockedTitle}>Premium Feature</Text>
        <Text style={styles.lockedSubtitle}>
          Unlock unlimited job search across millions of roles with a Vantage AI Premium subscription.
        </Text>
        <AnimatedPressable
          style={styles.unlockBtn}
          onPress={() => { console.log('[Jobs] Navigate to paywall'); router.push('/paywall'); }}
        >
          <LinearGradient
            colors={['#7C3AED', '#4F46E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.unlockBtnGradient}
          >
            <Text style={styles.unlockBtnText}>
              {'Unlock Job Search — '}
              {priceString}
              {'/month'}
            </Text>
          </LinearGradient>
        </AnimatedPressable>
      </View>
    );
  }

  const showSkeletons = loading && !refreshing && jobs.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Job Search</Text>
        {searched && jobs.length > 0 && (
          <Text style={styles.headerCount}>{jobs.length} results</Text>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <View style={[styles.searchInput, { flex: 1 }]}>
            <Search size={16} color={COLORS.textSecondary} />
            <TextInput
              style={styles.searchText}
              placeholder="Job title, role, keyword..."
              placeholderTextColor={COLORS.textMuted}
              value={keywords}
              onChangeText={setKeywords}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
          </View>
          <AnimatedPressable style={styles.searchBtn} onPress={handleSearch} disabled={loading}>
            {loading && !refreshing && jobs.length === 0
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : <Text style={styles.searchBtnText}>Search</Text>
            }
          </AnimatedPressable>
        </View>
        <View style={styles.searchInput}>
          <MapPin size={16} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchText}
            placeholder="Location (city, country, or Remote)..."
            placeholderTextColor={COLORS.textMuted}
            value={location}
            onChangeText={setLocation}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
        </View>
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsContent}
      >
        {CATEGORY_CHIPS.map((chip) => {
          const isActive = activeCategory === chip.label;
          return (
            <AnimatedPressable
              key={chip.label}
              style={[styles.categoryChip, isActive && styles.categoryChipActive]}
              onPress={() => handleCategoryChip(chip)}
            >
              <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                {chip.label}
              </Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {matchingUnavailable && !error ? (
        <View style={styles.matchingUnavailableBanner}>
          <Text style={styles.matchingUnavailableText}>AI matching unavailable</Text>
        </View>
      ) : null}

      {/* Results */}
      {showSkeletons ? (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {[0, 1, 2, 3].map(i => <JobCardSkeleton key={i} />)}
        </ScrollView>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primaryLight} colors={[COLORS.primaryLight]} />
          }
          renderItem={({ item, index }) => (
            <JobCard
              job={item}
              matchResult={matchMap[item.id]}
              isSubscribed={isSubscribed}
              index={index}
              onPress={() => {
                console.log('[Jobs] Navigate to job detail:', item.id, item.title);
                router.push(`/job/${item.id}` as any);
              }}
            />
          )}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <Briefcase size={32} color={COLORS.primaryLight} />
                </View>
                <Text style={styles.emptyTitle}>
                  {searched ? 'No jobs found' : 'Find your next opportunity'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {searched
                    ? 'Try different keywords or broaden your location.'
                    : 'Search any job title or tap a category above to get started.'}
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            hasMore && jobs.length > 0 ? (
              <AnimatedPressable style={styles.loadMoreBtn} onPress={handleLoadMore} disabled={loadingMore}>
                {loadingMore
                  ? <ActivityIndicator color={COLORS.primaryLight} size="small" />
                  : <Text style={styles.loadMoreText}>Load more results</Text>
                }
              </AnimatedPressable>
            ) : null
          }
        />
      )}
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
    backgroundColor: COLORS.primaryMuted,
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
    borderRadius: 14,
    overflow: 'hidden',
  },
  unlockBtnGradient: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  headerCount: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  searchSection: { paddingHorizontal: 20, gap: 8, marginBottom: 8 },
  searchRow: { flexDirection: 'row', gap: 8 },
  chipsScroll: { marginBottom: 8 },
  chipsContent: { paddingHorizontal: 20, gap: 8, paddingVertical: 4 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary,
  },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  categoryChipTextActive: { color: COLORS.primaryLight },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchText: { flex: 1, fontSize: 15, color: COLORS.text },
  searchBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
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
  matchingUnavailableBanner: {
    marginHorizontal: 20,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  matchingUnavailableText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '500' },
  listContent: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 4 },
  jobCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  jobCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  jobIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  jobIconInitial: { fontSize: 16, fontWeight: '800', color: COLORS.primaryLight },
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
  jobTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  jobCompany: { fontSize: 13, color: COLORS.textSecondary },
  jobMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: COLORS.textSecondary },
  badgeRow: { flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.infoMuted,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: { fontSize: 11, fontWeight: '600', color: COLORS.info },
  jobTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  jobTypeText: { fontSize: 11, fontWeight: '600', color: COLORS.primaryLight },
  jobSnippet: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },
  whyMatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  whyMatchText: { fontSize: 12, fontWeight: '600', color: COLORS.primaryLight },
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
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  loadMoreBtn: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadMoreText: { fontSize: 14, fontWeight: '600', color: COLORS.primaryLight },
});
