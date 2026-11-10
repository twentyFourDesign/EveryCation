import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Bell, CalendarCheck, ChevronLeft, Plus, Store } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, percent } from '@everycation/shared';
import { Badge, Button, Chips, Empty, IconButton, Loading, Note, Photo, Progress, T, colors, go } from '@/ui';
import { useApp } from '@/lib/store';
import { useWallet } from '@/lib/wallet';

export default function TripDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: t } = useQuery({ queryKey: ['trip', id], queryFn: () => api.trip(id) });
  const extraItinerary = useApp((s) => s.extraItinerary);
  const { data: wallet } = useWallet();
  const [day, setDay] = useState('Sun 13');
  if (!t) return <Loading what="your trip" />;
  const upcoming = t.status === 'upcoming';
  const goal = wallet?.goals.find((g) => t.title.toLowerCase().includes(g.name.toLowerCase().replace(/ trip$/, '')));
  const stops = [...(t.itinerary ?? []), ...extraItinerary].filter((i) => i.day === day).sort((a, b) => a.time.localeCompare(b.time));
  const events = (t.itinerary?.length ?? 0) + extraItinerary.length + 3;
  return (
    <View className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}><View className="w-full max-w-[520px] self-center">
        <Photo k={t.image} className="h-[230px]" alt={t.place} />
        <SafeAreaView edges={['top']} className="absolute left-0 right-0 top-0"><View className="flex-row justify-between px-4 pt-2">
          <IconButton tone="glass" icon={ChevronLeft} label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/travels'))} />
          <Pressable accessibilityRole="button" onPress={() => router.push('/plans/sell')} className="h-11 flex-row items-center gap-2 rounded-full bg-white px-4 active:opacity-80"><Store size={18} color={colors.navy} /><Text className="font-pop-sb text-[13px] text-navy">Share or sell plan</Text></Pressable>
        </View></SafeAreaView>
        <View className="-mt-6 gap-4 rounded-t-[28px] bg-white px-5 pb-6 pt-6">
          <View className="gap-1"><T v="h1">{t.title}</T><T v="small">{t.dates} · {t.nights} nights · {t.travellers} traveller{t.travellers > 1 ? 's' : ''}</T>
            {upcoming ? <Badge tone="gold" label={`In ${t.daysAway} days`} /> : <Badge tone="neutral" label={`${t.tipsRecorded} tips recorded`} />}</View>
          {upcoming && <Note icon={CalendarCheck}>{`Synced to Google Calendar. ${events} events with reminders in "EveryCation trips".`}</Note>}
          {t.days ? (
            <>
              <Chips options={t.days} value={day} onChange={setDay} />
              {stops.length === 0 && <Empty>Nothing planned for this day yet.</Empty>}
              {stops.map((s) => (
                <View key={s.id} className="flex-row gap-3">
                  <T v="label" className="w-12 pt-3.5 text-heading-blue">{s.time}</T>
                  <View className="flex-1 flex-row items-center gap-2 rounded-2xl bg-surface-muted p-3.5"><View className="flex-1"><T v="strong">{s.title}</T><T v="small">{s.note}</T></View><Bell size={18} color={colors.inkMuted} /></View>
                </View>
              ))}
              <View className="flex-row gap-3">
                {goal && <Pressable accessibilityRole="button" onPress={() => go(`/wallet/goal/${goal.id}`)} className="flex-1 gap-2 rounded-card bg-tint p-3.5 active:opacity-80"><T v="small" className="text-xs">Trip savings</T><T v="strong">{goal.percent}% saved</T><Progress pct={goal.percent} /></Pressable>}
                {t.packed && <View className="flex-1 gap-2 rounded-card bg-gold-soft p-3.5"><T v="small" className="text-xs">Packing list</T><T v="strong">{t.packed[0]} of {t.packed[1]} packed</T><Progress tone="gold" pct={percent(t.packed[0], t.packed[1])} /></View>}
              </View>
            </>
          ) : <Note>This trip is in your timeline. Record tips from it, share advice for the places you visited, or turn it into a plan others can follow.</Note>}
        </View>
      </View></ScrollView>
      <SafeAreaView edges={['bottom']} className="border-t border-line bg-white"><View className="w-full max-w-[520px] self-center px-5 py-3">
        {upcoming ? <Button icon={Plus} label="ADD TO ITINERARY" onPress={() => router.push({ pathname: '/calendar-add', params: { day } })} />
          : <Button variant="navy" icon={Store} label="TURN INTO A TRIP PLAN" onPress={() => router.push('/plans/sell')} />}
      </View></SafeAreaView>
    </View>
  );
}
