export const COLORS = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceAlt: '#263348',
  accent: '#F59E0B',
  accentMuted: 'rgba(245, 158, 11, 0.15)',
  accentDim: 'rgba(245, 158, 11, 0.08)',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  border: '#334155',
  borderLight: 'rgba(255,255,255,0.06)',
  success: '#22C55E',
  successMuted: 'rgba(34, 197, 94, 0.15)',
  error: '#EF4444',
  errorMuted: 'rgba(239, 68, 68, 0.15)',
  warning: '#F59E0B',
  warningMuted: 'rgba(245, 158, 11, 0.15)',
  info: '#3B82F6',
  infoMuted: 'rgba(59, 130, 246, 0.15)',
  scoreRed: '#EF4444',
  scoreAmber: '#F59E0B',
  scoreGreen: '#22C55E',
};

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  saved: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8' },
  applied: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6' },
  interviewing: { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B' },
  offered: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22C55E' },
  rejected: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444' },
};

export function getScoreColor(score: number): string {
  if (score <= 40) return COLORS.scoreRed;
  if (score <= 70) return COLORS.scoreAmber;
  return COLORS.scoreGreen;
}
