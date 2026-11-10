import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Lightbulb, Lock, Unlock } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatNaira, percent } from '@everycation/shared';
import { Badge, Button, IconButton, KeyValue, Note, Photo, Progress, T, Toggle } from '@/ui';
import { useApp } from '@/lib/store';

export default function SavingsGoal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { goals, toggleGoalLock, txns } = useApp();
  const g = goals.find((x) => x.id === id);
  if (!g) return <View className="flex-1 items-center justify-center"><T>This goal no longer exists.</T></View>;
  const pct = percent(g.saved, g.target); const left = g.target - g.saved;
  const weeks = g.daysLeft ? Math.max(1, Math.ceil(g.daysLeft / 7)) : null;
  const projected = weeks && g.autoSave ? g.saved + weeks * g.autoSave.amount : null;
  const needed = weeks ? Math.ceil(left / weeks / 500000) * 500000 : null;
  const mine = txns.filter((t) => t.title.includes(g.name)).slice(0, 3);
  return (
    <View className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}><View className="w-full max-w-[520px] self-center">
        <Photo k={g.image} className="h-[200px]" />
        <SafeAreaView edges={['top']} className="absolute left-0 right-0 top-0"><View className="px-4 pt-2"><IconButton tone="glass" icon={ChevronLeft} label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/wallet'))} /></View></SafeAreaView>
        <View className="-mt-6 gap-4 rounded-t-[28px] bg-white px-5 pb-6 pt-6">
          <View className="gap-1.5"><T v="h1">{g.name}</T>{g.by && <T v="small">Goal date {g.by}{g.daysLeft ? ` · ${g.daysLeft} days left` : ''}</T>}{g.locked && <Badge icon={Lock} label="Locked" />}</View>
          <View className="gap-2"><Text className="font-pop-sb text-[28px] text-ink">{formatNaira(g.saved)} <Text className="font-pop text-base text-ink-muted">of {formatNaira(g.target)}</Text></Text>
            <Progress pct={pct} /><View className="flex-row justify-between"><T v="label">{pct}% saved</T><T v="small">{formatNaira(Math.max(0, left))} to go</T></View></View>
          {projected !== null && needed !== null && left > 0 && projected < g.target && <Note icon={Lightbulb} tone="gold">{`At ${formatNaira(g.autoSave!.amount)} a week you'll reach ${formatNaira(projected)} by your goal date. Save ${formatNaira(needed)} a week to hit your goal.`}</Note>}
          <View className="rounded-card bg-surface-muted px-4 py-1">
            {g.autoSave && <View className="flex-row items-center gap-3 border-b border-line py-3"><View className="flex-1"><T v="strong">Auto-save</T><T v="small">{formatNaira(g.autoSave.amount)} {g.autoSave.every} from {g.autoSave.from}</T></View><Text accessibilityRole="link" onPress={() => router.push('/wallet/settings')} className="font-pop-sb text-[13px] text-heading-blue">Change</Text></View>}
            <View className="flex-row items-center gap-3 py-3"><View className="flex-1"><T v="strong">Lock until goal date</T><T v="small">Keeps this money for the {g.kind === 'shopping' ? 'shop' : 'trip'}</T></View><Toggle label="Lock until goal date" value={g.locked} onChange={() => toggleGoalLock(g.id)} /></View>
          </View>
          {mine.length > 0 && <View>{mine.map((t) => <KeyValue key={t.id} k={t.detail.split(' · ')[0]!} v={`${t.title.split(' · ')[0]} ${formatNaira(t.amount, { sign: true })}`} />)}</View>}
        </View>
      </View></ScrollView>
      <SafeAreaView edges={['bottom']} className="border-t border-line bg-white"><View className="w-full max-w-[520px] flex-row gap-3 self-center px-5 py-3">
        <Button className="flex-1" variant="outline" icon={g.locked ? Unlock : undefined} label={g.locked ? 'Unlock' : 'Withdraw'} onPress={() => (g.locked ? toggleGoalLock(g.id) : router.push('/wallet/withdraw'))} />
        <Button className="flex-[1.4]" label="ADD MONEY" onPress={() => router.push({ pathname: '/wallet/add-money', params: { to: g.id } })} />
      </View></SafeAreaView>
    </View>
  );
}
