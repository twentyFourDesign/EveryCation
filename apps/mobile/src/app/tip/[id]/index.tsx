import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Bookmark, ChevronLeft, Heart, MessageCircle, Share2 } from 'lucide-react-native';
import { ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api as sampleApi } from '@everycation/shared';
import { Avatar, Badge, Button, IconButton, Loading, Note, Photo, Screen, T, go } from '@/ui';
import { errorMessage } from '@/lib/api';
import { initials, isUuid, tipImage, useLikeTip, useTip } from '@/lib/community';
import { person } from '@/lib/people';
import { useSession } from '@/lib/session';
import { useApp } from '@/lib/store';

/** One shape for the screen, whether the tip came from the API or is one of the bundled samples that place pages still link to. */
function useTipView(id: string) {
  const live = useTip(id);
  const bundled = useQuery({ queryKey: ['sample-tip', id], queryFn: () => sampleApi.tip(id), enabled: !isUuid(id) });
  if (isUuid(id)) {
    const t = live.data;
    return { isLoading: live.isLoading, error: live.error, live: true, tip: t && { id: t.id, title: t.title, place: t.place, category: t.category, image: tipImage(t), body: t.body, goodToKnow: t.goodToKnow, visited: t.visited ? `Visited ${t.visited}` : '', likes: t.likes, liked: t.liked, comments: t.comments, authorName: t.author.name, authorInitials: initials(t.author.name), authorLink: null as string | null } };
  }
  const s = bundled.data; const a = s && person(s.authorId);
  return { isLoading: bundled.isLoading, error: bundled.error, live: false, tip: s && a && { id: s.id, title: s.title, place: s.place, category: s.category, image: s.image, body: s.body, goodToKnow: s.goodToKnow, visited: s.visited, likes: s.likes, liked: false, comments: s.comments, authorName: a.name, authorInitials: a.initials, authorLink: `/traveller/${a.id}` as string | null } };
}

export default function TipDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tip, isLoading, error, live } = useTipView(id);
  const like = useLikeTip();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const { bucket, savedTips, toggle } = useApp();
  if (isLoading) return <Screen title=""><Loading what="this tip" /></Screen>;
  if (!tip) return <Screen title="Tip"><Note tone="danger">{error ? errorMessage(error) : 'This tip is no longer available.'}</Note></Screen>;
  const inBucket = bucket.includes(tip.id); const saved = savedTips.includes(tip.id);
  return (
    <View className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="w-full max-w-[520px] self-center">
          <Photo k={tip.image} className="h-[340px]" alt={`Photo for ${tip.title}`} />
          <SafeAreaView edges={['top']} className="absolute left-0 right-0 top-0">
            <View className="flex-row gap-2 px-4 pt-2">
              <IconButton tone="glass" icon={ChevronLeft} label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} />
              <View className="flex-1" />
              <IconButton tone="glass" icon={MessageCircle} label={`${tip.comments} comments`} badge={tip.comments || undefined} onPress={() => go(`/tip/${tip.id}/comments`)} />
              <IconButton tone="glass" icon={Share2} label="Share tip" onPress={() => Share.share({ message: `${tip.title} · EveryCation` })} />
              <IconButton tone="glass" icon={Bookmark} label={saved ? 'Saved' : 'Save tip'} onPress={() => toggle('savedTips', tip.id)} />
            </View>
          </SafeAreaView>
          <View className="-mt-6 gap-4 rounded-t-[28px] bg-white px-5 pb-6 pt-6">
            <View className="flex-row flex-wrap gap-2"><Badge label="Travel tip" tone="gold" /><Badge label={tip.place} /><Badge label={tip.category} tone="neutral" /></View>
            <T v="h1">{tip.title}</T>
            <View className="flex-row items-center gap-3">
              <Avatar initials={tip.authorInitials} onPress={tip.authorLink ? () => go(tip.authorLink!) : undefined} />
              <View className="flex-1"><T v="strong">{tip.authorName}</T>{!!tip.visited && <T v="small">{tip.visited}</T>}</View>
              {live && <Button small variant={tip.liked ? 'navy' : 'outline'} icon={Heart} label={`${tip.likes}`} onPress={() => (signedIn ? like.mutate(tip.id) : router.push('/sign-up'))} />}
            </View>
            {!!tip.body && <T className="text-base leading-[26px]">{tip.body}</T>}
            {tip.goodToKnow.length > 0 && (
              <View className="gap-2 rounded-card bg-gold-soft p-4"><T v="eyebrow" className="text-ink">GOOD TO KNOW</T>{tip.goodToKnow.map((g) => <T key={g}>• {g}</T>)}</View>
            )}
          </View>
        </View>
      </ScrollView>
      <SafeAreaView edges={['bottom']} className="border-t border-line bg-white">
        <View className="w-full max-w-[520px] self-center px-5 py-3">
          <Button label={inBucket ? 'ON YOUR BUCKET LIST ✓' : 'ADD TO BUCKET LIST'} variant={inBucket ? 'outline' : 'primary'} onPress={() => toggle('bucket', tip.id)} />
        </View>
      </SafeAreaView>
    </View>
  );
}
