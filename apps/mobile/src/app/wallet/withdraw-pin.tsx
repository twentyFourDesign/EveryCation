import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { Fingerprint } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { formatNaira } from '@everycation/shared';
import { Button, Mark, PinPad, Screen, T } from '@/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { biometricsAvailable, forgetPin, pinWithBiometrics, rememberPin } from '@/lib/biometric-pin';
import { useWallet, useWithdraw } from '@/lib/wallet';

export default function WithdrawPin() {
  const { amount, source = 'available' } = useLocalSearchParams<{ amount: string; source?: string }>();
  const kobo = Number(amount);
  const { data: w } = useWallet();
  const withdraw = useWithdraw();
  const [pin, setPin] = useState(''); const [error, setError] = useState(''); const [locked, setLocked] = useState(false); const [bio, setBio] = useState(false);
  // One key for this attempt: if the request is retried after a dropped connection, the money still moves once.
  const [key] = useState(() => randomUUID());
  const bank = w?.banks.find((b) => b.isDefault) ?? w?.banks[0];
  const from = source === 'available' ? 'available balance' : `${w?.goals.find((g) => g.id === source)?.name ?? 'your'} goal`;
  useEffect(() => { biometricsAvailable().then(setBio); }, []);

  async function send(value: string, viaBiometrics = false) {
    setError('');
    try {
      const result = await withdraw.mutateAsync({ amount: kobo, source, pin: value, key });
      if (!viaBiometrics) await rememberPin(value);
      router.dismissTo('/wallet');
      router.push({ pathname: '/wallet/withdraw-sent', params: { reference: result.reference, amount: String(result.amount), status: result.status, message: result.message ?? '', from, at: result.createdAt } });
    } catch (e) {
      setPin('');
      setError(errorMessage(e));
      if (e instanceof ApiError && e.code === 'pin_locked') setLocked(true);
      if (viaBiometrics && e instanceof ApiError && e.code === 'pin_wrong') await forgetPin(); // PIN was changed on another phone
    }
  }
  function onPin(next: string) { if (locked || withdraw.isPending) return; setError(''); setPin(next); if (next.length === 4) send(next); }

  return (
    <Screen title="" scroll={false} className="items-center justify-between">
      <View className="items-center gap-2"><Mark size={40} color="brand" /><T v="h2" className="text-center">Withdrawing {formatNaira(kobo)}</T><T v="small" className="text-center">From {from} to {bank ? `${bank.bankName} •••• ${bank.last4}` : 'your bank'}</T></View>
      <View className="items-center gap-4"><T v="strong">{withdraw.isPending ? 'Sending…' : 'Enter your wallet PIN'}</T>
        {!!error && <Text accessibilityRole="alert" className="text-center font-pop-md text-[13px] text-danger">{error}</Text>}
        <PinPad value={pin} onChange={onPin} />
      </View>
      <View className="w-full gap-1">
        {bio && !locked && <Button variant="outline" icon={Fingerprint} label="Use face or fingerprint" onPress={async () => { const saved = await pinWithBiometrics(); if (saved) send(saved, true); else setError('Enter your PIN once on this phone to turn on face or fingerprint.'); }} />}
        <Button variant="ghost" label="Forgot PIN?" onPress={() => setError('To reset your PIN, contact support from Settings → Help and support.')} />
      </View>
    </Screen>
  );
}
