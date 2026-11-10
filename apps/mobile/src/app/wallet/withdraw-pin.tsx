import { router, useLocalSearchParams } from 'expo-router';
import { Fingerprint } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { formatNaira } from '@everycation/shared';
import { Button, Mark, PinPad, Screen, T } from '@/ui';
import { approveWithBiometrics, canUseBiometrics, checkPin } from '@/lib/pin';
import { useApp } from '@/lib/store';

export default function WithdrawPin() {
  const { amount, source = 'available' } = useLocalSearchParams<{ amount: string; source?: string }>();
  const kobo = Number(amount);
  const { withdraw, goals } = useApp();
  const [pin, setPin] = useState(''); const [error, setError] = useState(''); const [tries, setTries] = useState(0); const [bio, setBio] = useState(false);
  const from = source === 'available' ? 'available balance' : `${goals.find((g) => g.id === source)?.name} goal`;
  const finish = () => { withdraw(kobo, source); router.replace('/wallet/withdraw-sent'); };
  useEffect(() => { canUseBiometrics().then(setBio); }, []);
  async function onPin(next: string) {
    setError('');
    if (tries >= 3) return setError('Too many wrong tries. Reset your PIN or try again in a few minutes.');
    setPin(next);
    if (next.length < 4) return;
    if (await checkPin(next)) return finish();
    setTries(tries + 1); setPin('');
    setError(tries >= 2 ? 'Wrong PIN. For your safety, try again in a few minutes or reset it.' : 'That PIN is not right. Try again.');
  }
  return (
    <Screen title="" scroll={false} className="items-center justify-between">
      <View className="items-center gap-2"><Mark size={40} color="brand" /><T v="h2" className="text-center">Withdrawing {formatNaira(kobo)}</T><T v="small" className="text-center">From {from} to GTBank •••• 4821</T></View>
      <View className="items-center gap-4"><T v="strong">Enter your wallet PIN</T>
        {!!error && <Text accessibilityRole="alert" className="text-center font-pop-md text-[13px] text-danger">{error}</Text>}
        <PinPad value={pin} onChange={onPin} />
        {__DEV__ && <T v="small" className="text-xs">Sample PIN in development: 2580</T>}
      </View>
      <View className="w-full gap-1">
        {bio && <Button variant="outline" icon={Fingerprint} label="Use face or fingerprint" onPress={async () => { if (await approveWithBiometrics(`Withdraw ${formatNaira(kobo)}`)) finish(); }} />}
        <Button variant="ghost" label="Forgot PIN?" onPress={() => router.push('/wallet/setup/pin')} />
      </View>
    </Screen>
  );
}
