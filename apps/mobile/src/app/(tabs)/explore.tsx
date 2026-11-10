import { router } from 'expo-router';
import { Bell, Search } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { formatNaira } from '@everycation/shared';
import { usePlans } from '@/lib/plans';
import { tripImage } from '@/lib/trips';
import { Chips, IconButton, Loading, Mark, Photo, Screen, SectionTitle, T, colors, go } from '@/ui';
import { tipImage, tipPhoto, useTips, useUnread } from '@/lib/community';

const sections = ['For you', 'Community', 'Places', 'Trip plans', 'Advice'] as const;
const links: Record<string, string> = { Community: '/community', Places: '/places', 'Trip plans': '/plans', Advice: '/advice' };

export default function Explore() {
  const tips = useTips('popular');
  const plans = usePlans('all', '');
  const unread = useUnread().data?.unread ?? 0;
  return (
    <Screen edges={['top']}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2"><Mark size={30} color="brand" /><Text className="font-pop-sb text-lg text-navy">EveryCation</Text></View>
        <IconButton icon={Bell} label="Notifications" badge={unread || undefined} onPress={() => router.push('/notifications')} />
      </View>
      <T v="h1">Where to next?</T>
      <Pressable accessibilityRole="search" accessibilityLabel="Search places, tips and trip plans" onPress={() => router.push('/search')} className="h-[52px] flex-row items-center gap-3 rounded-full bg-surface-muted px-4">
        <Search size={20} color={colors.inkMuted} /><T className="text-ink-muted">Search places, tips, travellers</T>
      </Pressable>
      <Chips options={sections} value="For you" onChange={(s) => links[s] && go(links[s])} />

      <SectionTitle action="See all" onAction={() => router.push('/community')}>Tips from travellers</SectionTitle>
      {tips.isLoading ? <Loading what="tips" /> : !tips.data?.length ? (
        <T v="small">{tips.error ? 'Tips could not be loaded. Pull down on Community to try again.' : 'No tips yet. Be the first to share one with the + button.'}</T>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-3 px-5">
          {tips.data.slice(0, 4).map((t) => (
            <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={`${t.title}, tip by ${t.author.name}`} onPress={() => go(`/tip/${t.id}`)} className="w-[250px] overflow-hidden rounded-card bg-surface-muted active:opacity-80">
              <Photo k={tipImage(t)} uri={tipPhoto(t)} className="h-[150px]" />
              <View className="gap-1 p-3.5"><T v="eyebrow">{t.place.toUpperCase()}</T><T v="strong" numberOfLines={2}>{t.title}</T><T v="small">by {t.author.name} · {Math.max(1, Math.round(t.body.split(/\s+/).length / 60))} min read</T></View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <SectionTitle action="See all" onAction={() => router.push('/plans')}>Trip plans by creators</SectionTitle>
      {plans.data?.length === 0 && <T v="small">No plans yet. Finished a trip? Share yours from My travels.</T>}
      {plans.data?.slice(0, 2).map((p) => (
        <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`${p.title} by ${p.author.name}`} onPress={() => go(`/plans/${p.id}`)} className="flex-row gap-3 rounded-card bg-surface-muted p-3 active:opacity-80">
          <Photo k={tripImage({ id: p.tripId, imageKey: p.imageKey })} className="h-[88px] w-[88px] rounded-2xl" />
          <View className="flex-1 justify-center gap-0.5">
            <T v="strong" numberOfLines={1}>{p.title}</T>
            <T v="small">by {p.author.name} · {p.days} days · {p.stops} stops</T>
            <T v="strong" className="text-navy">{p.price ? formatNaira(p.price) : 'Free'}</T>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}
