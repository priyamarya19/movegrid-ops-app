/**
 * MoveGrid design tokens — light theme with the brand green accent.
 */
export const colors = {
  bg: '#F4F5F7', // app background (soft off-white)
  surface: '#FFFFFF', // cards / panels
  surfaceAlt: '#EEF0F3',
  border: '#E5E7EB', // hairline borders
  accent: '#00C48C',
  accentSoft: 'rgba(0,196,140,0.12)',
  text: '#0E1116', // near-black
  textMuted: '#5B6472', // secondary text
  textFaint: '#9AA1AC', // tertiary text
  danger: '#EF4444',
  dangerSoft: 'rgba(239,68,68,0.12)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245,158,11,0.12)',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

/** 4pt spacing scale: space(4) => 16 */
export const space = (n: number) => n * 4;
