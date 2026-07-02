import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { sharedInboxDrops, sharedInboxes } from '@/db/schema';
import { getSessionUser } from '@/lib/server/auth';
import { getSharedInboxMembership } from '@/lib/server/sharedInboxAccess';

export const GET: APIRoute = async ({ params, request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = params.id;
  if (!id) {
    return Response.json({ error: 'Drop id required.' }, { status: 400 });
  }

  const db = getDb();
  const [item] = await db
    .select({
      drop: sharedInboxDrops,
      slug: sharedInboxes.slug,
    })
    .from(sharedInboxDrops)
    .innerJoin(sharedInboxes, eq(sharedInboxDrops.inboxId, sharedInboxes.id))
    .where(eq(sharedInboxDrops.id, id))
    .limit(1);

  if (!item) {
    return Response.json({ error: 'Drop not found.' }, { status: 404 });
  }

  const membership = await getSharedInboxMembership(user.id, item.slug);
  if (!membership) {
    return Response.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const readBy = { ...(item.drop.readBy ?? {}) };
  if (!readBy[user.id]) {
    readBy[user.id] = new Date().toISOString();
    await db
      .update(sharedInboxDrops)
      .set({ readBy })
      .where(eq(sharedInboxDrops.id, item.drop.id));
  }

  return Response.json({
    id: item.drop.id,
    algorithm: item.drop.algorithm,
    iv: item.drop.iv,
    ciphertext: item.drop.ciphertext,
    wrappedKey: item.drop.wrappedKey,
    metadataPreview: item.drop.metadataPreview,
    createdAt: item.drop.createdAt.toISOString(),
    readAt: readBy[user.id],
  });
};

export const prerender = false;
