import { router, useLocalSearchParams } from 'expo-router';
import { Package, Plane, ShoppingBag } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { formatNaira, parseNaira } from '@everycation/shared';
import { Button, Input, Note, Screen, Segmented, T, Toggle, colors, cx } from '@/ui';
import { errorMessage } from '@/lib/api';
import { useCreateGoal } from '@/lib/wallet';

const kinds = [{ k: 'trip', l: 'A trip', i: Plane }, { k: 'shopping', l: 'Shopping', i: ShoppingBag }, { k: 'package', l: 'A package', i: Package }] as const;
const freq = ['Daily', 'Weekly', 'Monthly'] as const;
const everyDays = { daily: 1, weekly: 7, monthly: 30 };

/** "30/04/2027" → "2027-04-30", or null when it is not a real date in the future. */
function toIsoDate(input: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`; const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(iso) && d.getTime() > Date.now() ? iso : null;
}

export default function NewGoal() {
  const p = useLocalSearchParams<{ name?: string }>();
  const create = useCreateGoal();
  const [kind, setKind] = useState<(typeof kinds)[number]['k']>('trip');
  const [name, setName] = useState(p.name ?? ''); const [target, setTarget] = useState('₦600,000'); const [by, setBy] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly'); const [locked, setLocked] = useState(true);
  const [tried, setTried] = useState(false); const [error, setError] = useState(''); const [now] = useState(() => Date.now());

  const kobo = parseNaira(target) ?? 0; const iso = by ? toIsoDate(by) : null;
  const errors = { name: name.trim().length < 2 ? 'Give your goal a name' : undefined, target: kobo < 500000 ? 'Set a target of at least ₦5,000' : undefined, by: by && !iso ? 'Use dd/mm/yyyy, and a date in the future' : undefined };
  const days = iso ? Math.ceil((new Date(iso).getTime() - now) / 86_400_000) : null;
  const times = days ? Math.max(1, Math.ceil(days / everyDays[frequency])) : null;
  const each = times ? Math.ceil(kobo / times / 100000) * 100000 : null;

  async function submit() {
    setTried(true); setError('');
    if (errors.name || errors.target || errors.by) return;
    try {
      const goal = await create.mutateAsync({ name: name.trim(), kind, target: kobo, locked, ...(iso && { targetDate: iso }), ...(each && { autoSaveAmount: each, autoSaveFrequency: frequency }) });
      router.replace(`/wallet/goal/${goal.id}`);
    } catch (e) { setError(errorMessage(e)); }
  }
  return (
    <Screen title="New savings goal" footer={<Button disabled={create.isPending} label={create.isPending ? 'CREATING…' : 'CREATE GOAL'} onPress={submit} />}>
      <View className="gap-2"><T v="label">What are you saving for?</T>
        <View accessibilityRole="radiogroup" className="flex-row gap-2.5">{kinds.map((o) => (
          <Pressable key={o.k} accessibilityRole="radio" accessibilityState={{ checked: kind === o.k }} onPress={() => setKind(o.k)} className={cx('flex-1 items-center gap-2 rounded-2xl border-[1.5px] py-4', kind === o.k ? 'border-navy bg-tint' : 'border-line')}>
            <o.i size={22} color={colors.navy} /><T v="label">{o.l}</T></Pressable>))}</View></View>
      <Input label="Goal name" value={name} onChangeText={setName} placeholder="Beach escape" maxLength={60} error={tried ? errors.name : undefined} />
      <View className="flex-row gap-3">
        <View className="flex-1"><Input label="Target" value={target} onChangeText={setTarget} keyboardType="number-pad" error={tried ? errors.target : undefined} /></View>
        <View className="flex-1"><Input label="By (optional)" value={by} onChangeText={setBy} placeholder="dd/mm/yyyy" keyboardType="numbers-and-punctuation" maxLength={10} error={errors.by} /></View>
      </View>
      {each && times && (
        <View className="gap-2"><T v="label">Saving plan</T>
          <Segmented options={freq} value={freq.find((f) => f.toLowerCase() === frequency)!} onChange={(f) => setFrequency(f.toLowerCase() as typeof frequency)} />
          <View className="flex-row items-center justify-between rounded-2xl bg-surface-muted p-3.5"><T v="small">{frequency === 'weekly' ? 'Every week' : frequency === 'daily' ? 'Every day' : 'Every month'}, {times} times</T><T v="title">{formatNaira(each)}</T></View>
          <T v="small" className="text-xs">We save this plan with your goal. Automatic debits from your bank start once our bank partner is connected; until then, add money yourself.</T></View>
      )}
      <View className="flex-row items-center gap-3"><View className="flex-1"><T v="strong">Lock this goal</T><T v="small">Money can go in but not out until you unlock it</T></View><Toggle label="Lock this goal" value={locked} onChange={setLocked} /></View>
      {!!error && <Note tone="danger">{error}</Note>}
    </Screen>
  );
}
