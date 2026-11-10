import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api } from '@everycation/shared';
import { Avatar, Button, Chips, Empty, Photo, Screen, T, colors, go, SearchBar } from '@/ui';
import { shortName } from '@/lib/people';
import { useApp } from '@/lib/store';

const scopes = ['All', 'Places', 'Tips', 'Advice', 'Travellers'] as const;
const Group = ({ title, children }: { title: string; children: React.ReactNode }) => <View className="gap-2"><T v="eyebrow" className="text-ink-muted">{title}</T>{children}</View>;

export default function SearchResults() {
  const [term, setTerm] = useState('Bali');
  const [scope, setScope] = useState<(typeof scopes)[number]>('All');
  const { data } = useQuery({ queryKey: ['search', term], queryFn: () => api.search(term), placeholderData: (p) => p });
  const { following, toggle } = useApp();
  const show = (s: (typeof scopes)[number]) => scope === 'All' || scope === s;
  const none = data && !data.places.length && !data.tips.length && !data.countries.length && !data.travellers.length;
  return (
    <Screen>
      <View className="flex-row items-center gap-3">
        <SearchBar value={term} onChangeText={setTerm} autoFocus placeholder="Search places, tips, trip plans" accessibilityLabel="Search" className="flex-1" />
        <Text accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} className="font-pop-sb text-sm text-heading-blue">Cancel</Text>
      </View>
      <Chips options={scopes} value={scope} onChange={setScope} />
      {!term.trim() ? <Empty>Type a place, a tip or a traveller&apos;s name.</Empty> : none ? <Empty>{`Nothing found for "${term}". Check the spelling or try a country.`}</Empty> : null}
      {show('Places') && data?.places.map((p) => (
        <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`${p.name}, ${p.country}`} onPress={() => go(`/place/${p.id}`)} className="overflow-hidden rounded-card active:opacity-80">
          <Photo k={p.image} className="h-[150px]" />
          <View className="absolute bottom-0 left-0 right-0 flex-row items-center justify-between bg-navy/80 px-4 py-2.5"><View><Text className="font-pop-sb text-[11px] tracking-widest text-gold">PLACE</Text><Text className="font-pop-sb text-base text-white">{p.name}, {p.country}</Text></View><ChevronRight size={20} color="#fff" /></View>
        </Pressable>
      ))}
      {show('Tips') && !!data?.tips.length && <Group title="TIPS">{data.tips.map((t) => (
        <Pressable key={t.id} accessibilityRole="button" onPress={() => go(`/tip/${t.id}`)} className="flex-row items-center gap-3 active:opacity-70"><Photo k={t.image} className="h-14 w-14 rounded-xl" /><View className="flex-1"><T v="strong" numberOfLines={1}>{t.title}</T><T v="small">{shortName(t.authorId)} · {t.category}</T></View></Pressable>
      ))}</Group>}
      {show('Advice') && !!data?.countries.length && <Group title="TRAVEL ADVICE">{data.countries.map((c) => (
        <Pressable key={c.code} accessibilityRole="button" onPress={() => go(`/advice/${c.code}`)} className="flex-row items-center gap-3 active:opacity-70"><Avatar initials={c.code} size={48} /><View className="flex-1"><T v="strong">{c.name}</T><T v="small">Entry, visa, health and safety</T></View><ChevronRight size={18} color={colors.inkMuted} /></Pressable>
      ))}</Group>}
      {show('Travellers') && !!data?.travellers.length && <Group title="TRAVELLERS">{data.travellers.filter((t) => t.id !== 'wole').map((t) => (
        <Pressable key={t.id} accessibilityRole="button" onPress={() => go(`/traveller/${t.id}`)} className="flex-row items-center gap-3 active:opacity-70"><Avatar initials={t.initials} size={48} /><View className="flex-1"><T v="strong">{t.name}</T><T v="small">{t.tips} tips · {t.city}</T></View>
          <Button small variant={following.includes(t.id) ? 'outline' : 'navy'} label={following.includes(t.id) ? 'Following' : 'Follow'} onPress={() => toggle('following', t.id)} /></Pressable>
      ))}</Group>}
    </Screen>
  );
}
