import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { inboxDrops, users } from '@/db/schema';
import { INBOX_ALGORITHM } from '@/lib/inboxCrypto';
import { normalizeHandle } from '@/lib/handles';
import { sendInboxNotification } from '@/lib/server/notifications';

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
  const handle = normalizeHandle(params.handle ?? '');
  if (!handle) {
    return Response.json({ error: 'Handle required.' }, { status: 400 });
  }

  try {
    const body = dropSchema.parse(await request.json());
    const db = getDb();
    const [recipient] = await db
      .select({ id: users.id, email: users.email, handle: users.handle })
      .from(users)
      .where(eq(users.handle, handle))
      .limit(1);

    if (!recipient) {
      return Response.json({ error: 'Inbox not found.' }, { status: 404 });
    }

    const [created] = await db
      .insert(inboxDrops)
      .values({
        recipientId: recipient.id,
        algorithm: body.algorithm,
        iv: body.iv,
        ciphertext: body.ciphertext,
        wrappedKey: body.wrappedKey,
        metadataPreview: body.metadataPreview,
      })
      .returning({ id: inboxDrops.id, createdAt: inboxDrops.createdAt });

    if (recipient.email) {
      void sendInboxNotification({
        to: recipient.email,
        handle: recipient.handle,
        preview: body.metadataPreview,
      }).catch(() => undefined);
    }

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

    return Response.json({ error: 'Unable to store inbox drop.' }, { status: 500 });
  }
};
