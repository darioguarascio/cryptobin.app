import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { sharedInboxMembers } from '@/db/schema';
import { normalizeHandle } from '@/lib/handles';
import { getSessionUser } from '@/lib/server/auth';
import { requireSharedInboxOwner } from '@/lib/server/sharedInboxAccess';

export const DELETE: APIRoute = async ({ params, request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const slug = normalizeHandle(params.slug ?? '');
  const memberUserId = params.userId;
  if (!slug || !memberUserId) {
    return Response.json({ error: 'Slug and member id required.' }, { status: 400 });
  }

  try {
    const membership = await requireSharedInboxOwner(user.id, slug);
    if (memberUserId === user.id) {
      return Response.json({ error: 'Transfer ownership before leaving.' }, { status: 400 });
    }

    const db = getDb();
    const result = await db
      .delete(sharedInboxMembers)
      .where(
        and(
          eq(sharedInboxMembers.inboxId, membership.inbox.id),
          eq(sharedInboxMembers.userId, memberUserId),
          eq(sharedInboxMembers.role, 'member'),
        ),
      )
      .returning({ userId: sharedInboxMembers.userId });

    if (!result.length) {
      return Response.json({ error: 'Member not found.' }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_OWNER') {
      return Response.json({ error: 'Only the owner can remove members.' }, { status: 403 });
    }

    return Response.json({ error: 'Unable to remove member.' }, { status: 500 });
  }
};

export const prerender = false;
