import { Pressable, Text, View } from 'react-native';
import { Empty, Loading, Note, Photo, Screen } from '@/ui';
import { errorMessage } from '@/lib/api';
import { countryName, placeImage, usePlaces } from '@/lib/community';
import { go } from '@/ui';

export default function Places() {
  const { data, isLoading, error } = usePlaces();
  return (
    <Screen title="Places">
      {isLoading && <Loading what="places" />}
      {!!error && <Note tone="danger">{errorMessage(error)}</Note>}
      {data?.length === 0 && <Empty>No places have been published yet.</Empty>}
      {data?.map((p) => (
        <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`${p.name}, ${countryName(p.countryCode)}`} onPress={() => go(`/place/${p.id}`)} className="overflow-hidden rounded-card active:opacity-80">
          <Photo k={placeImage(p)} className="h-[160px]" />
          <View className="absolute bottom-0 left-0 right-0 bg-navy/80 px-4 py-2.5"><Text className="font-pop-sb text-[11px] tracking-widest text-gold">{p.kind.toUpperCase()} · {countryName(p.countryCode).toUpperCase()}</Text><Text className="font-pop-sb text-lg text-white">{p.name}</Text></View>
        </Pressable>
      ))}
    </Screen>
  );
}
