import { router } from 'expo-router';
import { Settings, Share2 } from 'lucide-react-native';
import { IconStore } from '@/ui/icons';
import { Share, View } from 'react-native';
import { Avatar, Button, IconButton, ListRow, Screen, Stats, T } from '@/ui';
import { initials, useProfile } from '@/lib/community';
import { useSession } from '@/lib/session';
import { ProfilePosts } from '@/ui/profile-posts';

const since = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : '');

export default function Profile() {
  const { me, status } = useSession();
  const { data: p } = useProfile(me?.id);
  const gear = <IconButton icon={Settings} label="Settings" onPress={() => router.push('/settings')} />;
  if (status !== 'signedIn' || !me) return (
    <Screen title="Profile" right={gear}>
      <View className="gap-4 pt-10"><T v="h2" className="text-center">Sign in to see your profile</T><T className="text-center text-ink-muted">Your moments, tips, advice and trips live here.</T><Button label="SIGN IN" onPress={() => router.push('/sign-up')} /></View>
    </Screen>
  );
  const name = me.name ?? 'Traveller';
  const line = [me.handle && `@${me.handle}`, me.showCity ? me.city : null].filter(Boolean).join(' · ');
  return (
    <Screen title="" right={<View className="flex-row"><IconButton icon={Share2} label="Share profile" onPress={() => Share.share({ message: `${name} on EveryCation${me.handle ? ` · @${me.handle}` : ''}` })} />{gear}</View>}>
      <View className="items-center gap-2">
        <Avatar initials={initials(name)} uri={me.avatarUrl} size={96} onPress={() => router.push('/edit-profile')} label="Change your profile photo" />
        <T v="h2">{name}</T>
        <T v="small">{line || 'Add a username and home city'}</T>
        {!!me.bio && <T className="text-center">{me.bio}</T>}
        {!!me.memberSince && <T v="small" className="text-xs">Member since {since(me.memberSince)}</T>}
        <View className="flex-row gap-2 pt-1">
          <Button small variant="outline" label="Edit profile" onPress={() => router.push('/edit-profile')} />
          <Button small variant="outline" label="Settings" onPress={() => router.push('/settings')} />
        </View>
      </View>
      <Stats items={[[p?.countries ?? 0, 'countries'], [p?.tips ?? 0, 'tips'], [p?.verifiedAdvice ?? 0, 'verified advice']]} />
      <ListRow icon={IconStore} title="Creator studio" subtitle="Share or sell your trip plans" onPress={() => router.push('/creator-studio')} />
      <ProfilePosts userId={me.id} mine />
    </Screen>
  );
}
