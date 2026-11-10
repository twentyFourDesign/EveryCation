import { useQuery } from '@tanstack/react-query';
import { PiggyBank, Plane, Star } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api } from '@everycation/shared';
import { Avatar, Button, Chips, Empty, Screen, T, colors, cx, go } from '@/ui';
import { person } from '@/lib/people';
import { useApp } from '@/lib/store';

const filters = ['All', 'Community', 'Wallet', 'Trips'] as const;
const icons = { community: Star, wallet: PiggyBank, trips: Plane };

export default function Notifications() {
  const [filter, setFilter] = useState<(typeof filters)[number]>('All');
  const { data = [] } = useQuery({ queryKey: ['notifications'], queryFn: api.notifications });
  const { readNotifications, markAllRead, following, toggle } = useApp();
  const list = data.filter((n) => filter === 'All' || n.type === filter.toLowerCase());
  return (
    <Screen title="Notifications" right={<Pressable accessibilityRole="button" hitSlop={10} onPress={markAllRead} className="pr-2"><Text className="font-pop-sb text-[13px] text-heading-blue">Mark all read</Text></Pressable>}>
      <Chips options={filters} value={filter} onChange={setFilter} />
      {list.length === 0 && <Empty>Nothing here yet.</Empty>}
      {(['Today', 'This week'] as const).map((g) => {
        const rows = list.filter((n) => n.group === g);
        if (!rows.length) return null;
        return (
          <View key={g} className="gap-1">
            <T v="eyebrow" className="text-ink-muted">{g.toUpperCase()}</T>
            {rows.map((n) => {
              const Icon = icons[n.type]; const unread = g === 'Today' && !readNotifications;
              return (
                <Pressable key={n.id} accessibilityRole="button" accessibilityLabel={`${unread ? 'Unread. ' : ''}${n.text}`} onPress={() => go(n.href)} className={cx('flex-row items-center gap-3 rounded-2xl px-2 py-3 active:opacity-70', unread && 'bg-tint')}>
                  {n.actor ? <Avatar initials={person(n.actor).initials} /> : <View className="h-10 w-10 items-center justify-center rounded-full bg-gold-soft"><Icon size={20} color={colors.navy} /></View>}
                  <View className="flex-1"><T className="text-sm leading-5">{n.text}</T><T v="small" className="text-xs">{n.when}</T></View>
                  {n.action && n.actor && <Button small variant={following.includes(n.actor) ? 'outline' : 'navy'} label={following.includes(n.actor) ? 'Following' : n.action} onPress={() => toggle('following', n.actor!)} />}
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </Screen>
  );
}
