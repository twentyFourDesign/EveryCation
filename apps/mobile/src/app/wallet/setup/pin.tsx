import { router } from 'expo-router';
import { BadgeCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { pinSchema } from '@everycation/shared';
import { Badge, PinPad, Screen, T } from '@/ui';
import { savePin } from '@/lib/pin';
import { useApp } from '@/lib/store';

export default function CreatePin() {
  const ready = useApp((s) => s.walletReady);
  const [first, setFirst] = useState<string | null>(null); const [pin, setPin] = useState(''); const [error, setError] = useState('');
  function onPin(next: string) {
    setError('');
    if (next.length < 4) return setPin(next);
    setPin('');
    if (first === null) { const r = pinSchema.safeParse(next); if (!r.success) return setError(r.error.issues[0]!.message); return setFirst(next); }
    if (next !== first) { setError('The two PINs did not match. Start again.'); return setFirst(null); }
    savePin(next).then(() => (ready ? router.back() : router.push('/wallet/setup/bank')));
  }
  return (
    <Screen title={ready ? 'Change wallet PIN' : 'Step 2 of 3'} scroll={false} className="items-center justify-between">
      <View className="items-center gap-2">{!ready && <Badge icon={BadgeCheck} label="Identity confirmed" />}
        <T v="h1" className="text-center">{first === null ? 'Create your wallet PIN' : 'Enter it again to confirm'}</T>
        <T className="text-center text-ink-muted">You&apos;ll use it to approve withdrawals and payments. Avoid your birthday or 1234.</T>
        {!!error && <Text accessibilityRole="alert" className="text-center font-pop-md text-[13px] text-danger">{error}</Text>}</View>
      <PinPad value={pin} onChange={onPin} />
      <View />
    </Screen>
  );
}
