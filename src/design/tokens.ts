export const colors = {
  white: '#FFFFFF',
  bg: '#FAFBFC',

  // Blue accent (Lingua branding)
  primaryDark: '#1E3A5F',
  primaryMain: '#2563EB',
  primaryMid: '#3B82F6',
  primaryLight: '#60A5FA',
  primaryBright: '#93C5FD',
  primaryFaded: '#DBEAFE',
  primaryPale: '#EFF6FF',

  // Accent (warm orange for contrast)
  accent: '#F59E0B',
  accentLight: '#FEF3C7',
  accentMid: '#FBBF24',
  accentDark: '#B45309',
  accentFaded: '#FFFBEB',

  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray900: '#111827',

  correct: '#059669',
  incorrect: '#EF4444',
} as const

export type ColorToken = keyof typeof colors
