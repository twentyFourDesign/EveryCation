import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarCheck, Check, ChevronLeft, ChevronRight, MapPin, Package, PiggyBank, Plane, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api, sample } from '@everycation/shared';
import { Avatar, Badge, Button, Chips, IconButton, Input, Loading, Photo, Progress, Screen, Stats, T, colors, cx, go } from '@/ui';
import { useApp } from '@/lib/store';

const views = ['Timeline', 'Bucket list', 'Calendar', 'Map'] as const;
type ViewName = (typeof views)[number];

function Timeline() {
  const { data, isLoading } = useQuery({ queryKey: ['trips'], queryFn: api.trips });
  if (isLoading) return <Loading what="your trips" />;
  const next = data?.find((t) => t.status === 'upcoming');
  return (
    <>
      {next && (
        <Pressable accessibilityRole="button" accessibilityLabel={`Next trip, ${next.place}, in ${next.daysAway} days`} onPress={() => go(`/trip/${next.id}`)} className="overflow-hidden rounded-card bg-navy active:opacity-90">
          <Photo k={next.image} className="h-[170px]" />
          <View className="gap-1 p-4"><Text className="font-pop-sb text-[11px] tracking-widest text-gold">NEXT TRIP</Text><Text className="font-pop-sb text-xl text-white">{next.place}</Text>
            <Text className="font-pop text-[13px] text-navy-text-soft">12 – 19 Dec 2026</Text><Text className="pt-1 font-pop-sb text-[13px] text-gold">In {next.daysAway} days · View trip →</Text></View>
        </Pressable>
      )}
      {data?.filter((t) => t.status === 'past').map((t) => (
        <View key={t.id} className="gap-2">
          <T v="eyebrow" className="text-ink-muted">{t.month}</T>
          <Pressable accessibilityRole="button" accessibilityLabel={t.title} onPress={() => go(`/trip/${t.id}`)} className="flex-row items-center gap-3 rounded-card bg-surface-muted p-3 active:opacity-80">
            <Photo k={t.image} className="h-[72px] w-[72px] rounded-2xl" /><View className="flex-1"><T v="strong">{t.title}</T><T v="small">{t.nights} nights · {t.tipsRecorded} tips recorded</T></View><ChevronRight size={18} color={colors.inkMuted} />
          </Pressable>
        </View>
      ))}
    </>
  );
}

function BucketList() {
  const { data = [] } = useQuery({ queryKey: ['bucket'], queryFn: api.bucketList });
  const { bucket } = useApp();
  const { data: tips = [] } = useQuery({ queryKey: ['tips'], queryFn: () => api.tips() });
  const [dream, setDream] = useState(''); const [adding, setAdding] = useState(false); const [mine, setMine] = useState<string[]>([]);
  const added = [...tips.filter((t) => bucket.includes(t.id)).map((t) => ({ title: t.title, image: t.image })), ...sample.places.filter((p) => bucket.includes(`place:${p.id}`)).map((p) => ({ title: `Visit ${p.name}`, image: p.image }))];
  const done = data.filter((b) => b.state === 'done').length;
  return (
    <>
      <View className="flex-row items-center justify-between"><T v="strong">{done} of {data.length + added.length + mine.length} ticked off</T><Button small variant="outline" icon={Plus} label="Add a dream" onPress={() => setAdding((v) => !v)} /></View>
      {adding && <View className="flex-row items-end gap-2"><View className="flex-1"><Input label="What do you dream of doing?" value={dream} onChangeText={setDream} placeholder="See the northern lights" /></View><Button small variant="navy" label="Add" disabled={dream.trim().length < 3} onPress={() => { setMine((m) => [...m, dream.trim()]); setDream(''); setAdding(false); }} className="mb-1.5 h-[52px]" /></View>}
      {mine.map((m) => <View key={m} className="flex-row items-center gap-3 rounded-card bg-surface-muted p-3"><View className="h-16 w-16 items-center justify-center rounded-2xl bg-tint"><MapPin size={24} color={colors.navy} /></View><View className="flex-1 gap-1"><Badge label="Dream" tone="neutral" /><T v="strong">{m}</T></View></View>)}
      {added.map((a) => <View key={a.title} className="flex-row items-center gap-3 rounded-card bg-surface-muted p-3"><Photo k={a.image} className="h-16 w-16 rounded-2xl" /><View className="flex-1 gap-1"><Badge label="Dream · just added" tone="gold" /><T v="strong">{a.title}</T></View></View>)}
      {data.map((b) => (
        <View key={b.id} className={cx('flex-row items-center gap-3 rounded-card bg-surface-muted p-3', b.state === 'done' && 'opacity-70')}>
          <Photo k={b.image} className="h-16 w-16 rounded-2xl" />
          <View className="flex-1 gap-1.5"><Badge icon={b.state === 'done' ? Check : undefined} label={b.label} tone={b.state === 'done' ? 'info' : b.state === 'dream' ? 'neutral' : 'gold'} /><T v="strong">{b.title}</T>
            {b.savedPct !== undefined && <Pressable accessibilityRole="button" onPress={() => router.navigate('/wallet')} className="gap-1"><Progress pct={b.savedPct} /><T v="small" className="text-xs">{b.savedPct}% saved</T></Pressable>}
            {b.state === 'dream' && <Text accessibilityRole="link" onPress={() => router.push({ pathname: '/wallet/new-goal', params: { name: b.title } })} className="font-pop-sb text-[13px] text-heading-blue">Start saving →</Text>}</View>
        </View>
      ))}
    </>
  );
}

function Calendar() {
  const { data = [] } = useQuery({ queryKey: ['calendar'], queryFn: api.calendar });
  const [picked, setPicked] = useState<number | null>(null);
  const lead = 1; // 1 December 2026 is a Tuesday
  const cells = [...Array<null>(lead).fill(null), ...Array.from({ length: 31 }, (_, i) => i + 1)];
  const inTrip = (d: number) => d >= 12 && d <= 19; const fridays = [4, 11, 18, 25];
  const icons = { trip: Plane, save: PiggyBank, order: Package };
  const shown = data.filter((e) => picked === null || (e.kind === 'save' ? fridays.includes(picked) : picked >= e.day && picked <= (e.endDay ?? e.day)));
  return (
    <>
      <View className="flex-row items-center justify-between">
        <IconButton icon={ChevronLeft} label="Previous month" />
        <View className="items-center"><T v="title">December 2026</T><View className="flex-row items-center gap-1"><CalendarCheck size={12} color={colors.navy} /><T v="small" className="text-xs">Synced with Google Calendar</T></View></View>
        <IconButton icon={ChevronRight} label="Next month" />
      </View>
      <View className="flex-row flex-wrap">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <View key={i} className="w-[14.28%] items-center pb-1"><T v="small" className="text-xs">{d}</T></View>)}
        {cells.map((d, i) => d === null ? <View key={`b${i}`} className="w-[14.28%]" /> : (
          <Pressable key={d} accessibilityRole="button" accessibilityLabel={`${d} December${inTrip(d) ? ', Dolomites trip' : ''}`} accessibilityState={{ selected: picked === d }} onPress={() => setPicked(picked === d ? null : d)} className="h-12 w-[14.28%] items-center justify-center">
            <View className={cx('h-10 w-10 items-center justify-center rounded-full', inTrip(d) && 'bg-navy', picked === d && 'border-2 border-gold')}>
              <Text className={cx('font-pop-md text-sm', inTrip(d) ? 'text-white' : 'text-ink')}>{d}</Text>
              {(fridays.includes(d) || d === 9) && <View className={cx('absolute bottom-1 h-1 w-1 rounded-full', d === 9 ? 'bg-sky' : 'bg-gold')} />}
            </View>
          </Pressable>
        ))}
      </View>
      {shown.length === 0 && <T v="small" className="text-center">Nothing on {picked} December.</T>}
      {shown.map((e) => { const Icon = icons[e.kind]; return (
        <Pressable key={e.id} accessibilityRole="button" onPress={() => go(e.href)} className="flex-row items-center gap-3 rounded-card bg-surface-muted p-3.5 active:opacity-80">
          <View className={cx('h-10 w-10 items-center justify-center rounded-full', e.kind === 'trip' ? 'bg-navy' : e.kind === 'save' ? 'bg-gold-soft' : 'bg-tint')}><Icon size={20} color={e.kind === 'trip' ? '#fff' : colors.navy} /></View>
          <View className="flex-1"><T v="strong">{e.title}</T><T v="small">{e.detail}</T></View><ChevronRight size={18} color={colors.inkMuted} />
        </Pressable>); })}
    </>
  );
}

const pins = [{ n: 'Lagos · home', x: 47, y: 56, k: 'home' }, { n: 'Iceland', x: 39, y: 14, k: 'visited' }, { n: 'Egypt', x: 56, y: 40, k: 'visited' }, { n: 'Bali', x: 84, y: 64, k: 'visited' }, { n: 'Dolomites', x: 51, y: 26, k: 'planned' }] as const;
function TravelMap() {
  const [place, setPlace] = useState(''); const [added, setAdded] = useState<string[]>([]);
  const tone = { home: 'bg-gold', visited: 'bg-navy', planned: 'bg-cyan' };
  return (
    <>
      {/* Placeholder until Mapbox tiles are wired in (needs an access token and a development build). */}
      <View accessibilityLabel="Map of places you have visited and planned" className="h-[300px] overflow-hidden rounded-card bg-tint">
        {pins.map((p) => <View key={p.n} style={{ left: `${p.x}%`, top: `${p.y}%` }} className="absolute items-center"><View className={cx('h-4 w-4 rounded-full border-2 border-white', tone[p.k])} /><Text className="font-pop-sb text-[10px] text-navy">{p.n}</Text></View>)}
        <Text className="absolute bottom-2 right-3 font-pop text-[10px] text-ink-muted">Map tiles: Mapbox (to be connected)</Text>
      </View>
      <View className="flex-row items-end gap-2"><View className="flex-1"><Input value={place} onChangeText={setPlace} placeholder="Add a place you've been" accessibilityLabel="Add a place you've been" /></View><Button small variant="navy" label="Add" disabled={place.trim().length < 2} onPress={() => { setAdded((a) => [...a, place.trim()]); setPlace(''); }} className="h-[52px]" /></View>
      {added.length > 0 && <T v="small">Added: {added.join(', ')}</T>}
      <T v="title" className="text-lg">Your travel map</T>
      <Stats items={[[3 + added.length, 'countries'], [21, 'nights away'], [9, 'tips shared']]} />
      <View className="flex-row gap-4">{(['visited', 'planned', 'home'] as const).map((k) => <View key={k} className="flex-row items-center gap-1.5"><View className={cx('h-3 w-3 rounded-full', tone[k])} /><T v="small" className="capitalize">{k}</T></View>)}</View>
    </>
  );
}

export default function MyTravels() {
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<ViewName>(views.includes(params.view as ViewName) ? (params.view as ViewName) : 'Timeline');
  return (
    <Screen edges={['top']} title="My travels" back={false}
      right={view === 'Calendar' ? <IconButton icon={Plus} label="Add to calendar" onPress={() => router.push('/calendar-add')} /> : <View className="pr-2"><Avatar initials={sample.me.initials} onPress={() => router.push('/profile')} /></View>}>
      <Chips options={views} value={view} onChange={setView} />
      {view === 'Timeline' ? <Timeline /> : view === 'Bucket list' ? <BucketList /> : view === 'Calendar' ? <Calendar /> : <TravelMap />}
    </Screen>
  );
}
