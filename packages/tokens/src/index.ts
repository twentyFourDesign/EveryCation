/** EveryCation brand tokens. One source for the mobile app and the admin console. */
export const colors = {
  gold: '#FFC502',
  goldLight: '#FFD80A',
  goldSoft: '#FFF1BC',
  onGold: '#262626',
  navy: '#002C82',
  onNavy: '#FFFFFF',
  blue: '#004A9B',
  headingBlue: '#1071B8',
  sky: '#008DD2',
  cyan: '#00B3F1',
  tint: '#E6F0FA',
  ink: '#262626',
  inkMuted: '#5F636A',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F1F1',
  line: '#E3E3E3',
  controlBorder: '#8A8F98',
  danger: '#B42318',
  dangerSoft: '#FDECEA',
  navyTextSoft: '#DCE3F2',
} as const;

export type ColorName = keyof typeof colors;

export const radii = { sm: 10, md: 12, lg: 16, xl: 20, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 28 } as const;

export const fontFamily = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

/** Colours keyed for Tailwind/NativeWind: `bg-navy`, `text-ink-muted`, `border-control-border`… */
export const tailwindColors: Record<string, string> = Object.fromEntries(
  Object.entries(colors).map(([k, v]) => [kebab(k), v]),
);
