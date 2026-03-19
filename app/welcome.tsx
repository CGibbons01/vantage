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
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { IconSymbol } from '@/components/IconSymbol';

const NAVY = '#0F2B5B';
const CARD = '#1A3A6B';
const AMBER = '#F59E0B';
const AMBER_MUTED = 'rgba(245, 158, 11, 0.15)';
const WHITE = '#FFFFFF';
const SLATE = '#94A3B8';
const BORDER = 'rgba(255,255,255,0.08)';

interface FeatureRowProps {
  icon: string;
  title: string;
  description: string;
  delay: number;
  iconBg: string;
}

function FeatureRow({ icon, title, description, delay, iconBg }: FeatureRowProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const badgeStyle = {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: iconBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0 as const,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  };

  return (
    <Animated.View style={[styles.featureRow, { opacity, transform: [{ translateX }] }]}>
      <View style={badgeStyle}>
        <IconSymbol name={icon as any} size={26} color={WHITE} />
      </View>
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
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(heroSlide, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
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

      {/* Background accent blobs */}
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />

      {/* Hero section */}
      <Animated.View
        style={[
          styles.heroSection,
          { opacity: fadeAnim, transform: [{ translateY: heroSlide }] },
        ]}
      >
        <Image
          source={require('../assets/images/app-icon-lca.png')}
          style={styles.logoImage}
          resizeMode="cover"
        />
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
          iconBg="#1E40AF"
        />
        <View style={styles.featureDivider} />
        <FeatureRow
          icon="briefcase.fill"
          title="Matched Job Search"
          description="Find roles that fit your skills with AI match percentages"
          delay={320}
          iconBg="#B45309"
        />
        <View style={styles.featureDivider} />
        <FeatureRow
          icon="envelope.fill"
          title="AI Cover Letters"
          description="Generate tailored cover letters for any job in seconds"
          delay={440}
          iconBg="#065F46"
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
          <Text style={styles.ctaButtonText}>Get Started</Text>
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
    backgroundColor: NAVY,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  blobTop: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
  },
  blobBottom: {
    position: 'absolute',
    bottom: 60,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 32,
  },
  logoImage: {
    width: 90,
    height: 90,
    borderRadius: 20,
    marginBottom: 20,
  },
  appName: {
    fontSize: 40,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: -1,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '600',
    color: AMBER,
    letterSpacing: 0.5,
  },
  featuresSection: {
    backgroundColor: CARD,
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
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: AMBER_MUTED,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: AMBER,
    borderRadius: 14,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: AMBER,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.2,
  },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInPrompt: {
    fontSize: 14,
    color: WHITE,
  },
  signInLink: {
    fontSize: 14,
    fontWeight: '700',
    color: AMBER,
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
    color: AMBER,
  },
});
