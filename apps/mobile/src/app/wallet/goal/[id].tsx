import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Lightbulb, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatNaira } from '@everycation/shared';
import { Badge, Button, IconButton, Loading, Note, Photo, Progress, Screen, T, Toggle } from '@/ui';
import { errorMessage } from '@/lib/api';
import { daysUntil, formatDay, goalImage, useUpdateGoal, useWallet } from '@/lib/wallet';

const per = { daily: 'a day', weekly: 'a week', monthly: 'a month' };

export default function SavingsGoal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: w, isLoading } = useWallet();
  const update = useUpdateGoal();
  const [error, setError] = useState('');
  const g = w?.goals.find((x) => x.id === id);
  if (isLoading) return <Screen title=""><Loading what="your goal" /></Screen>;
  if (!g) return <Screen title="Savings goal"><T>This goal no longer exists.</T></Screen>;
  const left = Math.max(0, g.target - g.saved); const days = daysUntil(g.targetDate);
  const setLocked = (locked: boolean) => { setError(''); update.mutateAsync({ id: g.id, locked }).catch((e) => setError(errorMessage(e))); };
  return (
    <View className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}><View className="w-full max-w-[520px] self-center">
        <Photo k={goalImage(g)} className="h-[200px]" />
        <SafeAreaView edges={['top']} className="absolute left-0 right-0 top-0"><View className="px-4 pt-2"><IconButton tone="glass" icon={ChevronLeft} label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/wallet'))} /></View></SafeAreaView>
        <View className="-mt-6 gap-4 rounded-t-[28px] bg-white px-5 pb-6 pt-6">
          <View className="gap-1.5"><T v="h1">{g.name}</T>{g.targetDate && <T v="small">Goal date {formatDay(g.targetDate)}{days ? ` · ${days} days left` : ''}</T>}{g.locked && <Badge icon={Lock} label="Locked" />}</View>
          <View className="gap-2"><Text className="font-pop-sb text-[28px] text-ink">{formatNaira(g.saved)} <Text className="font-pop text-base text-ink-muted">of {formatNaira(g.target)}</Text></Text>
            <Progress pct={g.percent} /><View className="flex-row justify-between"><T v="label">{g.percent}% saved</T><T v="small">{left ? `${formatNaira(left)} to go` : 'Goal reached'}</T></View></View>
          {g.autoSave && left > 0 && <Note icon={Lightbulb} tone="gold">{`Your plan: ${formatNaira(g.autoSave.amount)} ${per[g.autoSave.frequency]}${days ? ` gets you there by ${formatDay(g.targetDate)}` : ''}. Add it yourself for now; automatic debits come later.`}</Note>}
          <View className="rounded-card bg-surface-muted px-4 py-1">
            <View className="flex-row items-center gap-3 py-3"><View className="flex-1"><T v="strong">Lock this goal</T><T v="small">Keeps this money for the {g.kind === 'shopping' ? 'shop' : 'trip'}. You can unlock it any time.</T></View><Toggle label="Lock this goal" value={g.locked} onChange={setLocked} /></View>
          </View>
          {!!error && <Note tone="danger">{error}</Note>}
        </View>
      </View></ScrollView>
      <SafeAreaView edges={['bottom']} className="border-t border-line bg-white"><View className="w-full max-w-[520px] flex-row gap-3 self-center px-5 py-3">
        <Button className="flex-1" variant="outline" disabled={g.locked || g.saved === 0} label="Withdraw" onPress={() => router.push('/wallet/withdraw')} />
        <Button className="flex-[1.4]" label="ADD MONEY" onPress={() => router.push({ pathname: '/wallet/add-money', params: { to: g.id } })} />
      </View></SafeAreaView>
    </View>
  );
}
