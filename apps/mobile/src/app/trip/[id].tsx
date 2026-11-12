import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Plus, Store, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Chips, Empty, IconButton, Loading, Note, Photo, Progress, Screen, T, colors, go } from '@/ui';
import { MapView } from '@/ui/map';
import { errorMessage } from '@/lib/api';
import { dayLabel, daysOf, tripDates, tripImage, useRemoveItem, useTrip } from '@/lib/trips';
import { useWallet } from '@/lib/wallet';

export default function TripDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: t, isLoading, error } = useTrip(id);
  const remove = useRemoveItem();
  const { data: wallet } = useWallet();
  const [picked, setPicked] = useState<string | null>(null);
  if (isLoading) return <Screen title=""><Loading what="your trip" /></Screen>;
  if (!t) return <Screen title="Trip"><Note tone="danger">{error ? errorMessage(error) : 'This trip could not be found.'}</Note></Screen>;
  const days = daysOf(t); const day = picked && days.includes(picked) ? picked : (t.itinerary[0]?.day ?? days[0]!);
  const labels = days.map(dayLabel); const stops = t.itinerary.filter((i) => i.day === day);
  const goal = wallet?.goals.find((g) => t.title.toLowerCase().includes(g.name.toLowerCase().replace(/ trip$/, '')) || g.name.toLowerCase().includes(t.place.split(',')[0]!.toLowerCase()));
  return (
    <View className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}><View className="w-full max-w-[520px] self-center">
        <Photo k={tripImage(t)} className="h-[230px]" alt={t.place} />
        <SafeAreaView edges={['top']} className="absolute left-0 right-0 top-0"><View className="flex-row justify-between px-4 pt-2">
          <IconButton tone="glass" icon={ChevronLeft} label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/travels'))} />
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/plans/sell', params: { tripId: t.id } })} className="h-11 flex-row items-center gap-2 rounded-full bg-white px-4 active:opacity-80"><Store size={18} color={colors.navy} /><Text className="font-pop-sb text-[13px] text-navy">Share or sell plan</Text></Pressable>
        </View></SafeAreaView>
        <View className="-mt-6 gap-4 rounded-t-[28px] bg-white px-5 pb-6 pt-6">
          <View className="gap-1"><T v="h1">{t.title}</T><T v="small">{t.place} · {tripDates(t)} · {t.nights} night{t.nights === 1 ? '' : 's'} · {t.travellers} traveller{t.travellers > 1 ? 's' : ''}</T>
            <Badge tone={t.status === 'past' ? 'neutral' : 'gold'} label={t.status === 'upcoming' ? `In ${t.daysAway} day${t.daysAway === 1 ? '' : 's'}` : t.status === 'now' ? 'Happening now' : 'Completed'} /></View>
          <Chips options={labels} value={dayLabel(day)} onChange={(l) => setPicked(days[labels.indexOf(l)]!)} />
          {stops.length === 0 && <Empty>Nothing planned for this day yet.</Empty>}
          {stops.map((s) => (
            <View key={s.id} className="flex-row gap-3">
              <T v="label" className="w-12 pt-3.5 text-heading-blue">{s.time}</T>
              <View className="flex-1 flex-row items-center gap-2 rounded-2xl bg-surface-muted p-3.5"><View className="flex-1"><T v="strong">{s.title}</T>{!!s.note && <T v="small">{s.note}</T>}</View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${s.title}`} hitSlop={10} onPress={() => remove.mutate({ tripId: t.id, itemId: s.id })}><Trash2 size={18} color={colors.inkMuted} /></Pressable></View>
            </View>
          ))}
          {t.lat !== null && t.lng !== null && <MapView pins={[{ id: t.id, lat: t.lat, lng: t.lng, label: t.place, tone: t.status === 'upcoming' ? 'planned' : 'visited' }]} height={170} interactive={false} zoom={t.pinned ? 7 : 3.5} />}
          {goal && <Pressable accessibilityRole="button" onPress={() => go(`/wallet/goal/${goal.id}`)} className="gap-2 rounded-card bg-tint p-3.5 active:opacity-80"><T v="small" className="text-xs">Trip savings · {goal.name}</T><T v="strong">{goal.percent}% saved</T><Progress pct={goal.percent} /></Pressable>}
          {t.status === 'past' && <Note>This trip is on your timeline. It backs up the advice you share for {t.place.split(',').pop()?.trim()}, and you can turn it into a plan others follow.</Note>}
        </View>
      </View></ScrollView>
      <SafeAreaView edges={['bottom']} className="border-t border-line bg-white"><View className="w-full max-w-[520px] self-center px-5 py-3">
        <Button icon={Plus} label="ADD TO ITINERARY" onPress={() => router.push({ pathname: '/calendar-add', params: { tripId: t.id, day } })} />
      </View></SafeAreaView>
    </View>
  );
}
