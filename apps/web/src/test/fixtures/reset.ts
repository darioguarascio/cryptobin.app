import { sql } from 'drizzle-orm';
import { getDb } from '@/db';

export async function resetDatabase(): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    TRUNCATE TABLE
      shared_inbox_drops,
      shared_inbox_invites,
      shared_inbox_members,
      shared_inboxes,
      vault_entries,
      inbox_drops,
      sessions,
      users
    RESTART IDENTITY CASCADE
  `);
}
