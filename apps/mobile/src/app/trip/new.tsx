import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Input, Note, Screen, T } from '@/ui';
import { PlaceField } from '@/ui/place-field';
import { errorMessage } from '@/lib/api';
import { countryName, findCountry } from '@/lib/community';
import { useCreateTrip, type PlaceHit } from '@/lib/trips';
import { DateField } from '@/ui/date-field';

export default function NewTrip() {
  const create = useCreateTrip();
  // Opened from a bucket list dream: start with its name and place.
  const from = useLocalSearchParams<{ title?: string; place?: string; countryCode?: string; lat?: string; lng?: string }>();
  const fromPin: PlaceHit | null = from.place && from.countryCode && from.lat && from.lng ? { name: from.place, detail: '', label: from.place, countryCode: from.countryCode, lat: Number(from.lat), lng: Number(from.lng), source: 'map' } : null;
  const [title, setTitle] = useState(from.title ?? ''); const [place, setPlace] = useState(from.place ?? ''); const [country, setCountry] = useState(from.countryCode ? countryName(from.countryCode) : ''); const [start, setStart] = useState(''); const [end, setEnd] = useState(''); const [travellers, setTravellers] = useState('1');
  const [tried, setTried] = useState(false); const [error, setError] = useState('');
  // The place the traveller picked from search. It carries the exact map position; typing again drops it.
  const [picked, setPicked] = useState<PlaceHit | null>(fromPin);
  function choose(hit: PlaceHit | null) { setPicked(hit); if (hit) setCountry(countryName(hit.countryCode)); }
  const match = findCountry(country); const s = start || null; const e = end || null;
  const errors = { title: title.trim().length < 2 ? 'Give the trip a name' : undefined, place: place.trim().length < 2 ? 'Add where you are going' : undefined, country: !match ? 'Choose a country, like Italy' : undefined,
    start: !s ? 'Choose when the trip starts' : undefined, end: !e ? 'Choose when the trip ends' : s && e < s ? 'The trip cannot end before it starts' : undefined };
  async function save() {
    setTried(true); setError('');
    if (Object.values(errors).some(Boolean)) return;
    try { const trip = await create.mutateAsync({ title: title.trim(), place: place.trim(), countryCode: match!.code, startDate: s!, endDate: e!, travellers: Math.max(1, Number(travellers) || 1), ...(picked && picked.countryCode === match!.code && { lat: picked.lat, lng: picked.lng }) }); router.replace(`/trip/${trip.id}`); }
    catch (err) { setError(errorMessage(err)); }
  }
  const show = <K extends keyof typeof errors>(k: K) => (tried ? errors[k] : undefined);
  return (
    <Screen title="Add a trip" footer={<Button disabled={create.isPending} label={create.isPending ? 'SAVING…' : 'SAVE TRIP'} onPress={save} />}>
      <T className="-mt-2 text-ink-muted">Add a trip you are planning or one you have already taken. Past trips back up the advice you share.</T>
      <Input label="Trip name *" value={title} onChangeText={setTitle} placeholder="Dolomites trip" maxLength={80} error={show('title')} />
      <PlaceField label="Where are you going? *" value={place} onChangeText={setPlace} picked={picked} onPick={choose} error={show('place')} hint="Pinned on your travel map." />
      <Input label="Country *" value={country} onChangeText={setCountry} placeholder="Italy" autoCapitalize="words" error={show('country')} />
      <View className="flex-row gap-3">
        <View className="flex-1"><DateField label="From *" value={start} onChange={(d) => { setStart(d); if (end && end < d) setEnd(''); }} placeholder="Start date" error={show('start')} /></View>
        <View className="flex-1"><DateField label="To *" value={end} onChange={setEnd} min={start || undefined} placeholder="End date" error={show('end')} /></View>
      </View>
      <Input label="Travellers" value={travellers} onChangeText={(v) => setTravellers(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={2} />
      {!!error && <Note tone="danger">{error}</Note>}
    </Screen>
  );
}
