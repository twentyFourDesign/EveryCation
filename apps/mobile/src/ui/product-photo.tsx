import { Package } from 'lucide-react-native';
import { View } from 'react-native';
import { colors } from '@everycation/tokens';
import { productImage } from '@/lib/shop';
import { Photo, cx } from './index';

/** A product's photo, or a plain tile when it has none yet. */
export function ProductPhoto({ p, className }: { p: { imageKey: string | null }; className?: string }) {
  const k = productImage(p);
  return k ? <Photo k={k} className={className} /> : <View className={cx('items-center justify-center bg-tint', className)}><Package size={32} color={colors.navy} /></View>;
}
