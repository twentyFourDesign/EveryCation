import { Link, Redirect, router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Mark, Photo, T } from '@/ui';
import { useSession } from '@/lib/session';

export default function Welcome() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  if (signedIn) return <Redirect href="/explore" />;
  return (
    <View className="flex-1 bg-navy">
      <Photo k="lagoon-aerial" className="absolute inset-0 opacity-40" />
      <SafeAreaView className="flex-1">
      <View className="w-full max-w-[520px] flex-1 justify-between self-center px-6 pb-4 pt-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2.5"><Mark size={36} color="#fff" /><Text className="font-pop-sb text-xl text-white">EveryCation</Text></View>
          <Link href="/explore" asChild><Pressable accessibilityRole="link" hitSlop={12}><Text className="font-pop-sb text-sm text-white">Skip</Text></Pressable></Link>
        </View>
        <View className="gap-4">
          <Text className="font-pop-sb text-xs tracking-widest text-gold">EXPLORE THE WORLD</Text>
          <T v="display" className="text-[40px] leading-[46px] text-white">PLAN. SAVE.{'\n'}TRAVEL.</T>
          <T className="text-navy-text-soft">Tips from real travellers, trip plans you can follow, and one place to keep every journey you take.</T>
          <View className="mt-4 gap-3">
            <Button label="GET STARTED" onPress={() => router.push('/sign-up')} />
            <Pressable accessibilityRole="link" onPress={() => router.push('/sign-up')} className="h-11 items-center justify-center"><Text className="font-pop-md text-sm text-white">I already have an account · <Text className="font-pop-sb text-gold">Sign in</Text></Text></Pressable>
          </View>
        </View>
      </View>
      </SafeAreaView>
    </View>
  );
}
