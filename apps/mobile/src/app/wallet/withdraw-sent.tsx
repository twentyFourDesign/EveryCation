import { router, useLocalSearchParams } from 'expo-router';
import { Check, Clock } from 'lucide-react-native';
import { Share, View } from 'react-native';
import { formatNaira } from '@everycation/shared';
import { Button, KeyValue, Screen, T, cx } from '@/ui';
import { useWallet } from '@/lib/wallet';

export default function WithdrawSent() {
  const p = useLocalSearchParams<{ reference: string; amount: string; status: string; message?: string; from?: string; at?: string }>();
  const { data: w } = useWallet();
  const amount = formatNaira(Number(p.amount)); const held = p.status === 'held';
  const bank = w?.banks.find((b) => b.isDefault) ?? w?.banks[0];
  const to = bank ? `${bank.bankName} •••• ${bank.last4}` : 'Your bank';
  const when = p.at ? new Date(p.at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <Screen footer={<><Button label="BACK TO WALLET" onPress={() => router.dismissTo('/wallet')} /><Button variant="ghost" label="Share receipt" onPress={() => Share.share({ message: `EveryCation withdrawal ${p.reference}: ${amount} to ${to}, ${when}` })} /></>}>
      <View className="items-center gap-3 pt-10">
        <View className={cx('h-20 w-20 items-center justify-center rounded-full', held ? 'bg-gold-soft' : 'bg-gold')}>{held ? <Clock size={38} color="#262626" /> : <Check size={40} color="#262626" strokeWidth={3} />}</View>
        <T v="h1" className="text-center">{held ? `${amount} is being reviewed` : `${amount} is on its way`}</T>
        <T className="text-center text-ink-muted">{held ? p.message : `We've sent it to your ${bank?.bankName ?? 'bank'} account ending ${bank?.last4 ?? ''}. We'll let you know when it lands.`}</T>
      </View>
      <View className="rounded-card bg-surface-muted px-4 py-2">
        <KeyValue k="From" v={(p.from ?? 'Available balance').replace(/^./, (c) => c.toUpperCase())} /><KeyValue k="To" v={to} /><KeyValue k="Date" v={when} /><KeyValue k="Reference" v={p.reference} />
        {w && <KeyValue k="New available balance" v={formatNaira(w.available)} strong />}
      </View>
    </Screen>
  );
}
