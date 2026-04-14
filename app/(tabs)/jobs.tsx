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
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, MapPin, Briefcase, ChevronRight, Clock } from 'lucide-react-native';
import Constants from 'expo-constants';
import { COLORS } from '@/constants/theme';
import { AnimatedPressable } from '@/components/AnimatedPressable';

const _extra = Constants.expoConfig?.extra || {};
const ADZUNA_APP_ID: string = _extra.adzunaAppId || '';
const ADZUNA_APP_KEY: string = _extra.adzunaAppKey || '';

// ─── Country config ───────────────────────────────────────────────────────────

interface CountryConfig {
  label: string;
  code: string;
  currency: string;
}

const COUNTRIES: CountryConfig[] = [
  { label: '🇬🇧 UK',          code: 'gb', currency: '£' },
  { label: '🇺🇸 USA',         code: 'us', currency: '$' },
  { label: '🇦🇺 Australia',   code: 'au', currency: 'A$' },
  { label: '🇨🇦 Canada',      code: 'ca', currency: 'CA$' },
  { label: '🇩🇪 Germany',     code: 'de', currency: '€' },
  { label: '🇫🇷 France',      code: 'fr', currency: '€' },
  { label: '🇮🇳 India',       code: 'in', currency: '₹' },
  { label: '🇳🇱 Netherlands', code: 'nl', currency: '€' },
  { label: '🇳🇿 New Zealand', code: 'nz', currency: 'NZ$' },
  { label: '🇵🇱 Poland',      code: 'pl', currency: 'zł' },
  { label: '🇸🇬 Singapore',   code: 'sg', currency: 'S$' },
  { label: '🇿🇦 South Africa',code: 'za', currency: 'R' },
  { label: '🇧🇷 Brazil',      code: 'br', currency: 'R$' },
  { label: '🇦🇹 Austria',     code: 'at', currency: '€' },
  { label: '🇧🇪 Belgium',     code: 'be', currency: '€' },
  { label: '🇨🇭 Switzerland', code: 'ch', currency: 'CHF' },
  { label: '🇮🇹 Italy',       code: 'it', currency: '€' },
  { label: '🇲🇽 Mexico',      code: 'mx', currency: 'MX$' },
  { label: '🇪🇸 Spain',       code: 'es', currency: '€' },
];

const DEFAULT_COUNTRY = 'gb';

function getCurrencyForCountry(code: string): string {
  return COUNTRIES.find(c => c.code === code)?.currency ?? '£';
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

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

// ─── Source badge detection ───────────────────────────────────────────────────

interface SourceInfo {
  label: string;
  bg: string;
  color: string;
}

function detectSource(redirectUrl: string): SourceInfo | null {
  if (!redirectUrl) return null;
  const url = redirectUrl.toLowerCase();
  if (url.includes('indeed.com')) return { label: 'Indeed', bg: '#E8F0FE', color: '#1A56DB' };
  if (url.includes('linkedin.com')) return { label: 'LinkedIn', bg: '#E0EAF5', color: '#0A66C2' };
  if (url.includes('glassdoor.com')) return { label: 'Glassdoor', bg: '#E6F4EA', color: '#1E8E3E' };
  if (url.includes('hays.')) return { label: 'Hays', bg: '#FCE8E6', color: '#C5221F' };
  if (url.includes('roberthalf.')) return { label: 'Robert Half', bg: '#FEF3E2', color: '#E37400' };
  if (url.includes('reed.co.uk') || url.includes('reed.com')) return { label: 'Reed', bg: '#FCE8E6', color: '#B31412' };
  if (url.includes('totaljobs.com')) return { label: 'Total Jobs', bg: '#EDE7F6', color: '#6200EA' };
  if (url.includes('cv-library.co.uk')) return { label: 'CV-Library', bg: '#E8F5E9', color: '#2E7D32' };
  if (url.includes('monster.com')) return { label: 'Monster', bg: '#F3E5F5', color: '#7B1FA2' };
  if (url.includes('seek.com')) return { label: 'Seek', bg: '#E3F2FD', color: '#1565C0' };
  if (url.includes('naukri.com')) return { label: 'Naukri', bg: '#FFF3E0', color: '#E65100' };
  if (url.includes('ziprecruiter.com')) return { label: 'ZipRecruiter', bg: '#E8F5E9', color: '#1B5E20' };
  if (url.includes('workopolis.com')) return { label: 'Workopolis', bg: '#EDE7F6', color: '#4527A0' };
  if (url.includes('xing.com')) return { label: 'Xing', bg: '#E0F2F1', color: '#00695C' };
  if (url.includes('pnet.co.za')) return { label: 'PNet', bg: '#FCE4EC', color: '#880E4F' };
  return null;
}

// ─── Platform deep-link shortcuts ────────────────────────────────────────────

interface Platform {
  key: string;
  label: string;
  bg: string;
  color: string;
  buildUrl: (query: string, location: string) => string;
}

const GLOBAL_PLATFORMS: Platform[] = [
  {
    key: 'indeed',
    label: 'Indeed',
    bg: '#E8F0FE',
    color: '#1A56DB',
    buildUrl: (q, l) =>
      `https://www.indeed.com/jobs?q=${encodeURIComponent(q)}&l=${encodeURIComponent(l)}`,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    bg: '#E0EAF5',
    color: '#0A66C2',
    buildUrl: (q, l) =>
      `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(q)}&location=${encodeURIComponent(l)}`,
  },
  {
    key: 'glassdoor',
    label: 'Glassdoor',
    bg: '#E6F4EA',
    color: '#1E8E3E',
    buildUrl: (q) =>
      `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${encodeURIComponent(q)}&locT=C&locId=1`,
  },
  {
    key: 'monster',
    label: 'Monster',
    bg: '#F3E5F5',
    color: '#7B1FA2',
    buildUrl: (q) =>
      `https://www.monster.com/jobs/search?q=${encodeURIComponent(q)}`,
  },
];

const COUNTRY_PLATFORMS: Record<string, Platform[]> = {
  gb: [
    {
      key: 'reed',
      label: 'Reed',
      bg: '#FCE8E6',
      color: '#B31412',
      buildUrl: (q, l) =>
        `https://www.reed.co.uk/jobs/${encodeURIComponent(q)}-jobs-in-${encodeURIComponent(l || 'uk')}`,
    },
    {
      key: 'totaljobs',
      label: 'Total Jobs',
      bg: '#EDE7F6',
      color: '#6200EA',
      buildUrl: (q, l) =>
        `https://www.totaljobs.com/jobs/${encodeURIComponent(q)}/in-${encodeURIComponent(l || 'uk')}`,
    },
    {
      key: 'cvlibrary',
      label: 'CV-Library',
      bg: '#E8F5E9',
      color: '#2E7D32',
      buildUrl: (q) =>
        `https://www.cv-library.co.uk/search-jobs?q=${encodeURIComponent(q)}`,
    },
  ],
  au: [
    {
      key: 'seek_au',
      label: 'Seek',
      bg: '#E3F2FD',
      color: '#1565C0',
      buildUrl: (q, l) =>
        `https://www.seek.com.au/jobs?keywords=${encodeURIComponent(q)}&where=${encodeURIComponent(l)}`,
    },
  ],
  in: [
    {
      key: 'naukri',
      label: 'Naukri',
      bg: '#FFF3E0',
      color: '#E65100',
      buildUrl: (q, l) =>
        `https://www.naukri.com/${encodeURIComponent(q)}-jobs?k=${encodeURIComponent(q)}&l=${encodeURIComponent(l)}`,
    },
  ],
  us: [
    {
      key: 'ziprecruiter',
      label: 'ZipRecruiter',
      bg: '#E8F5E9',
      color: '#1B5E20',
      buildUrl: (q, l) =>
        `https://www.ziprecruiter.com/jobs-search?search=${encodeURIComponent(q)}&location=${encodeURIComponent(l)}`,
    },
  ],
  ca: [
    {
      key: 'workopolis',
      label: 'Workopolis',
      bg: '#EDE7F6',
      color: '#4527A0',
      buildUrl: (q, l) =>
        `https://www.workopolis.com/jobsearch/find-jobs?ak=${encodeURIComponent(q)}&l=${encodeURIComponent(l)}`,
    },
  ],
  nz: [
    {
      key: 'seek_nz',
      label: 'Seek NZ',
      bg: '#E3F2FD',
      color: '#1565C0',
      buildUrl: (q, l) =>
        `https://www.seek.co.nz/jobs?keywords=${encodeURIComponent(q)}&where=${encodeURIComponent(l)}`,
    },
  ],
  za: [
    {
      key: 'pnet',
      label: 'PNet',
      bg: '#FCE4EC',
      color: '#880E4F',
      buildUrl: (q) =>
        `https://www.pnet.co.za/jobs/${encodeURIComponent(q)}`,
    },
  ],
};

const XING_COUNTRIES = new Set(['de', 'at', 'ch']);
const XING_PLATFORM: Platform = {
  key: 'xing',
  label: 'Xing',
  bg: '#E0F2F1',
  color: '#00695C',
  buildUrl: (q) =>
    `https://www.xing.com/jobs/search?keywords=${encodeURIComponent(q)}`,
};

function getPlatformsForCountry(countryCode: string): Platform[] {
  const countrySpecific = COUNTRY_PLATFORMS[countryCode] ?? [];
  const xing = XING_COUNTRIES.has(countryCode) ? [XING_PLATFORM] : [];
  return [...GLOBAL_PLATFORMS, ...countrySpecific, ...xing];
}

function PlatformShortcuts({
  query,
  location,
  selectedCountry,
}: {
  query: string;
  location: string;
  selectedCountry: string;
}) {
  const platforms = getPlatformsForCountry(selectedCountry);

  const handlePlatformPress = async (platform: Platform) => {
    const url = platform.buildUrl(query, location);
    console.log('[Jobs] Platform shortcut pressed:', platform.label, '→', url);
    try {
      await Linking.openURL(url);
    } catch (e) {
      console.error('[Jobs] Failed to open URL:', url, e);
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.platformScroll}
      contentContainerStyle={styles.platformContent}
    >
      {platforms.map((platform) => (
        <AnimatedPressable
          key={platform.key}
          style={[styles.platformBtn, { backgroundColor: platform.bg, borderColor: platform.color + '40' }]}
          onPress={() => handlePlatformPress(platform)}
        >
          <Text style={[styles.platformBtnText, { color: platform.color }]}>{platform.label}</Text>
        </AnimatedPressable>
      ))}
    </ScrollView>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

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
  }, [opacity]);
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

function JobCard({
  job,
  onPress,
  index,
  currencySymbol,
}: {
  job: Job;
  onPress: () => void;
  index: number;
  currencySymbol: string;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: Math.min(index * 50, 400), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, delay: Math.min(index * 50, 400), useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  const salaryMin = job.salary_min ? Number(job.salary_min) : null;
  const salaryMax = job.salary_max ? Number(job.salary_max) : null;
  const hasSalary = salaryMin != null || salaryMax != null;
  const sym = currencySymbol;
  const salaryText = hasSalary
    ? salaryMin && salaryMax
      ? `${sym}${Math.round(salaryMin / 1000)}k – ${sym}${Math.round(salaryMax / 1000)}k`
      : salaryMin
      ? `From ${sym}${Math.round(salaryMin / 1000)}k`
      : `Up to ${sym}${Math.round((salaryMax ?? 0) / 1000)}k`
    : null;

  const snippet = job.description?.replace(/<[^>]*>/g, '').slice(0, 120) ?? '';
  const postedDate = formatPostedDate(job.created);
  const jobType = job.contract_type || job.job_type || null;
  const companyInitial = (job.company?.[0] || 'J').toUpperCase();
  const source = detectSource(job.redirect_url);

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
            {source ? (
              <View style={[styles.sourceBadge, { backgroundColor: source.bg, borderColor: source.color + '40' }]}>
                <Text style={[styles.sourceBadgeText, { color: source.color }]}>{source.label}</Text>
              </View>
            ) : (
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
              <Text style={styles.currencySign}>{sym}</Text>
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

  const [selectedCountry, setSelectedCountry] = useState<string>(DEFAULT_COUNTRY);
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const currencySymbol = getCurrencyForCountry(selectedCountry);

  const searchJobs = useCallback(async (
    pageNum = 1,
    append = false,
    overrideKeywords?: string,
    overrideCountry?: string,
  ) => {
    const kw = overrideKeywords !== undefined ? overrideKeywords : keywords;
    const country = overrideCountry !== undefined ? overrideCountry : selectedCountry;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        app_id: ADZUNA_APP_ID,
        app_key: ADZUNA_APP_KEY,
        results_per_page: '10',
      });
      if (kw.trim()) params.set('what', kw.trim());
      if (location.trim()) params.set('where', location.trim());

      const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${pageNum}?${params.toString()}`;
      console.log('[Jobs] Fetching from Adzuna:', url);
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        const text = await response.text();
        console.error('[Jobs] Adzuna error response:', response.status, text.slice(0, 500));
        throw new Error(`Adzuna API error ${response.status}: ${text.slice(0, 120)}`);
      }
      const data = await response.json();
      console.log('[Jobs] Adzuna raw response keys:', Object.keys(data));

      const newJobs: Job[] = (data.results ?? []).map((r: any) => ({
        id: r.id,
        title: r.title,
        company: r.company?.display_name ?? 'Unknown Company',
        location: r.location?.display_name ?? '',
        description: r.description ?? '',
        salary_min: r.salary_min,
        salary_max: r.salary_max,
        redirect_url: r.redirect_url,
        created: r.created,
        category: r.category?.label,
        contract_type: r.contract_type,
        job_type: r.contract_time,
      }));

      console.log(`[Jobs] Got ${newJobs.length} jobs (total: ${data.count ?? 0})`);

      const total = data.count ?? 0;
      if (append) {
        setJobs(prev => [...prev, ...newJobs]);
      } else {
        setJobs(newJobs);
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
  }, [keywords, location, selectedCountry]);

  const handleCountrySelect = (code: string) => {
    if (code === selectedCountry) return;
    console.log('[Jobs] Country selected:', code);
    setSelectedCountry(code);
    setJobs([]);
    setPage(1);
    setHasMore(false);
    if (searched) {
      searchJobs(1, false, undefined, code);
    }
  };

  const handleSearch = () => {
    console.log('[Jobs] Search button pressed - keywords:', keywords, 'location:', location, 'country:', selectedCountry);
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

      {/* Country selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.countryScroll}
        contentContainerStyle={styles.countryContent}
      >
        {COUNTRIES.map((country) => {
          const isActive = selectedCountry === country.code;
          return (
            <AnimatedPressable
              key={country.code}
              style={[styles.countryChip, isActive && styles.countryChipActive]}
              onPress={() => handleCountrySelect(country.code)}
            >
              <Text style={[styles.countryChipText, isActive && styles.countryChipTextActive]}>
                {country.label}
              </Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>

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

      {/* Platform shortcuts */}
      <PlatformShortcuts query={keywords} location={location} selectedCountry={selectedCountry} />

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
              index={index}
              currencySymbol={currencySymbol}
              onPress={() => {
                console.log('[Jobs] Navigate to job detail:', item.id, item.title);
                router.push({
                  pathname: '/job/[id]',
                  params: {
                    id: item.id,
                    jobData: JSON.stringify(item),
                    currencySymbol: currencySymbol,
                  },
                } as any);
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
  // Country selector
  countryScroll: { marginBottom: 8 },
  countryContent: { paddingHorizontal: 20, gap: 8, paddingVertical: 4 },
  countryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  countryChipActive: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary,
  },
  countryChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  countryChipTextActive: { color: COLORS.primaryLight },
  searchSection: { paddingHorizontal: 20, gap: 8, marginBottom: 8 },
  searchRow: { flexDirection: 'row', gap: 8 },
  // Platform shortcuts
  platformScroll: { marginBottom: 6 },
  platformContent: { paddingHorizontal: 20, gap: 8, paddingVertical: 4 },
  platformBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  platformBtnText: { fontSize: 12, fontWeight: '700' },
  // Category chips
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
  sourceBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  sourceBadgeText: { fontSize: 11, fontWeight: '700' },
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
  currencySign: { fontSize: 12, color: COLORS.textSecondary },
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
