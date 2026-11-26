import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Check, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Button, Loading, Note, Progress, Screen, T, colors, cx, go } from '@/ui';
import { errorMessage } from '@/lib/api';
import { SECTIONS, TONE_STYLE, flag, useAddChecklistItem, useChecklist, useDeleteChecklist, useRemoveChecklistItem, useTickItem, type ChecklistItem, type Section } from '@/lib/travel';

const order = Object.keys(SECTIONS) as Section[];
const buzz = () => { if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {}); };

function Item({ item, onTick, onRemove }: { item: ChecklistItem; onTick: () => void; onRemove: () => void }) {
  return (
    <View className="flex-row items-center gap-3 py-2.5">
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: item.done }} accessibilityLabel={item.text} hitSlop={6} onPress={onTick} className="flex-1 flex-row items-center gap-3">
        <View className={cx('h-7 w-7 items-center justify-center rounded-lg border-2', item.done ? 'border-navy bg-navy' : 'border-control-border bg-white')}>{item.done && <Check size={16} color="#fff" strokeWidth={3} />}</View>
        <Text className={cx('flex-1 font-pop text-[15px] leading-5', item.done ? 'text-ink-muted line-through' : 'text-ink')}>{item.text}</Text>
      </Pressable>
      {item.own && <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.text}`} hitSlop={10} onPress={onRemove}><Trash2 size={17} color={colors.inkMuted} /></Pressable>}
    </View>
  );
}

export default function ChecklistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: c, isLoading, error } = useChecklist(id);
  const tick = useTickItem(id); const add = useAddChecklistItem(id); const removeItem = useRemoveChecklistItem(id); const del = useDeleteChecklist();
  const [text, setText] = useState(''); const [section, setSection] = useState<Section>('before'); const [confirm, setConfirm] = useState(false);
  if (isLoading) return <Screen title="Checklist"><Loading what="your checklist" /></Screen>;
  if (!c) return <Screen title="Checklist"><Note tone="danger">{error ? errorMessage(error) : 'This checklist could not be found.'}</Note></Screen>;

  const done = c.items.filter((i) => i.done).length; const total = c.items.length; const pct = total ? Math.round((done / total) * 100) : 0;
  const tone = TONE_STYLE[c.requirement.tone];
  return (
    <Screen title={`${flag(c.destination)} ${c.destinationName}`}>
      <View className="gap-3 rounded-card bg-navy p-4">
        <Text className="font-pop-sb text-[11px] tracking-widest text-gold">{pct === 100 ? 'ALL SET' : 'TRAVEL CHECKLIST'}</Text>
        <Text className="font-pop-sb text-xl text-white">{pct === 100 ? `🎉 You are ready for ${c.destinationName}!` : `${done} of ${total} done`}</Text>
        <Progress pct={pct} tone="gold" />
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/requirements', params: { to: c.destination } })} style={{ backgroundColor: tone.bg }} className="flex-row items-center gap-2 self-start rounded-full px-3 py-1.5">
          <tone.icon size={18} color={tone.ink} accent={tone.accent} /><Text style={{ color: tone.ink }} className="font-pop-sb text-[13px]">{c.requirement.title}{c.requirement.days ? ` · ${c.requirement.days} days` : ''} for {c.passportName} passports</Text>
        </Pressable>
      </View>

      {order.map((s) => {
        const items = c.items.filter((i) => i.section === s); if (!items.length) return null;
        const left = items.filter((i) => !i.done).length;
        return (
          <View key={s} className="gap-0.5">
            <View className="flex-row items-center">{(() => { const S = SECTIONS[s].icon; return <S size={22} />; })()}<T v="strong" className="ml-2 flex-1">{SECTIONS[s].title}</T><T v="small" className="text-xs">{left ? `${left} to do` : 'Done ✓'}</T></View>
            <View className="divide-y divide-line">
              {items.map((i) => <Item key={i.id} item={i} onTick={() => { buzz(); tick.mutate({ itemId: i.id, done: !i.done }); }} onRemove={() => removeItem.mutate(i.id)} />)}
            </View>
          </View>
        );
      })}

      <View className="gap-2.5 rounded-card bg-surface-muted p-3.5">
        <T v="strong">Add your own</T>
        <TextInput value={text} onChangeText={setText} placeholder="Pack the power bank" placeholderTextColor={colors.inkMuted} maxLength={120} accessibilityLabel="New checklist item"
          onSubmitEditing={() => text.trim().length >= 2 && add.mutate({ text: text.trim(), section }, { onSuccess: () => setText('') })}
          className="h-12 rounded-xl border-[1.5px] border-control-border bg-white px-3.5 font-pop text-[15px] text-ink" />
        <View className="flex-row flex-wrap gap-2">
          {order.map((s) => (
            <Pressable key={s} accessibilityRole="radio" accessibilityState={{ selected: s === section }} onPress={() => setSection(s)} className={cx('h-9 justify-center rounded-full px-3', s === section ? 'bg-navy' : 'border-[1.5px] border-control-border bg-white')}>
              <Text className={cx('font-pop-md text-[13px]', s === section ? 'text-white' : 'text-ink')}>{SECTIONS[s].title}</Text>
            </Pressable>
          ))}
        </View>
        {!!add.error && <Note tone="danger">{errorMessage(add.error)}</Note>}
        <Button small variant="navy" icon={Plus} label="Add to checklist" disabled={text.trim().length < 2 || add.isPending} onPress={() => add.mutate({ text: text.trim(), section }, { onSuccess: () => setText('') })} />
      </View>

      {c.tripId && <Button variant="outline" label="View the trip" onPress={() => go(`/trip/${c.tripId}`)} />}
      <Pressable accessibilityRole="button" disabled={del.isPending} onPress={() => (confirm ? del.mutate(c.id, { onSuccess: () => router.back() }) : setConfirm(true))} className="items-center py-2">
        <Text className="font-pop-sb text-sm text-danger">{confirm ? 'Tap again to delete this checklist' : 'Delete checklist'}</Text>
      </Pressable>
    </Screen>
  );
}
