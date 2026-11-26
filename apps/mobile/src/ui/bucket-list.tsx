import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Check, Plus, Shuffle, Trash2, X } from 'lucide-react-native';
import { IconAdventure, IconBeach, IconCity, IconCulture, IconDreamer, IconExplore, IconFood, IconGlobe, IconInspire, IconNature, IconSavings, IconTravels, IconTrip, IconTrophy, IconWanderer, type Icon } from '@/ui/icons';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';
import { cssInterop } from 'nativewind';
import { errorMessage } from '@/lib/api';
import { useAddBucket, useBucket, useRemoveBucket, useSetBucketState, type BucketItem, type NewDream, type PlaceHit, type Vibe } from '@/lib/trips';
import { Button, Input, Loading, Note, Photo, Segmented, T, colors, cx } from './index';
import { PlaceField } from './place-field';

// Lets Tailwind classes style Reanimated views, merged with their animated styles.
cssInterop(Animated.View, { className: 'style' });

export const VIBES: Record<Vibe, { label: string; icon: Icon; bg: string; ink: string }> = {
  beach: { label: 'Beach', icon: IconBeach, bg: '#DDF3FB', ink: '#00618F' },
  city: { label: 'City', icon: IconCity, bg: '#E5EAF6', ink: colors.navy },
  adventure: { label: 'Adventure', icon: IconAdventure, bg: '#FFE9DC', ink: '#A4440B' },
  food: { label: 'Food', icon: IconFood, bg: '#FFF1BC', ink: '#7A5A00' },
  culture: { label: 'Culture', icon: IconCulture, bg: '#F1E6FA', ink: '#6A2C91' },
  nature: { label: 'Nature', icon: IconNature, bg: '#E2F5E6', ink: '#1E7034' },
};
const vibeList = Object.keys(VIBES) as Vibe[];
const DEFAULT = { label: 'Dream', icon: IconInspire, bg: '#F3F3F3', ink: colors.ink };
const look = (v: Vibe | null) => (v ? VIBES[v] : DEFAULT);

/** 🇳🇬 from "NG". */
export const flag = (code?: string | null) => (code && /^[A-Z]{2}$/i.test(code) ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '');

/** Traveller levels, by how many dreams are ticked off. */
const LEVELS = [[0, 'Dreamer', IconDreamer], [1, 'Wanderer', IconWanderer], [3, 'Explorer', IconExplore], [6, 'Adventurer', IconTravels], [10, 'Globetrotter', IconGlobe], [20, 'Legend', IconTrophy]] as const;
function level(done: number) {
  let i = 0; LEVELS.forEach(([min], n) => { if (done >= min) i = n; }); const next = LEVELS[i + 1];
  return { name: LEVELS[i]![1], icon: LEVELS[i]![2], next: next ? { name: next[1], left: next[0] - done } : null };
}

/** Ideas for "Need inspiration?". Places a Nigerian traveller can reach, and some further away. */
const IDEAS: (NewDream & { id: string; vibe: Vibe; place: string; countryCode: string; lat: number; lng: number })[] = [
  { id: 'olumo', title: 'Climb Olumo Rock', place: 'Abeokuta, Nigeria', countryCode: 'NG', lat: 7.16, lng: 3.35, vibe: 'adventure' },
  { id: 'obudu', title: 'Ride the Obudu cable car', place: 'Obudu, Nigeria', countryCode: 'NG', lat: 6.38, lng: 9.37, vibe: 'nature' },
  { id: 'calabar', title: 'Dance at the Calabar Carnival', place: 'Calabar, Nigeria', countryCode: 'NG', lat: 4.95, lng: 8.32, vibe: 'culture' },
  { id: 'waakye', title: 'Eat waakye at an Accra chop bar', place: 'Accra, Ghana', countryCode: 'GH', lat: 5.6, lng: -0.19, vibe: 'food' },
  { id: 'capecoast', title: 'Walk through Cape Coast Castle', place: 'Cape Coast, Ghana', countryCode: 'GH', lat: 5.1, lng: -1.24, vibe: 'culture' },
  { id: 'zanzibar', title: 'Sail a dhow at sunset', place: 'Zanzibar, Tanzania', countryCode: 'TZ', lat: -6.16, lng: 39.19, vibe: 'beach' },
  { id: 'mara', title: 'See the Great Migration', place: 'Maasai Mara, Kenya', countryCode: 'KE', lat: -1.49, lng: 35.14, vibe: 'adventure' },
  { id: 'gorillas', title: 'Trek to see mountain gorillas', place: 'Volcanoes National Park, Rwanda', countryCode: 'RW', lat: -1.47, lng: 29.53, vibe: 'nature' },
  { id: 'tablemtn', title: 'Take the cable car up Table Mountain', place: 'Cape Town, South Africa', countryCode: 'ZA', lat: -33.96, lng: 18.4, vibe: 'adventure' },
  { id: 'jemaa', title: 'Eat your way round Jemaa el-Fnaa', place: 'Marrakech, Morocco', countryCode: 'MA', lat: 31.63, lng: -7.99, vibe: 'food' },
  { id: 'nile', title: 'Ride a felucca on the Nile', place: 'Aswan, Egypt', countryCode: 'EG', lat: 24.09, lng: 32.9, vibe: 'culture' },
  { id: 'oia', title: 'Watch the sunset in Oia', place: 'Santorini, Greece', countryCode: 'GR', lat: 36.46, lng: 25.38, vibe: 'beach' },
  { id: 'aurora', title: 'See the northern lights', place: 'Tromsø, Norway', countryCode: 'NO', lat: 69.65, lng: 18.96, vibe: 'nature' },
  { id: 'cappadocia', title: 'Fly in a hot-air balloon', place: 'Cappadocia, Türkiye', countryCode: 'TR', lat: 38.64, lng: 34.83, vibe: 'adventure' },
  { id: 'dunes', title: 'Go dune bashing in the desert', place: 'Dubai, United Arab Emirates', countryCode: 'AE', lat: 25.2, lng: 55.27, vibe: 'adventure' },
  { id: 'ramen', title: 'Go on a ramen crawl', place: 'Tokyo, Japan', countryCode: 'JP', lat: 35.68, lng: 139.69, vibe: 'food' },
  { id: 'sakura', title: 'See the cherry blossoms', place: 'Kyoto, Japan', countryCode: 'JP', lat: 35.01, lng: 135.77, vibe: 'nature' },
  { id: 'pasta', title: 'Learn to make fresh pasta', place: 'Rome, Italy', countryCode: 'IT', lat: 41.9, lng: 12.5, vibe: 'food' },
  { id: 'paris', title: 'Picnic under the Eiffel Tower', place: 'Paris, France', countryCode: 'FR', lat: 48.86, lng: 2.29, vibe: 'city' },
  { id: 'westend', title: 'Catch a West End show', place: 'London, United Kingdom', countryCode: 'GB', lat: 51.51, lng: -0.13, vibe: 'city' },
  { id: 'nyc', title: 'Ring in New Year in Times Square', place: 'New York, United States', countryCode: 'US', lat: 40.76, lng: -73.99, vibe: 'city' },
  { id: 'rio', title: 'Join the Rio Carnival', place: 'Rio de Janeiro, Brazil', countryCode: 'BR', lat: -22.91, lng: -43.17, vibe: 'culture' },
  { id: 'maldives', title: 'Snorkel with manta rays', place: 'Maldives', countryCode: 'MV', lat: 3.2, lng: 73.22, vibe: 'beach' },
  { id: 'ubud', title: 'Walk the Ubud rice terraces', place: 'Bali, Indonesia', countryCode: 'ID', lat: -8.51, lng: 115.26, vibe: 'nature' },
  { id: 'greatwall', title: 'Hike a stretch of the Great Wall', place: 'Beijing, China', countryCode: 'CN', lat: 40.43, lng: 116.57, vibe: 'culture' },
];
const shuffle = <X,>(list: X[]) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; };
const buzz = (kind: 'tap' | 'win') => { if (Platform.OS !== 'web') void (kind === 'win' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.selectionAsync()).catch(() => {}); };
const monthYear = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

// ───────────── Confetti ─────────────
const CONFETTI = [colors.gold, colors.navy, '#00B5E2', '#FF6B4A', '#3CC46B', '#B05CE0'];
function Piece({ i }: { i: number }) {
  const p = useSharedValue(0);
  const [spec] = useState(() => ({ angle: (i / 22) * Math.PI * 2 + Math.random() * 0.4, dist: 70 + Math.random() * 70, spin: (Math.random() - 0.5) * 720, color: CONFETTI[i % CONFETTI.length]!, w: 6 + Math.random() * 4, round: i % 3 === 0 }));
  useEffect(() => { p.set(withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) })); }, [p]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - p.value * p.value,
    transform: [{ translateX: Math.cos(spec.angle) * spec.dist * p.value }, { translateY: Math.sin(spec.angle) * spec.dist * p.value + 60 * p.value * p.value }, { rotate: `${spec.spin * p.value}deg` }],
  }));
  return <Animated.View style={[{ position: 'absolute', width: spec.w, height: spec.round ? spec.w : spec.w * 1.8, borderRadius: spec.round ? spec.w : 1.5, backgroundColor: spec.color }, style]} />;
}
/** A one-off burst of confetti from the middle of its parent. Change `burst` to fire again. */
function Confetti({ burst }: { burst: number }) {
  if (!burst) return null;
  return <View key={burst} pointerEvents="none" style={{ position: 'absolute', top: '50%', right: 34, width: 0, height: 0, overflow: 'visible', zIndex: 10 }}>{Array.from({ length: 22 }, (_, i) => <Piece key={i} i={i} />)}</View>;
}

// ───────────── Pieces ─────────────
function Tile({ item, size = 56 }: { item: Pick<BucketItem, 'vibe' | 'imageKey' | 'countryCode'>; size?: number }) {
  const v = look(item.vibe);
  return (
    <View style={{ width: size, height: size }}>
      {item.imageKey ? <Photo k={item.imageKey as never} className="h-full w-full rounded-2xl" />
        : <View style={{ backgroundColor: v.bg }} className="h-full w-full items-center justify-center rounded-2xl"><v.icon size={size * 0.56} color={v.ink} /></View>}
      {!!item.countryCode && <View className="absolute -bottom-1 -right-1 h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-white"><Text className="text-[13px]">{flag(item.countryCode)}</Text></View>}
    </View>
  );
}

function CheckButton({ done, onPress, label }: { done: boolean; onPress: () => void; label: string }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={label} hitSlop={8}
      onPress={() => { scale.set(withSequence(withTiming(0.8, { duration: 90 }), withSpring(1, { damping: 6, stiffness: 260 }))); onPress(); }}>
      <Animated.View style={style} className={cx('h-11 w-11 items-center justify-center rounded-full border-2', done ? 'border-navy bg-navy' : 'border-control-border bg-white')}>
        {done ? <Animated.View entering={ZoomIn.springify().damping(9)}><Check size={22} color="#fff" strokeWidth={3} /></Animated.View> : <Check size={20} color={colors.line} strokeWidth={3} />}
      </Animated.View>
    </Pressable>
  );
}

function Hero({ items }: { items: BucketItem[] }) {
  const done = items.filter((b) => b.state === 'done');
  const countries = new Set(items.map((b) => b.countryCode).filter(Boolean)).size;
  const lv = level(done.length);
  const pct = items.length ? done.length / items.length : 0;
  const width = useSharedValue(0);
  useEffect(() => { width.set(withDelay(150, withSpring(pct, { damping: 18 }))); }, [pct, width]);
  const bar = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, width.value)) * 100}%` }));
  return (
    <View className="gap-3 overflow-hidden rounded-card bg-navy p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-white/15"><lv.icon size={28} color="#fff" /></View>
        <View className="flex-1">
          <Text className="font-pop-sb text-[11px] tracking-widest text-gold">YOUR LEVEL</Text>
          <Text className="font-pop-sb text-xl text-white">{lv.name}</Text>
        </View>
      </View>
      <View className="h-2.5 overflow-hidden rounded-full bg-white/20"><Animated.View style={bar} className="h-full rounded-full bg-gold" /></View>
      <Text className="font-pop text-[13px] text-navy-text-soft">
        {items.length === 0 ? 'Add your first dream to get started.' : `${done.length} of ${items.length} ticked off${lv.next ? ` · ${lv.next.left} more to ${lv.next.name}` : ' · Top level!'}`}
      </Text>
      <View className="flex-row gap-2">
        {([[items.length - done.length, 'Dreams'], [done.length, 'Done'], [countries, countries === 1 ? 'Country' : 'Countries']] as const).map(([n, l]) => (
          <View key={l} className="flex-1 items-center rounded-2xl bg-white/10 py-2"><Text className="font-pop-sb text-lg text-white">{n}</Text><Text className="font-pop text-[11px] text-navy-text-soft">{l}</Text></View>
        ))}
      </View>
    </View>
  );
}

function AddDream({ onClose }: { onClose: () => void }) {
  const add = useAddBucket();
  const [title, setTitle] = useState(''); const [place, setPlace] = useState(''); const [picked, setPicked] = useState<PlaceHit | null>(null); const [vibe, setVibe] = useState<Vibe | null>(null);
  function pick(hit: PlaceHit | null) { setPicked(hit); if (hit && !title.trim()) setTitle(`Visit ${hit.name}`); }
  const save = () => add.mutate({ title: title.trim(), vibe: vibe ?? undefined, ...(picked && { place: picked.label, countryCode: picked.countryCode, lat: picked.lat, lng: picked.lng }) }, { onSuccess: () => { buzz('tap'); onClose(); } });
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} className="gap-3 rounded-card border-[1.5px] border-navy bg-white p-4">
      <View className="flex-row items-center"><T v="strong" className="flex-1">Add a dream</T><Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={onClose}><X size={20} color={colors.inkMuted} /></Pressable></View>
      <Input label="What do you dream of doing?" value={title} onChangeText={setTitle} placeholder="See the northern lights" maxLength={80} autoFocus />
      <PlaceField label="Where? (optional)" value={place} onChangeText={setPlace} picked={picked} onPick={pick} current={false} placeholder="Start typing a place" hint="Pinned on your map. You can turn it into a trip later." />
      <View className="gap-2">
        <T v="label">What kind of dream?</T>
        <View className="flex-row flex-wrap gap-2">
          {vibeList.map((k) => { const v = VIBES[k]; const on = vibe === k; return (
            <Pressable key={k} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => { buzz('tap'); setVibe(on ? null : k); }}
              style={on ? { backgroundColor: v.bg, borderColor: v.ink } : undefined} className={cx('h-10 flex-row items-center gap-1.5 rounded-full border-[1.5px] px-3.5', !on && 'border-control-border bg-white')}>
              <v.icon size={18} color={on ? v.ink : colors.inkMuted} mono={!on} /><Text style={on ? { color: v.ink } : undefined} className={cx('font-pop-md text-[13px]', !on && 'text-ink')}>{v.label}</Text>
            </Pressable>
          ); })}
        </View>
      </View>
      {!!add.error && <Note tone="danger">{errorMessage(add.error)}</Note>}
      <Button label={add.isPending ? 'ADDING…' : 'ADD TO MY BUCKET LIST'} disabled={title.trim().length < 3 || add.isPending} onPress={save} />
    </Animated.View>
  );
}

function Ideas({ have }: { have: Set<string> }) {
  const add = useAddBucket();
  const [deck, setDeck] = useState(() => shuffle(IDEAS));
  const shown = deck.filter((i) => !have.has(`idea:${i.id}`)).slice(0, 4);
  if (!shown.length) return null;
  return (
    <View className="gap-2.5">
      <View className="flex-row items-center"><T v="strong" className="flex-1">Need inspiration?</T>
        <Pressable accessibilityRole="button" onPress={() => { buzz('tap'); setDeck(shuffle(IDEAS)); }} className="flex-row items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 active:opacity-70">
          <Shuffle size={14} color={colors.navy} /><Text className="font-pop-sb text-[13px] text-navy">Shuffle</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-3 px-5">
        {shown.map((idea) => { const v = VIBES[idea.vibe]; return (
          <Animated.View key={idea.id} entering={FadeIn.duration(250)} layout={LinearTransition} style={{ backgroundColor: v.bg }} className="w-[170px] gap-2 rounded-card p-3.5">
            <View className="flex-row items-center justify-between"><v.icon size={34} color={v.ink} /><Text className="text-lg">{flag(idea.countryCode)}</Text></View>
            <Text style={{ color: v.ink }} className="min-h-[40px] font-pop-sb text-sm leading-5" numberOfLines={2}>{idea.title}</Text>
            <Text className="font-pop text-xs text-ink-muted" numberOfLines={1}>{idea.place}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Add ${idea.title}`} disabled={add.isPending} onPress={() => { buzz('tap'); const { id, ...dream } = idea; add.mutate({ ...dream, source: `idea:${id}` }); }}
              className="h-9 flex-row items-center justify-center gap-1 rounded-full bg-white active:opacity-70">
              <Plus size={16} color={v.ink} /><Text style={{ color: v.ink }} className="font-pop-sb text-[13px]">Add</Text>
            </Pressable>
          </Animated.View>
        ); })}
      </ScrollView>
    </View>
  );
}

function DreamCard({ item }: { item: BucketItem }) {
  const setState = useSetBucketState(); const remove = useRemoveBucket();
  const [burst, setBurst] = useState(0); const [memory, setMemory] = useState(''); const [asking, setAsking] = useState(false);
  const done = item.state === 'done'; const v = look(item.vibe);
  function toggle() {
    if (!done) { setBurst(Date.now()); buzz('win'); setAsking(true); } else { buzz('tap'); setAsking(false); }
    setState.mutate({ id: item.id, state: done ? 'dream' : 'done' });
  }
  const planTrip = () => router.push({ pathname: '/trip/new', params: { title: item.title, place: item.place ?? '', countryCode: item.countryCode ?? '', ...(item.lat !== null && item.lng !== null && { lat: String(item.lat), lng: String(item.lng) }) } });
  return (
    <Animated.View layout={LinearTransition.springify().damping(16)} entering={FadeIn} className={cx('gap-3 rounded-card p-3.5', done ? 'bg-surface-muted' : 'border border-line bg-white')}>
      <View className="flex-row items-center gap-3">
        <Tile item={item} />
        <View className="flex-1 gap-0.5">
          <Text style={{ color: v.ink }} className="font-pop-sb text-[11px] tracking-wider">{done ? `✓ DONE${item.doneAt ? ` · ${monthYear(item.doneAt).toUpperCase()}` : ''}` : v.label.toUpperCase()}</Text>
          <Text className={cx('font-pop-sb text-[15px] text-ink', done && 'text-ink-muted line-through')}>{item.title}</Text>
          {!!item.place && <T v="small" className="text-xs" numberOfLines={1}>{item.place}</T>}
        </View>
        <CheckButton done={done} onPress={toggle} label={`${item.title}, ${done ? 'done' : 'not done yet'}`} />
      </View>
      <Confetti burst={burst} />
      {done && asking && !item.memory ? (
        <Animated.View entering={FadeIn.delay(250)} className="gap-2 rounded-2xl bg-gold-soft p-3">
          <Text className="font-pop-sb text-sm text-ink">🎉 You did it! How was it?</Text>
          <TextInput value={memory} onChangeText={setMemory} placeholder="One line to remember it by" placeholderTextColor={colors.inkMuted} maxLength={140}
            className="h-11 rounded-xl border-[1.5px] border-control-border bg-white px-3 font-pop text-sm text-ink" accessibilityLabel="How was it?" />
          <View className="flex-row gap-2">
            <Button small className="flex-1" variant="navy" label="Save memory" disabled={!memory.trim() || setState.isPending} onPress={() => setState.mutate({ id: item.id, memory: memory.trim() }, { onSuccess: () => setAsking(false) })} />
            <Button small className="flex-1" variant="ghost" label="Not now" onPress={() => setAsking(false)} />
          </View>
        </Animated.View>
      ) : done && item.memory ? (
        <Text className="font-pop text-[13px] italic text-ink-muted">“{item.memory}”</Text>
      ) : null}
      <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
        {!done && <Action icon={IconTrip} label="Plan a trip" onPress={planTrip} />}
        {!done && <Action icon={IconSavings} label="Start saving" onPress={() => router.push({ pathname: '/wallet/new-goal', params: { name: item.title } })} />}
        {done && !item.memory && !asking && <Action label="✍️ Add a memory" onPress={() => setAsking(true)} />}
        <View className="flex-1" />
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.title}`} hitSlop={10} onPress={() => remove.mutate(item.id)}><Trash2 size={17} color={colors.inkMuted} /></Pressable>
      </View>
    </Animated.View>
  );
}
const Action = ({ icon: Icon, label, onPress }: { icon?: typeof IconTrip; label: string; onPress: () => void }) => (
  <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6} className="flex-row items-center gap-1.5 py-1 active:opacity-60">
    {Icon && <Icon size={15} color={colors.navy} />}<Text className="font-pop-sb text-[13px] text-heading-blue">{label}</Text>
  </Pressable>
);

const filters = ['All', 'Dreams', 'Done'] as const;
export function BucketList() {
  const { data = [], isLoading, error } = useBucket();
  const [adding, setAdding] = useState(false); const [filter, setFilter] = useState<(typeof filters)[number]>('All');
  const have = useMemo(() => new Set(data.map((b) => b.source).filter((s): s is string => !!s)), [data]);
  if (isLoading) return <Loading what="your bucket list" />;
  const shown = data.filter((b) => filter === 'All' || (filter === 'Done') === (b.state === 'done'));
  const doneCount = data.filter((b) => b.state === 'done').length;
  return (
    <>
      {!!error && <Note tone="danger">{errorMessage(error)}</Note>}
      <Hero items={data} />
      {adding ? <AddDream onClose={() => setAdding(false)} /> : <Button icon={Plus} label="ADD A DREAM" onPress={() => setAdding(true)} />}
      <Ideas have={have} />
      {data.length > 0 && <Segmented options={filters} value={filter} onChange={setFilter} />}
      {data.length === 0 ? (
        <View className="items-center gap-2 py-6"><IconGlobe size={56} /><T v="strong" className="text-center">Where do you dream of going?</T><T v="small" className="text-center">Add your own, pick an idea above, or tap “Add to bucket list” on any tip or place.</T></View>
      ) : shown.length === 0 ? (
        <T v="small" className="py-6 text-center">{filter === 'Done' ? 'Nothing ticked off yet. Your first one is closer than you think.' : `All ${doneCount} done. Time to dream up some more!`}</T>
      ) : shown.map((b) => <DreamCard key={b.id} item={b} />)}
    </>
  );
}
