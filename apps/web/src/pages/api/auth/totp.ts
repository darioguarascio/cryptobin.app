import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { getSessionUser } from '@/lib/server/auth';
import { buildTotpUri, createTotpSecret, verifyTotpCode, normalizeTotpCode } from '@/lib/totp';

export const GET: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return Response.json({ enabled: user.totpEnabled });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const secret = createTotpSecret();

  return Response.json({
    secret,
    uri: buildTotpUri(secret, user.handle),
  });
};

const verifySchema = z.object({
  secret: z.string().min(16),
  code: z.string().min(6).max(8),
});

export const PUT: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = verifySchema.parse(await request.json());
    const code = normalizeTotpCode(body.code);

    if (!(await verifyTotpCode(body.secret, code))) {
      return Response.json({ error: 'Invalid authenticator code.' }, { status: 400 });
    }

    const db = getDb();
    await db
      .update(users)
      .set({ totpSecret: body.secret, totpEnabled: true })
      .where(eq(users.id, user.id));

    return Response.json({ enabled: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Invalid payload.' }, { status: 400 });
    }

    return Response.json({ error: 'Unable to enable 2FA.' }, { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  await db
    .update(users)
    .set({ totpSecret: null, totpEnabled: false })
    .where(eq(users.id, user.id));

  return Response.json({ enabled: false });
};
