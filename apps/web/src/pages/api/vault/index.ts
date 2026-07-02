import type { APIRoute } from 'astro';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { vaultEntries } from '@/db/schema';
import { getSessionUser } from '@/lib/server/auth';
import type { EncryptedVaultSecret } from '@/lib/vaultCrypto';

export const GET: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const items = await db
    .select({
      id: vaultEntries.id,
      encryptedPayload: vaultEntries.encryptedPayload,
      createdAt: vaultEntries.createdAt,
      updatedAt: vaultEntries.updatedAt,
    })
    .from(vaultEntries)
    .where(eq(vaultEntries.userId, user.id))
    .orderBy(desc(vaultEntries.createdAt));

  return Response.json({
    items: items.map((item) => ({
      id: item.id,
      encryptedPayload: item.encryptedPayload,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  });
};

const createSchema = z.object({
  id: z.string().uuid().optional(),
  encryptedPayload: z.custom<EncryptedVaultSecret>(),
});

export const POST: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = createSchema.parse(await request.json());
    const db = getDb();
    const [created] = await db
      .insert(vaultEntries)
      .values({
        id: body.id,
        userId: user.id,
        encryptedPayload: body.encryptedPayload,
      })
      .returning({
        id: vaultEntries.id,
        createdAt: vaultEntries.createdAt,
        updatedAt: vaultEntries.updatedAt,
      });

    return Response.json(
      {
        id: created.id,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Invalid vault payload.' }, { status: 400 });
    }

    return Response.json({ error: 'Unable to save vault entry.' }, { status: 500 });
  }
};

export const prerender = false;
