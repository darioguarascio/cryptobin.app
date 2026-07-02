import type { APIRoute } from 'astro';
import { and, eq, gt } from 'drizzle-orm';
import { getDb } from '@/db';
import { sharedInboxInvites, sharedInboxMembers, sharedInboxes } from '@/db/schema';
import { getSessionUser } from '@/lib/server/auth';

export const POST: APIRoute = async ({ params, request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = params.id;
  if (!id) {
    return Response.json({ error: 'Invite id required.' }, { status: 400 });
  }

  const db = getDb();
  const now = new Date();
  const [invite] = await db
    .select()
    .from(sharedInboxInvites)
    .where(
      and(
        eq(sharedInboxInvites.id, id),
        eq(sharedInboxInvites.inviteeId, user.id),
        eq(sharedInboxInvites.status, 'pending'),
        gt(sharedInboxInvites.expiresAt, now),
      ),
    )
    .limit(1);

  if (!invite) {
    return Response.json({ error: 'Invite not found.' }, { status: 404 });
  }

  const [existingMember] = await db
    .select({ userId: sharedInboxMembers.userId })
    .from(sharedInboxMembers)
    .where(
      and(
        eq(sharedInboxMembers.inboxId, invite.inboxId),
        eq(sharedInboxMembers.userId, user.id),
      ),
    )
    .limit(1);

  if (existingMember) {
    await db
      .update(sharedInboxInvites)
      .set({ status: 'accepted' })
      .where(eq(sharedInboxInvites.id, invite.id));
    const [inbox] = await db
      .select({ slug: sharedInboxes.slug })
      .from(sharedInboxes)
      .where(eq(sharedInboxes.id, invite.inboxId))
      .limit(1);
    return Response.json({ ok: true, slug: inbox?.slug ?? null });
  }

  await db.insert(sharedInboxMembers).values({
    inboxId: invite.inboxId,
    userId: user.id,
    role: 'member',
    wrappedPrivateKey: invite.wrappedPrivateKey,
  });

  await db
    .update(sharedInboxInvites)
    .set({ status: 'accepted' })
    .where(eq(sharedInboxInvites.id, invite.id));

  const [inbox] = await db
    .select({ slug: sharedInboxes.slug })
    .from(sharedInboxes)
    .where(eq(sharedInboxes.id, invite.inboxId))
    .limit(1);

  return Response.json({ ok: true, slug: inbox?.slug ?? null });
};

export const DELETE: APIRoute = async ({ params, request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = params.id;
  if (!id) {
    return Response.json({ error: 'Invite id required.' }, { status: 400 });
  }

  const db = getDb();
  const result = await db
    .update(sharedInboxInvites)
    .set({ status: 'declined' })
    .where(
      and(
        eq(sharedInboxInvites.id, id),
        eq(sharedInboxInvites.inviteeId, user.id),
        eq(sharedInboxInvites.status, 'pending'),
      ),
    )
    .returning({ id: sharedInboxInvites.id });

  if (!result.length) {
    return Response.json({ error: 'Invite not found.' }, { status: 404 });
  }

  return Response.json({ ok: true });
};

export const prerender = false;
