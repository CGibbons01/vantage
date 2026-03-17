import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NAVY = '#0F2B5B';
const CARD = '#1A3A6B';
const AMBER = '#F59E0B';
const WHITE = '#FFFFFF';
const SLATE = '#94A3B8';
const BORDER = 'rgba(255,255,255,0.08)';

interface SectionProps {
  title: string;
  children: React.ReactNode;
  isLast?: boolean;
}

function Section({ title, children, isLast }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
      {!isLast && <View style={styles.sectionDivider} />}
    </View>
  );
}

function BulletItem({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Last updated: January 2025</Text>

        <Section title="Introduction">
          <Text style={styles.bodyText}>
            Vantage AI Recruitment ('we', 'our', 'us') is committed to protecting your personal data. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile application.
          </Text>
        </Section>

        <Section title="Information We Collect">
          <Text style={styles.bodyText}>We may collect the following information:</Text>
          <View style={styles.bulletList}>
            <BulletItem text="Name and email address" />
            <BulletItem text="CV/resume content" />
            <BulletItem text="Job search queries and preferences" />
            <BulletItem text="Application history and status" />
            <BulletItem text="Device identifiers for push notifications" />
          </View>
        </Section>

        <Section title="How We Use Your Information">
          <Text style={styles.bodyText}>Your information is used to:</Text>
          <View style={styles.bulletList}>
            <BulletItem text="Provide AI-powered CV analysis and job matching" />
            <BulletItem text="Generate personalised cover letters" />
            <BulletItem text="Send job alert notifications (with your consent)" />
            <BulletItem text="Improve and develop our services" />
          </View>
        </Section>

        <Section title="Data Storage & Security">
          <Text style={styles.bodyText}>
            Your data is stored securely on our servers. CV content is processed by AI models solely to provide the features you request and is not shared with third parties for marketing purposes. We use industry-standard encryption to protect your data in transit and at rest.
          </Text>
        </Section>

        <Section title="Third-Party Services">
          <Text style={styles.bodyText}>
            We use the following third-party services, each governed by their own privacy policy:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="RevenueCat — subscription management" />
            <BulletItem text="OneSignal — push notifications" />
            <BulletItem text="Adzuna — job listings" />
          </View>
        </Section>

        <Section title="Your Rights">
          <Text style={styles.bodyText}>
            You may request deletion of your account and all associated data at any time by contacting us at admin@gibbonsrecruitment.com. You can withdraw notification consent at any time in the app settings under Notification Preferences.
          </Text>
        </Section>

        <Section title="Contact Us" isLast>
          <Text style={styles.bodyText}>
            For privacy enquiries, please contact us at:
          </Text>
          <View style={styles.contactCard}>
            <Text style={styles.contactEmail}>admin@gibbonsrecruitment.com</Text>
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  lastUpdated: {
    fontSize: 12,
    color: SLATE,
    marginBottom: 24,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: WHITE,
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  sectionBody: {
    marginBottom: 20,
  },
  sectionDivider: {
    height: 2,
    backgroundColor: AMBER,
    opacity: 0.25,
    borderRadius: 1,
    marginBottom: 20,
  },
  bodyText: {
    fontSize: 14,
    color: SLATE,
    lineHeight: 22,
  },
  bulletList: {
    marginTop: 10,
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AMBER,
    marginTop: 7,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: SLATE,
    lineHeight: 22,
  },
  contactCard: {
    marginTop: 12,
    backgroundColor: CARD,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  contactEmail: {
    fontSize: 15,
    fontWeight: '600',
    color: AMBER,
  },
});
