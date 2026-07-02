import type { APIRoute } from 'astro';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { inboxDrops } from '@/db/schema';
import { getSessionUser } from '@/lib/server/auth';

export const GET: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const items = await db
    .select({
      id: inboxDrops.id,
      metadataPreview: inboxDrops.metadataPreview,
      readAt: inboxDrops.readAt,
      createdAt: inboxDrops.createdAt,
    })
    .from(inboxDrops)
    .where(eq(inboxDrops.recipientId, user.id))
    .orderBy(desc(inboxDrops.createdAt));

  const unreadCount = items.filter((item) => !item.readAt).length;

  return Response.json({
    items: items.map((item) => ({
      id: item.id,
      metadataPreview: item.metadataPreview,
      readAt: item.readAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
    })),
    unreadCount,
  });
};

export const prerender = false;
