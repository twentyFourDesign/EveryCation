import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { Package, Plane, ShoppingBag } from 'lucide-react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { formatNaira, goalSchema, parseNaira, type GoalInput } from '@everycation/shared';
import { Button, FormInput, Screen, Segmented, T, Toggle, colors, cx } from '@/ui';
import { useApp } from '@/lib/store';

const kinds = [{ k: 'trip', l: 'A trip', i: Plane }, { k: 'shopping', l: 'Shopping', i: ShoppingBag }, { k: 'package', l: 'A package', i: Package }] as const;
const freq = ['Daily', 'Weekly', 'Monthly'] as const;
const perYear = { daily: 365, weekly: 52, monthly: 12 };

export default function NewGoal() {
  const p = useLocalSearchParams<{ name?: string }>();
  const createGoal = useApp((s) => s.createGoal);
  const { control, handleSubmit, setValue } = useForm<GoalInput>({ resolver: zodResolver(goalSchema), defaultValues: { kind: 'trip', name: p.name ?? '', target: '₦600,000', by: '30 Apr 2027', frequency: 'weekly', locked: true } });
  const [kind, target, frequency] = useWatch({ control, name: ['kind', 'target', 'frequency'] });
  const times = Math.max(1, Math.ceil((perYear[frequency] * 171) / 365)); // 171 days from today to the sample goal date
  const each = Math.ceil((parseNaira(target) ?? 0) / times / 100000) * 100000;
  const create = handleSubmit((v) => {
    const id = createGoal({ name: v.name, kind: v.kind, target: parseNaira(v.target)!, locked: v.locked, by: v.by, autoSave: { amount: each, every: v.frequency === 'weekly' ? 'every Friday' : v.frequency, from: 'GTBank •••• 4821' } });
    router.replace(`/wallet/goal/${id}`);
  });
  return (
    <Screen title="New savings goal" footer={<Button label="CREATE GOAL" onPress={create} />}>
      <View className="gap-2"><T v="label">What are you saving for?</T>
        <View accessibilityRole="radiogroup" className="flex-row gap-2.5">{kinds.map((o) => (
          <Pressable key={o.k} accessibilityRole="radio" accessibilityState={{ checked: kind === o.k }} onPress={() => setValue('kind', o.k)} className={cx('flex-1 items-center gap-2 rounded-2xl border-[1.5px] py-4', kind === o.k ? 'border-navy bg-tint' : 'border-line')}>
            <o.i size={22} color={colors.navy} /><T v="label">{o.l}</T></Pressable>))}</View></View>
      <FormInput control={control} name="name" label="Goal name" placeholder="Beach escape" />
      <View className="flex-row gap-3"><View className="flex-1"><FormInput control={control} name="target" label="Target" keyboardType="number-pad" /></View><View className="flex-1"><FormInput control={control} name="by" label="By" /></View></View>
      <View className="gap-2"><T v="label">Auto-save</T>
        <Segmented options={freq} value={freq.find((f) => f.toLowerCase() === frequency)!} onChange={(f) => setValue('frequency', f.toLowerCase() as GoalInput['frequency'])} />
        <View className="flex-row items-center justify-between rounded-2xl bg-surface-muted p-3.5"><T v="small">{frequency === 'weekly' ? 'Every Friday' : frequency === 'daily' ? 'Every day' : 'Every month'}, {times} times</T><T v="title">{formatNaira(each)}</T></View></View>
      <View className="flex-row items-center gap-3"><View className="flex-1"><T v="strong">Lock until goal date</T><T v="small">You can still unlock it later if plans change</T></View>
        <Controller control={control} name="locked" render={({ field }) => <Toggle label="Lock until goal date" value={field.value} onChange={field.onChange} />} /></View>
    </Screen>
  );
}
