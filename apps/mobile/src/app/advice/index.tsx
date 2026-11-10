import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { BadgeCheck, ChevronRight, PenLine } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sample } from '@everycation/shared';
import { Avatar, Button, Header, SearchBar, T, Toggle, colors, go } from '@/ui';
import { useAdviceCounts } from '@/lib/community';

interface Row { code: string; name: string; total: number; verified: number }
type Item = { kind: 'head'; title: string } | { kind: 'country'; c: Row };

export default function TravelAdvice() {
  const { data: counts, error } = useAdviceCounts();
  const [term, setTerm] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const items = useMemo<Item[]>(() => {
    const byCode = new Map((counts ?? []).map((c) => [c.code, c]));
    const all: Row[] = sample.countries.map((c) => ({ code: c.code, name: c.name, total: byCode.get(c.code)?.total ?? 0, verified: byCode.get(c.code)?.verified ?? 0 }));
    const t = term.trim().toLowerCase();
    if (t) return all.filter((c) => c.name.toLowerCase().includes(t)).map((c) => ({ kind: 'country', c }));
    const withAdvice = all.filter((c) => (verifiedOnly ? c.verified : c.total) > 0).sort((a, b) => b.verified - a.verified || b.total - a.total).slice(0, 6);
    const out: Item[] = withAdvice.length ? [{ kind: 'head', title: 'MOST ADVICE' }, ...withAdvice.map((c) => ({ kind: 'country' as const, c }))] : [];
    let letter = '';
    for (const c of all) { if (c.name[0] !== letter) { letter = c.name[0]!; out.push({ kind: 'head', title: `ALL COUNTRIES · ${letter}` }); } out.push({ kind: 'country', c }); }
    return out;
  }, [counts, term, verifiedOnly]);
  const label = (c: Row) => { const n = verifiedOnly ? c.verified : c.total; return n === 0 ? 'No advice yet' : verifiedOnly ? `${n} verified` : `${c.total} shared · ${c.verified} verified`; };
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-white">
      <View className="w-full max-w-[520px] flex-1 self-center">
        <Header title="Travel advice" />
        <View className="gap-3 px-5 pb-3">
          <T className="text-ink-muted">From travellers who&apos;ve been there{error ? '. Counts could not be loaded just now.' : ''}</T>
          <SearchBar value={term} onChangeText={setTerm} placeholder="Choose a country" />
          <View className="flex-row items-center justify-between">
            <View className="h-9 justify-center rounded-full border-[1.5px] border-control-border px-3"><Text className="font-pop-md text-[13px] text-ink">Passport: Nigeria</Text></View>
            <View className="flex-row items-center gap-2"><BadgeCheck size={18} color={colors.navy} /><T v="label">Verified only</T><Toggle label="Verified only" value={verifiedOnly} onChange={setVerifiedOnly} /></View>
          </View>
        </View>
        <FlashList data={items} keyExtractor={(i, n) => (i.kind === 'head' ? `h${i.title}` : `${i.c.code}${n}`)} getItemType={(i) => i.kind} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 96 }}
          ListEmptyComponent={<T v="small" className="py-8 text-center">{`No country matches "${term}".`}</T>}
          renderItem={({ item }) => item.kind === 'head'
            ? <T v="eyebrow" className="pb-1 pt-4 text-ink-muted">{item.title}</T>
            : (
              <Pressable accessibilityRole="button" accessibilityLabel={`${item.c.name}, ${label(item.c)}`} onPress={() => go(`/advice/${item.c.code}`)} className="h-[64px] flex-row items-center gap-3 border-b border-line active:opacity-70">
                <Avatar initials={item.c.code} size={40} />
                <View className="flex-1"><T v="strong">{item.c.name}</T><T v="small">{label(item.c)}</T></View>
                <ChevronRight size={18} color={colors.inkMuted} />
              </Pressable>
            )} />
        <View className="absolute bottom-5 right-5"><Button small variant="navy" icon={PenLine} label="Share advice" onPress={() => router.push('/advice/share')} className="h-12 px-5" /></View>
      </View>
    </SafeAreaView>
  );
}
