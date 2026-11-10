import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { badRequest } from '../../common/errors.js';
import { CONFIG, type Config } from '../../config.js';
import { Database } from '../../db/db.module.js';
import { media } from '../../db/schema.js';

/** Where files are kept. Swap this class for an S3 one in production; nothing else changes. */
export abstract class MediaStorage {
  abstract put(key: string, data: Buffer, contentType: string): Promise<void>;
  abstract url(key: string): string;
}
@Injectable()
export class DiskStorage extends MediaStorage {
  readonly root: string; private readonly base: string;
  constructor(@Inject(CONFIG) config: Config) { super(); this.root = resolve(config.MEDIA_DIR); this.base = (config.PUBLIC_URL ?? `http://localhost:${config.PORT}`).replace(/\/$/, ''); }
  async put(key: string, data: Buffer) { const file = join(this.root, key); await mkdir(dirname(file), { recursive: true }); await writeFile(file, data); }
  url(key: string) { return `${this.base}/media/${key}`; }
}

type Kind = 'image' | 'video' | 'audio';
const MB = 1024 * 1024;
const LIMITS: Record<Kind, number> = { image: 8 * MB, video: 60 * MB, audio: 15 * MB };
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/webm': 'webm', 'audio/x-m4a': 'm4a' };

/** The file's real type from its first bytes. The type a client claims is not trusted. */
function sniff(b: Buffer): string | null {
  const hex = b.subarray(0, 12).toString('hex'); const ascii = b.subarray(0, 12).toString('latin1');
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (hex.startsWith('89504e470d0a1a0a')) return 'image/png';
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'image/webp';
  if (ascii.slice(4, 8) === 'ftyp') { const brand = ascii.slice(8, 12); return brand.startsWith('qt') ? 'video/quicktime' : brand.startsWith('M4A') ? 'audio/mp4' : 'video/mp4'; }
  if (hex.startsWith('1a45dfa3')) return 'video/webm';
  if (hex.startsWith('494433') || hex.startsWith('fffb') || hex.startsWith('fff3')) return 'audio/mpeg';
  return null;
}

@Injectable()
export class MediaService {
  constructor(private readonly database: Database, private readonly storage: MediaStorage) {}

  async upload(userId: string, file: { buffer: Buffer; mimetype: string; size: number } | undefined) {
    if (!file?.buffer?.length) throw badRequest('file_required', 'Choose a photo or video to upload.');
    const real = sniff(file.buffer);
    // A WebM file can hold video or sound; trust the claimed family only to tell those two apart.
    const contentType = real === 'video/webm' && file.mimetype.startsWith('audio/') ? 'audio/webm' : real;
    if (!contentType || !EXT[contentType]) throw badRequest('file_type', 'Use a JPEG, PNG or WebP photo, or an MP4 or MOV video.');
    const kind = contentType.split('/')[0] as Kind;
    if (file.size > LIMITS[kind]) throw badRequest('file_too_large', `That ${kind === 'image' ? 'photo' : kind} is too large. The limit is ${LIMITS[kind] / MB} MB.`);
    const now = new Date(); const id = randomUUID();
    const key = `tips/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${id}.${EXT[contentType]}`;
    await this.storage.put(key, file.buffer, contentType);
    await this.database.db.insert(media).values({ id, userId, kind, contentType, size: file.size, key });
    return { id, kind, url: this.storage.url(key) };
  }

  /** Media a user may attach: it must be their own upload. */
  async owned(userId: string, id: string) {
    const [m] = await this.database.db.select().from(media).where(and(eq(media.id, id), eq(media.userId, userId)));
    return m ?? null;
  }
  async views(ids: string[]) {
    if (!ids.length) return new Map<string, { kind: string; url: string }>();
    const rows = await this.database.db.select().from(media).where(inArray(media.id, ids));
    return new Map(rows.map((m) => [m.id, { kind: m.kind, url: this.storage.url(m.key) }]));
  }
}
