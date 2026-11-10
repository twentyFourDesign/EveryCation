import { router } from 'expo-router';
import { ArrowDownToLine, ArrowUpFromLine, History, Lock, ShieldCheck, Target } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { formatNaira, percent } from '@everycation/shared';
import { Button, IconButton, Mark, Note, Photo, Progress, Screen, SectionTitle, T, colors, go } from '@/ui';
import { goalsTotal, useApp } from '@/lib/store';

export default function Wallet() {
  const { available, goals, walletReady, frozen } = useApp();
  if (!walletReady) return (
    <Screen edges={['top']} title="Travel wallet" back={false}>
      <View className="items-center gap-3 pt-8"><View className="h-20 w-20 items-center justify-center rounded-full bg-tint"><ShieldCheck size={40} color={colors.navy} /></View>
        <T v="h2" className="text-center">Set up your travel wallet</T><T className="text-center text-ink-muted">Save for trips and travel shopping, and withdraw to your bank whenever you need to. It takes about three minutes.</T></View>
      <Button label="SET UP WALLET" onPress={() => router.push('/wallet/setup/identity')} />
    </Screen>
  );
  const inGoals = goalsTotal(goals);
  const actions = [{ l: 'Add money', i: ArrowDownToLine, h: '/wallet/add-money' }, { l: 'Withdraw', i: ArrowUpFromLine, h: '/wallet/withdraw' }, { l: 'New goal', i: Target, h: '/wallet/new-goal' }];
  return (
    <Screen edges={['top']} title="Travel wallet" back={false} right={<IconButton icon={History} label="Wallet history" onPress={() => router.push('/wallet/history')} />}>
      <View className="gap-4 overflow-hidden rounded-card bg-navy p-5">
        <View className="absolute -right-6 -top-6 opacity-10"><Mark size={150} color="#fff" /></View>
        <View><Text className="font-pop text-[13px] text-navy-text-soft">Total balance</Text><Text accessibilityLabel={`Total balance ${formatNaira(available + inGoals)}`} className="font-pop-sb text-[36px] leading-[44px] text-white">{formatNaira(available + inGoals)}</Text></View>
        <View className="flex-row gap-6">
          <View><Text className="font-pop text-xs text-navy-text-soft">Available</Text><Text className="font-pop-sb text-base text-white">{formatNaira(available)}</Text></View>
          <View><Text className="font-pop text-xs text-navy-text-soft">In savings goals</Text><Text className="font-pop-sb text-base text-white">{formatNaira(inGoals)}</Text></View>
        </View>
      </View>
      {frozen && <Note tone="danger" icon={Lock}>Your wallet is frozen. No money can go out until you unfreeze it in Wallet settings.</Note>}
      <View className="flex-row gap-3">
        {actions.map((a) => (
          <Pressable key={a.l} accessibilityRole="button" accessibilityLabel={a.l} onPress={() => go(a.h)} className="flex-1 items-center gap-2 rounded-card bg-surface-muted py-4 active:opacity-70">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-gold"><a.i size={20} color={colors.ink} /></View><T v="label">{a.l}</T>
          </Pressable>
        ))}
      </View>
      <SectionTitle action="History" onAction={() => router.push('/wallet/history')}>Savings goals</SectionTitle>
      {goals.map((g) => (
        <Pressable key={g.id} accessibilityRole="button" accessibilityLabel={`${g.name}, ${formatNaira(g.saved)} of ${formatNaira(g.target)}`} onPress={() => go(`/wallet/goal/${g.id}`)} className="flex-row items-center gap-3 rounded-card bg-surface-muted p-3 active:opacity-80">
          <Photo k={g.image} className="h-16 w-16 rounded-2xl" />
          <View className="flex-1 gap-1.5">
            <View className="flex-row items-center gap-2"><T v="strong" className="flex-shrink" numberOfLines={1}>{g.name}</T>{g.locked && <Lock size={14} color={colors.inkMuted} accessibilityLabel="Locked" />}</View>
            <Progress pct={percent(g.saved, g.target)} /><T v="small" className="text-xs">{formatNaira(g.saved)} of {formatNaira(g.target)}</T>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}
