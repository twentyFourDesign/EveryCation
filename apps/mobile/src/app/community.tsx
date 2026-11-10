import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Bell, Bookmark, Heart, MessageCircle, Play } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api } from '@everycation/shared';
import { Avatar, Chips, IconButton, Loading, Photo, Screen, T, colors, go } from '@/ui';
import { person } from '@/lib/people';
import { useApp } from '@/lib/store';

const feeds = ['Following', 'Popular', 'From Lagos'] as const;

export default function CommunityFeed() {
  const [feed, setFeed] = useState<(typeof feeds)[number]>('Following');
  const { data, isLoading } = useQuery({ queryKey: ['tips'], queryFn: () => api.tips() });
  const { savedTips, toggle } = useApp();
  const list = (data ?? []).filter((t) => t.authorId !== 'wole').sort((a, b) => (feed === 'Popular' ? b.likes - a.likes : 0)).slice(0, feed === 'From Lagos' ? 2 : 5);
  return (
    <Screen title="Community" right={<IconButton icon={Bell} label="Notifications" onPress={() => router.push('/notifications')} />}>
      <Chips options={feeds} value={feed} onChange={setFeed} />
      {isLoading && <Loading what="the feed" />}
      {list.map((t) => {
        const a = person(t.authorId); const saved = savedTips.includes(t.id);
        return (
          <View key={t.id} className="gap-3 border-b border-line pb-5">
            <Pressable accessibilityRole="button" accessibilityLabel={`${a.name}'s profile`} onPress={() => go(`/traveller/${a.id}`)} className="flex-row items-center gap-3">
              <Avatar initials={a.initials} /><View><T v="strong">{a.name}</T><T v="small">{t.place} · {t.visited.replace('Visited ', '')}</T></View>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t.title} onPress={() => go(`/tip/${t.id}`)} className="gap-2.5 active:opacity-80">
              <View><Photo k={t.image} className="h-[210px] rounded-card" />
                {t.video && <View className="absolute bottom-3 left-3 flex-row items-center gap-1 rounded-full bg-navy px-2.5 py-1"><Play size={12} color="#fff" fill="#fff" /><Text className="font-pop-sb text-xs text-white">{t.video}</Text></View>}</View>
              <T v="title">{t.title}</T>
              {!t.video && <T className="text-ink-muted" numberOfLines={2}>{t.body}</T>}
            </Pressable>
            <View className="flex-row items-center gap-5">
              <View className="flex-row items-center gap-1.5"><Heart size={20} color={colors.ink} /><T v="label">{t.likes}</T></View>
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
