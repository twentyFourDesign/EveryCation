import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Share, View } from 'react-native';
import { formatNaira } from '@everycation/shared';
import { Button, KeyValue, Screen, T } from '@/ui';
import { useApp } from '@/lib/store';

export default function WithdrawSent() {
  const { lastWithdrawal: w, available } = useApp();
  if (!w) return <Screen title="Withdraw"><T>No recent withdrawal.</T></Screen>;
  const receipt = `EveryCation withdrawal ${w.ref}: ${formatNaira(w.amount)} to GTBank •••• 4821 on ${w.when}`;
  return (
    <Screen footer={<><Button label="BACK TO WALLET" onPress={() => router.dismissTo('/wallet')} /><Button variant="ghost" label="Share receipt" onPress={() => Share.share({ message: receipt })} /></>}>
      <View className="items-center gap-3 pt-10">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-gold"><Check size={40} color="#262626" strokeWidth={3} /></View>
        <T v="h1" className="text-center">{formatNaira(w.amount)} is on its way</T>
        <T className="text-center text-ink-muted">We&apos;ve sent it to your GTBank account ending 4821. We&apos;ll let you know when it lands.</T>
      </View>
      <View className="rounded-card bg-surface-muted px-4 py-2">
        <KeyValue k="From" v={w.source} /><KeyValue k="To" v="GTBank •••• 4821" /><KeyValue k="Date" v={w.when} /><KeyValue k="Reference" v={w.ref} /><KeyValue k="New available balance" v={formatNaira(available)} strong />
      </View>
    </Screen>
  );
}
