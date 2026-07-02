import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { normalizeHandle } from '@/lib/handles';

export const GET: APIRoute = async ({ params }) => {
  const handle = normalizeHandle(params.handle ?? '');
  if (!handle) {
    return Response.json({ error: 'Handle required.' }, { status: 400 });
  }

  const db = getDb();
  const [user] = await db
    .select({ handle: users.handle, publicKey: users.publicKey })
    .from(users)
    .where(eq(users.handle, handle))
    .limit(1);

  if (!user) {
    return Response.json({ error: 'Inbox not found.' }, { status: 404 });
  }

  return Response.json({ handle: user.handle, publicKey: user.publicKey });
};
