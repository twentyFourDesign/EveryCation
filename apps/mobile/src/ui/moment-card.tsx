import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ChevronLeft, ChevronRight, Plus, Share2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, Share, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { initials, timeAgo } from '@/lib/community';
import { KINDS, KIND_ORDER, useLikeMoment, useMoments, type Moment, type MomentKind } from '@/lib/moments';
import { useSession } from '@/lib/session';
import { showDate } from './date-field';
import { IconComment, IconLike, IconLiked, IconMic, IconPlace } from './icons';
import { Avatar, T, colors, cx, go } from './index';
import { VoicePlayer } from './voice';

const buzz = () => { if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };
const compact = (n: number) => (n < 1000 ? `${n}` : n < 10_000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${Math.round(n / 1000)}k`);

/** EveryCation's heart: a map pin with the logo's hexagon in it. It pops when tapped. */
export function LikeButton({ m, light, size = 26 }: { m: Pick<Moment, 'id' | 'liked' | 'likes'>; light?: boolean; size?: number }) {
  const like = useLikeMoment(); const signedIn = useSession((s) => s.status === 'signedIn');
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const color = light ? '#fff' : m.liked ? colors.navy : colors.ink;
  function press() {
    if (!signedIn) return router.push('/sign-up');
    if (!m.liked) { buzz(); scale.set(withSequence(withTiming(0.7, { duration: 90 }), withSpring(1.25, { damping: 6, stiffness: 320 }), withSpring(1))); }
    like.mutate(m.id);
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={m.liked ? `Liked, ${m.likes} likes. Tap to unlike` : `Like, ${m.likes} likes`} accessibilityState={{ selected: m.liked }} hitSlop={8} onPress={press} className="flex-row items-center gap-1.5 py-1">
      <Animated.View style={style}>{m.liked ? <IconLiked size={size} color={color} /> : <IconLike size={size} color={color} />}</Animated.View>
      <Text className={cx('min-w-[14px] font-pop-sb text-[14px]', light ? 'text-white' : 'text-ink')}>{m.likes ? compact(m.likes) : ''}</Text>
    </Pressable>
  );
}

export function CommentButton({ m, light, size = 26 }: { m: Pick<Moment, 'id' | 'comments'>; light?: boolean; size?: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${m.comments} comments`} hitSlop={8} onPress={() => go(`/moment/${m.id}`)} className="flex-row items-center gap-1.5 py-1">
      <IconComment size={size} color={light ? '#fff' : colors.ink} />
      <Text className={cx('min-w-[14px] font-pop-sb text-[14px]', light ? 'text-white' : 'text-ink')}>{m.comments ? compact(m.comments) : ''}</Text>
    </Pressable>
  );
}

export const KindPill = ({ kind, small }: { kind: MomentKind; small?: boolean }) => {
  const k = KINDS[kind];
  return (
    <View style={{ backgroundColor: k.bg }} className={cx('flex-row items-center gap-1 rounded-full', small ? 'px-2 py-0.5' : 'px-2.5 py-1')}>
      <k.icon size={small ? 13 : 15} color={k.ink} accent={k.ink === colors.onGold ? colors.navy : undefined} />
      <Text style={{ color: k.ink }} className={cx('font-pop-sb', small ? 'text-[11px]' : 'text-xs')}>{k.label}</Text>
    </View>
  );
};

function MomentVideo({ url, active, rounded }: { url: string; active: boolean; rounded?: boolean }) {
  const player = useVideoPlayer(url, (p) => { p.loop = true; p.muted = true; });
  useEffect(() => { if (active) player.play(); else player.pause(); }, [active, player]);
  return <VideoView player={player} style={{ width: '100%', height: '100%', backgroundColor: '#000', borderRadius: rounded ? 16 : 0 }} contentFit="cover" nativeControls accessibilityLabel="Video moment" />;
}

/** Words-only moments get the kind's colour wash, with the type sized to how much was written. */
function Words({ m, clamp }: { m: Moment; clamp?: number }) {
  const k = KINDS[m.kind]; const n = m.body.length;
  const size = n < 70 ? 'text-[24px] leading-[32px]' : n < 160 ? 'text-[19px] leading-[27px]' : 'text-base leading-6';
  return (
    <LinearGradient colors={k.wash} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 16, padding: 20, justifyContent: 'center', minHeight: clamp ? undefined : 220 }}>
      <View style={{ position: 'absolute', right: 14, bottom: 12, opacity: 0.16 }}><k.icon size={84} color="#fff" accent="#fff" /></View>
      <Text numberOfLines={clamp} className={cx('font-pop-sb text-white', size)}>{m.body}</Text>
    </LinearGradient>
  );
}

function Media({ m, active, fixed }: { m: Moment; active: boolean; fixed: boolean }) {
  const box = fixed ? 'flex-1' : 'h-[360px]';
  if (!m.media) return fixed ? <View className="flex-1"><Words m={m} clamp={9} /></View> : <Words m={m} />;
  if (m.media.kind === 'image') return <View className={cx(box, 'overflow-hidden rounded-2xl bg-surface-muted')}><Image source={{ uri: m.media.url }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} accessibilityLabel={`Photo by ${m.author.name}`} /></View>;
  if (m.media.kind === 'video') return <View className={cx(box, 'overflow-hidden rounded-2xl bg-black')}><MomentVideo url={m.media.url} active={active} rounded /></View>;
  const k = KINDS[m.kind];
  return (
    <LinearGradient colors={k.wash} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 16, padding: 16, gap: 14, justifyContent: 'center', ...(fixed ? { flex: 1 } : { minHeight: 200 }) }}>
      <View className="items-center gap-2"><View className="h-16 w-16 items-center justify-center rounded-full bg-white/20"><IconMic size={34} color="#fff" accent={colors.gold} /></View><Text className="font-pop-sb text-sm text-white">Voice note from {m.author.name.split(' ')[0]}</Text></View>
      <VoicePlayer url={m.media.url} label={`Voice note from ${m.author.name}`} />
    </LinearGradient>
  );
}

const share = (m: Moment) => Share.share({ message: `${m.body ? `"${m.body.slice(0, 200)}" ` : ''}${m.author.name} on EveryCation` });

/**
 * One moment. `fixed` fits it to a set height for the Explore frame and shortens long words;
 * otherwise it shows the moment in full, for the timeline and the moment's own page.
 */
export function MomentCard({ m, fixed, active = true, open = true }: { m: Moment; fixed?: boolean; active?: boolean; open?: boolean }) {
  const words = !m.media;
  const where = [m.kind === 'event' && m.eventDate ? showDate(m.eventDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : null, m.place].filter(Boolean).join(' · ');
  const body = (
    <>
      <Media m={m} active={active} fixed={!!fixed} />
      {!words && !!m.body && <T numberOfLines={fixed ? 2 : undefined} className="px-0.5 pt-2.5">{m.body}</T>}
      {!!where && (
        <View className="flex-row items-center gap-1.5 px-0.5 pt-2">
          <IconPlace size={15} color={m.kind === 'safety' ? colors.danger : colors.inkMuted} /><T v="small" numberOfLines={1} className={cx('flex-1 text-xs', m.kind === 'safety' && 'text-danger')}>{where}</T>
        </View>
      )}
    </>
  );
  return (
    <View className={cx('rounded-card border border-line bg-white p-3', fixed && 'flex-1')}>
      <View className="flex-row items-center gap-2.5 pb-2.5">
        <Avatar initials={initials(m.author.name)} size={36} onPress={() => go(`/traveller/${m.author.id}`)} />
        <View className="min-w-0 flex-1"><T v="label" numberOfLines={1}>{m.mine ? 'You' : m.author.name}</T><T v="small" numberOfLines={1} className="text-xs">{timeAgo(m.createdAt)}{m.author.city ? ` · ${m.author.city}` : ''}</T></View>
        <KindPill kind={m.kind} small />
      </View>
      {open ? <Pressable accessibilityRole="button" accessibilityLabel={`Open ${KINDS[m.kind].label.toLowerCase()} by ${m.author.name}`} onPress={() => go(`/moment/${m.id}`)} className={cx(fixed && 'flex-1')}>{body}</Pressable> : <View>{body}</View>}
      <View className="flex-row items-center gap-5 pt-2">
        <LikeButton m={m} />
        <CommentButton m={m} />
        <View className="flex-1" />
        <Pressable accessibilityRole="button" accessibilityLabel="Share" hitSlop={8} onPress={() => share(m)}><Share2 size={21} color={colors.ink} /></Pressable>
      </View>
    </View>
  );
}

const FILTERS = ['all', ...KIND_ORDER] as const;
type Filter = (typeof FILTERS)[number];
const FRAME_HEIGHT = 470;

/** The Explore frame: one moment at a time, swipe or tap the arrows for the next. Everyone's moments, newest first. */
export function MomentsFrame() {
  const [filter, setFilter] = useState<Filter>('all');
  const feed = useMoments(filter === 'all' ? undefined : filter);
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const [width, setWidth] = useState(0); const [index, setIndex] = useState(0);
  const list = useRef<FlatList<Moment>>(null);
  const choose = (f: Filter) => { setFilter(f); setIndex(0); list.current?.scrollToOffset({ offset: 0, animated: false }); };
  const to = (i: number) => { const n = Math.max(0, Math.min(items.length - 1, i)); list.current?.scrollToOffset({ offset: n * width, animated: true }); setIndex(n); if (n >= items.length - 3 && feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage(); };

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <View className="flex-1"><T v="h2">Moments</T><T v="small" className="text-xs">Live from travellers everywhere</T></View>
        <Pressable accessibilityRole="button" onPress={() => go('/moments')} className="h-9 justify-center px-2"><Text className="font-pop-sb text-sm text-heading-blue">See all</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Post a moment" onPress={() => go('/moment/new')} className="h-9 flex-row items-center gap-1 rounded-full bg-gold px-3.5 active:opacity-80"><Plus size={16} color={colors.ink} strokeWidth={2.5} /><Text className="font-pop-sb text-[13px] text-ink">Post</Text></Pressable>
      </View>
      <FlatList horizontal data={FILTERS as unknown as Filter[]} keyExtractor={(f) => f} showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5"
        renderItem={({ item: f }) => {
          const on = f === filter; const k = f === 'all' ? null : KINDS[f];
          return (
            <Pressable accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => choose(f)} className={cx('h-9 flex-row items-center gap-1.5 rounded-full px-3', on ? 'bg-navy' : 'border-[1.5px] border-line bg-white')}>
              {k && <k.icon size={15} color={on ? '#fff' : k.ink} accent={on ? colors.gold : undefined} />}
              <Text className={cx('font-pop-md text-[13px]', on ? 'text-white' : 'text-ink')}>{k ? k.plural : 'All'}</Text>
            </Pressable>
          );
        }} />
      <View style={{ height: FRAME_HEIGHT }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {feed.isLoading || !width ? <View className="flex-1 items-center justify-center rounded-card bg-surface-muted"><T v="small">Loading moments…</T></View>
          : !items.length ? (
            <LinearGradient colors={[colors.navy, colors.headingBlue]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 20, padding: 24, justifyContent: 'center', gap: 14 }}>
              <IconLike size={56} color="#fff" />
              <Text className="font-pop-sb text-2xl text-white">{feed.error ? 'Moments could not load just now.' : filter === 'all' ? 'Nothing here yet. Start the timeline.' : `No ${KINDS[filter].plural.toLowerCase()} moments yet.`}</Text>
              <Text className="font-pop text-[15px] leading-[22px] text-white/80">Share a status, an event, a question about a trip, a safety heads-up or something fun. Everyone on EveryCation can see it, like it and reply.</Text>
              <Pressable accessibilityRole="button" onPress={() => go('/moment/new')} className="h-12 flex-row items-center justify-center gap-2 self-start rounded-full bg-gold px-5"><Plus size={18} color={colors.ink} strokeWidth={2.5} /><Text className="font-pop-sb text-[15px] text-ink">Post a moment</Text></Pressable>
            </LinearGradient>
          ) : (
            <FlatList ref={list} horizontal pagingEnabled showsHorizontalScrollIndicator={false} data={items} keyExtractor={(m) => m.id}
              getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
              onScroll={(e) => { const i = Math.round(e.nativeEvent.contentOffset.x / width); if (i !== index) setIndex(i); }} scrollEventThrottle={32}
              onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()} onEndReachedThreshold={2}
              renderItem={({ item, index: i }) => <View style={{ width, height: FRAME_HEIGHT }}><MomentCard m={item} fixed active={i === index} /></View>} />
          )}
      </View>
      {items.length > 1 && (
        <View className="flex-row items-center justify-center gap-4">
          <Pressable accessibilityRole="button" accessibilityLabel="Previous moment" disabled={index === 0} onPress={() => to(index - 1)} className={cx('h-10 w-10 items-center justify-center rounded-full bg-surface-muted', index === 0 && 'opacity-40')}><ChevronLeft size={20} color={colors.navy} /></Pressable>
          <View className="flex-row items-center gap-1.5" accessibilityLabel={`Moment ${index + 1} of ${items.length}${feed.hasNextPage ? ' or more' : ''}`}>
            {items.slice(Math.max(0, Math.min(index - 3, items.length - 7)), Math.max(7, index + 4)).map((m) => <View key={m.id} className={cx('h-2 rounded-full', m.id === items[index]?.id ? 'w-5 bg-navy' : 'w-2 bg-line')} />)}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Next moment" disabled={index >= items.length - 1} onPress={() => to(index + 1)} className={cx('h-10 w-10 items-center justify-center rounded-full bg-surface-muted', index >= items.length - 1 && 'opacity-40')}><ChevronRight size={20} color={colors.navy} /></Pressable>
        </View>
      )}
    </View>
  );
}
