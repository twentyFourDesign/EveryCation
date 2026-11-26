import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, ChevronDown, ChevronRight, ChevronUp, ClipboardCheck, ExternalLink } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Button, Loading, Note, Progress, Screen, T, colors, go } from '@/ui';
import { CountryField } from '@/ui/country-field';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';
import { SECTIONS, TONE_STYLE, flag, useChecklists, useCountries, useCreateChecklist, usePassport, usePassportOverview, useRequirement, type PassportOverview } from '@/lib/travel';

const showDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** One group of "Where can I go?": a coloured header with a count, opening to the countries in it. */
function Group({ group, open, onToggle, onPick }: { group: PassportOverview['groups'][number]; open: boolean; onToggle: () => void; onPick: (code: string) => void }) {
  const [all, setAll] = useState(false); const tone = TONE_STYLE[group.tone];
  const shown = all ? group.countries : group.countries.slice(0, 12);
  return (
    <View style={{ backgroundColor: tone.bg }} className="overflow-hidden rounded-card">
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${group.title}, ${group.countries.length} countries`} onPress={onToggle} className="flex-row items-center gap-3 p-3.5 active:opacity-80">
        <Text style={{ color: tone.ink }} className="min-w-[44px] font-pop-sb text-2xl">{group.countries.length}</Text>
        <Text style={{ color: tone.ink }} className="flex-1 font-pop-sb text-[15px]">{group.title}</Text>
        {open ? <ChevronUp size={20} color={tone.ink} /> : <ChevronDown size={20} color={tone.ink} />}
      </Pressable>
      {open && (
        <View className="bg-white/60 px-3.5 pb-2">
          {shown.map((c) => (
            <Pressable key={c.code} accessibilityRole="button" accessibilityLabel={`${c.name}, ${c.title}${c.days ? `, ${c.days} days` : ''}`} onPress={() => onPick(c.code)} className="flex-row items-center gap-3 border-b border-black/5 py-2.5 active:opacity-60">
              <Text className="text-xl">{flag(c.code)}</Text><Text className="flex-1 font-pop text-[15px] text-ink">{c.name}</Text>
              <Text className="font-pop text-xs text-ink-muted">{c.days ? `${c.days} days` : group.title.startsWith('Apply') ? c.title.replace('Travel authorisation (ETA)', 'ETA') : ''}</Text>
            </Pressable>
          ))}
          {group.countries.length > 12 && (
            <Pressable accessibilityRole="button" onPress={() => setAll(!all)} className="items-center py-2.5"><Text style={{ color: tone.ink }} className="font-pop-sb text-[13px]">{all ? 'Show fewer' : `Show all ${group.countries.length}`}</Text></Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function WhereCanIGo({ from, onPick }: { from: string; onPick: (code: string) => void }) {
  const { data, isLoading } = usePassportOverview(from); const [open, setOpen] = useState<string | null>(null);
  if (isLoading) return <Loading what="where you can go" />;
  if (!data) return null;
  const easy = data.groups.filter((g) => g.tone === 'good').reduce((n, g) => n + g.countries.length, 0);
  return (
    <View className="gap-2.5">
      <T v="strong">Where can you go with a {data.fromName} passport?</T>
      <T v="small">{easy} countries let you in without applying for a visa first. Tap a group to see them, then a country for the details.</T>
      {data.groups.map((g) => <Group key={g.title} group={g} open={open === g.title} onToggle={() => setOpen(open === g.title ? null : g.title)} onPick={onPick} />)}
    </View>
  );
}

/** Entry requirements for the traveller's passport and a destination, and the checklist made from them. */
export default function Requirements() {
  const params = useLocalSearchParams<{ to?: string; tripId?: string }>();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const passport = usePassport(); const from = passport.code; const countries = useCountries().data;
  const [to, setTo] = useState((params.to ?? '').toUpperCase());
  const req = useRequirement(from, to); const lists = useChecklists(); const create = useCreateChecklist();
  const existing = lists.data?.find((c) => c.destination === to);
  const r = req.data; const tone = r ? TONE_STYLE[r.tone] : null;

  function checklist() {
    if (!signedIn) return router.push('/sign-up');
    if (existing) return go(`/checklist/${existing.id}`);
    create.mutate({ from, to, ...(params.tripId && { tripId: params.tripId }) }, { onSuccess: (c) => go(`/checklist/${c.id}`) });
  }

  return (
    <Screen title="Visa & entry" footer={r && r.entry !== 'own_country' ? <Button icon={ClipboardCheck} disabled={create.isPending} label={create.isPending ? 'MAKING YOUR CHECKLIST…' : existing ? 'OPEN MY CHECKLIST' : signedIn ? 'CREATE MY CHECKLIST' : 'SIGN IN TO MAKE A CHECKLIST'} onPress={checklist} /> : undefined}>
      <T className="-mt-2 text-ink-muted">See what your passport needs to enter any country, then turn it into a checklist.</T>
      <CountryField label="Your passport" value={from} onChange={passport.choose} hint={passport.chosen ? (signedIn ? 'We remember this for next time.' : undefined) : undefined} />
      {!passport.chosen && countries && (
        <View className="gap-2 rounded-2xl bg-gold-soft p-3.5">
          <T className="text-sm">Is {countries.find((c) => c.code === from)?.name ?? 'this'} the passport you travel on? Entry rules depend on it, so change it above if not.</T>
          <Pressable accessibilityRole="button" onPress={() => passport.choose(from)} className="self-start rounded-full bg-navy px-4 py-2 active:opacity-80"><Text className="font-pop-sb text-[13px] text-white">Yes, that is my passport</Text></Pressable>
        </View>
      )}
      <CountryField label="Where are you going?" value={to} onChange={setTo} placeholder="Choose a destination" />
      {!to && <WhereCanIGo from={from} onPick={setTo} />}
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
            {r.notes.map((n) => <View key={n} className="flex-row gap-2"><Text style={{ color: tone.ink }} className="font-pop text-sm">•</Text><Text style={{ color: tone.ink }} className="flex-1 font-pop text-sm leading-5">{n}</Text></View>)}
            {r.apply && (
              <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(r.apply!.url)} className="min-h-11 flex-row items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 active:opacity-70">
                <Text style={{ color: tone.ink }} className="font-pop-sb text-sm">{r.apply.label}</Text><ExternalLink size={15} color={tone.ink} />
              </Pressable>
            )}
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
          <Note>Rules change, sometimes quickly. Check the {r.toName} embassy or official government website before you book or pay for anything. Information updated {showDay(r.updated)}, from Passport Index data and official announcements.</Note>
          <Pressable accessibilityRole="button" onPress={() => setTo('')} className="items-center py-1"><Text className="font-pop-sb text-sm text-heading-blue">See everywhere a {r.fromName} passport can go</Text></Pressable>
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
