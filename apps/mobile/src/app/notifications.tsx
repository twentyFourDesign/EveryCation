import { router } from 'expo-router';
import { Megaphone, PiggyBank, Plane, ShoppingBag, Star } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Chips, Empty, Loading, Note, Screen, T, colors, cx, go } from '@/ui';
import { errorMessage } from '@/lib/api';
import { timeAgo, useInbox, useMarkOneRead, useMarkRead } from '@/lib/community';
import { useSession } from '@/lib/session';

const filters = ['All', 'Community', 'Wallet', 'Trips', 'News'] as const;
const icons: Record<string, typeof Star> = { community: Star, wallet: PiggyBank, trips: Plane, shop: ShoppingBag, news: Megaphone };

export default function Notifications() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  const [filter, setFilter] = useState<(typeof filters)[number]>('All');
  const { data, isLoading, error } = useInbox();
  const markRead = useMarkRead(); const markOne = useMarkOneRead();
  if (!signedIn) return <Screen title="Notifications"><View className="gap-4 pt-10"><T className="text-center text-ink-muted">Sign in to see replies, wallet updates and review decisions.</T><Button label="SIGN IN" onPress={() => router.push('/sign-up')} /></View></Screen>;
  const list = (data?.items ?? []).filter((n) => filter === 'All' || n.type === filter.toLowerCase());
  return (
    <Screen title="Notifications" right={data?.unread ? <Pressable accessibilityRole="button" hitSlop={10} onPress={() => markRead.mutate()} className="pr-2"><Text className="font-pop-sb text-[13px] text-heading-blue">Mark all read</Text></Pressable> : undefined}>
      <Chips options={filters} value={filter} onChange={setFilter} />
      {isLoading && <Loading what="notifications" />}
      {!!error && <Note tone="danger">{errorMessage(error)}</Note>}
      {data && list.length === 0 && <Empty>Nothing here yet. Replies, wallet updates and review decisions show up here.</Empty>}
      <View className="gap-1">
        {list.map((n) => { const Icon = icons[n.type] ?? Star; return (
          <Pressable key={n.id} disabled={!n.href && n.read} accessibilityRole="button" accessibilityLabel={`${n.read ? '' : 'Unread. '}${n.text}`} onPress={() => { if (!n.read) markOne.mutate(n.id); if (n.href) go(n.href); }} className={cx('flex-row items-center gap-3 rounded-2xl px-2 py-3 active:opacity-70', !n.read && 'bg-tint')}>
            <View className="h-10 w-10 items-center justify-center rounded-full bg-gold-soft"><Icon size={20} color={colors.navy} /></View>
            <View className="flex-1">{n.type === 'news' && n.text.includes('\n') ? <><T v="strong" className="text-sm">{n.text.split('\n')[0]}</T><T className="text-sm leading-5">{n.text.split('\n').slice(1).join(' ')}</T></> : <T className="text-sm leading-5">{n.text}</T>}<T v="small" className="text-xs">{timeAgo(n.at)}</T></View>
          </Pressable>); })}
      </View>
    </Screen>
  );
}
