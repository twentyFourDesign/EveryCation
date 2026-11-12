import { router } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Input, Note, Screen, T, colors } from '@/ui';
import { errorMessage } from '@/lib/api';
import { countryName, findCountry } from '@/lib/community';
import { toIso, useCreateTrip, usePlaceSearch, type PlaceHit } from '@/lib/trips';

export default function NewTrip() {
  const create = useCreateTrip();
  const [title, setTitle] = useState(''); const [place, setPlace] = useState(''); const [country, setCountry] = useState(''); const [start, setStart] = useState(''); const [end, setEnd] = useState(''); const [travellers, setTravellers] = useState('1');
  const [tried, setTried] = useState(false); const [error, setError] = useState('');
  // The place the traveller picked from search. It carries the exact map position; typing again drops it.
  const [picked, setPicked] = useState<PlaceHit | null>(null); const [term, setTerm] = useState('');
  useEffect(() => { const t = setTimeout(() => setTerm(picked ? '' : place.trim()), 300); return () => clearTimeout(t); }, [place, picked]);
  const search = usePlaceSearch(term); const suggestions = !picked && term.length >= 2 && term === place.trim() ? search.data ?? [] : [];
  function choose(hit: PlaceHit) { setPicked(hit); setPlace(hit.label); setCountry(countryName(hit.countryCode)); }
  const match = findCountry(country); const s = toIso(start); const e = toIso(end);
  const errors = { title: title.trim().length < 2 ? 'Give the trip a name' : undefined, place: place.trim().length < 2 ? 'Add where you are going' : undefined, country: !match ? 'Choose a country, like Italy' : undefined,
    start: !s ? 'Use dd/mm/yyyy' : undefined, end: !e ? 'Use dd/mm/yyyy' : s && e < s ? 'The trip cannot end before it starts' : undefined };
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
      <View className="gap-1.5">
        <Input label="Where are you going? *" value={place} onChangeText={(v) => { setPlace(v); setPicked(null); }} placeholder="Start typing a city, island or region" maxLength={80} autoCorrect={false} error={show('place')} hint={picked ? 'Pinned on your travel map.' : undefined} />
        {suggestions.length > 0 && (
          <View className="overflow-hidden rounded-2xl border border-line" accessibilityLabel="Place suggestions">
            {suggestions.map((h, i) => (
              <Pressable key={`${h.label}${h.lat}`} accessibilityRole="button" accessibilityLabel={`${h.name}, ${h.detail}`} onPress={() => choose(h)} className={`flex-row items-center gap-3 px-3.5 py-3 active:bg-surface-muted ${i ? 'border-t border-line' : ''}`}>
                <MapPin size={18} color={h.source === 'everycation' ? colors.navy : colors.inkMuted} />
                <View className="flex-1"><T v="strong" className="text-sm">{h.name}</T><T v="small" className="text-xs">{h.detail}</T></View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
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
