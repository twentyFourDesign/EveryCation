import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { BadgeCheck, ChevronLeft, Lock, Share2, Star } from 'lucide-react-native';
import { ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, formatNaira } from '@everycation/shared';
import { Avatar, Badge, Button, IconButton, Loading, Note, Photo, T, colors, go } from '@/ui';
import { person } from '@/lib/people';
import { useApp } from '@/lib/store';

export default function PlanDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: p } = useQuery({ queryKey: ['plan', id], queryFn: () => api.plan(id) });
  const { ownedPlans, buyPlan, following, toggle } = useApp();
  if (!p) return <Loading what="this plan" />;
  const a = person(p.authorId); const owned = ownedPlans.includes(p.id) || a.id === 'wole'; const follows = following.includes(a.id);
  // Sample purchase: plan sales are not connected to the wallet API yet, so nothing is charged.
  const buy = () => buyPlan(p.id);
  return (
    <View className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}><View className="w-full max-w-[520px] self-center">
        <Photo k={p.image} className="h-[300px]" alt={p.title} />
        <SafeAreaView edges={['top']} className="absolute left-0 right-0 top-0"><View className="flex-row justify-between px-4 pt-2">
          <IconButton tone="glass" icon={ChevronLeft} label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/plans'))} />
          <IconButton tone="glass" icon={Share2} label="Share plan" onPress={() => Share.share({ message: `${p.title} · EveryCation trip plan` })} />
        </View></SafeAreaView>
        <View className="-mt-6 gap-4 rounded-t-[28px] bg-white px-5 pb-6 pt-6">
          <T v="h1">{p.title}</T>
          {p.rating && <View className="flex-row items-start gap-1.5"><View className="pt-0.5"><Star size={14} color={colors.gold} fill={colors.gold} /></View><T v="small" className="flex-1">{p.rating} ({p.reviews} reviews) · {p.used} travellers used it{p.updated ? ` · ${p.updated}` : ''}</T></View>}
          <View className="flex-row items-center gap-3 rounded-card bg-surface-muted p-3.5">
            <Avatar initials={a.initials} onPress={() => go(`/traveller/${a.id}`)} />
            <View className="flex-1 gap-1"><View className="flex-row items-center gap-2"><T v="strong">{a.id === 'wole' ? 'You' : a.name}</T><Badge label="CREATOR" tone="navy" /></View>
              <View className="flex-row items-center gap-1"><BadgeCheck size={14} color={colors.navy} /><T v="small" className="text-xs">{p.tripDone}</T></View></View>
            {a.id !== 'wole' && <Button small variant={follows ? 'outline' : 'navy'} label={follows ? 'Following' : 'Follow'} onPress={() => toggle('following', a.id)} />}
          </View>
          <View className="flex-row gap-2">{p.includes.map((i) => <View key={i} className="flex-1 items-center justify-center rounded-2xl bg-tint px-2 py-3"><T v="label" className="text-center text-navy">{i}</T></View>)}</View>
          <T v="title">{owned ? 'Itinerary' : 'Preview · Day 1'}</T>
          {p.preview.map((s, i) => (
            <View key={i} className="flex-row gap-3"><T v="label" className="w-12 text-heading-blue">{s.time ?? `Day ${s.day}`}</T><T className="flex-1">{s.text}</T></View>
          ))}
          {owned ? <Note icon={BadgeCheck}>This plan is yours. The full itinerary, map and budget sheet are in My travels.</Note>
            : p.days > 1 && <Note icon={Lock} tone="gold">{`${p.days - 1} more day${p.days > 2 ? 's' : ''} after you ${p.price ? 'buy' : 'save it'}`}</Note>}
        </View>
      </View></ScrollView>
      <SafeAreaView edges={['bottom']} className="border-t border-line bg-white"><View className="w-full max-w-[520px] flex-row items-center gap-4 self-center px-5 py-3">
        <View><T v="h2" className="text-navy">{p.price ? formatNaira(p.price) : 'Free'}</T>{p.price > 0 && <T v="small" className="text-xs">Pay from wallet or card</T>}</View>
        {owned ? <Button className="flex-1" variant="navy" label="OPEN IN MY TRAVELS" onPress={() => router.dismissTo('/travels')} /> : <Button className="flex-1" label={p.price ? 'BUY & ADD TO MY TRIPS' : 'SAVE TO MY TRIPS'} onPress={buy} />}
      </View></SafeAreaView>
    </View>
  );
}
