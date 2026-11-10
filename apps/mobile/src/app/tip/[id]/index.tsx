import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Bookmark, ChevronLeft, MessageCircle, Share2 } from 'lucide-react-native';
import { ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@everycation/shared';
import { Avatar, Badge, Button, IconButton, Loading, Photo, T, go } from '@/ui';
import { person } from '@/lib/people';
import { useApp } from '@/lib/store';

export default function TipDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: tip } = useQuery({ queryKey: ['tip', id], queryFn: () => api.tip(id) });
  const { following, bucket, savedTips, toggle } = useApp();
  if (!tip) return <Loading what="this tip" />;
  const a = person(tip.authorId); const follows = following.includes(a.id); const inBucket = bucket.includes(tip.id); const saved = savedTips.includes(tip.id);
  return (
    <View className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="w-full max-w-[520px] self-center">
          <Photo k={tip.image} className="h-[340px]" alt={`Photo for ${tip.title}`} />
          <SafeAreaView edges={['top']} className="absolute left-0 right-0 top-0">
            <View className="flex-row gap-2 px-4 pt-2">
              <IconButton tone="glass" icon={ChevronLeft} label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} />
              <View className="flex-1" />
              <IconButton tone="glass" icon={MessageCircle} label={`${tip.comments} comments`} onPress={() => go(`/tip/${tip.id}/comments`)} />
              <IconButton tone="glass" icon={Share2} label="Share tip" onPress={() => Share.share({ message: `${tip.title} · EveryCation` })} />
              <IconButton tone="glass" icon={Bookmark} label={saved ? 'Saved' : 'Save tip'} onPress={() => toggle('savedTips', tip.id)} />
            </View>
          </SafeAreaView>
          <View className="-mt-6 gap-4 rounded-t-[28px] bg-white px-5 pb-6 pt-6">
            <View className="flex-row flex-wrap gap-2"><Badge label="Travel tip" tone="gold" /><Badge label={tip.place} /><Badge label={tip.category} tone="neutral" /></View>
            <T v="h1">{tip.title}</T>
            <View className="flex-row items-center gap-3">
              <Avatar initials={a.initials} onPress={() => go(`/traveller/${a.id}`)} />
              <View className="flex-1"><T v="strong">{a.name}</T><T v="small">{tip.visited}</T></View>
              {a.id !== 'wole' && <Button small variant={follows ? 'outline' : 'navy'} label={follows ? 'Following' : 'Follow'} onPress={() => toggle('following', a.id)} />}
            </View>
            <T className="text-base leading-[26px]">{tip.body}</T>
            <View className="gap-2 rounded-card bg-gold-soft p-4">
              <T v="eyebrow" className="text-ink">GOOD TO KNOW</T>
              {tip.goodToKnow.map((g) => <T key={g}>• {g}</T>)}
            </View>
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
