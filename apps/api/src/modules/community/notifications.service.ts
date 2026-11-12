import { Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { Database } from '../../db/db.module.js';
import { notifications } from '../../db/schema.js';

@Injectable()
export class NotificationsService {
  constructor(private readonly database: Database) {}
  private get db() { return this.database.db; }

  async list(userId: string) {
    const items = await this.db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(100);
    return { unread: items.filter((n) => !n.readAt).length, items: items.map((n) => ({ id: n.id, type: n.type, text: n.text, href: n.href, read: !!n.readAt, at: n.createdAt })) };
  }
  async unread(userId: string) {
    const [r] = await this.db.select({ n: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return { unread: r?.n ?? 0 };
  }
  /** Tapping a notification counts it as read. */
  async markRead(userId: string, id: string) { await this.db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, userId), isNull(notifications.readAt))); }
  async markAllRead(userId: string) { await this.db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt))); }
}
