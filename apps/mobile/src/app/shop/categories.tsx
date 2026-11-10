import { router } from 'expo-router';
import { Baby, BatteryCharging, BedDouble, BriefcaseMedical, Luggage, PackageOpen, Backpack, Shirt, ShieldCheck, Smartphone, Sparkles, Star, Sun, Umbrella } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { sample } from '@everycation/shared';
import { Empty, ListRow, Screen, SearchBar } from '@/ui';

const icons = [Luggage, Backpack, PackageOpen, Sparkles, Sun, BatteryCharging, Smartphone, BedDouble, ShieldCheck, BriefcaseMedical, Umbrella, Shirt, Baby, Star];

export default function ShopCategories() {
  const [term, setTerm] = useState('');
  const list = sample.shopCategories.map((c, i) => ({ c, icon: icons[i]! })).filter((x) => x.c.toLowerCase().includes(term.toLowerCase()));
  return (
    <Screen title="Shop by category">
      <SearchBar value={term} onChangeText={setTerm} placeholder="Search travel essentials" accessibilityLabel="Search categories" />
      <View>{list.map(({ c, icon }) => <ListRow key={c} icon={icon} title={c} onPress={() => router.navigate('/shop')} />)}</View>
      {list.length === 0 && <Empty>No category matches.</Empty>}
    </Screen>
  );
}
