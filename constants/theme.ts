// Premium Purple/Blue/Pink dark theme
export const COLORS = {
  // Backgrounds
  background: '#0D0B1E',
  surface: '#161230',
  surfaceSecondary: '#1E1A3A',
  surfaceElevated: '#251F45',
  surfaceAlt: '#1E1A3A',

  // Text
  text: '#F0EEFF',
  textSecondary: '#A89EC9',
  textMuted: '#6B5F8A',
  textTertiary: '#6B5F8A',

  // Primary (purple)
  primary: '#7C3AED',
  primaryLight: '#9D6FFF',
  primaryMuted: 'rgba(124, 58, 237, 0.15)',

  // Accent (pink)
  accent: '#EC4899',
  accentMuted: 'rgba(236, 72, 153, 0.15)',
  accentDim: 'rgba(236, 72, 153, 0.08)',

  // Blue
  blue: '#3B82F6',
  blueMuted: 'rgba(59, 130, 246, 0.15)',
  info: '#3B82F6',
  infoMuted: 'rgba(59, 130, 246, 0.15)',

  // Semantic
  success: '#10B981',
  successMuted: 'rgba(16, 185, 129, 0.15)',
  warning: '#F59E0B',
  warningMuted: 'rgba(245, 158, 11, 0.15)',
  danger: '#EF4444',
  error: '#EF4444',
  errorMuted: 'rgba(239, 68, 68, 0.15)',

  // Borders
  border: 'rgba(124, 58, 237, 0.2)',
  borderLight: 'rgba(255, 255, 255, 0.06)',
  divider: 'rgba(255, 255, 255, 0.06)',

  // Tab bar
  tabBar: '#0D0B1E',
  tabBarBorder: 'rgba(124, 58, 237, 0.3)',

  // Score colors
  scoreRed: '#EF4444',
  scoreAmber: '#F59E0B',
  scoreGreen: '#10B981',
};

// Gradient arrays for use with LinearGradient
export const PURPLE_PINK_GRADIENT = ['#7C3AED', '#4F46E5', '#EC4899'] as const;
export const PURPLE_BLUE_GRADIENT = ['#7C3AED', '#3B82F6'] as const;
export const PINK_PURPLE_GRADIENT = ['#EC4899', '#7C3AED'] as const;
export const DARK_BG_GRADIENT = ['#0D0B1E', '#161230'] as const;

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  saved: { bg: 'rgba(168, 158, 201, 0.15)', text: '#A89EC9' },
  applied: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6' },
  interviewing: { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B' },
  offered: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981' },
  rejected: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444' },
};

export function getScoreColor(score: number): string {
  if (score <= 40) return COLORS.scoreRed;
  if (score <= 70) return COLORS.scoreAmber;
  return COLORS.scoreGreen;
}
