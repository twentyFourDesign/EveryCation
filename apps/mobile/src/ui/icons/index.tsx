import type { ComponentType } from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@everycation/tokens';
import paths from './paths.json';

/**
 * EveryCation's own feature icons, drawn on a 24 grid from the logo's shapes: a navy line, a gold accent,
 * and the logo's hexagon where an icon needs a mark. Utility icons (back, close, tick, plus, search, delete,
 * share) stay standard on purpose, because people read those instantly.
 */
export type BrandIconName = keyof typeof paths;
interface Parts { line?: string[]; solid?: string[]; accent?: string[]; accentLine?: string[] }
export interface IconProps {
  size?: number;
  /** The line colour. */
  color?: string;
  strokeWidth?: number;
  /** The highlight colour; gold unless the icon sits on gold. */
  accent?: string;
  /** One colour, for inactive or disabled states: the accent becomes a light tint of the line colour. */
  mono?: boolean;
  /** Read aloud when the icon stands alone; otherwise the icon is hidden from screen readers. */
  accessibilityLabel?: string;
}
/** Anything an icon slot accepts: a brand icon or a standard one. */
export type Icon = ComponentType<IconProps>;

export function BrandIcon({ name, size = 24, color = colors.navy, strokeWidth = 1.8, accent = colors.gold, mono, accessibilityLabel }: IconProps & { name: BrandIconName }) {
  const p = paths[name] as Parts;
  const fill = mono ? color : accent;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...(accessibilityLabel ? { accessible: true, accessibilityLabel, accessibilityRole: "image" as const } : { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const })}>
      {p.accent?.map((d) => <Path key={`a${d}`} d={d} fill={fill} fillOpacity={mono ? 0.22 : 1} />)}
      {p.solid?.map((d) => <Path key={`s${d}`} d={d} fill={color} />)}
      {p.line?.map((d) => <Path key={`l${d}`} d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />)}
      {p.accentLine?.map((d) => <Path key={`al${d}`} d={d} stroke={mono ? color : accent} strokeWidth={strokeWidth + 0.4} strokeLinecap="round" strokeLinejoin="round" />)}
    </Svg>
  );
}

const make = (name: BrandIconName): Icon => {
  const C = (props: IconProps) => <BrandIcon name={name} {...props} />;
  C.displayName = `Icon(${name})`;
  return C;
};
/** Ready-made components, used like any icon: `<IconWallet size={22} />` or `icon={IconWallet}`. */
export const IconExplore = make('explore'), IconWallet = make('wallet'), IconShop = make('shop'), IconTravels = make('travels'),
  IconPackages = make('packages'), IconTrip = make('trip'), IconSavings = make('savings'), IconBucket = make('bucket'), IconVisa = make('visa'),
  IconChecklist = make('checklist'), IconTips = make('tips'), IconAdvice = make('advice'), IconPlace = make('place'), IconCalendar = make('calendar'),
  IconBell = make('bell'), IconVerified = make('verified'), IconShield = make('shield'), IconLock = make('lock'), IconMic = make('mic'),
  IconCamera = make('camera'), IconTopUp = make('topup'), IconWithdraw = make('withdraw'), IconTransfer = make('transfer'), IconGoal = make('goal'),
  IconBank = make('bank'), IconStore = make('store'), IconMegaphone = make('megaphone'), IconHeart = make('heart'), IconBeach = make('beach'),
  IconCity = make('city'), IconAdventure = make('adventure'), IconFood = make('food'), IconCulture = make('culture'), IconNature = make('nature'),
  IconHealth = make('health'), IconMoney = make('money'), IconDreamer = make('dreamer'), IconWanderer = make('wanderer'), IconGlobe = make('globe'),
  IconTrophy = make('trophy'), IconApply = make('apply'), IconHome = make('home'), IconInspire = make('inspire');
