import { ChevronDown, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { flag, useCountries, type Country } from '@/lib/travel';
import { T, colors, cx } from './index';

/** Matches "uk", "usa", "uae" and the like as well as the start of any word in the name. */
const ALIASES: Record<string, string> = { uk: 'GB', britain: 'GB', england: 'GB', usa: 'US', america: 'US', uae: 'AE', dubai: 'AE', holland: 'NL', drc: 'CD', 'south korea': 'KR', 'north korea': 'KP', 'ivory coast': 'CI', turkey: 'TR', czechia: 'CZ' };
function matches(c: Country, q: string) {
  if (!q) return true;
  const n = c.name.toLowerCase();
  return n.startsWith(q) || n.split(/[\s-]+/).some((w) => w.startsWith(q)) || c.code.toLowerCase() === q || ALIASES[q] === c.code;
}

/** Choose a country from all 199, with search. `value` is a two-letter code. */
export function CountryField({ label, value, onChange, placeholder = 'Choose a country', hint }: { label: string; value: string; onChange: (code: string) => void; placeholder?: string; hint?: string }) {
  const { data = [] } = useCountries();
  const [open, setOpen] = useState(false); const [q, setQ] = useState('');
  const chosen = data.find((c) => c.code === value);
  const list = useMemo(() => { const t = q.trim().toLowerCase(); return data.filter((c) => matches(c, t)); }, [data, q]);
  const close = () => { setOpen(false); setQ(''); };
  return (
    <View className="gap-1.5">
      <T v="label">{label}</T>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}${chosen ? `, ${chosen.name}` : ''}`} onPress={() => setOpen(true)}
        className="h-[52px] flex-row items-center gap-2.5 rounded-xl border-[1.5px] border-control-border bg-white px-4">
        {chosen && <Text className="text-xl">{flag(chosen.code)}</Text>}
        <Text numberOfLines={1} className={cx('flex-1 font-pop text-[15px]', chosen ? 'text-ink' : 'text-ink-muted')}>{chosen?.name ?? placeholder}</Text>
        <ChevronDown size={19} color={colors.inkMuted} />
      </Pressable>
      {!!hint && <Text className="font-pop text-xs text-ink-muted">{hint}</Text>}
      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <View className="flex-1 justify-end bg-black/40 sm:items-center sm:justify-center">
          <View className="h-[85%] w-full max-w-[520px] gap-3 rounded-t-[28px] bg-white px-5 pt-4 sm:h-[75%] sm:rounded-[28px]">
            <View className="flex-row items-center"><T v="strong" className="flex-1">{label}</T>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={close}><X size={22} color={colors.inkMuted} /></Pressable></View>
            <View className="h-12 flex-row items-center gap-2 rounded-full bg-surface-muted px-4">
              <Search size={18} color={colors.inkMuted} />
              <TextInput value={q} onChangeText={setQ} placeholder="Search countries" placeholderTextColor={colors.inkMuted} autoFocus autoCorrect={false} accessibilityLabel="Search countries" className="flex-1 font-pop text-[15px] text-ink" />
            </View>
            <FlatList data={list} keyExtractor={(c) => c.code} keyboardShouldPersistTaps="handled" contentContainerClassName="pb-10" initialNumToRender={20}
              ListEmptyComponent={<T v="small" className="py-6 text-center">No country matches “{q}”.</T>}
              renderItem={({ item }) => (
                <Pressable accessibilityRole="button" accessibilityLabel={item.name} accessibilityState={{ selected: item.code === value }} onPress={() => { onChange(item.code); close(); }}
                  className={cx('flex-row items-center gap-3 rounded-xl px-2 py-3 active:bg-surface-muted', item.code === value && 'bg-tint')}>
                  <Text className="text-2xl">{flag(item.code)}</Text><Text className="flex-1 font-pop text-[15px] text-ink">{item.name}</Text>
                </Pressable>
              )} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
