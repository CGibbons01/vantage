import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  StatusBar,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { IconSymbol } from '@/components/IconSymbol';
import { COLORS } from '@/constants/theme';

const WHITE = '#F0EEFF';
const SLATE = '#A89EC9';
const BORDER = 'rgba(124, 58, 237, 0.2)';

interface FeatureRowProps {
  icon: string;
  title: string;
  description: string;
  delay: number;
  gradientColors: readonly [string, string];
}

function FeatureRow({ icon, title, description, delay, gradientColors }: FeatureRowProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 400, delay, useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[styles.featureRow, { opacity, transform: [{ translateX }] }]}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.featureBadge}
      >
        <IconSymbol name={icon as any} size={24} color={WHITE} />
      </LinearGradient>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{description}</Text>
      </View>
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(heroSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGetStarted = () => {
    console.log('[Welcome] Get Started pressed — navigating to auth-screen');
    router.push('/auth-screen');
  };

  const handlePrivacy = () => {
    console.log('[Welcome] Privacy Policy pressed — navigating to privacy');
    router.push('/privacy');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" />

      {/* Background gradient */}
      <LinearGradient
        colors={['#0D0B1E', '#161230', '#0D0B1E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Glow orbs */}
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />

      {/* Hero section */}
      <Animated.View
        style={[
          styles.heroSection,
          { opacity: fadeAnim, transform: [{ translateY: heroSlide }] },
        ]}
      >
        <View style={styles.logoGlow}>
          <Image
            source={require('../assets/images/app-icon-lca.png')}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </View>
        <Text style={styles.appName}>Vantage</Text>
        <Text style={styles.tagline}>AI-Powered Recruitment</Text>
      </Animated.View>

      {/* Feature highlights */}
      <View style={styles.featuresSection}>
        <FeatureRow
          icon="doc.text.fill"
          title="Smart CV Analysis"
          description="Upload your CV and get an instant AI-powered score and improvement tips"
          delay={200}
          gradientColors={['#7C3AED', '#4F46E5']}
        />
        <View style={styles.featureDivider} />
        <FeatureRow
          icon="briefcase.fill"
          title="Matched Job Search"
          description="Find roles that fit your skills with AI match percentages"
          delay={320}
          gradientColors={['#4F46E5', '#3B82F6']}
        />
        <View style={styles.featureDivider} />
        <FeatureRow
          icon="envelope.fill"
          title="AI Cover Letters"
          description="Generate tailored cover letters for any job in seconds"
          delay={440}
          gradientColors={['#EC4899', '#7C3AED']}
        />
      </View>

      {/* Bottom CTA section */}
      <Animated.View style={[styles.bottomSection, { opacity: fadeAnim }]}>
        <AnimatedPressable
          style={styles.ctaButton}
          onPress={handleGetStarted}
          accessibilityRole="button"
          accessibilityLabel="Get started with Vantage"
        >
          <LinearGradient
            colors={['#7C3AED', '#4F46E5', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaButtonText}>Get Started</Text>
          </LinearGradient>
        </AnimatedPressable>

        <View style={styles.privacyRow}>
          <Text style={styles.privacyText}>By continuing you agree to our </Text>
          <AnimatedPressable
            onPress={handlePrivacy}
            accessibilityRole="button"
            accessibilityLabel="View Privacy Policy"
          >
            <Text style={styles.privacyLink}>Privacy Policy</Text>
          </AnimatedPressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  blobTop: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
  },
  blobBottom: {
    position: 'absolute',
    bottom: 60,
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(236, 72, 153, 0.07)',
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 32,
  },
  logoGlow: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 16,
    marginBottom: 20,
  },
  logoImage: {
    width: 90,
    height: 90,
    borderRadius: 22,
  },
  appName: {
    fontSize: 40,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: -1,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primaryLight,
    letterSpacing: 0.5,
  },
  featuresSection: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  featureBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: WHITE,
    marginBottom: 3,
  },
  featureDesc: {
    fontSize: 13,
    color: SLATE,
    lineHeight: 18,
  },
  featureDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: -4,
  },
  bottomSection: {
    paddingBottom: 8,
    gap: 16,
  },
  ctaButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  ctaGradient: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  ctaButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  privacyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  privacyText: {
    fontSize: 12,
    color: SLATE,
  },
  privacyLink: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primaryLight,
  },
});
