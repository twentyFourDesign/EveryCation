import { View } from 'react-native';
import { colors } from '@everycation/tokens';
import MapCanvas from './map-canvas';

/** Free OpenStreetMap map from OpenFreeMap. No account or key. Set EXPO_PUBLIC_MAP_STYLE_URL to use another provider's style. */
const STYLE_URL = process.env.EXPO_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/positron';
const tones = { visited: colors.navy, planned: colors.cyan, place: colors.gold } as const;
export interface Pin { id: string; lat: number; lng: number; label: string; tone: keyof typeof tones }

/** A real map with pins. `zoom` is how close to go for one pin, and the closest it will go when fitting several. */
export function MapView({ pins, height = 320, interactive = true, zoom = 4, onPin }: { pins: Pin[]; height?: number; interactive?: boolean; zoom?: number; onPin?: (id: string) => void }) {
  return (
    <View style={{ height }} className="overflow-hidden rounded-card bg-surface-muted" accessibilityLabel={`Map showing ${pins.map((p) => p.label).join(', ') || 'the world'}`}>
      <MapCanvas pins={pins.map(({ tone, ...p }) => ({ ...p, color: tones[tone] }))} styleUrl={STYLE_URL} height={height} interactive={interactive} zoom={zoom}
        onPin={async (id) => onPin?.(id)} dom={{ style: { height }, scrollEnabled: false }} />
    </View>
  );
}
