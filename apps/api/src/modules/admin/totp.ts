import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Time-based one-time codes (RFC 6238), as used by Google Authenticator, 1Password and Authy. */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function newTotpSecret(): string {
  let bits = ''; for (const byte of randomBytes(20)) bits += byte.toString(2).padStart(8, '0');
  return (bits.match(/.{5}/g) ?? []).map((b) => ALPHABET[parseInt(b, 2)]).join('');
}
function decode(secret: string): Buffer {
  let bits = ''; for (const c of secret.replace(/=+$/, '').toUpperCase()) { const v = ALPHABET.indexOf(c); if (v < 0) throw new Error('Bad TOTP secret'); bits += v.toString(2).padStart(5, '0'); }
  return Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
}
export function totpCode(secret: string, at = Date.now()): string {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const mac = createHmac('sha1', decode(secret)).update(counter).digest();
  const offset = mac[mac.length - 1]! & 0xf;
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
/** Accepts the current code and the ones either side, to allow for a clock that is a little off. */
export function totpValid(secret: string, code: string, at = Date.now()): boolean {
  const given = Buffer.from(code.replace(/\s/g, ''));
  return [-1, 0, 1].some((step) => { const want = Buffer.from(totpCode(secret, at + step * 30_000)); return given.length === want.length && timingSafeEqual(given, want); });
}
export const otpauthUrl = (email: string, secret: string) => `otpauth://totp/EveryCation%20Admin:${encodeURIComponent(email)}?secret=${secret}&issuer=EveryCation%20Admin`;
