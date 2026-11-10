import type { Tx } from '../db/db.module.js';
import type { Database } from '../db/db.module.js';
import { notifications } from '../db/schema.js';

export type NotificationType = 'community' | 'wallet' | 'trips' | 'shop';
/** Writes an in-app notification, inside the caller's transaction when one is passed. */
export async function notify(db: Tx | Database['db'], userId: string, type: NotificationType, text: string, href?: string) {
  await db.insert(notifications).values({ userId, type, text, href });
}
