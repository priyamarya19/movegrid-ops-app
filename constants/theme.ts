/**
 * MoveGrid design tokens — v2 semantic token pairs.
 *
 * Two complete sets share one shape (`ThemeTokens`):
 *  - `light`: "Soft neo-minimal" — the default; warm off-white, borderless white
 *    squircle cards on layered shadows, bold near-black money numerals, deep
 *    emerald accents. Built for daytime field use in direct sunlight.
 *  - `dark`: "Ambient dark" — the optional night set; near-black canvas, layered
 *    alpha "glass" surfaces (NO backdrop-blur — budget Android GPUs), mint
 *    gradient accents. Toggled from Menu › Settings, persisted per device.
 *
 * The legacy `colors` export stays and maps to the light set, so screens that
 * haven't migrated to `useTheme()` yet render the new light palette correctly —
 * they just don't react to the toggle until migrated.
 */

export type ThemeTokens = {
  /** Canvas behind everything. */
  bg: string;
  /** Cards / panels. */
  surface: string;
  /** Recessed fills: input backgrounds, neutral pills. */
  surfaceAlt: string;
  /** Elevated overlays: sheets, dialogs. */
  surfaceRaised: string;
  border: string;
  /** Brand fill for buttons/FAB/active states. */
  accent: string;
  /** Pressed state of accent fills. */
  accentPressed: string;
  accentSoft: string;
  /** Accent used AS TEXT or icons — darker in light mode for contrast. */
  accentText: string;
  /** Ink on top of accent-filled controls. */
  onAccent: string;
  text: string;
  textMuted: string;
  textFaint: string;
  danger: string;
  dangerText: string;
  dangerSoft: string;
  warning: string;
  warningText: string;
  warningSoft: string;
  /** Money-positive figures (collected, paid). */
  money: string;
  /** Card shadow color (alpha included). */
  shadow: string;
  /** Tab bar background. */
  tabBar: string;
  statusBarStyle: 'dark' | 'light';
};

/** "Soft neo-minimal" — default. All text tokens pass WCAG AA on their surfaces. */
export const lightTheme: ThemeTokens = {
  bg: '#F5F6F2',
  surface: '#FFFFFF',
  surfaceAlt: '#EFF1EC',
  surfaceRaised: '#FFFFFF',
  border: '#E6E9E2',
  accent: '#00C48C',
  accentPressed: '#00A878',
  accentSoft: 'rgba(0,196,140,0.12)',
  accentText: '#0C7A56',
  onAccent: '#06281F',
  text: '#101613',
  textMuted: '#5B6560',
  textFaint: '#959E98',
  danger: '#DC3D43',
  dangerText: '#B3261E',
  dangerSoft: 'rgba(220,61,67,0.10)',
  warning: '#D97706',
  warningText: '#8A5A00',
  warningSoft: 'rgba(217,119,6,0.12)',
  money: '#0C7A56',
  shadow: 'rgba(16,22,19,0.08)',
  tabBar: '#FFFFFF',
  statusBarStyle: 'dark',
};

/** "Ambient dark" — optional night set. Layered alpha glass, no blur. */
export const darkTheme: ThemeTokens = {
  bg: '#070C14',
  surface: 'rgba(255,255,255,0.055)',
  surfaceAlt: 'rgba(255,255,255,0.09)',
  surfaceRaised: '#111A26',
  border: 'rgba(255,255,255,0.10)',
  accent: '#00C48C',
  accentPressed: '#00A878',
  accentSoft: 'rgba(0,196,140,0.16)',
  accentText: '#7DF0C6',
  onAccent: '#06281F',
  text: '#F2F7F4',
  textMuted: '#9DAAB4',
  textFaint: '#66727E',
  danger: '#FF5A60',
  dangerText: '#FF8A8E',
  dangerSoft: 'rgba(255,90,96,0.16)',
  warning: '#F5A623',
  warningText: '#FFC463',
  warningSoft: 'rgba(245,166,35,0.16)',
  money: '#7DF0C6',
  shadow: 'rgba(0,0,0,0.45)',
  tabBar: '#0B1220',
  statusBarStyle: 'light',
};

/**
 * Legacy static export — the light set under the old names. Screens still on
 * `import { colors }` render neo-minimal light and ignore the toggle until
 * they migrate to `useTheme()`.
 */
export const colors = {
  bg: lightTheme.bg,
  surface: lightTheme.surface,
  surfaceAlt: lightTheme.surfaceAlt,
  border: lightTheme.border,
  accent: lightTheme.accent,
  accentSoft: lightTheme.accentSoft,
  text: lightTheme.text,
  textMuted: lightTheme.textMuted,
  textFaint: lightTheme.textFaint,
  danger: lightTheme.danger,
  dangerSoft: lightTheme.dangerSoft,
  warning: lightTheme.warning,
  warningSoft: lightTheme.warningSoft,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
} as const;

/** 4pt spacing scale: space(4) => 16 */
export const space = (n: number) => n * 4;

/** Type scale (weights 600–800; use tabular numerals for money). */
export const type = {
  overline: 11,
  caption: 12,
  label: 13,
  body: 15,
  subtitle: 17,
  title: 20,
  screenTitle: 24,
  moneyHero: 32,
  amountEntry: 52,
} as const;
