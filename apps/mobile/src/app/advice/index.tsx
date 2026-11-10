import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { BadgeCheck, ChevronRight, PenLine } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api, type Country } from '@everycation/shared';
import { Avatar, Button, Header, Loading, T, Toggle, colors, go, SearchBar } from '@/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

type Item = { kind: 'head'; title: string } | { kind: 'country'; c: Country };

export default function TravelAdvice() {
  const { data, isLoading } = useQuery({ queryKey: ['countries'], queryFn: api.countries });
  const [term, setTerm] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const items = useMemo<Item[]>(() => {
    const all = data ?? []; const t = term.trim().toLowerCase();
    if (t) return all.filter((c) => c.name.toLowerCase().includes(t) || c.cities?.some((x) => x.toLowerCase().includes(t))).map((c) => ({ kind: 'country', c }));
    const out: Item[] = [{ kind: 'head', title: 'POPULAR FROM NIGERIA' }, ...all.filter((c) => c.popular).map((c) => ({ kind: 'country' as const, c }))];
    let letter = '';
    for (const c of all) { if (c.name[0] !== letter) { letter = c.name[0]!; out.push({ kind: 'head', title: `ALL COUNTRIES · ${letter}` }); } out.push({ kind: 'country', c }); }
    return out;
  }, [data, term]);
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-white">
      <View className="w-full max-w-[520px] flex-1 self-center">
        <Header title="Travel advice" />
        <View className="gap-3 px-5 pb-3">
          <T className="text-ink-muted">From travellers who&apos;ve been there</T>
          <SearchBar value={term} onChangeText={setTerm} placeholder="Choose a country, city or place" accessibilityLabel="Find a country" />
          <View className="flex-row items-center justify-between">
            <View className="h-9 justify-center rounded-full border-[1.5px] border-control-border px-3"><Text className="font-pop-md text-[13px] text-ink">Passport: Nigeria</Text></View>
            <View className="flex-row items-center gap-2"><BadgeCheck size={18} color={colors.navy} /><T v="label">Verified only</T><Toggle label="Verified only" value={verifiedOnly} onChange={setVerifiedOnly} /></View>
          </View>
        </View>
        {isLoading ? <Loading what="countries" /> : (
          <FlashList data={items} keyExtractor={(i, n) => (i.kind === 'head' ? `h${i.title}` : `${i.c.code}${n}`)} getItemType={(i) => i.kind} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 96 }}
            ListEmptyComponent={<T v="small" className="py-8 text-center">{`No country matches "${term}".`}</T>}
            renderItem={({ item }) => item.kind === 'head'
              ? <T v="eyebrow" className="pb-1 pt-4 text-ink-muted">{item.title}</T>
              : (
                <Pressable accessibilityRole="button" accessibilityLabel={`${item.c.name}, ${item.c.tips} tips`} onPress={() => go(`/advice/${item.c.code}`)} className="h-[64px] flex-row items-center gap-3 border-b border-line active:opacity-70">
                  <Avatar initials={item.c.code} size={40} />
                  <View className="flex-1"><T v="strong">{item.c.name}</T><T v="small">{verifiedOnly ? `${item.c.verified.toLocaleString()} verified` : `${item.c.tips.toLocaleString()} tips · ${item.c.verified.toLocaleString()} verified`}</T></View>
                  <ChevronRight size={18} color={colors.inkMuted} />
                </Pressable>
              )} />
        )}
        <View className="absolute bottom-5 right-5"><Button small variant="navy" icon={PenLine} label="Share advice" onPress={() => router.push('/advice/share')} className="h-12 px-5" /></View>
      </View>
    </SafeAreaView>
  );
}
