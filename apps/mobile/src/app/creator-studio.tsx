import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { api, formatNaira, saleOpensAt, type TripPlan } from '@everycation/shared';
import { Badge, Button, Photo, Screen, SectionTitle, T, go } from '@/ui';
import { useApp } from '@/lib/store';

export default function CreatorStudio() {
  const { data: e } = useQuery({ queryKey: ['earnings'], queryFn: api.creatorEarnings });
  const { data: plans = [] } = useQuery({ queryKey: ['myPlans'], queryFn: api.myPlans });
  const listing = useApp((s) => s.planListing);
  const line = (p: TripPlan): { text: string; badge: string; tone: 'info' | 'gold' | 'neutral' } => {
    if (p.status === 'scheduled') {
      if (listing.mode === 'private') return { text: 'Only you can see it', badge: 'Private', tone: 'neutral' };
      if (listing.mode === 'free') return { text: 'Free · shared with everyone', badge: 'Free', tone: 'neutral' };
      const opens = saleOpensAt(p.tripEnds!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' });
      return { text: `${formatNaira(listing.price)} · on sale from ${opens}`, badge: 'Scheduled', tone: 'gold' };
    }
    return p.price ? { text: `${formatNaira(p.price)} · ${p.sales} sales · ${p.rating} rating`, badge: 'On sale', tone: 'info' } : { text: `Free · saved ${p.saved} times · shared ${p.shared}`, badge: 'Free', tone: 'neutral' };
  };
  return (
    <Screen title="Creator studio">
      {e && (
        <View className="gap-3 rounded-card bg-navy p-5">
          <Text className="font-pop text-[13px] text-navy-text-soft">Your earnings · {e.month}</Text>
          <Text className="font-pop-sb text-[34px] leading-10 text-white">{formatNaira(e.net)}</Text>
          <View className="gap-1.5 border-t border-white/20 pt-3">
            <View className="flex-row justify-between"><Text className="font-pop text-sm text-white">{e.sales} sales</Text><Text className="font-pop-md text-sm text-white">{formatNaira(e.gross)}</Text></View>
            <View className="flex-row justify-between"><Text className="font-pop text-sm text-white">Platform fee (25%)</Text><Text className="font-pop-md text-sm text-white">{formatNaira(-e.fee)}</Text></View>
          </View>
          <View className="flex-row items-center justify-between"><Text className="flex-1 font-pop text-xs text-navy-text-soft">Paid into your wallet every Friday</Text>
            <Pressable accessibilityRole="link" hitSlop={10} onPress={() => router.dismissTo('/wallet')}><Text className="font-pop-sb text-[13px] text-gold">View in wallet</Text></Pressable></View>
        </View>
      )}
      <SectionTitle>Your plans</SectionTitle>
      {plans.map((p) => { const l = line(p); return (
        <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`${p.title}, ${l.badge}`} onPress={() => go(p.status === 'scheduled' ? '/plans/sell' : `/plans/${p.id}`)} className="flex-row items-center gap-3 rounded-card bg-surface-muted p-3 active:opacity-80">
          <Photo k={p.image} className="h-16 w-16 rounded-2xl" /><View className="flex-1 gap-0.5"><T v="strong" numberOfLines={1}>{p.title}</T><T v="small">{l.text}</T></View><Badge label={l.badge} tone={l.tone} />
        </Pressable>); })}
      <Button variant="outline" icon={Plus} label="Turn a past trip into a plan" onPress={() => router.dismissTo('/travels')} />
      <T v="small" className="text-center text-xs">Anyone can sell. You keep 75% of every sale. Paid plans go on sale after your trip ends, and payouts need a verified ID.</T>
    </Screen>
  );
}
