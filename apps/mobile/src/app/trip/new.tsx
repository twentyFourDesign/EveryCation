import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Input, Note, Screen, T } from '@/ui';
import { errorMessage } from '@/lib/api';
import { findCountry } from '@/lib/community';
import { toIso, useCreateTrip } from '@/lib/trips';

export default function NewTrip() {
  const create = useCreateTrip();
  const [title, setTitle] = useState(''); const [place, setPlace] = useState(''); const [country, setCountry] = useState(''); const [start, setStart] = useState(''); const [end, setEnd] = useState(''); const [travellers, setTravellers] = useState('1');
  const [tried, setTried] = useState(false); const [error, setError] = useState('');
  const match = findCountry(country); const s = toIso(start); const e = toIso(end);
  const errors = { title: title.trim().length < 2 ? 'Give the trip a name' : undefined, place: place.trim().length < 2 ? 'Add where you are going' : undefined, country: !match ? 'Choose a country, like Italy' : undefined,
    start: !s ? 'Use dd/mm/yyyy' : undefined, end: !e ? 'Use dd/mm/yyyy' : s && e < s ? 'The trip cannot end before it starts' : undefined };
  async function save() {
    setTried(true); setError('');
    if (Object.values(errors).some(Boolean)) return;
    try { const trip = await create.mutateAsync({ title: title.trim(), place: place.trim(), countryCode: match!.code, startDate: s!, endDate: e!, travellers: Math.max(1, Number(travellers) || 1) }); router.replace(`/trip/${trip.id}`); }
    catch (err) { setError(errorMessage(err)); }
  }
  const show = <K extends keyof typeof errors>(k: K) => (tried ? errors[k] : undefined);
  return (
    <Screen title="Add a trip" footer={<Button disabled={create.isPending} label={create.isPending ? 'SAVING…' : 'SAVE TRIP'} onPress={save} />}>
      <T className="-mt-2 text-ink-muted">Add a trip you are planning or one you have already taken. Past trips back up the advice you share.</T>
      <Input label="Trip name *" value={title} onChangeText={setTitle} placeholder="Dolomites trip" maxLength={80} error={show('title')} />
      <Input label="City or place *" value={place} onChangeText={setPlace} placeholder="Cortina d'Ampezzo" maxLength={80} error={show('place')} />
      <Input label="Country *" value={country} onChangeText={setCountry} placeholder="Italy" autoCapitalize="words" error={show('country')} />
      <View className="flex-row gap-3">
        <View className="flex-1"><Input label="From *" value={start} onChangeText={setStart} placeholder="dd/mm/yyyy" keyboardType="numbers-and-punctuation" maxLength={10} error={show('start')} /></View>
        <View className="flex-1"><Input label="To *" value={end} onChangeText={setEnd} placeholder="dd/mm/yyyy" keyboardType="numbers-and-punctuation" maxLength={10} error={show('end')} /></View>
      </View>
      <Input label="Travellers" value={travellers} onChangeText={(v) => setTravellers(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={2} />
      {!!error && <Note tone="danger">{error}</Note>}
    </Screen>
  );
}
