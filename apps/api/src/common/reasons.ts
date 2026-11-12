import { z } from 'zod';

/** Why staff removed something. The words finish the sentence "We removed your … because …". */
export const REMOVAL_REASONS = {
  misleading: 'it was misleading or inaccurate',
  spam: 'it was spam or advertising',
  offensive: 'it was offensive or abusive',
  unsafe: 'it gave unsafe or illegal advice',
  copied: 'it was copied from someone else',
  other: 'it broke the community guidelines',
} as const;
export type RemovalReason = keyof typeof REMOVAL_REASONS;
export interface Why { reason: RemovalReason; note?: string }

export const whyFields = { reason: z.enum(Object.keys(REMOVAL_REASONS) as [RemovalReason, ...RemovalReason[]]).optional(), note: z.string().trim().max(300).optional() };
/** "Other" needs a note, since on its own it tells the author nothing. */
export const whyComplete = (w: { reason?: RemovalReason; note?: string }) => !!w.reason && (w.reason !== 'other' || (w.note?.length ?? 0) >= 5);
export const WHY_MESSAGE = 'Choose why you are removing this. For "Other", write a short note for the author.';

/** What the author is told: "because it was spam or advertising. <note>" */
export const because = (w: Why) => (w.reason === 'other' && w.note ? `because: ${w.note}` : `because ${REMOVAL_REASONS[w.reason]}.${w.note ? ` ${w.note}` : ''}`).replace(/\.\.$/, '.');
/** What goes in the audit log and on staff screens. */
export const reasonLabel = (w: Why) => `${w.reason[0]!.toUpperCase()}${w.reason.slice(1)}${w.note ? `: ${w.note}` : ''}`;
