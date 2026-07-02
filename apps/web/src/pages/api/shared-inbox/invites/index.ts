import type { APIRoute } from 'astro';
import { and, desc, eq, gt } from 'drizzle-orm';
import { getDb } from '@/db';
import { sharedInboxInvites, sharedInboxes, users } from '@/db/schema';
import { getSessionUser } from '@/lib/server/auth';

export const GET: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const now = new Date();
  const rows = await db
    .select({
      id: sharedInboxInvites.id,
      slug: sharedInboxes.slug,
      name: sharedInboxes.name,
      invitedByHandle: users.handle,
      expiresAt: sharedInboxInvites.expiresAt,
      wrappedPrivateKey: sharedInboxInvites.wrappedPrivateKey,
    })
    .from(sharedInboxInvites)
    .innerJoin(sharedInboxes, eq(sharedInboxInvites.inboxId, sharedInboxes.id))
    .innerJoin(users, eq(sharedInboxInvites.invitedBy, users.id))
    .where(
      and(
        eq(sharedInboxInvites.inviteeId, user.id),
        eq(sharedInboxInvites.status, 'pending'),
        gt(sharedInboxInvites.expiresAt, now),
      ),
    )
    .orderBy(desc(sharedInboxInvites.createdAt));

  return Response.json({
    items: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      invitedByHandle: row.invitedByHandle,
      expiresAt: row.expiresAt.toISOString(),
      wrappedPrivateKey: row.wrappedPrivateKey,
    })),
  });
};

export const prerender = false;
