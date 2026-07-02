import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { sharedInboxInvites, sharedInboxMembers } from '@/db/schema';
import { normalizeHandle } from '@/lib/handles';
import { INBOX_ALGORITHM } from '@/lib/inboxCrypto';
import { getSessionUser } from '@/lib/server/auth';
import { getUserByHandle, requireSharedInboxOwner } from '@/lib/server/sharedInboxAccess';

const inviteSchema = z.object({
  inviteeHandle: z.string().min(3).max(64),
  wrappedPrivateKey: z.object({
    algorithm: z.literal(INBOX_ALGORITHM),
    iv: z.string().min(12),
    ciphertext: z.string().min(16),
    wrappedKey: z.string().min(16),
  }),
});

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const POST: APIRoute = async ({ params, request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const slug = normalizeHandle(params.slug ?? '');
  if (!slug) {
    return Response.json({ error: 'Slug required.' }, { status: 400 });
  }

  try {
    const membership = await requireSharedInboxOwner(user.id, slug);
    const body = inviteSchema.parse(await request.json());
    const inviteeHandle = normalizeHandle(body.inviteeHandle);

    if (inviteeHandle === user.handle) {
      return Response.json({ error: 'You are already a member.' }, { status: 400 });
    }

    const invitee = await getUserByHandle(inviteeHandle);
    if (!invitee) {
      return Response.json({ error: 'That account does not exist yet.' }, { status: 404 });
    }

    const db = getDb();
    const [existingMember] = await db
      .select({ userId: sharedInboxMembers.userId })
      .from(sharedInboxMembers)
      .where(
        and(
          eq(sharedInboxMembers.inboxId, membership.inbox.id),
          eq(sharedInboxMembers.userId, invitee.id),
        ),
      )
      .limit(1);

    if (existingMember) {
      return Response.json({ error: 'That user is already a member.' }, { status: 409 });
    }

    const [pendingInvite] = await db
      .select({ id: sharedInboxInvites.id })
      .from(sharedInboxInvites)
      .where(
        and(
          eq(sharedInboxInvites.inboxId, membership.inbox.id),
          eq(sharedInboxInvites.inviteeId, invitee.id),
          eq(sharedInboxInvites.status, 'pending'),
        ),
      )
      .limit(1);

    if (pendingInvite) {
      return Response.json({ error: 'An invite is already pending for that user.' }, { status: 409 });
    }

    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const [created] = await db
      .insert(sharedInboxInvites)
      .values({
        inboxId: membership.inbox.id,
        inviteeHandle: invitee.handle,
        inviteeId: invitee.id,
        invitedBy: user.id,
        wrappedPrivateKey: body.wrappedPrivateKey,
        expiresAt,
      })
      .returning({
        id: sharedInboxInvites.id,
        expiresAt: sharedInboxInvites.expiresAt,
      });

    return Response.json(
      {
        id: created.id,
        inviteeHandle: invitee.handle,
        expiresAt: created.expiresAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Invalid invite payload.' }, { status: 400 });
    }

    if (error instanceof Error && error.message === 'NOT_OWNER') {
      return Response.json({ error: 'Only the owner can invite members.' }, { status: 403 });
    }

    return Response.json({ error: 'Unable to create invite.' }, { status: 500 });
  }
};

export const prerender = false;
