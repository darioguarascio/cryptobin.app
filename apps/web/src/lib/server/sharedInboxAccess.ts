import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import {
  sharedInboxMembers,
  sharedInboxes,
  users,
  type SharedInbox,
} from '@/db/schema';
import {
  normalizeMembershipRole,
  requireMembership,
  requireOwnerMembership,
  type SharedInboxMembership,
} from '@/lib/sharedInboxRoles';

export type { SharedInboxMembership };

export async function getSharedInboxBySlug(slug: string): Promise<SharedInbox | null> {
  const db = getDb();
  const [inbox] = await db
    .select()
    .from(sharedInboxes)
    .where(eq(sharedInboxes.slug, slug))
    .limit(1);
  return inbox ?? null;
}

export async function getSharedInboxMembership(
  userId: string,
  slug: string,
): Promise<SharedInboxMembership | null> {
  const db = getDb();
  const [row] = await db
    .select({
      inbox: sharedInboxes,
      role: sharedInboxMembers.role,
    })
    .from(sharedInboxMembers)
    .innerJoin(sharedInboxes, eq(sharedInboxMembers.inboxId, sharedInboxes.id))
    .where(and(eq(sharedInboxes.slug, slug), eq(sharedInboxMembers.userId, userId)))
    .limit(1);

  if (!row) return null;

  return {
    inbox: row.inbox,
    role: normalizeMembershipRole(row.role),
  };
}

export async function requireSharedInboxMember(
  userId: string,
  slug: string,
): Promise<SharedInboxMembership> {
  return requireMembership(await getSharedInboxMembership(userId, slug));
}

export async function requireSharedInboxOwner(
  userId: string,
  slug: string,
): Promise<SharedInboxMembership> {
  return requireOwnerMembership(await requireSharedInboxMember(userId, slug));
}

export async function getMemberPublicKey(userId: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ publicKey: users.publicKey })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.publicKey ?? null;
}

export async function getUserByHandle(handle: string): Promise<{ id: string; handle: string; publicKey: string } | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: users.id, handle: users.handle, publicKey: users.publicKey })
    .from(users)
    .where(eq(users.handle, handle))
    .limit(1);
  return row ?? null;
}
