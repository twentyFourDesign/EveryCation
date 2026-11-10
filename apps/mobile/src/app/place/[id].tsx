import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Empty, IconButton, Loading, Note, Photo, Screen, SectionTitle, T, go } from '@/ui';
import { errorMessage } from '@/lib/api';
import { countryName, placeImage, tipImage, tipPhoto, usePlace } from '@/lib/community';
import { useSession } from '@/lib/session';
import { useAddBucket, useBucket } from '@/lib/trips';

export default function PlaceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: p, isLoading, error } = usePlace(id);
  const signedIn = useSession((s) => s.status === 'signedIn');
  const bucket = useBucket(); const addBucket = useAddBucket();
  if (isLoading) return <Screen title=""><Loading what="this place" /></Screen>;
  if (!p) return <Screen title="Place"><Note tone="danger">{error ? errorMessage(error) : 'This place could not be found.'}</Note></Screen>;
  const source = `place:${p.id}`; const inBucket = !!bucket.data?.some((b) => b.source === source); const country = countryName(p.countryCode);
  return (
    <View className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="w-full max-w-[520px] self-center">
          <Photo k={placeImage(p)} className="h-[320px]" alt={p.name} />
          <SafeAreaView edges={['top']} className="absolute left-0 right-0 top-0"><View className="px-4 pt-2"><IconButton tone="glass" icon={ChevronLeft} label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} /></View></SafeAreaView>
          <View className="-mt-6 gap-5 rounded-t-[28px] bg-white px-5 pb-6 pt-6">
            <View className="gap-1"><T v="eyebrow">{p.kind.toUpperCase()} · {country.toUpperCase()}</T><T v="display">{p.name}</T><T className="text-ink-muted">{p.summary}</T></View>
            <View className="flex-row gap-2.5">
              {!!p.bestTime && <View className="flex-1 rounded-2xl bg-surface-muted p-3"><T v="small" className="text-xs">Best time</T><T v="label">{p.bestTime}</T></View>}
              {!!p.currency && <View className="flex-1 rounded-2xl bg-surface-muted p-3"><T v="small" className="text-xs">Currency</T><T v="label">{p.currency}</T></View>}
              <Pressable accessibilityRole="button" accessibilityLabel={`Travel advice for ${country}`} onPress={() => go(`/advice/${p.countryCode}`)} className="flex-1 rounded-2xl bg-tint p-3 active:opacity-70"><T v="small" className="text-xs">{p.verifiedAdvice} verified</T><T v="label" className="text-heading-blue">See advice →</T></Pressable>
            </View>
            <SectionTitle>Tips from travellers</SectionTitle>
            {p.tips.length === 0 ? <Empty>No tips here yet. Been there? Share one with the + button.</Empty> : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-3 px-5">
                {p.tips.map((t) => (
                  <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={t.title} onPress={() => go(`/tip/${t.id}`)} className="w-[170px] gap-2 active:opacity-80"><Photo k={tipImage(t)} uri={tipPhoto(t)} className="h-[150px] rounded-2xl" /><T v="label" numberOfLines={2}>{t.title}</T><T v="small" className="text-xs">{t.author.name}</T></Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </ScrollView>
      <SafeAreaView edges={['bottom']} className="border-t border-line bg-white"><View className="w-full max-w-[520px] flex-row gap-3 self-center px-5 py-3">
        <Button className="flex-1" variant="outline" label="Save for it" onPress={() => router.push({ pathname: '/wallet/new-goal', params: { name: `${p.name} trip` } })} />
        <Button className="flex-[1.4]" disabled={inBucket} label={inBucket ? 'ON BUCKET LIST ✓' : 'ADD TO BUCKET LIST'} variant={inBucket ? 'outline' : 'primary'} onPress={() => (signedIn ? addBucket.mutate({ title: `Visit ${p.name}`, source, imageKey: p.imageKey ?? undefined }) : router.push('/sign-up'))} />
      </View></SafeAreaView>
    </View>
  );
}
