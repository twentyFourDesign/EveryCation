import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { BadgeCheck, ChevronLeft, Lock, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatNaira } from '@everycation/shared';
import { Avatar, Badge, Button, IconButton, Loading, Note, Photo, PinPad, Screen, T, go } from '@/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { initials } from '@/lib/community';
import { useBuyPlan, usePlan } from '@/lib/plans';
import { useSession } from '@/lib/session';
import { fmt, tripImage } from '@/lib/trips';
import { useWallet } from '@/lib/wallet';

export default function PlanDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: p, isLoading, error } = usePlan(id);
  const { data: wallet } = useWallet();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const buy = useBuyPlan();
  const [paying, setPaying] = useState(false); const [pin, setPin] = useState(''); const [problem, setProblem] = useState(''); const [key] = useState(() => randomUUID());
  if (isLoading) return <Screen title=""><Loading what="this plan" /></Screen>;
  if (!p) return <Screen title="Trip plan"><Note tone="danger">{error ? errorMessage(error) : 'This plan is not available.'}</Note></Screen>;

  async function pay(value?: string) {
    setProblem('');
    try { await buy.mutateAsync({ id: p!.id, pin: value, key }); setPaying(false); }
    catch (e) { setPin(''); setProblem(errorMessage(e)); if (e instanceof ApiError && e.code === 'pin_required') router.push('/wallet'); }
  }
  function start() {
    if (!signedIn) return router.push('/sign-up');
    if (p!.price === 0) return pay();
    if (!wallet?.setup.ready) return router.push('/wallet');
    if (wallet.available < p!.price) return setProblem(`Your available balance is ${formatNaira(wallet.available)}. Add money to your wallet to buy this plan.`);
    setProblem(''); setPaying(true);
  }
  if (paying) return (
    <Screen title="" scroll={false} className="items-center justify-between" >
      <View className="items-center gap-2"><T v="h2" className="text-center">Pay {formatNaira(p.price)}</T><T v="small" className="text-center">{p.title} · from your available balance</T></View>
      <View className="items-center gap-4"><T v="strong">{buy.isPending ? 'Paying…' : 'Enter your wallet PIN'}</T>
        {!!problem && <Text accessibilityRole="alert" className="text-center font-pop-md text-[13px] text-danger">{problem}</Text>}
        <PinPad value={pin} onChange={(v) => { if (buy.isPending) return; setPin(v); if (v.length === 4) pay(v); }} /></View>
      <Button variant="ghost" label="Cancel" onPress={() => { setPaying(false); setPin(''); setProblem(''); }} />
    </Screen>
  );
  const days = [...new Set(p.itinerary.map((i) => i.day))];
  return (
    <View className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}><View className="w-full max-w-[520px] self-center">
        <Photo k={tripImage({ id: p.tripId, imageKey: p.imageKey })} className="h-[280px]" alt={p.title} />
        <SafeAreaView edges={['top']} className="absolute left-0 right-0 top-0"><View className="flex-row justify-between px-4 pt-2">
          <IconButton tone="glass" icon={ChevronLeft} label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/plans'))} />
          <IconButton tone="glass" icon={Share2} label="Share plan" onPress={() => Share.share({ message: `${p.title} · EveryCation trip plan` })} />
        </View></SafeAreaView>
        <View className="-mt-6 gap-4 rounded-t-[28px] bg-white px-5 pb-6 pt-6">
          <View className="gap-1"><T v="h1">{p.title}</T><T v="small">{p.place}{p.used ? ` · used by ${p.used} traveller${p.used === 1 ? '' : 's'}` : ''}</T></View>
          {p.status === 'scheduled' && p.opensAt && <Note tone="gold">{`Goes on sale on ${fmt(p.opensAt.slice(0, 10))}, the morning after your trip ends. Only you can see it until then.`}</Note>}
          {p.status === 'private' && <Note>Only you can see this plan.</Note>}
          <View className="flex-row items-center gap-3 rounded-card bg-surface-muted p-3.5">
            <Avatar initials={initials(p.author.name)} onPress={() => go(`/traveller/${p.author.id}`)} />
            <View className="flex-1 gap-1"><View className="flex-row items-center gap-2"><T v="strong">{p.mine ? 'You' : p.author.name}</T><Badge label="CREATOR" tone="navy" /></View>
              {p.tripEnded && <View className="flex-row items-center gap-1"><BadgeCheck size={14} color="#002C82" /><T v="small" className="text-xs">Made this trip, ended {fmt(p.tripEndDate)}</T></View>}</View>
          </View>
          {!!p.summary && <T>{p.summary}</T>}
          <View className="flex-row gap-2">{[`${p.days} day${p.days === 1 ? '' : 's'}`, `${p.stops} stops`, 'Times for each stop'].map((i) => <View key={i} className="flex-1 items-center justify-center rounded-2xl bg-tint px-2 py-3"><T v="label" className="text-center text-navy">{i}</T></View>)}</View>
          {days.map((d) => (
            <View key={d} className="gap-2.5"><T v="title">{p.unlocked ? `Day ${d}` : `Preview · Day ${d}`}</T>
              {p.itinerary.filter((i) => i.day === d).map((s, n) => <View key={n} className="flex-row gap-3"><T v="label" className="w-12 text-heading-blue">{s.time}</T><View className="flex-1"><T>{s.title}</T>{!!s.note && <T v="small">{s.note}</T>}</View></View>)}</View>
          ))}
          {!p.unlocked && p.lockedStops > 0 && <Note icon={Lock} tone="gold">{`${p.lockedStops} more stop${p.lockedStops === 1 ? '' : 's'} after you buy`}</Note>}
          {p.owned && <Note icon={BadgeCheck}>This plan is in your library. Find it under Trip plans → My library.</Note>}
          {!!problem && <Note tone="danger">{problem}</Note>}
        </View>
      </View></ScrollView>
      {!p.mine && !p.owned && (
        <SafeAreaView edges={['bottom']} className="border-t border-line bg-white"><View className="w-full max-w-[520px] flex-row items-center gap-4 self-center px-5 py-3">
          <View><T v="h2" className="text-navy">{p.price ? formatNaira(p.price) : 'Free'}</T>{p.price > 0 && <T v="small" className="text-xs">From your wallet</T>}</View>
          <Button className="flex-1" disabled={buy.isPending} label={p.price ? 'BUY THIS PLAN' : 'SAVE TO MY LIBRARY'} onPress={start} />
        </View></SafeAreaView>
      )}
      {p.mine && <SafeAreaView edges={['bottom']} className="border-t border-line bg-white"><View className="w-full max-w-[520px] self-center px-5 py-3"><Button variant="outline" label="Change price or sharing" onPress={() => router.push({ pathname: '/plans/sell', params: { tripId: p.tripId } })} /></View></SafeAreaView>}
    </View>
  );
}
