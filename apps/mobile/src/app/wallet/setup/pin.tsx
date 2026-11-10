import { router } from 'expo-router';
import { BadgeCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { pinSchema } from '@everycation/shared';
import { Badge, Loading, PinPad, Screen, T } from '@/ui';
import { errorMessage } from '@/lib/api';
import { forgetPin } from '@/lib/biometric-pin';
import { useSetPin, useWallet } from '@/lib/wallet';

export default function CreatePin() {
  const { data: w } = useWallet();
  const setPinOnServer = useSetPin();
  const [current, setCurrent] = useState<string | null>(null); const [first, setFirst] = useState<string | null>(null); const [pin, setPin] = useState(''); const [error, setError] = useState('');
  if (!w) return <Screen title=""><Loading what="your wallet" /></Screen>;
  const changing = w.setup.hasPin; const askCurrent = changing && current === null;

  async function onPin(next: string) {
    setError('');
    if (next.length < 4) return setPin(next);
    setPin('');
    if (askCurrent) return setCurrent(next);
    if (first === null) { const r = pinSchema.safeParse(next); if (!r.success) return setError(r.error.issues[0]!.message); return setFirst(next); }
    if (next !== first) { setError('The two PINs did not match. Start again.'); return setFirst(null); }
    try {
      await setPinOnServer.mutateAsync({ pin: next, ...(current && { currentPin: current }) });
      await forgetPin();
      if (changing) router.back(); else router.replace(w!.setup.hasBank ? '/wallet' : '/wallet/setup/bank');
    } catch (e) { setError(errorMessage(e)); setFirst(null); if (changing) setCurrent(null); }
  }
  return (
    <Screen title={changing ? 'Change wallet PIN' : 'Step 2 of 3'} scroll={false} className="items-center justify-between">
      <View className="items-center gap-2">{!changing && <Badge icon={BadgeCheck} label="Identity confirmed" />}
        <T v="h1" className="text-center">{askCurrent ? 'Enter your current PIN' : first === null ? (changing ? 'Choose a new PIN' : 'Create your wallet PIN') : 'Enter it again to confirm'}</T>
        <T className="text-center text-ink-muted">You&apos;ll use it to approve withdrawals and payments. Avoid your birthday or 1234.</T>
        {!!error && <Text accessibilityRole="alert" className="text-center font-pop-md text-[13px] text-danger">{error}</Text>}
        {setPinOnServer.isPending && <T v="small">Saving…</T>}</View>
      <PinPad value={pin} onChange={onPin} />
      <View />
    </Screen>
  );
}
