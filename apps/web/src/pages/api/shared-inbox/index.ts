import type { APIRoute } from 'astro';
import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import {
  sharedInboxDrops,
  sharedInboxMembers,
  sharedInboxes,
  users,
} from '@/db/schema';
import { handleValidationMessage, normalizeHandle } from '@/lib/handles';
import { INBOX_ALGORITHM } from '@/lib/inboxCrypto';
import { getSessionUser } from '@/lib/server/auth';

const wrappedKeySchema = z.object({
  algorithm: z.literal(INBOX_ALGORITHM),
  iv: z.string().min(12),
  ciphertext: z.string().min(16),
  wrappedKey: z.string().min(16),
});

const createSchema = z.object({
  slug: z.string().min(3).max(32),
  name: z.string().min(2).max(120),
  publicKey: z.string().min(32),
  wrappedPrivateKey: wrappedKeySchema,
});

export const GET: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const memberships = await db
    .select({
      slug: sharedInboxes.slug,
      name: sharedInboxes.name,
      role: sharedInboxMembers.role,
      inboxId: sharedInboxes.id,
    })
    .from(sharedInboxMembers)
    .innerJoin(sharedInboxes, eq(sharedInboxMembers.inboxId, sharedInboxes.id))
    .where(eq(sharedInboxMembers.userId, user.id))
    .orderBy(desc(sharedInboxes.createdAt));

  const inboxIds = memberships.map((row) => row.inboxId);
  const memberCounts = new Map<string, number>();
  const unreadCounts = new Map<string, number>();

  if (inboxIds.length) {
    const members = await db
      .select({
        inboxId: sharedInboxMembers.inboxId,
      })
      .from(sharedInboxMembers)
      .where(inArray(sharedInboxMembers.inboxId, inboxIds));

    for (const member of members) {
      memberCounts.set(member.inboxId, (memberCounts.get(member.inboxId) ?? 0) + 1);
    }

    const drops = await db
      .select({
        inboxId: sharedInboxDrops.inboxId,
        readBy: sharedInboxDrops.readBy,
      })
      .from(sharedInboxDrops)
      .where(inArray(sharedInboxDrops.inboxId, inboxIds));

    for (const drop of drops) {
      if (!drop.readBy?.[user.id]) {
        unreadCounts.set(drop.inboxId, (unreadCounts.get(drop.inboxId) ?? 0) + 1);
      }
    }
  }

  return Response.json({
    items: memberships.map((row) => ({
      slug: row.slug,
      name: row.name,
      role: row.role === 'owner' ? 'owner' : 'member',
      memberCount: memberCounts.get(row.inboxId) ?? 0,
      unreadCount: unreadCounts.get(row.inboxId) ?? 0,
    })),
  });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = createSchema.parse(await request.json());
    const slug = normalizeHandle(body.slug);
    const slugError = handleValidationMessage(slug);
    if (slugError) {
      return Response.json({ error: slugError }, { status: 400 });
    }

    const db = getDb();
    const [existingUser] = await db
      .select({ handle: users.handle })
      .from(users)
      .where(eq(users.handle, slug))
      .limit(1);

    if (existingUser) {
      return Response.json({ error: 'This slug is already taken by a personal inbox.' }, { status: 409 });
    }

    const [existingInbox] = await db
      .select({ slug: sharedInboxes.slug })
      .from(sharedInboxes)
      .where(eq(sharedInboxes.slug, slug))
      .limit(1);

    if (existingInbox) {
      return Response.json({ error: 'This shared inbox slug is already taken.' }, { status: 409 });
    }

    const [created] = await db
      .insert(sharedInboxes)
      .values({
        slug,
        name: body.name.trim(),
        ownerId: user.id,
        publicKey: body.publicKey,
      })
      .returning({
        id: sharedInboxes.id,
        slug: sharedInboxes.slug,
        name: sharedInboxes.name,
        publicKey: sharedInboxes.publicKey,
        createdAt: sharedInboxes.createdAt,
      });

    await db.insert(sharedInboxMembers).values({
      inboxId: created.id,
      userId: user.id,
      role: 'owner',
      wrappedPrivateKey: body.wrappedPrivateKey,
    });

    return Response.json(
      {
        slug: created.slug,
        name: created.name,
        publicKey: created.publicKey,
        role: 'owner',
        createdAt: created.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Invalid shared inbox payload.' }, { status: 400 });
    }

    return Response.json({ error: 'Unable to create shared inbox.' }, { status: 500 });
  }
};

export const prerender = false;
