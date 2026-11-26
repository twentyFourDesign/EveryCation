import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, ChevronRight, ClipboardCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Loading, Note, Progress, Screen, T, colors, go } from '@/ui';
import { CountryField } from '@/ui/country-field';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';
import { SECTIONS, TONE_STYLE, flag, useChecklists, useCreateChecklist, useRequirement } from '@/lib/travel';

const POPULAR = ['GH', 'GB', 'AE', 'US', 'KE', 'ZA', 'CA', 'FR'];
const POPULAR_NAMES: Record<string, string> = { GH: 'Ghana', GB: 'UK', AE: 'UAE', US: 'USA', KE: 'Kenya', ZA: 'South Africa', CA: 'Canada', FR: 'France' };
const showDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Entry requirements for the traveller's passport and a destination, and the checklist made from them. */
export default function Requirements() {
  const params = useLocalSearchParams<{ to?: string; tripId?: string }>();
  const me = useSession((s) => s.me); const signedIn = useSession((s) => s.status === 'signedIn'); const updateProfile = useSession((s) => s.updateProfile);
  const [from, setFrom] = useState(me?.passportCountry ?? 'NG'); const [to, setTo] = useState((params.to ?? '').toUpperCase());
  const req = useRequirement(from, to); const lists = useChecklists(); const create = useCreateChecklist();
  const existing = lists.data?.find((c) => c.destination === to);
  const r = req.data; const tone = r ? TONE_STYLE[r.tone] : null;

  function choosePassport(code: string) { setFrom(code); if (signedIn && code !== me?.passportCountry) void updateProfile({ passportCountry: code }).catch(() => {}); }
  function checklist() {
    if (!signedIn) return router.push('/sign-up');
    if (existing) return go(`/checklist/${existing.id}`);
    create.mutate({ from, to, ...(params.tripId && { tripId: params.tripId }) }, { onSuccess: (c) => go(`/checklist/${c.id}`) });
  }

  return (
    <Screen title="Visa & entry" footer={r && r.entry !== 'own_country' ? <Button icon={ClipboardCheck} disabled={create.isPending} label={create.isPending ? 'MAKING YOUR CHECKLIST…' : existing ? 'OPEN MY CHECKLIST' : signedIn ? 'CREATE MY CHECKLIST' : 'SIGN IN TO MAKE A CHECKLIST'} onPress={checklist} /> : undefined}>
      <T className="-mt-2 text-ink-muted">See what your passport needs to enter any country, then turn it into a checklist.</T>
      <CountryField label="Your passport" value={from} onChange={choosePassport} hint={signedIn ? 'We remember this for next time.' : undefined} />
      <CountryField label="Where are you going?" value={to} onChange={setTo} placeholder="Choose a destination" />
      {!to && (
        <View className="gap-2">
          <T v="label">Popular with travellers</T>
          <View className="flex-row flex-wrap gap-2">
            {POPULAR.filter((c) => c !== from).map((c) => (
              <Pressable key={c} accessibilityRole="button" onPress={() => setTo(c)} className="h-10 flex-row items-center gap-1.5 rounded-full border-[1.5px] border-control-border bg-white px-3.5 active:bg-surface-muted">
                <Text className="text-base">{flag(c)}</Text><Text className="font-pop-md text-[13px] text-ink">{POPULAR_NAMES[c]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      {to && req.isLoading && <Loading what="the entry rules" />}
      {!!req.error && <Note tone="danger">{errorMessage(req.error)}</Note>}
      {r && tone && (
        <>
          <View style={{ backgroundColor: tone.bg }} className="gap-3 rounded-card p-4">
            <View className="flex-row items-center gap-2"><Text className="text-2xl">{flag(r.from)}</Text><ArrowRight size={18} color={tone.ink} /><Text className="text-2xl">{flag(r.to)}</Text>
              <Text style={{ color: tone.ink }} numberOfLines={1} className="flex-1 font-pop-md text-[13px]">{r.fromName} passport to {r.toName}</Text></View>
            <View className="flex-row items-center gap-2.5"><Text className="text-3xl">{tone.emoji}</Text>
              <View className="flex-1"><Text style={{ color: tone.ink }} className="font-pop-sb text-2xl">{r.title}</Text>
                {r.days ? <Text style={{ color: tone.ink }} className="font-pop-sb text-sm">Up to {r.days} days</Text> : null}</View></View>
            <Text style={{ color: tone.ink }} className="font-pop text-[15px] leading-6">{r.summary}</Text>
          </View>
          {r.checklist.length > 0 && (
            <View className="gap-2.5">
              <T v="strong">What you will need</T>
              {r.checklist.filter((i) => i.section === 'documents').map((i) => (
                <View key={i.text} className="flex-row gap-2.5"><Text className="pt-0.5 text-sm">{SECTIONS.documents.emoji}</Text><T className="flex-1 text-[15px]">{i.text}</T></View>
              ))}
              <T v="small">Your checklist adds health, money and before-you-go items too, and you can add your own.</T>
            </View>
          )}
          <Note>Rules change, sometimes quickly. Check the {r.toName} embassy or official government website before you book or pay for anything. Information updated {showDay(r.updated)}, from Passport Index data.</Note>
        </>
      )}
      {!!lists.data?.length && (
        <View className="gap-2.5">
          <T v="strong">Your checklists</T>
          {lists.data.map((c) => (
            <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`${c.destinationName} checklist, ${c.done} of ${c.total} done`} onPress={() => go(`/checklist/${c.id}`)} className="flex-row items-center gap-3 rounded-card bg-surface-muted p-3.5 active:opacity-80">
              <Text className="text-3xl">{flag(c.destination)}</Text>
              <View className="flex-1 gap-1.5"><T v="strong">{c.destinationName}</T><Progress pct={c.total ? Math.round((c.done / c.total) * 100) : 0} /><T v="small" className="text-xs">{c.done} of {c.total} done</T></View>
              <ChevronRight size={18} color={colors.inkMuted} />
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
