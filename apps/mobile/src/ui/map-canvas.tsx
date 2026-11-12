'use dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';

export interface MapPin { id: string; lat: number; lng: number; label: string; color: string }

/**
 * The map itself. It is web code (MapLibre) so the same map runs in the browser and, inside a web view,
 * on iPhone and Android. Use <MapView> from '@/ui/map' rather than this file directly.
 */
export default function MapCanvas({ pins, styleUrl, height, interactive, zoom, onPin }: {
  pins: MapPin[]; styleUrl: string; height: number; interactive: boolean; zoom: number;
  onPin: (id: string) => Promise<void>; dom?: import('expo/dom').DOMProps;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const tap = useRef(onPin);
  const [failed, setFailed] = useState(false);
  useEffect(() => { tap.current = onPin; }, [onPin]);

  useEffect(() => {
    if (!box.current) return;
    let loaded = false;
    const m = new maplibregl.Map({ container: box.current, style: styleUrl, center: [15, 12], zoom: 0.6, interactive, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, touchPitch: false, renderWorldCopies: true });
    m.touchZoomRotate.disableRotation();
    if (interactive) m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.on('load', () => { loaded = true; setFailed(false); });
    m.on('error', () => { if (!loaded) setFailed(true); });
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, [styleUrl, interactive]);

  const key = JSON.stringify(pins);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const list: MapPin[] = JSON.parse(key);
    const markers = list.map((p) => {
      const el = document.createElement('button');
      el.type = 'button'; el.setAttribute('aria-label', p.label); el.title = p.label;
      el.style.cssText = `width:22px;height:22px;border-radius:50%;background:${p.color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);padding:0;cursor:pointer`;
      el.addEventListener('click', (e) => { e.stopPropagation(); void tap.current(p.id); });
      return new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(m);
    });
    if (list.length === 1) m.jumpTo({ center: [list[0]!.lng, list[0]!.lat], zoom });
    else if (list.length > 1) {
      const b = new maplibregl.LngLatBounds();
      list.forEach((p) => b.extend([p.lng, p.lat]));
      m.fitBounds(b, { padding: 44, maxZoom: zoom, animate: false });
    }
    return () => markers.forEach((x) => x.remove());
  }, [key, zoom]);

  return (
    <div style={{ position: 'relative', width: '100%', height, background: '#F1F1F1' }}>
      <div ref={box} style={{ position: 'absolute', inset: 0 }} />
      {failed && <p role="status" style={{ position: 'absolute', left: 8, right: 8, bottom: 8, margin: 0, padding: '8px 12px', borderRadius: 12, background: '#fff', font: '13px/18px system-ui, sans-serif', color: '#333' }}>The map could not load. Check your connection.</p>}
    </div>
  );
}
