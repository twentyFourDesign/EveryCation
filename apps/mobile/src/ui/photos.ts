import type { ImageKey } from '@everycation/shared';

/** Bundled sample photos. Real content will come from the CDN as URLs. */
export const photos: Record<ImageKey, number> = {
  'alpine-lake': require('../../assets/photos/alpine-lake.jpg'),
  'bali-temple': require('../../assets/photos/bali-temple.jpg'),
  'giza-traveller': require('../../assets/photos/giza-traveller.jpg'),
  'jungle-cove': require('../../assets/photos/jungle-cove.jpg'),
  'lagoon-aerial': require('../../assets/photos/lagoon-aerial.jpg'),
  'venice-canal': require('../../assets/photos/venice-canal.jpg'),
  waterfall: require('../../assets/photos/waterfall.jpg'),
  'product-0': require('../../assets/photos/product-0.jpg'),
  'product-1': require('../../assets/photos/product-1.jpg'),
  'product-2': require('../../assets/photos/product-2.jpg'),
  'product-3': require('../../assets/photos/product-3.jpg'),
};
