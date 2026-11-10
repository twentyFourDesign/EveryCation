import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { formatNaira } from '@everycation/shared';
import { Badge, Button, Empty, Loading, Note, Photo, Screen, SectionTitle, T, go } from '@/ui';
import { errorMessage } from '@/lib/api';
import { useStudio, type Plan } from '@/lib/plans';
import { useSession } from '@/lib/session';
import { fmt, tripImage } from '@/lib/trips';

const line = (p: Plan): { text: string; badge: string; tone: 'info' | 'gold' | 'neutral' } =>
  p.status === 'private' ? { text: 'Only you can see it', badge: 'Private', tone: 'neutral' }
    : p.status === 'free' ? { text: `Free · saved ${p.used} time${p.used === 1 ? '' : 's'}`, badge: 'Free', tone: 'neutral' }
    : p.status === 'scheduled' ? { text: `${formatNaira(p.price)} · on sale from ${p.opensAt ? fmt(p.opensAt.slice(0, 10), { day: 'numeric', month: 'short' }) : 'the day after your trip'}`, badge: 'Scheduled', tone: 'gold' }
    : { text: `${formatNaira(p.price)} · ${p.used} sale${p.used === 1 ? '' : 's'}`, badge: 'On sale', tone: 'info' };

export default function CreatorStudio() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  const { data: s, isLoading, error } = useStudio();
  if (!signedIn) return <Screen title="Creator studio"><View className="gap-4 pt-10"><T className="text-center text-ink-muted">Sign in to share or sell the trips you have taken.</T><Button label="SIGN IN" onPress={() => router.push('/sign-up')} /></View></Screen>;
  return (
    <Screen title="Creator studio">
      {isLoading && <Loading what="your studio" />}
      {!!error && <Note tone="danger">{errorMessage(error)}</Note>}
      {s && (
        <>
          <View className="gap-3 rounded-card bg-navy p-5">
            <Text className="font-pop text-[13px] text-navy-text-soft">Your earnings this month</Text>
            <Text className="font-pop-sb text-[34px] leading-10 text-white">{formatNaira(s.month.net)}</Text>
            <View className="gap-1.5 border-t border-white/20 pt-3">
              <View className="flex-row justify-between"><Text className="font-pop text-sm text-white">{s.month.sales} sale{s.month.sales === 1 ? '' : 's'}</Text><Text className="font-pop-md text-sm text-white">{formatNaira(s.month.gross)}</Text></View>
              <View className="flex-row justify-between"><Text className="font-pop text-sm text-white">Platform fee ({s.feePercent}%)</Text><Text className="font-pop-md text-sm text-white">{formatNaira(-s.month.fee)}</Text></View>
              <View className="flex-row justify-between"><Text className="font-pop text-sm text-white">Waiting for next payout</Text><Text className="font-pop-md text-sm text-gold">{formatNaira(s.waitingForPayout)}</Text></View>
            </View>
            <Pressable accessibilityRole="link" hitSlop={10} onPress={() => router.dismissTo('/wallet')}><Text className="font-pop-sb text-[13px] text-gold">View in wallet</Text></Pressable>
          </View>
          {!s.canBePaid && <Note tone="gold">You can list plans now. To be paid, confirm your identity in your wallet; your earnings wait for you until then.</Note>}
          <SectionTitle>Your plans</SectionTitle>
          {s.plans.length === 0 && <Empty>No plans yet. Turn a trip with at least 3 stops into a plan.</Empty>}
          {s.plans.map((p) => { const l = line(p); return (
            <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`${p.title}, ${l.badge}`} onPress={() => go(`/plans/${p.id}`)} className="flex-row items-center gap-3 rounded-card bg-surface-muted p-3 active:opacity-80">
              <Photo k={tripImage({ id: p.tripId, imageKey: p.imageKey })} className="h-16 w-16 rounded-2xl" /><View className="flex-1 gap-0.5"><T v="strong" numberOfLines={1}>{p.title}</T><T v="small">{l.text}</T></View><Badge label={l.badge} tone={l.tone} />
            </Pressable>); })}
          <Button variant="outline" icon={Plus} label="Turn a trip into a plan" onPress={() => router.push('/plans/sell')} />
          <T v="small" className="text-center text-xs">Anyone can sell. You keep {100 - s.feePercent}% of every sale. Paid plans go on sale after your trip ends, and payouts need a verified ID.</T>
        </>
      )}
    </Screen>
  );
}
