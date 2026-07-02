import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getDb } from '@/db';
import { sharedInboxDrops } from '@/db/schema';
import { normalizeHandle } from '@/lib/handles';
import { INBOX_ALGORITHM } from '@/lib/inboxCrypto';
import { getSharedInboxBySlug } from '@/lib/server/sharedInboxAccess';
import { sendSharedInboxNotification } from '@/lib/server/notifications';

const dropSchema = z.object({
  algorithm: z.literal(INBOX_ALGORITHM),
  iv: z.string().min(12),
  ciphertext: z.string().min(16),
  wrappedKey: z.string().min(16),
  metadataPreview: z
    .object({
      from: z.string().max(120).optional(),
      label: z.string().max(160).optional(),
      description: z.string().max(500).optional(),
    })
    .optional(),
});

export const POST: APIRoute = async ({ params, request }) => {
  const slug = normalizeHandle(params.slug ?? '');
  if (!slug) {
    return Response.json({ error: 'Slug required.' }, { status: 400 });
  }

  try {
    const inbox = await getSharedInboxBySlug(slug);
    if (!inbox) {
      return Response.json({ error: 'Shared inbox not found.' }, { status: 404 });
    }

    const body = dropSchema.parse(await request.json());
    const db = getDb();
    const [created] = await db
      .insert(sharedInboxDrops)
      .values({
        inboxId: inbox.id,
        algorithm: body.algorithm,
        iv: body.iv,
        ciphertext: body.ciphertext,
        wrappedKey: body.wrappedKey,
        metadataPreview: body.metadataPreview,
      })
      .returning({ id: sharedInboxDrops.id, createdAt: sharedInboxDrops.createdAt });

    void sendSharedInboxNotification({
      inboxId: inbox.id,
      slug: inbox.slug,
      name: inbox.name,
      preview: body.metadataPreview,
    }).catch(() => undefined);

    return Response.json(
      {
        id: created.id,
        createdAt: created.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Invalid encrypted inbox payload.' }, { status: 400 });
    }

    return Response.json({ error: 'Unable to store shared inbox drop.' }, { status: 500 });
  }
};

export const prerender = false;
