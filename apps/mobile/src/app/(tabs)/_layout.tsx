import { Tabs } from 'expo-router/js-tabs';
import { router } from 'expo-router';
import { Compass, Map, Plus, ShoppingBag, Wallet, type LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { colors } from '@/ui';

const tabs: Record<string, { label: string; icon: LucideIcon }> = {
  explore: { label: 'Explore', icon: Compass },
  wallet: { label: 'Wallet', icon: Wallet },
  shop: { label: 'Shop', icon: ShoppingBag },
  travels: { label: 'My travels', icon: Map },
};

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}
      tabBar={({ state, navigateToTab, insets }) => (
        <View className="flex-row items-center border-t border-line bg-white px-2 pt-1.5" style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
          {state.routes.map((route, i) => {
            const tab = tabs[route.name];
            if (!tab) return null;
            const on = state.index === i;
            const item = (
              <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={tab.label}
                onPress={() => navigateToTab(route.key)} className="h-14 flex-1 items-center justify-center gap-0.5">
                <tab.icon size={22} color={on ? colors.navy : colors.inkMuted} strokeWidth={on ? 2.4 : 1.8} />
                <Text className={on ? 'font-pop-sb text-[11px] text-navy' : 'font-pop text-[11px] text-ink-muted'}>{tab.label}</Text>
              </Pressable>
            );
            if (route.name !== 'shop') return item;
            return [
              <View key="record" className="flex-1 items-center">
                <Pressable accessibilityRole="button" accessibilityLabel="Record a tip" onPress={() => router.push('/record-tip')}
                  className="-mt-6 h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-gold active:opacity-80">
                  <Plus size={26} color={colors.ink} strokeWidth={2.4} />
                </Pressable>
              </View>,
              item,
            ];
          })}
        </View>
      )}>
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="shop" />
      <Tabs.Screen name="travels" />
    </Tabs>
  );
}
