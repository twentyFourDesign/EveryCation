import { router } from 'expo-router';
import { Settings, Store } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Avatar, Button, Empty, IconButton, ListRow, Photo, Screen, SectionTitle, Stats, T, go } from '@/ui';
import { initials, tipImage, useProfile, useTipsBy } from '@/lib/community';
import { useSession } from '@/lib/session';

export default function Profile() {
  const { me, status } = useSession();
  const { data: p } = useProfile(me?.id);
  const { data: tips = [] } = useTipsBy(me?.id);
  if (status !== 'signedIn' || !me) return (
    <Screen title="Profile" right={<IconButton icon={Settings} label="Settings" onPress={() => router.push('/settings')} />}>
      <View className="gap-4 pt-10"><T v="h2" className="text-center">Sign in to see your profile</T><T className="text-center text-ink-muted">Your tips, advice and trips live here.</T><Button label="SIGN IN" onPress={() => router.push('/sign-up')} /></View>
    </Screen>
  );
  const name = me.name ?? 'Traveller';
  return (
    <Screen title="" right={<IconButton icon={Settings} label="Settings" onPress={() => router.push('/settings')} />}>
      <View className="items-center gap-2">
        <Avatar initials={initials(name)} size={88} />
        <T v="h2">{name}</T>
        <T v="small">{[me.handle && `@${me.handle}`, me.city].filter(Boolean).join(' · ') || 'Add a username and home city'}</T>
        {!!me.bio && <T className="text-center">{me.bio}</T>}
        <Button small variant="outline" label="Edit profile" onPress={() => router.push('/edit-profile')} />
      </View>
      <Stats items={[[p?.countries ?? 0, 'countries'], [p?.tips ?? 0, 'tips'], [p?.verifiedAdvice ?? 0, 'verified advice']]} />
      <ListRow icon={Store} title="Creator studio" subtitle="Share or sell your trip plans" onPress={() => router.push('/creator-studio')} />
      <SectionTitle>My tips</SectionTitle>
      {tips.length === 0 ? <Empty>You have not shared a tip yet. Use the + button to post your first.</Empty> : (
        <View className="flex-row flex-wrap gap-2">
          {tips.map((t) => <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={t.title} onPress={() => go(`/tip/${t.id}`)} className="w-[31.8%]"><Photo k={tipImage(t)} className="aspect-square rounded-xl" /></Pressable>)}
        </View>)}
    </Screen>
  );
}
