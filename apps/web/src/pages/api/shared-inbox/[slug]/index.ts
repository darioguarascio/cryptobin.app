import type { APIRoute } from 'astro';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { sharedInboxDrops, sharedInboxMembers, users } from '@/db/schema';
import { normalizeHandle } from '@/lib/handles';
import { getSessionUser } from '@/lib/server/auth';
import { requireSharedInboxMember } from '@/lib/server/sharedInboxAccess';

export const GET: APIRoute = async ({ params, request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const slug = normalizeHandle(params.slug ?? '');
  if (!slug) {
    return Response.json({ error: 'Slug required.' }, { status: 400 });
  }

  try {
    const membership = await requireSharedInboxMember(user.id, slug);
    const db = getDb();

    const members = await db
      .select({
        userId: sharedInboxMembers.userId,
        handle: users.handle,
        role: sharedInboxMembers.role,
        joinedAt: sharedInboxMembers.joinedAt,
        wrappedPrivateKey: sharedInboxMembers.wrappedPrivateKey,
      })
      .from(sharedInboxMembers)
      .innerJoin(users, eq(sharedInboxMembers.userId, users.id))
      .where(eq(sharedInboxMembers.inboxId, membership.inbox.id))
      .orderBy(sharedInboxMembers.joinedAt);

    const drops = await db
      .select({
        id: sharedInboxDrops.id,
        metadataPreview: sharedInboxDrops.metadataPreview,
        readBy: sharedInboxDrops.readBy,
        createdAt: sharedInboxDrops.createdAt,
      })
      .from(sharedInboxDrops)
      .where(eq(sharedInboxDrops.inboxId, membership.inbox.id))
      .orderBy(desc(sharedInboxDrops.createdAt));

    const self = members.find((member) => member.userId === user.id);
    if (!self) {
      return Response.json({ error: 'Membership not found.' }, { status: 404 });
    }

    return Response.json({
      slug: membership.inbox.slug,
      name: membership.inbox.name,
      role: membership.role,
      publicKey: membership.inbox.publicKey,
      wrappedPrivateKey: self.wrappedPrivateKey,
      members: members.map((member) => ({
        userId: member.userId,
        handle: member.handle,
        role: member.role === 'owner' ? 'owner' : 'member',
        joinedAt: member.joinedAt.toISOString(),
      })),
      drops: drops.map((drop) => ({
        id: drop.id,
        metadataPreview: drop.metadataPreview,
        readAt: drop.readBy?.[user.id] ?? null,
        createdAt: drop.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_MEMBER') {
      return Response.json({ error: 'Forbidden.' }, { status: 403 });
    }

    return Response.json({ error: 'Unable to load shared inbox.' }, { status: 500 });
  }
};

export const prerender = false;
