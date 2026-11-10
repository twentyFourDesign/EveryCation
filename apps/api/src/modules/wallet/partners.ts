import { Injectable } from '@nestjs/common';

export interface IdentityResult { matched: boolean; legalName?: string; reason?: string }

/** Checks a BVN or NIN with the KYC partner (Smile ID, Dojah, Prembly…). The number is never stored. */
export abstract class IdentityVerifier {
  abstract verify(input: { method: 'BVN' | 'NIN'; number: string; dateOfBirth: string }): Promise<IdentityResult>;
}
/** Looks up the name on a bank account with the wallet partner. */
export abstract class BankDirectory {
  abstract resolve(bankName: string, accountNumber: string): Promise<{ accountName: string } | null>;
}

/**
 * Sandbox stand-ins used until a partner is chosen.
 * A number starting 000 fails the check; an account number starting 999 does not exist.
 */
@Injectable()
export class SandboxIdentityVerifier extends IdentityVerifier {
  async verify({ number }: { number: string }): Promise<IdentityResult> {
    return number.startsWith('000') ? { matched: false, reason: 'Date of birth did not match.' } : { matched: true, legalName: 'OLUWOLE OLAREWAJU' };
  }
}
@Injectable()
export class SandboxBankDirectory extends BankDirectory {
  async resolve(_bank: string, accountNumber: string) {
    if (accountNumber.startsWith('999')) return null;
    return { accountName: accountNumber.startsWith('111') ? 'SOMEONE ELSE' : 'OLUWOLE OLAREWAJU' };
  }
}

/** True when two names share at least two words, ignoring order and case ("Olarewaju Oluwole A." matches). */
export function namesMatch(a: string, b: string) {
  const words = (s: string) => new Set(s.toUpperCase().replace(/[^A-Z\s]/g, '').split(/\s+/).filter((w) => w.length > 1));
  const wa = words(a); let shared = 0;
  for (const w of words(b)) if (wa.has(w)) shared++;
  return shared >= 2;
}
