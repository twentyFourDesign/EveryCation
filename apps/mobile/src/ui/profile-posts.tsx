import { Pressable, View } from 'react-native';
import { useState } from 'react';
import { Empty, Loading, Photo, Segmented, T, go } from './index';
import { tipImage, tipPhoto, useTipsBy } from '@/lib/community';
import { useMoments } from '@/lib/moments';
import { MomentCard } from './moment-card';

/** A traveller's public posts on their profile: moments first, then tips. */
export function ProfilePosts({ userId, mine }: { userId: string; mine?: boolean }) {
  const [tab, setTab] = useState<'Moments' | 'Tips'>('Moments');
  const moments = useMoments(undefined, userId);
  const { data: tips = [], isLoading: tipsLoading } = useTipsBy(userId);
  const items = moments.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <View className="gap-4">
      <Segmented options={['Moments', 'Tips'] as const} value={tab} onChange={setTab} />
      {tab === 'Moments' ? (
        moments.isLoading ? <Loading what="moments" /> : !items.length ? <Empty>{mine ? 'You have not posted a moment yet. Share one from Explore.' : 'No moments yet.'}</Empty> : (
          <View className="gap-4">
            {items.map((m) => <MomentCard key={m.id} m={m} />)}
            {moments.hasNextPage && <Pressable accessibilityRole="button" onPress={() => moments.fetchNextPage()} className="items-center py-2"><T v="label" className="text-heading-blue">{moments.isFetchingNextPage ? 'Loading…' : 'Show more'}</T></Pressable>}
          </View>
        )
      ) : tipsLoading ? <Loading what="tips" /> : tips.length === 0 ? <Empty>{mine ? 'You have not shared a tip yet. Use the + button to post your first.' : 'No tips yet.'}</Empty> : (
        <View className="flex-row flex-wrap gap-2">
          {tips.map((t) => <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={t.title} onPress={() => go(`/tip/${t.id}`)} className="w-[31.8%]"><Photo k={tipImage(t)} uri={tipPhoto(t)} className="aspect-square rounded-xl" /></Pressable>)}
        </View>
      )}
    </View>
  );
}
