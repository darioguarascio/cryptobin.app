import { getDb } from '@/db';
import { inboxDrops, users, vaultEntries } from '@/db/schema';
import { hashPassword } from '@/lib/server/auth';
import { testCryptoFixtures } from './crypto';

export const FIXTURE_MASTER_PASSWORD = 'fixture-pass-12';
export const ALICE_HANDLE = 'alice-test';
export const BOB_HANDLE = 'bob-test';

export interface FixtureUsers {
  alice: { id: string; handle: string };
  bob: { id: string; handle: string };
}

export async function seedFixtures(): Promise<FixtureUsers> {
  const db = getDb();
  const passwordHash = await hashPassword(FIXTURE_MASTER_PASSWORD);

  const [alice] = await db
    .insert(users)
    .values({
      handle: ALICE_HANDLE,
      passwordHash,
      publicKey: testCryptoFixtures.publicKey,
      encryptedPrivateKey: testCryptoFixtures.encryptedPrivateKey,
    })
    .returning({ id: users.id, handle: users.handle });

  const [bob] = await db
    .insert(users)
    .values({
      handle: BOB_HANDLE,
      passwordHash,
      publicKey: testCryptoFixtures.publicKey,
      encryptedPrivateKey: testCryptoFixtures.encryptedPrivateKey,
    })
    .returning({ id: users.id, handle: users.handle });

  await db.insert(vaultEntries).values({
    userId: alice.id,
    encryptedPayload: testCryptoFixtures.encryptedPrivateKey,
  });

  await db.insert(inboxDrops).values({
    recipientId: alice.id,
    algorithm: testCryptoFixtures.inboxPayload.algorithm,
    iv: testCryptoFixtures.inboxPayload.iv,
    ciphertext: testCryptoFixtures.inboxPayload.ciphertext,
    wrappedKey: testCryptoFixtures.inboxPayload.wrappedKey,
    metadataPreview: { from: 'sender@example.com', label: 'Fixture drop' },
  });

  return { alice, bob };
}
