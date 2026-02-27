// ── Font Sizes ──────────────────────────────────────────────────────────────
export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
} as const;

// ── Font Weights ────────────────────────────────────────────────────────────
export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

// ── Spacing ─────────────────────────────────────────────────────────────────
export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// ── Border Radius ───────────────────────────────────────────────────────────
export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
} as const;

// ── Touch Target ────────────────────────────────────────────────────────────
export const TOUCH_TARGET = 44;

// ── Color Palette ───────────────────────────────────────────────────────────
const dark = {
  // Backgrounds
  background: '#0F0F0F',
  surface: '#1A1A1A',
  surfaceRaised: '#242424',
  surfaceHighlight: '#2A2A2A',

  // Text
  text: '#F2F2F2',
  textSecondary: '#A0A0A0',
  textTertiary: '#606060',
  textDisabled: '#404040',

  // Brand
  primary: '#6366F1',
  primaryLight: '#818CF8',

  // Borders
  border: '#2E2E2E',
  borderSubtle: '#232323',

  // Tab bar
  tabBar: '#141414',

  // Semantic
  error: '#EF4444',
  warning: '#F59E0B',
  success: '#22C55E',

  // Workout-specific
  restTimer: '#06B6D4',
  warmup: '#FCD34D',
  failure: '#EF4444',
  drop: '#A78BFA',
  setCompleted: '#22C55E',
  pr: '#F59E0B',
};

const light = {
  // Backgrounds
  background: '#F8F8F8',
  surface: '#FFFFFF',
  surfaceRaised: '#F0F0F0',
  surfaceHighlight: '#E8E8E8',

  // Text
  text: '#111111',
  textSecondary: '#555555',
  textTertiary: '#999999',
  textDisabled: '#CCCCCC',

  // Brand
  primary: '#4F46E5',
  primaryLight: '#6366F1',

  // Borders
  border: '#E0E0E0',
  borderSubtle: '#EEEEEE',

  // Tab bar
  tabBar: '#FFFFFF',

  // Semantic
  error: '#EF4444',
  warning: '#F59E0B',
  success: '#22C55E',

  // Workout-specific
  restTimer: '#0891B2',
  warmup: '#D97706',
  failure: '#DC2626',
  drop: '#7C3AED',
  setCompleted: '#16A34A',
  pr: '#D97706',
};

export const Colors = { dark, light } as const;
export type Theme = typeof dark;
