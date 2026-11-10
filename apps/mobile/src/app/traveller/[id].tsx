import { router, useLocalSearchParams } from 'expo-router';
import { Share2 } from 'lucide-react-native';
import { Pressable, Share, View } from 'react-native';
import { Avatar, Button, Empty, IconButton, Loading, Note, Photo, Screen, SectionTitle, Stats, T, go } from '@/ui';
import { errorMessage } from '@/lib/api';
import { initials, tipImage, tipPhoto, useFollow, useTipsBy, useTraveller } from '@/lib/community';
import { useSession } from '@/lib/session';

export default function TravellerProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: t, isLoading, error } = useTraveller(id);
  const { data: tips = [] } = useTipsBy(id);
  const follow = useFollow();
  const signedIn = useSession((s) => s.status === 'signedIn');
  if (isLoading) return <Screen title=""><Loading what="this profile" /></Screen>;
  if (!t) return <Screen title="Traveller"><Note tone="danger">{error ? errorMessage(error) : 'This traveller could not be found.'}</Note></Screen>;
  const share = () => Share.share({ message: `${t.name} on EveryCation${t.handle ? ` · @${t.handle}` : ''}` });
  return (
    <Screen title="" right={<IconButton icon={Share2} label="Share profile" onPress={share} />}>
      <View className="items-center gap-2">
        <Avatar initials={initials(t.name)} size={88} />
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
      <SectionTitle>Tips</SectionTitle>
      {tips.length === 0 ? <Empty>No tips yet.</Empty> : (
        <View className="flex-row flex-wrap gap-2">
          {tips.map((tip) => <Pressable key={tip.id} accessibilityRole="button" accessibilityLabel={tip.title} onPress={() => go(`/tip/${tip.id}`)} className="w-[31.8%]"><Photo k={tipImage(tip)} uri={tipPhoto(tip)} className="aspect-square rounded-xl" /></Pressable>)}
        </View>)}
    </Screen>
  );
}
