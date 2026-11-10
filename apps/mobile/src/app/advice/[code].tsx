import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { BadgeCheck, Clock, PenLine, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import { api, sample } from '@everycation/shared';
import { Avatar, Badge, Button, Chips, Empty, IconButton, Loading, Screen, T, Toggle, colors, cx, go } from '@/ui';
import { person } from '@/lib/people';
import { useApp } from '@/lib/store';

export default function CountryAdvice() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { data: c } = useQuery({ queryKey: ['country', code], queryFn: () => api.country(code) });
  const { data: list = [] } = useQuery({ queryKey: ['advice', code], queryFn: () => api.advice(code) });
  const mine = useApp((s) => s.myAdvice).filter((a) => a.countryCode === code);
  const [city, setCity] = useState('All');
  const [topic, setTopic] = useState('All topics');
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [helpful, setHelpful] = useState<string[]>([]);
  const [reported, setReported] = useState<string[]>([]);
  if (!c) return <Loading what="advice" />;
  const cities = ['All', ...(c.cities ?? [])];
  const shown = [...mine, ...list].filter((a) => (!verifiedOnly || a.status === 'verified' || a.authorId === 'wole') && (city === 'All' || a.city === city) && (topic === 'All topics' || a.topic === topic)).sort((a, b) => b.helpful - a.helpful);
  return (
    <Screen title="" right={<IconButton icon={Share2} label="Share" onPress={() => Share.share({ message: `Travel advice for ${c.name} · EveryCation` })} />}
      footer={<Button variant="navy" icon={PenLine} label={`Share your ${c.name} advice`} onPress={() => router.push({ pathname: '/advice/share', params: { location: c.name, code: c.code } })} />}>
      <View className="flex-row items-center gap-3"><Avatar initials={c.code} size={52} /><View className="flex-1"><T v="h1">{c.name}</T><T v="small">{c.tips.toLocaleString()} tips · {c.verified.toLocaleString()} verified{c.facts ? ` · ${c.facts}` : ''}</T></View></View>
      {cities.length > 1 && <Chips options={cities} value={city} onChange={setCity} />}
      <Chips options={['All topics', ...sample.adviceTopics]} value={topic} onChange={setTopic} />
      <View className="flex-row items-center justify-between">
        <T v="small" className="flex-1">Showing {verifiedOnly ? 'verified' : 'all'} advice · Nigerian passport · Most helpful</T>
        <Toggle label="Verified only" value={verifiedOnly} onChange={setVerifiedOnly} />
      </View>
      {shown.length === 0 && <Empty>{`No ${verifiedOnly ? 'verified ' : ''}advice here yet. If you have been, share what you learned.`}</Empty>}
      {shown.map((a) => {
        const p = person(a.authorId); const on = helpful.includes(a.id); const verified = a.status === 'verified';
        return (
          <View key={a.id} className="gap-3 rounded-card bg-surface-muted p-4">
            <View className="flex-row items-center gap-3">
              <Avatar initials={p.initials} onPress={() => go(`/traveller/${p.id}`)} />
              <View className="flex-1 gap-1"><T v="strong">{p.id === 'wole' ? 'You' : p.name}</T>
                <View className="flex-row flex-wrap items-center gap-1.5">{verified ? <Badge icon={BadgeCheck} label="Verified" /> : <Badge icon={Clock} tone="gold" label="In review" />}<T v="small" className="text-xs">{a.visited}</T></View></View>
            </View>
            <T v="eyebrow">{a.topic.toUpperCase()}</T>
            <T>{a.body}</T>
            {!verified && <T v="small" className="text-xs">Not checked by our team yet. Treat it as one traveller&apos;s experience.</T>}
            <View className="flex-row items-center gap-5">
              <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setHelpful((h) => (on ? h.filter((x) => x !== a.id) : [...h, a.id]))} className={cx('h-9 justify-center rounded-full px-3.5', on ? 'bg-navy' : 'border-[1.5px] border-control-border bg-white')}>
                <Text className={cx('font-pop-sb text-[13px]', on ? 'text-white' : 'text-ink')}>Helpful · {a.helpful + (on ? 1 : 0)}</Text></Pressable>
              {p.id !== 'wole' && <Text accessibilityRole="button" onPress={() => setReported((r) => [...r, a.id])} className="font-pop-sb text-[13px] text-ink-muted" style={{ color: colors.inkMuted }}>{reported.includes(a.id) ? 'Reported' : 'Report'}</Text>}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}
