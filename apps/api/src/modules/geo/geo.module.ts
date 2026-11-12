import { Controller, Get, Inject, Injectable, Logger, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { sql } from 'drizzle-orm';
import { CONFIG, type Config } from '../../config.js';
import { Database } from '../../db/db.module.js';

export interface PlaceHit { name: string; detail: string; label: string; countryCode: string; lat: number; lng: number; source: 'everycation' | 'map' }
interface PhotonFeature { geometry?: { coordinates?: [number, number] }; properties?: { name?: string; country?: string; countrycode?: string; state?: string; county?: string; city?: string; type?: string } }
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
const countryName = (code: string) => { try { return countryNames.of(code.toUpperCase()) ?? code; } catch { return code; } };

/**
 * Finds a place by name so a trip can be pinned exactly. Places staff added come first; the rest comes from
 * OpenStreetMap through a Photon server (GEOCODER_URL). If that server is slow or down, travellers still get our own places.
 */
@Injectable()
export class GeoService {
  private readonly log = new Logger('Geo');
  /** Recent answers, so typing the same thing twice does not ask the map service twice. */
  private readonly cache = new Map<string, { at: number; hits: PlaceHit[] }>();
  constructor(private readonly database: Database, @Inject(CONFIG) private readonly config: Config) {}

  async search(query: string): Promise<PlaceHit[]> {
    const q = query.trim().slice(0, 80);
    if (q.length < 2) return [];
    const [ours, map] = await Promise.all([this.ours(q), this.map(q)]);
    const seen = new Set<string>(); const key = (h: PlaceHit) => `${h.name.toLowerCase()}|${h.countryCode}`;
    return [...ours, ...map].filter((h) => !seen.has(key(h)) && seen.add(key(h))).slice(0, 7);
  }

  private async ours(q: string): Promise<PlaceHit[]> {
    const like = `%${q.replace(/[%_]/g, '')}%`;
    const r = await this.database.db.execute(sql`SELECT name, country_code, lat, lng FROM places WHERE published AND lat IS NOT NULL AND lng IS NOT NULL AND name ILIKE ${like} ORDER BY (name ILIKE ${like.slice(1)}) DESC, name LIMIT 3`);
    return (r.rows as { name: string; country_code: string; lat: number; lng: number }[]).map((p) => { const country = countryName(p.country_code);
      return { name: p.name, detail: country, label: p.name === country ? p.name : `${p.name}, ${country}`, countryCode: p.country_code, lat: p.lat, lng: p.lng, source: 'everycation' as const }; });
  }

  private async map(q: string): Promise<PlaceHit[]> {
    if (!this.config.GEOCODER_URL) return [];
    const k = q.toLowerCase(); const cached = this.cache.get(k);
    if (cached && Date.now() - cached.at < 86_400_000) return cached.hits;
    try {
      const res = await fetch(`${this.config.GEOCODER_URL.replace(/\/$/, '')}/api?q=${encodeURIComponent(q)}&limit=10&lang=en`, { headers: { 'user-agent': 'EveryCation/1.0 (trip place search)' }, signal: AbortSignal.timeout(4_000) });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { features?: PhotonFeature[] };
      const hits = (data.features ?? []).flatMap((f): PlaceHit[] => {
        const p = f.properties ?? {}; const c = f.geometry?.coordinates;
        // Trips go to towns, islands, regions and countries, not to a street or a single building.
        if (!p.name || !p.countrycode || !c || p.type === 'house' || p.type === 'street') return [];
        const country = p.country ?? countryName(p.countrycode); const region = [p.city, p.county, p.state].find((x) => x && x !== p.name);
        const detail = p.type === 'country' ? 'Country' : [region, country].filter(Boolean).join(', ');
        return [{ name: p.name, detail, label: p.type === 'country' || p.name === country ? p.name : `${p.name}, ${country}`, countryCode: p.countrycode.toUpperCase(), lat: Number(c[1].toFixed(5)), lng: Number(c[0].toFixed(5)), source: 'map' }];
      });
      if (this.cache.size > 2_000) this.cache.clear();
      this.cache.set(k, { at: Date.now(), hits });
      return hits;
    } catch (e) { this.log.warn(`Place search is unavailable: ${(e as Error).message}`); return []; }
  }
}

@ApiTags('geo') @ApiBearerAuth()
@Controller('geo')
class GeoController {
  constructor(private readonly geo: GeoService) {}
  /** Suggestions while the traveller types where they are going. */
  @Throttle({ default: { limit: 60, ttl: 60_000 } }) @Get('search') search(@Query('q') q?: string) { return this.geo.search(q ?? ''); }
}

@Module({ controllers: [GeoController], providers: [GeoService], exports: [GeoService] })
export class GeoModule {}
