import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { sample } from '@everycation/shared';
import { Avatar, Chips, Empty, Loading, Note, Photo, Screen, SearchBar, T, colors, go } from '@/ui';
import { errorMessage } from '@/lib/api';
import { countryName, initials, placeImage, tipImage, tipPhoto, useSearch } from '@/lib/community';

const scopes = ['All', 'Places', 'Tips', 'Advice', 'Travellers'] as const;
const Group = ({ title, children }: { title: string; children: React.ReactNode }) => <View className="gap-2"><T v="eyebrow" className="text-ink-muted">{title}</T>{children}</View>;

export default function SearchResults() {
  const [term, setTerm] = useState(''); const [query, setQuery] = useState('');
  const [scope, setScope] = useState<(typeof scopes)[number]>('All');
  useEffect(() => { const t = setTimeout(() => setQuery(term.trim()), 250); return () => clearTimeout(t); }, [term]);
  const { data, isFetching, error } = useSearch(query);
  const show = (s: (typeof scopes)[number]) => scope === 'All' || scope === s;
  // Countries are matched on the phone (the full list ships with the app); cities with verified advice come from the server.
  const countries = query.length >= 2 ? sample.countries.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 4).map((c) => ({ code: c.code, label: c.name })) : [];
  const adviceHits = [...countries, ...(data?.advice ?? []).map((a) => ({ code: a.countryCode, label: `${a.city}, ${countryName(a.countryCode)}` }))];
  const none = query.length >= 2 && data && !data.places.length && !data.tips.length && !data.travellers.length && !adviceHits.length;
  return (
    <Screen>
      <View className="flex-row items-center gap-3">
        <SearchBar className="flex-1" value={term} onChangeText={setTerm} autoFocus placeholder="Search places, tips, travellers" />
        <Text accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} className="font-pop-sb text-sm text-heading-blue">Cancel</Text>
      </View>
      <Chips options={scopes} value={scope} onChange={setScope} />
      {!!error && <Note tone="danger">{errorMessage(error)}</Note>}
      {query.length < 2 ? <Empty>Type a place, a tip or a traveller&apos;s name.</Empty> : !data && isFetching ? <Loading what="results" /> : none ? <Empty>{`Nothing found for "${query}". Check the spelling or try a country.`}</Empty> : null}
      {query.length >= 2 && show('Places') && data?.places.map((p) => (
        <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`${p.name}, ${countryName(p.countryCode)}`} onPress={() => go(`/place/${p.id}`)} className="overflow-hidden rounded-card active:opacity-80">
          <Photo k={placeImage(p)} uri={p.imageUrl} className="h-[150px]" />
          <View className="absolute bottom-0 left-0 right-0 flex-row items-center justify-between bg-navy/80 px-4 py-2.5"><View><Text className="font-pop-sb text-[11px] tracking-widest text-gold">PLACE</Text><Text className="font-pop-sb text-base text-white">{p.name}, {countryName(p.countryCode)}</Text></View><ChevronRight size={20} color="#fff" /></View>
        </Pressable>
      ))}
      {query.length >= 2 && show('Tips') && !!data?.tips.length && <Group title="TIPS">{data.tips.map((t) => (
        <Pressable key={t.id} accessibilityRole="button" onPress={() => go(`/tip/${t.id}`)} className="flex-row items-center gap-3 active:opacity-70"><Photo k={tipImage(t)} uri={tipPhoto(t)} className="h-14 w-14 rounded-xl" /><View className="flex-1"><T v="strong" numberOfLines={1}>{t.title}</T><T v="small">{t.author.name} · {t.place}</T></View></Pressable>
      ))}</Group>}
      {show('Advice') && adviceHits.length > 0 && <Group title="TRAVEL ADVICE">{adviceHits.map((c) => (
        <Pressable key={c.code + c.label} accessibilityRole="button" onPress={() => go(`/advice/${c.code}`)} className="flex-row items-center gap-3 active:opacity-70"><Avatar initials={c.code} size={48} /><View className="flex-1"><T v="strong">{c.label}</T><T v="small">Entry, money, getting around and safety</T></View><ChevronRight size={18} color={colors.inkMuted} /></Pressable>
      ))}</Group>}
      {query.length >= 2 && show('Travellers') && !!data?.travellers.length && <Group title="TRAVELLERS">{data.travellers.map((t) => (
        <Pressable key={t.id} accessibilityRole="button" onPress={() => go(`/traveller/${t.id}`)} className="flex-row items-center gap-3 active:opacity-70"><Avatar initials={initials(t.name)} size={48} /><View className="flex-1"><T v="strong">{t.name}</T><T v="small">{t.tips} tip{t.tips === 1 ? '' : 's'}{t.city ? ` · ${t.city}` : ''}</T></View><ChevronRight size={18} color={colors.inkMuted} /></Pressable>
      ))}</Group>}
    </Screen>
  );
}
