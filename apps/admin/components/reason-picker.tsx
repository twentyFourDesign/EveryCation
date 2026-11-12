'use client';
import { Field, Input, Select } from './ui';

export const REASONS = [['misleading', 'Misleading or inaccurate'], ['spam', 'Spam or advertising'], ['offensive', 'Offensive or abusive'], ['unsafe', 'Unsafe or illegal advice'], ['copied', 'Copied from someone else'], ['other', 'Other (write a note)']] as const;
export type Reason = (typeof REASONS)[number][0];
export interface Why { reason: Reason | ''; note: string }
export const noWhy: Why = { reason: '', note: '' };
/** A removal needs a reason, and "Other" needs a note, because the author is told why. */
export const whyReady = (w: Why) => !!w.reason && (w.reason !== 'other' || w.note.trim().length >= 5);
export const whyBody = (w: Why) => ({ reason: w.reason, note: w.note.trim() || undefined });

/** Why staff are removing something. The author sees the reason and the note. */
export function ReasonPicker({ value, onChange }: { value: Why; onChange: (w: Why) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Reason the author will see"><Select value={value.reason} onChange={(e) => onChange({ ...value, reason: e.target.value as Reason | '' })}><option value="">Choose a reason</option>{REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
      <Field label={value.reason === 'other' ? 'Note for the author' : 'Note for the author (optional)'} hint="Shown to the author after the reason. Keep it short and specific."><Input value={value.note} maxLength={300} onChange={(e) => onChange({ ...value, note: e.target.value })} placeholder="Nigerians need a visa for Dubai." /></Field>
    </div>
  );
}
