import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Empty, Header, Loading, Note, T, colors, cx, go } from '@/ui';
import { errorMessage } from '@/lib/api';
import { KINDS, KIND_ORDER, useMoments, type MomentKind } from '@/lib/moments';
import { MomentCard } from '@/ui/moment-card';

/** The whole public timeline, newest first, with a filter for each kind. */
export default function Moments() {
  const [kind, setKind] = useState<MomentKind | undefined>();
  const feed = useMoments(kind);
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white">
      <View className="w-full max-w-[520px] flex-1 self-center">
        <Header title="Moments" right={<Pressable accessibilityRole="button" accessibilityLabel="Post a moment" onPress={() => go('/moment/new')} className="h-10 flex-row items-center gap-1 rounded-full bg-gold px-3.5"><Plus size={16} color={colors.ink} strokeWidth={2.5} /><Text className="font-pop-sb text-[13px] text-ink">Post</Text></Pressable>} />
        <FlatList data={items} keyExtractor={(m) => m.id} contentContainerClassName="gap-4 px-5 pb-10"
          refreshControl={<RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={() => { void feed.refetch(); }} />}
          onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()} onEndReachedThreshold={1.5}
          ListHeaderComponent={
            <View className="gap-3 pb-1">
              <T v="small">Public posts from travellers: statuses, events, trip talk, safety alerts and fun. No following needed. Like and reply to anything.</T>
              <View className="flex-row flex-wrap gap-2">
                {[undefined, ...KIND_ORDER].map((k) => {
                  const on = k === kind; const meta = k && KINDS[k];
                  return (
                    <Pressable key={k ?? 'all'} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setKind(k)} className={cx('h-9 flex-row items-center gap-1.5 rounded-full px-3', on ? 'bg-navy' : 'border-[1.5px] border-line bg-white')}>
                      {meta && <meta.icon size={15} color={on ? '#fff' : meta.ink} accent={on ? colors.gold : undefined} />}
                      <Text className={cx('font-pop-md text-[13px]', on ? 'text-white' : 'text-ink')}>{meta ? meta.plural : 'All'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          }
          ListEmptyComponent={feed.isLoading ? <Loading what="moments" /> : feed.error ? <Note tone="danger">{errorMessage(feed.error)}</Note> : <Empty>{kind ? `No ${KINDS[kind].plural.toLowerCase()} moments yet. Post the first one.` : 'No moments yet. Post the first one.'}</Empty>}
          ListFooterComponent={feed.isFetchingNextPage ? <Loading what="more" /> : items.length && !feed.hasNextPage ? <T v="small" className="py-4 text-center">You are all caught up.</T> : undefined}
          renderItem={({ item }) => <MomentCard m={item} />} />
      </View>
    </SafeAreaView>
  );
}
