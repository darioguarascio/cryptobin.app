import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { inboxDrops } from '@/db/schema';
import { getSessionUser } from '@/lib/server/auth';

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
    .select()
    .from(inboxDrops)
    .where(and(eq(inboxDrops.id, id), eq(inboxDrops.recipientId, user.id)))
    .limit(1);

  if (!item) {
    return Response.json({ error: 'Inbox item not found.' }, { status: 404 });
  }

  if (!item.readAt) {
    await db
      .update(inboxDrops)
      .set({ readAt: new Date() })
      .where(eq(inboxDrops.id, item.id));
  }

  return Response.json({
    id: item.id,
    algorithm: item.algorithm,
    iv: item.iv,
    ciphertext: item.ciphertext,
    wrappedKey: item.wrappedKey,
    metadataPreview: item.metadataPreview,
    createdAt: item.createdAt.toISOString(),
    readAt: (item.readAt ?? new Date()).toISOString(),
  });
};

export const DELETE: APIRoute = async ({ params, request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = params.id;
  if (!id) {
    return Response.json({ error: 'Drop id required.' }, { status: 400 });
  }

  const db = getDb();
  const result = await db
    .delete(inboxDrops)
    .where(and(eq(inboxDrops.id, id), eq(inboxDrops.recipientId, user.id)))
    .returning({ id: inboxDrops.id });

  if (!result.length) {
    return Response.json({ error: 'Inbox item not found.' }, { status: 404 });
  }

  return Response.json({ ok: true });
};

export const prerender = false;
