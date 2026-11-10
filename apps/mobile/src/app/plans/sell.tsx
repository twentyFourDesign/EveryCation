import { router, useLocalSearchParams } from 'expo-router';
import { CalendarClock, Check } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { formatNaira, parseNaira, planSaleSplit } from '@everycation/shared';
import { Button, Chips, Input, Loading, Note, Photo, Screen, Segmented, T, colors } from '@/ui';
import { errorMessage } from '@/lib/api';
import { useListing, useListPlan, type PlanDetail } from '@/lib/plans';
import { fmt, tripDates, tripImage, useTrips, type Trip } from '@/lib/trips';

const modes = ['Private', 'Share free', 'Sell'] as const;
const modeKey = { Private: 'private', 'Share free': 'free', Sell: 'sell' } as const;
const buyersGet = ['Day-by-day itinerary with times', 'Every stop and your notes', 'Updates when you edit the trip'];

export default function SellPlan() {
  const p = useLocalSearchParams<{ tripId?: string }>();
  const { data: trips, isLoading } = useTrips();
  const [tripId, setTripId] = useState(p.tripId);
  const trip = trips?.find((t) => t.id === tripId) ?? trips?.[0];
  const listing = useListing(trip?.id);
  if (isLoading || (trip && listing.isLoading)) return <Screen title="Share or sell a plan"><Loading what="your trips" /></Screen>;
  if (!trip) return <Screen title="Share or sell a plan"><View className="gap-4 pt-8"><T className="text-center text-ink-muted">Add a trip and its itinerary first. Then you can share it free or sell it.</T><Button label="ADD A TRIP" onPress={() => router.replace('/trip/new')} /></View></Screen>;
  // Keyed by trip so the form starts from that trip's saved listing.
  return <SellForm key={trip.id} trip={trip} listing={listing.data ?? null} choices={p.tripId ? [] : (trips ?? [])} onPick={setTripId} />;
}

function SellForm({ trip, listing, choices, onPick }: { trip: Trip; listing: PlanDetail | null; choices: Trip[]; onPick: (id: string) => void }) {
  const list = useListPlan();
  const [mode, setMode] = useState<(typeof modes)[number]>(listing?.status === 'private' ? 'Private' : listing?.status === 'free' ? 'Share free' : 'Sell');
  const [price, setPrice] = useState(listing?.price ? formatNaira(listing.price) : '₦6,500'); const [summary, setSummary] = useState(listing?.summary ?? ''); const [error, setError] = useState('');
  const kobo = parseNaira(price) ?? 0; const split = planSaleSplit(kobo);
  const priceError = mode === 'Sell' && kobo < 100000 ? 'Set a price of at least ₦1,000' : undefined;
  const opens = new Date(Date.parse(`${trip.endDate}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  async function save() {
    setError('');
    try { await list.mutateAsync({ tripId: trip.id, mode: modeKey[mode], price: mode === 'Sell' ? kobo : undefined, summary: summary.trim() }); router.replace('/creator-studio'); }
    catch (e) { setError(errorMessage(e)); }
  }
  return (
    <Screen title="Share or sell a plan" footer={<Button disabled={!!priceError || list.isPending} label={list.isPending ? 'SAVING…' : mode === 'Sell' ? (trip.status === 'past' ? 'PUT ON SALE' : 'SCHEDULE SALE') : mode === 'Share free' ? 'SHARE FREE NOW' : 'KEEP PRIVATE'} onPress={save} />}>
      {choices.length > 1 && <View className="gap-2"><T v="label">Which trip?</T><Chips wrap options={choices.map((t) => t.title)} value={trip.title} onChange={(name) => onPick(choices.find((t) => t.title === name)!.id)} /></View>}
      <View className="flex-row items-center gap-3 rounded-card bg-surface-muted p-3"><Photo k={tripImage(trip)} className="h-16 w-16 rounded-2xl" /><View className="flex-1"><T v="strong">{trip.title}</T><T v="small">{trip.place} · {tripDates(trip)}</T></View></View>
      <Segmented options={modes} value={mode} onChange={setMode} />
      {mode === 'Sell' && (
        <>
          <Input label="Price" value={price} onChangeText={setPrice} keyboardType="number-pad" error={priceError} />
          {!priceError && <T v="small">You get <T v="label">{formatNaira(split.sellerGets)}</T> per sale after the 25% platform fee ({formatNaira(split.fee)}). Paid into your wallet after each payout run.</T>}
          {trip.status === 'past'
            ? <Note icon={Check}>Your trip has ended, so this plan goes on sale as soon as you save.</Note>
            : <Note icon={CalendarClock} tone="gold">{`Goes on sale on ${fmt(opens)}, the morning after your trip ends on ${fmt(trip.endDate)}, so buyers get a tested plan. You can share it free any time.`}</Note>}
        </>
      )}
      {mode === 'Share free' && <Note icon={Check}>Anyone can save this plan at no cost. You can share a free plan before, during or after your trip.</Note>}
      {mode === 'Private' && <Note>Only you can see this plan.</Note>}
      {mode !== 'Private' && (
        <>
          <Input label="What makes this plan useful? (optional)" value={summary} onChangeText={setSummary} multiline maxLength={300} placeholder="A week of hikes and lakes on a mid-range budget, with the drives timed." />
          <View className="gap-2"><T v="title">Buyers get</T>{buyersGet.map((b) => <View key={b} className="flex-row items-center gap-2.5"><Check size={18} color={colors.navy} /><T>{b}</T></View>)}</View>
        </>
      )}
      {!!error && <Note tone="danger">{error}</Note>}
    </Screen>
  );
}
