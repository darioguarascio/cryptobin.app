import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import {
  createSession,
  getSessionUser,
  hashPassword,
  sessionCookieHeader,
  verifyPassword,
} from '@/lib/server/auth';
import { handleValidationMessage, normalizeHandle } from '@/lib/handles';
import { verifyTotpCode, normalizeTotpCode } from '@/lib/totp';
import type { EncryptedVaultSecret } from '@/lib/vaultCrypto';

const registerSchema = z.object({
  handle: z.string().min(3).max(32),
  masterPassword: z.string().min(12).max(256),
  email: z.string().email().optional(),
  publicKey: z.string().min(16),
  encryptedPrivateKey: z.custom<EncryptedVaultSecret>(),
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = registerSchema.parse(await request.json());
    const handle = normalizeHandle(body.handle);
    const handleError = handleValidationMessage(handle);

    if (handleError) {
      return Response.json({ error: handleError }, { status: 400 });
    }

    const db = getDb();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.handle, handle)).limit(1);

    if (existing) {
      return Response.json({ error: 'This handle is already taken.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(body.masterPassword);
    const [created] = await db
      .insert(users)
      .values({
        handle,
        passwordHash,
        email: body.email ?? null,
        publicKey: body.publicKey,
        encryptedPrivateKey: body.encryptedPrivateKey,
      })
      .returning({
        id: users.id,
        handle: users.handle,
        email: users.email,
        totpEnabled: users.totpEnabled,
        publicKey: users.publicKey,
        encryptedPrivateKey: users.encryptedPrivateKey,
      });

    const session = await createSession(created.id);

    return new Response(
      JSON.stringify({
        user: {
          id: created.id,
          handle: created.handle,
          email: created.email,
          totpEnabled: created.totpEnabled,
          publicKey: created.publicKey,
          encryptedPrivateKey: created.encryptedPrivateKey,
        },
      }),
      {
        status: 201,
        headers: {
          'content-type': 'application/json',
          'set-cookie': sessionCookieHeader(session.token, session.expiresAt),
        },
      },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Invalid registration payload.' }, { status: 400 });
    }

    return Response.json({ error: 'Unable to create account.' }, { status: 500 });
  }
};

const loginSchema = z.object({
  handle: z.string().min(3).max(32),
  masterPassword: z.string().min(1).max(256),
  totpCode: z.string().optional(),
});

export const PUT: APIRoute = async ({ request }) => {
  try {
    const body = loginSchema.parse(await request.json());
    const handle = normalizeHandle(body.handle);
    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.handle, handle)).limit(1);

    if (!user || !(await verifyPassword(body.masterPassword, user.passwordHash))) {
      return Response.json({ error: 'Invalid handle or master password.' }, { status: 401 });
    }

    if (user.totpEnabled) {
      const code = normalizeTotpCode(body.totpCode ?? '');
      if (!user.totpSecret || !(await verifyTotpCode(user.totpSecret, code))) {
        return Response.json({ error: 'Two-factor code required.', requiresTotp: true }, { status: 401 });
      }
    }

    const session = await createSession(user.id);

    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          handle: user.handle,
          email: user.email,
          totpEnabled: user.totpEnabled,
          publicKey: user.publicKey,
          encryptedPrivateKey: user.encryptedPrivateKey,
        },
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'set-cookie': sessionCookieHeader(session.token, session.expiresAt),
        },
      },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Invalid login payload.' }, { status: 400 });
    }

    return Response.json({ error: 'Unable to log in.' }, { status: 500 });
  }
};

export const GET: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);

  if (!user) {
    return Response.json({ user: null }, { status: 401 });
  }

  return Response.json({ user });
};
