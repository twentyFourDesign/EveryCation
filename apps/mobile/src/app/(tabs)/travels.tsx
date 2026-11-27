import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import { IconPlace, IconTrip, IconVisa } from '@/ui/icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Avatar, Button, Chips, Empty, IconButton, Loading, Note, Photo, Screen, Stats, T, colors, cx, go } from '@/ui';
import { MapView, type Pin } from '@/ui/map';
import { Cancelled, connectGoogleCalendar, disconnectGoogleCalendar, useCalendar } from '@/lib/social';
import { errorMessage } from '@/lib/api';
import { countryName, initials } from '@/lib/community';
import { useSession } from '@/lib/session';
import { fmt, tripDates, tripImage, useBucket, useTrips, type Trip } from '@/lib/trips';
import { BucketList } from '@/ui/bucket-list';

const views = ['Timeline', 'Bucket list', 'Calendar', 'Map'] as const;
type ViewName = (typeof views)[number];

function Timeline({ trips }: { trips: Trip[] }) {
  const next = [...trips].reverse().find((t) => t.status !== 'past');
  const past = trips.filter((t) => t.status === 'past');
  return (
    <>
      {trips.length === 0 && <View className="gap-3 rounded-card bg-surface-muted p-4"><T v="strong">No trips yet</T><T v="small">Add a trip you are planning, or ones you have already taken. Past trips back up the advice you share.</T></View>}
      {next && (
        <Pressable accessibilityRole="button" accessibilityLabel={`Next trip, ${next.place}`} onPress={() => go(`/trip/${next.id}`)} className="overflow-hidden rounded-card bg-navy active:opacity-90">
          <Photo k={tripImage(next)} className="h-[170px]" />
          <View className="gap-1 p-4"><Text className="font-pop-sb text-[11px] tracking-widest text-gold">{next.status === 'now' ? 'HAPPENING NOW' : 'NEXT TRIP'}</Text><Text className="font-pop-sb text-xl text-white">{next.place}</Text>
            <Text className="font-pop text-[13px] text-navy-text-soft">{tripDates(next)}</Text><Text className="pt-1 font-pop-sb text-[13px] text-gold">{next.status === 'upcoming' ? `In ${next.daysAway} days · ` : ''}View trip →</Text></View>
        </Pressable>
      )}
      {past.map((t) => (
        <View key={t.id} className="gap-2">
          <T v="eyebrow" className="text-ink-muted">{fmt(t.startDate, { month: 'long', year: 'numeric' }).toUpperCase()}</T>
          <Pressable accessibilityRole="button" accessibilityLabel={t.title} onPress={() => go(`/trip/${t.id}`)} className="flex-row items-center gap-3 rounded-card bg-surface-muted p-3 active:opacity-80">
            <Photo k={tripImage(t)} className="h-[72px] w-[72px] rounded-2xl" /><View className="flex-1"><T v="strong">{t.title}</T><T v="small">{t.place} · {t.nights} nights</T></View><ChevronRight size={18} color={colors.inkMuted} />
          </Pressable>
        </View>
      ))}
      <Button variant="outline" icon={Plus} label="Add a trip" onPress={() => router.push('/trip/new')} />
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/requirements', params: next ? { to: next.countryCode, tripId: next.id } : {} })} className="flex-row items-center gap-3 rounded-card bg-tint p-3.5 active:opacity-80">
        <IconVisa size={28} />
        <View className="flex-1"><T v="strong">Visa & entry checklists</T><T v="small">See what your passport needs for any country, then tick it off as you prepare.</T></View>
        <ChevronRight size={18} color={colors.inkMuted} />
      </Pressable>
    </>
  );
}

/** Connect, see the state of, or disconnect the copy of your trips in Google Calendar. Hidden until the server has Google set up. */
function CalendarSync() {
  const { data, refetch } = useCalendar();
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  if (!data?.available) return null;
  async function run(work: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await work(); } catch (e) { if (!(e instanceof Cancelled)) setError(errorMessage(e)); } finally { await refetch(); setBusy(false); }
  }
  if (!data.connected) return (
    <View className="gap-2.5 rounded-card bg-surface-muted p-4">
      <T v="strong">See your trips in Google Calendar</T>
      <T v="small">We add a calendar called &ldquo;EveryCation trips&rdquo; and keep it up to date. We cannot see or change anything else in your calendar.</T>
      <Button variant="outline" disabled={busy} label={busy ? 'Waiting for Google…' : 'Connect Google Calendar'} onPress={() => run(connectGoogleCalendar)} />
      {!!error && <Note tone="danger">{error}</Note>}
    </View>
  );
  return (
    <View className="gap-2 rounded-card bg-surface-muted p-4">
      <T v="strong">Google Calendar is connected</T>
      <T v="small">{data.account ? `${data.account} · ` : ''}{data.waiting ? `${data.waiting} trip${data.waiting === 1 ? '' : 's'} waiting to sync` : 'All trips are in your “EveryCation trips” calendar'}</T>
      {!!data.problem && <Note tone="danger">{data.problem}</Note>}
      {!!error && <Note tone="danger">{error}</Note>}
      <View className="flex-row gap-5 pt-1">
        {!!data.problem && <Text accessibilityRole="button" onPress={() => !busy && run(connectGoogleCalendar)} className="font-pop-sb text-[13px] text-heading-blue">Connect again</Text>}
        <Text accessibilityRole="button" onPress={() => !busy && run(disconnectGoogleCalendar)} className="font-pop-sb text-[13px] text-heading-blue">{busy ? 'Working…' : 'Disconnect'}</Text>
      </View>
    </View>
  );
}

function Calendar({ trips }: { trips: Trip[] }) {
  const [month, setMonth] = useState(() => { const first = [...trips].reverse().find((t) => t.status !== 'past'); const d = first ? new Date(`${first.startDate}T00:00:00Z`) : new Date(); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  const [picked, setPicked] = useState<string | null>(null);
  const first = new Date(Date.UTC(month.y, month.m, 1)); const count = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate(); const lead = (first.getUTCDay() + 6) % 7;
  const iso = (d: number) => `${month.y}-${String(month.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const on = (day: string) => trips.filter((t) => t.startDate <= day && t.endDate >= day);
  const inMonth = trips.filter((t) => t.startDate <= iso(count) && t.endDate >= iso(1));
  const shown = picked ? on(picked) : inMonth;
  const step = (n: number) => { setPicked(null); setMonth(({ y, m }) => { const d = new Date(Date.UTC(y, m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; }); };
  return (
    <>
      <View className="flex-row items-center justify-between">
        <IconButton icon={ChevronLeft} label="Previous month" onPress={() => step(-1)} />
        <T v="title">{first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</T>
        <IconButton icon={ChevronRight} label="Next month" onPress={() => step(1)} />
      </View>
      <View className="flex-row flex-wrap">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <View key={i} className="w-[14.28%] items-center pb-1"><T v="small" className="text-xs">{d}</T></View>)}
        {Array.from({ length: lead }, (_, i) => <View key={`b${i}`} className="w-[14.28%]" />)}
        {Array.from({ length: count }, (_, i) => i + 1).map((d) => { const day = iso(d); const busy = on(day).length > 0; return (
          <Pressable key={d} accessibilityRole="button" accessibilityLabel={`${fmt(day)}${busy ? `, ${on(day)[0]!.title}` : ''}`} accessibilityState={{ selected: picked === day }} onPress={() => setPicked(picked === day ? null : day)} className="h-12 w-[14.28%] items-center justify-center">
            <View className={cx('h-10 w-10 items-center justify-center rounded-full', busy && 'bg-navy', picked === day && 'border-2 border-gold')}><Text className={cx('font-pop-md text-sm', busy ? 'text-white' : 'text-ink')}>{d}</Text></View>
          </Pressable>); })}
      </View>
      {shown.length === 0 && <T v="small" className="text-center">{picked ? `Nothing on ${fmt(picked, { day: 'numeric', month: 'long' })}.` : 'No trips this month.'}</T>}
      {shown.map((t) => (
        <Pressable key={t.id} accessibilityRole="button" onPress={() => go(`/trip/${t.id}`)} className="flex-row items-center gap-3 rounded-card bg-surface-muted p-3.5 active:opacity-80">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-navy"><IconTrip size={20} color="#fff" /></View>
          <View className="flex-1"><T v="strong">{t.title}</T><T v="small">{tripDates(t)} · {t.nights} nights</T></View><ChevronRight size={18} color={colors.inkMuted} />
        </Pressable>
      ))}
      <CalendarSync />
    </>
  );
}

function TravelMap({ trips }: { trips: Trip[] }) {
  const [picked, setPicked] = useState<string | null>(null);
  const visited = [...new Set(trips.filter((t) => t.status !== 'upcoming').map((t) => t.countryCode))];
  const nights = trips.filter((t) => t.status === 'past').reduce((n, t) => n + t.nights, 0);
  // Trips in the same spot share one pin. A spot counts as visited once any trip there has started.
  const spots = new Map<string, Trip[]>();
  for (const t of trips) if (t.lat !== null && t.lng !== null) { const k = `${t.lat},${t.lng}`; spots.set(k, [...(spots.get(k) ?? []), t]); }
  const name = (list: Trip[]) => (list[0]!.pinned ? list[0]!.place : countryName(list[0]!.countryCode));
  const pins: Pin[] = [...spots].map(([id, list]) => ({ id, lat: list[0]!.lat!, lng: list[0]!.lng!, label: `${name(list)}, ${list.length} trip${list.length === 1 ? '' : 's'}`, tone: list.some((t) => t.status !== 'upcoming') ? 'visited' : 'planned' }));
  const dreams = (useBucket().data ?? []).filter((b) => b.state === 'dream' && b.lat !== null && b.lng !== null);
  pins.push(...dreams.map((b): Pin => ({ id: `dream:${b.id}`, lat: b.lat!, lng: b.lng!, label: `Dream: ${b.title}`, tone: 'dream' })));
  const dream = picked?.startsWith('dream:') ? dreams.find((b) => `dream:${b.id}` === picked) : undefined;
  const shown = picked && !dream ? spots.get(picked) ?? [] : [];
  return (
    <>
      <T v="title" className="text-lg">Your travel map</T>
      <Stats items={[[visited.length, 'countries'], [nights, 'nights away'], [trips.length, 'trips']]} />
      <MapView pins={pins} height={340} zoom={5} onPin={setPicked} />
      <View className="flex-row gap-4">{([['Visited', 'bg-navy'], ['Planned', 'bg-cyan'], ...(dreams.length ? [['Dreams', 'bg-gold']] as const : [])] as const).map(([l, tone]) => <View key={l} className="flex-row items-center gap-1.5"><View className={cx('h-3 w-3 rounded-full', tone)} /><T v="small">{l}</T></View>)}</View>
      {dream ? (
        <View className="gap-1 rounded-card bg-gold-soft p-3.5"><T v="eyebrow" className="text-ink-muted">ON YOUR BUCKET LIST</T><T v="strong">{dream.title}</T>{!!dream.place && <T v="small">{dream.place}</T>}</View>
      ) : trips.length === 0 ? <Empty>{dreams.length ? 'Tap a gold pin to see a dream. Add a trip and it shows here too.' : 'Add a trip and it shows on your map.'}</Empty> : shown.length === 0 ? <T v="small" className="text-center">Tap a pin to see the trips there.</T> : (
        <>
          <T v="strong">{name(shown)}</T>
          {shown.map((t) => (
            <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={t.title} onPress={() => go(`/trip/${t.id}`)} className="flex-row items-center gap-3 rounded-card bg-surface-muted p-3.5 active:opacity-80">
              <View className={cx('h-10 w-10 items-center justify-center rounded-full', t.status === 'upcoming' ? 'bg-cyan' : 'bg-navy')}><IconPlace size={20} color="#fff" /></View>
              <View className="flex-1"><T v="strong">{t.title}</T><T v="small">{t.place} · {tripDates(t)}</T></View><ChevronRight size={18} color={colors.inkMuted} />
            </Pressable>
          ))}
        </>
      )}
    </>
  );
}

export default function MyTravels() {
  const params = useLocalSearchParams<{ view?: string }>();
  const { status, me } = useSession();
  const { data: trips, isLoading, error } = useTrips();
  const [view, setView] = useState<ViewName>(views.includes(params.view as ViewName) ? (params.view as ViewName) : 'Timeline');
  if (status !== 'signedIn') return (
    <Screen edges={['top']} title="My travels" back={false}><View className="gap-4 pt-10"><T v="h2" className="text-center">Keep every journey in one place</T><T className="text-center text-ink-muted">Sign in to save your trips, plan each day and build a bucket list.</T><Button label="SIGN IN" onPress={() => router.push('/sign-up')} /></View></Screen>
  );
  return (
    <Screen edges={['top']} title="My travels" back={false}
      right={view === 'Calendar' ? <IconButton icon={Plus} label="Add to itinerary" onPress={() => router.push('/calendar-add')} /> : <View className="pr-2"><Avatar initials={initials(me?.name ?? 'You')} uri={me?.avatarUrl} label="Your profile" onPress={() => router.push('/profile')} /></View>}>
      <Chips options={views} value={view} onChange={setView} />
      {!!error && <Note tone="danger">{errorMessage(error)}</Note>}
      {isLoading ? <Loading what="your trips" /> : view === 'Timeline' ? <Timeline trips={trips ?? []} /> : view === 'Bucket list' ? <BucketList /> : view === 'Calendar' ? <Calendar trips={trips ?? []} /> : <TravelMap trips={trips ?? []} />}
    </Screen>
  );
}
