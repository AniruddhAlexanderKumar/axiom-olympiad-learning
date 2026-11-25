export const colors = {
  green: '#58CC02',
  greenDark: '#46A302',
  greenSoft: '#D7FFB8',
  blue: '#1CB0F6',
  blueDark: '#1899D6',
  blueSoft: '#DDF4FF',
  purple: '#CE82FF',
  purpleSoft: '#F3E5FF',
  orange: '#FF9600',
  orangeSoft: '#FFF1D9',
  red: '#FF4B4B',
  redDark: '#E03D3D',
  redSoft: '#FFDFE0',
  yellow: '#FFC800',
  text: '#1F2933',
  textMuted: '#6B7280',
  textFaint: '#9AA3AF',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  background: '#FFFFFF',
  surface: '#F7F9FA',
  surfaceAlt: '#EFF3F6',
  black: '#111827',
  white: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  button: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
};

export const type = {
  display: { fontSize: 30, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '800' as const, color: colors.text },
  heading: { fontSize: 18, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, fontWeight: '500' as const, color: colors.text, lineHeight: 22 },
  small: { fontSize: 13, fontWeight: '600' as const, color: colors.textMuted },
  tiny: { fontSize: 11, fontWeight: '700' as const, color: colors.textFaint, letterSpacing: 0.6 },
  mono: {
    fontFamily: 'monospace' as const,
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 21,
  },
};

export const modeColors: Record<string, string> = {
  learn: colors.green,
  compete: colors.blue,
  review: colors.purple,
  contest: colors.orange,
};
