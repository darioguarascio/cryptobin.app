import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { sessions, users, type User } from '@/db/schema';
import {
  createSessionToken,
  getSessionTokenFromRequest,
  hashSessionToken,
} from './sessionHelpers';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export {
  SESSION_COOKIE,
  clearSessionCookieHeader,
  createSessionToken,
  getSessionTokenFromRequest,
  hashPassword,
  hashSessionToken,
  safeEqualString,
  sessionCookieHeader,
  verifyPassword,
} from './sessionHelpers';

export interface SessionUser {
  id: string;
  handle: string;
  email: string | null;
  totpEnabled: boolean;
  publicKey: string;
  encryptedPrivateKey: User['encryptedPrivateKey'];
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const db = getDb();
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });

  return { token, expiresAt };
}

export async function deleteSession(token: string): Promise<void> {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const token = getSessionTokenFromRequest(request);
  if (!token) return null;

  const db = getDb();
  const tokenHash = hashSessionToken(token);
  const [row] = await db
    .select({
      expiresAt: sessions.expiresAt,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);

  if (!row || row.expiresAt.getTime() <= Date.now()) {
    if (row) {
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    }
    return null;
  }

  return {
    id: row.user.id,
    handle: row.user.handle,
    email: row.user.email,
    totpEnabled: row.user.totpEnabled,
    publicKey: row.user.publicKey,
    encryptedPrivateKey: row.user.encryptedPrivateKey,
  };
}
