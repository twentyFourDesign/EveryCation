import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@everycation/shared';
import { Avatar, Button, IconButton, Loading, Photo, SectionTitle, T, colors, go } from '@/ui';
import { useApp } from '@/lib/store';

export default function PlaceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: p } = useQuery({ queryKey: ['place', id], queryFn: () => api.place(id) });
  const { bucket, toggle } = useApp();
  if (!p) return <Loading what="this place" />;
  const key = `place:${p.id}`; const inBucket = bucket.includes(key);
  return (
    <View className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="w-full max-w-[520px] self-center">
          <Photo k={p.image} className="h-[320px]" alt={p.name} />
          <SafeAreaView edges={['top']} className="absolute left-0 right-0 top-0"><View className="flex-row justify-between px-4 pt-2">
            <IconButton tone="glass" icon={ChevronLeft} label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} />
            <View className="h-9 justify-center rounded-full bg-navy px-3"><Text className="font-pop-sb text-xs text-white">1 / {p.photos} photos</Text></View>
          </View></SafeAreaView>
          <View className="-mt-6 gap-5 rounded-t-[28px] bg-white px-5 pb-6 pt-6">
            <View className="gap-1"><T v="eyebrow">{p.kind} · {p.country.toUpperCase()}</T><T v="display">{p.name}</T><T className="text-ink-muted">{p.summary}</T></View>
            <View className="flex-row gap-2.5">
              <View className="flex-1 rounded-2xl bg-surface-muted p-3"><T v="small" className="text-xs">Best time</T><T v="label">{p.bestTime}</T></View>
              <View className="flex-1 rounded-2xl bg-surface-muted p-3"><T v="small" className="text-xs">Currency</T><T v="label">{p.currency}</T></View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Visa and entry advice for ${p.country}`} onPress={() => go(`/advice/${p.countryCode}`)} className="flex-1 rounded-2xl bg-tint p-3 active:opacity-70"><T v="small" className="text-xs">Visa & entry</T><T v="label" className="text-heading-blue">See advice →</T></Pressable>
            </View>
            <SectionTitle>Experiences</SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-3 px-5">
              {p.experiences.map((e) => (
                <Pressable key={e.title} disabled={!e.tipId} accessibilityRole="button" accessibilityLabel={e.title} onPress={() => e.tipId && go(`/tip/${e.tipId}`)} className="w-[150px] gap-2 active:opacity-80"><Photo k={e.image} className="h-[150px] rounded-2xl" /><T v="label">{e.title}</T></Pressable>
              ))}
            </ScrollView>
            <Pressable accessibilityRole="button" onPress={() => router.push('/community')} className="flex-row items-center gap-3 rounded-card bg-surface-muted p-3.5 active:opacity-70">
              <View className="flex-row">{['AO', 'TA', 'KB'].map((i, n) => <View key={i} style={{ marginLeft: n ? -10 : 0 }} className="rounded-full border-2 border-white"><Avatar initials={i} size={32} /></View>)}</View>
              <T v="label" className="flex-1">{p.tipCount} tips from travellers</T><ChevronRight size={18} color={colors.inkMuted} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
      <SafeAreaView edges={['bottom']} className="border-t border-line bg-white"><View className="w-full max-w-[520px] flex-row gap-3 self-center px-5 py-3">
        <Button className="flex-1" variant="outline" label="Save for it" onPress={() => router.push({ pathname: '/wallet/new-goal', params: { name: `${p.name} trip` } })} />
        <Button className="flex-[1.4]" label={inBucket ? 'ON BUCKET LIST ✓' : 'ADD TO BUCKET LIST'} variant={inBucket ? 'outline' : 'primary'} onPress={() => toggle('bucket', key)} />
      </View></SafeAreaView>
    </View>
  );
}
