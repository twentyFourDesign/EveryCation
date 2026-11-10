import { router } from 'expo-router';
import { Bell, Bookmark, Heart, MessageCircle, Play } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Avatar, Button, Chips, Empty, IconButton, Loading, Note, Photo, Screen, T, colors, go } from '@/ui';
import { errorMessage } from '@/lib/api';
import { initials, timeAgo, tipImage, useLikeTip, useTips } from '@/lib/community';
import { useSession } from '@/lib/session';
import { useApp } from '@/lib/store';

const feeds = ['Latest', 'Popular'] as const;

export default function CommunityFeed() {
  const [feed, setFeed] = useState<(typeof feeds)[number]>('Latest');
  const { data, isLoading, error, refetch } = useTips(feed === 'Popular' ? 'popular' : 'latest');
  const like = useLikeTip();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const { savedTips, toggle } = useApp();
  return (
    <Screen title="Community" right={<IconButton icon={Bell} label="Notifications" onPress={() => router.push('/notifications')} />}>
      <Chips options={feeds} value={feed} onChange={setFeed} />
      {isLoading && <Loading what="the feed" />}
      {!!error && <><Note tone="danger">{errorMessage(error)}</Note><Button variant="outline" label="Try again" onPress={() => refetch()} /></>}
      {data?.length === 0 && <Empty>No tips yet. Share the first one with the + button.</Empty>}
      {data?.map((t) => {
        const saved = savedTips.includes(t.id);
        return (
          <View key={t.id} className="gap-3 border-b border-line pb-5">
            <View className="flex-row items-center gap-3"><Avatar initials={initials(t.author.name)} /><View><T v="strong">{t.author.name}</T><T v="small">{t.place} · {timeAgo(t.createdAt)}</T></View></View>
            <Pressable accessibilityRole="button" accessibilityLabel={t.title} onPress={() => go(`/tip/${t.id}`)} className="gap-2.5 active:opacity-80">
              <View><Photo k={tipImage(t)} className="h-[210px] rounded-card" />
                {t.format !== 'write' && <View className="absolute bottom-3 left-3 flex-row items-center gap-1 rounded-full bg-navy px-2.5 py-1"><Play size={12} color="#fff" fill="#fff" /><Text className="font-pop-sb text-xs capitalize text-white">{t.format}</Text></View>}</View>
              <T v="title">{t.title}</T>
              {!!t.body && <T className="text-ink-muted" numberOfLines={2}>{t.body}</T>}
            </Pressable>
            <View className="flex-row items-center gap-5">
              <Pressable accessibilityRole="button" accessibilityLabel={`${t.liked ? 'Unlike' : 'Like'}, ${t.likes} likes`} accessibilityState={{ selected: t.liked }} hitSlop={10} onPress={() => (signedIn ? like.mutate(t.id) : router.push('/sign-up'))} className="flex-row items-center gap-1.5">
                <Heart size={20} color={t.liked ? colors.danger : colors.ink} fill={t.liked ? colors.danger : 'transparent'} /><T v="label">{t.likes}</T></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`${t.comments} comments`} hitSlop={10} onPress={() => go(`/tip/${t.id}/comments`)} className="flex-row items-center gap-1.5"><MessageCircle size={20} color={colors.ink} /><T v="label">{t.comments}</T></Pressable>
              <View className="flex-1" />
              <Pressable accessibilityRole="button" accessibilityLabel={saved ? 'Remove from saved' : 'Save tip'} hitSlop={10} onPress={() => toggle('savedTips', t.id)}><Bookmark size={22} color={colors.navy} fill={saved ? colors.navy : 'transparent'} /></Pressable>
            </View>
          </View>
        );
      })}
    </Screen>
  );
}
