import { View } from 'react-native';
import { Empty, Loading, Note, Screen, T } from '@/ui';
import { PackageCard } from '@/ui/package-card';
import { errorMessage } from '@/lib/api';
import { usePackages } from '@/lib/packages';

/** Every sponsored package on show, highest ad plan first. */
export default function Packages() {
  const { data, isLoading, error } = usePackages();
  return (
    <Screen title="Travel packages">
      <T className="-mt-2 text-ink-muted">Ready-made trips from travel agencies, hotels and tour companies. These are paid listings: book directly with the company.</T>
      {isLoading && <Loading what="packages" />}
      {!!error && <Note tone="danger">{errorMessage(error)}</Note>}
      {data?.length === 0 && <Empty>No packages right now. Check back soon.</Empty>}
      <View className="gap-4">{data?.map((p) => <PackageCard key={p.id} p={p} wide />)}</View>
    </Screen>
  );
}
