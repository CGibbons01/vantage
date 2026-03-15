import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, Sparkles } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { AnimatedPressable } from '@/components/AnimatedPressable';

interface PremiumLockProps {
  featureName: string;
  description: string;
}

export function PremiumLock({ featureName, description }: PremiumLockProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.iconRing}>
        <View style={styles.iconCircle}>
          <Lock size={32} color={COLORS.accent} />
        </View>
      </View>
      <View style={styles.badge}>
        <Sparkles size={12} color={COLORS.accent} />
        <Text style={styles.badgeText}>Premium Feature</Text>
      </View>
      <Text style={styles.title}>{featureName}</Text>
      <Text style={styles.description}>{description}</Text>
      <AnimatedPressable
        style={styles.upgradeBtn}
        onPress={() => {
          console.log('[PremiumLock] Upgrade to Premium pressed for:', featureName);
          router.push('/paywall');
        }}
      >
        <Sparkles size={16} color="#000" />
        <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
    backgroundColor: COLORS.background,
  },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.accentDim,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.accent,
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 16,
    boxShadow: '0 4px 16px rgba(245,158,11,0.35)',
  },
  upgradeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
});
