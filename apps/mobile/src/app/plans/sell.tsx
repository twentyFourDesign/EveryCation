import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { CalendarClock, Check, Link2 } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { formatNaira, parseNaira, planSaleSplit, sample, saleOpensAt, sellPlanSchema } from '@everycation/shared';
import { Button, Input, Note, Photo, Screen, Segmented, T, colors } from '@/ui';
import { useApp } from '@/lib/store';

const modes = ['Private', 'Share free', 'Sell'] as const;
const modeKey = { Private: 'private', 'Share free': 'free', Sell: 'sell' } as const;
const buyersGet = ['Day-by-day itinerary with times', 'Map of every stop', 'Budget in naira', 'Packing list with shop links'];

export default function SellPlan() {
  const trip = sample.trips[0]!;
  const { planListing, listPlan } = useApp();
  const [mode, setMode] = useState<(typeof modes)[number]>(planListing.mode === 'sell' ? 'Sell' : planListing.mode === 'free' ? 'Share free' : 'Private');
  const [price, setPrice] = useState(formatNaira(planListing.price));
  const [copied, setCopied] = useState(false);
  const check = sellPlanSchema.safeParse({ mode: modeKey[mode], price });
  const error = check.success ? undefined : check.error.issues[0]?.message;
  const split = planSaleSplit(parseNaira(price) ?? 0);
  const opens = saleOpensAt(trip.end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' });
  const save = () => { if (!check.success) return; listPlan(modeKey[mode], split.price); router.replace('/creator-studio'); };
  return (
    <Screen title="Share or sell this plan" footer={<Button disabled={!check.success} label={mode === 'Sell' ? 'SCHEDULE SALE' : mode === 'Share free' ? 'SHARE FREE NOW' : 'KEEP PRIVATE'} onPress={save} />}>
      <View className="flex-row items-center gap-3 rounded-card bg-surface-muted p-3"><Photo k={trip.image} className="h-16 w-16 rounded-2xl" /><View className="flex-1"><T v="strong">{trip.title}</T><T v="small">7 days · 22 stops · budget and packing list</T></View></View>
      <Segmented options={modes} value={mode} onChange={setMode} />
      {mode === 'Sell' && (
        <>
          <Input label="Price" value={price} onChangeText={setPrice} keyboardType="number-pad" error={error} />
          {check.success && <T v="small">You get <T v="label">{formatNaira(split.sellerGets)}</T> per sale after the 25% platform fee ({formatNaira(split.fee)}). Paid to your wallet every Friday.</T>}
          <Note icon={CalendarClock} tone="gold">{`Goes on sale on ${opens}, the morning after your trip ends on 19 Dec, so buyers get a tested plan. You can share it free any time.`}</Note>
        </>
      )}
      {mode === 'Share free' && <Note icon={Check}>Anyone can save this plan at no cost. You can share a free plan before, during or after your trip.</Note>}
      {mode === 'Private' && <Note>Only you can see this plan.</Note>}
      {mode !== 'Private' && <View className="gap-2"><T v="title">Buyers get</T>{buyersGet.map((b) => <View key={b} className="flex-row items-center gap-2.5"><Check size={18} color={colors.navy} /><T>{b}</T></View>)}</View>}
      {mode === 'Share free' && <Button variant="outline" icon={Link2} label={copied ? 'Link copied' : 'Copy link'} onPress={async () => { await Clipboard.setStringAsync('https://everycation.app/p/dolomites-trip'); setCopied(true); }} />}
    </Screen>
  );
}
