import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { vaultEntries } from '@/db/schema';
import { getSessionUser } from '@/lib/server/auth';

export const DELETE: APIRoute = async ({ params, request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = params.id;
  if (!id) {
    return Response.json({ error: 'Vault entry id required.' }, { status: 400 });
  }

  const db = getDb();
  const result = await db
    .delete(vaultEntries)
    .where(and(eq(vaultEntries.id, id), eq(vaultEntries.userId, user.id)))
    .returning({ id: vaultEntries.id });

  if (!result.length) {
    return Response.json({ error: 'Vault entry not found.' }, { status: 404 });
  }

  return Response.json({ ok: true });
};

export const prerender = false;
