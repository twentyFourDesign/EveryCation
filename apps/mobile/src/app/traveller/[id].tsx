import { router, useLocalSearchParams } from 'expo-router';
import { Share2 } from 'lucide-react-native';
import { Share, View } from 'react-native';
import { Avatar, Button, IconButton, Loading, Note, Screen, Stats, T } from '@/ui';
import { ProfilePosts } from '@/ui/profile-posts';
import { errorMessage } from '@/lib/api';
import { initials, useFollow, useTraveller } from '@/lib/community';
import { useSession } from '@/lib/session';

export default function TravellerProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: t, isLoading, error } = useTraveller(id);
  const follow = useFollow();
  const signedIn = useSession((s) => s.status === 'signedIn');
  if (isLoading) return <Screen title=""><Loading what="this profile" /></Screen>;
  if (!t) return <Screen title="Traveller"><Note tone="danger">{error ? errorMessage(error) : 'This traveller could not be found.'}</Note></Screen>;
  const share = () => Share.share({ message: `${t.name} on EveryCation${t.handle ? ` · @${t.handle}` : ''}` });
  return (
    <Screen title="" right={<IconButton icon={Share2} label="Share profile" onPress={share} />}>
      <View className="items-center gap-2">
        <Avatar initials={initials(t.name)} uri={t.avatarUrl} size={88} />
        <T v="h2">{t.name}</T>
        {(t.handle || t.city) && <T v="small">{[t.handle && `@${t.handle}`, t.city].filter(Boolean).join(' · ')}</T>}
        {!!t.bio && <T className="text-center">{t.bio}</T>}
      </View>
      <Stats items={[[t.countries, 'countries'], [t.tips, 'tips'], [t.followers, 'followers'], [t.verifiedAdvice, 'verified advice']]} />
      {t.isMe ? <Button variant="outline" label="Edit profile" onPress={() => router.push('/edit-profile')} /> : (
        <View className="flex-row gap-3">
          <Button className="flex-1" disabled={follow.isPending} variant={t.followedByMe ? 'outline' : 'primary'} label={t.followedByMe ? 'FOLLOWING' : 'FOLLOW'} onPress={() => (signedIn ? follow.mutate(t.id) : router.push('/sign-up'))} />
          <Button className="flex-1" variant="outline" label="Share profile" onPress={share} />
        </View>
      )}
      <ProfilePosts userId={t.id} mine={t.isMe} />
    </Screen>
  );
}
