import { LinearGradient } from 'expo-linear-gradient';
import { Text, Pressable, View } from 'react-native';
import { formatNaira, type ImageKey } from '@everycation/shared';
import type { TravelPackage } from '@/lib/packages';
import { flag } from '@/lib/travel';
import { Photo, T, cx, go } from './index';
import { VIBES } from './bucket-list';

const GRADIENTS: Record<string, [string, string]> = {
  beach: ['#005F8F', '#3CC4E6'], nature: ['#14532D', '#4CAF6A'], culture: ['#4A1D6B', '#A35BD0'], city: ['#002C82', '#2D6BD8'], adventure: ['#8A3209', '#F07B3C'], food: ['#7A5A00', '#F2B705'],
};
const nightsText = (n: number) => (n === 0 ? 'Day trip' : `${n} night${n === 1 ? '' : 's'}`);

/** The package photo, or until the advertiser uploads one, a cover in the colours of its vibe. */
export function PackageCover({ p, className, big }: { p: TravelPackage; className?: string; big?: boolean }) {
  if (p.imageUrl || p.imageKey) return <Photo k={(p.imageKey ?? 'lagoon-aerial') as ImageKey} uri={p.imageUrl} className={className} alt={p.title} />;
  const [a, b] = GRADIENTS[p.vibe ?? 'city'] ?? GRADIENTS.city!;
  return (
    <View className={cx('overflow-hidden', className)}>
      <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
        <Text style={{ position: 'absolute', right: big ? 24 : 14, bottom: big ? 48 : 12, fontSize: big ? 120 : 68, opacity: 0.95 }}>{p.vibe ? VIBES[p.vibe].emoji : '✈️'}</Text>
      </LinearGradient>
    </View>
  );
}

/** "Sponsored" is always shown, so a paid package is never mistaken for a traveller's own tip. */
export const SponsoredTag = ({ p, light }: { p: TravelPackage; light?: boolean }) => (
  <View className="flex-row flex-wrap items-center gap-1.5">
    <View className={cx('rounded-full px-2 py-0.5', light ? 'bg-white/90' : 'bg-gold-soft')}><Text className="font-pop-sb text-[10px] tracking-wider text-ink">SPONSORED</Text></View>
    {p.sample && <View className="rounded-full bg-black/60 px-2 py-0.5"><Text className="font-pop-sb text-[10px] tracking-wider text-white">SAMPLE</Text></View>}
  </View>
);

export function PackageCard({ p, wide }: { p: TravelPackage; wide?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Sponsored package: ${p.title}, ${nightsText(p.nights)}, from ${formatNaira(p.price)}, by ${p.advertiser.name}`} onPress={() => go(`/packages/${p.id}`)}
      className={cx('overflow-hidden rounded-card border border-line bg-white active:opacity-85', wide ? 'w-full' : 'w-[270px]')}>
      <View>
        <PackageCover p={p} className={wide ? 'h-[170px]' : 'h-[150px]'} />
        <View className="absolute left-3 top-3"><SponsoredTag p={p} light /></View>
      </View>
      <View className="gap-1 p-3.5">
        <T v="eyebrow" className="text-ink-muted" numberOfLines={1}>{flag(p.countryCode)} {p.destination.toUpperCase()} · {nightsText(p.nights).toUpperCase()}</T>
        <T v="strong" numberOfLines={2}>{p.title}</T>
        <View className="flex-row items-end justify-between gap-2 pt-1">
          <View className="flex-1"><Text className="font-pop text-[11px] text-ink-muted">From</Text><Text className="font-pop-sb text-lg text-navy">{formatNaira(p.price)}</Text></View>
          <Text numberOfLines={1} className="max-w-[55%] font-pop text-xs text-ink-muted">by {p.advertiser.name.replace(' (sample agency)', '')}</Text>
        </View>
        {!!p.priceNote && <Text numberOfLines={1} className="font-pop text-[11px] text-ink-muted">{p.priceNote}</Text>}
      </View>
    </Pressable>
  );
}
export { nightsText };
