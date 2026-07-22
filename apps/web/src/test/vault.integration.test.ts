import { beforeEach, describe, expect, it } from 'vitest';
import { GET, POST } from '@/pages/api/vault/index';
import { resetDatabase } from '@/test/fixtures/reset';
import { ALICE_HANDLE, FIXTURE_MASTER_PASSWORD, seedFixtures } from '@/test/fixtures/seed';
import { testCryptoFixtures } from '@/test/fixtures/crypto';
import { callApi, signInCookie } from '@/test/helpers/api';

describe('vault API (integration)', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedFixtures();
  });

  it('lists vault entries for authenticated user', async () => {
    const cookie = await signInCookie({
      handle: ALICE_HANDLE,
      masterPassword: FIXTURE_MASTER_PASSWORD,
    });

    const response = await callApi(GET, {
      url: 'http://localhost/api/vault',
      cookie,
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: { id: string }[] };
    expect(body.items).toHaveLength(1);
  });

  it('creates a vault entry', async () => {
    const cookie = await signInCookie({
      handle: ALICE_HANDLE,
      masterPassword: FIXTURE_MASTER_PASSWORD,
    });

    const createResponse = await callApi(POST, {
      method: 'POST',
      url: 'http://localhost/api/vault',
      cookie,
      body: {
        encryptedPayload: testCryptoFixtures.encryptedPrivateKey,
      },
    });

    expect(createResponse.status).toBe(201);

    const listResponse = await callApi(GET, {
      url: 'http://localhost/api/vault',
      cookie,
    });
    const body = (await listResponse.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(2);
  });

  it('returns 401 without session', async () => {
    const response = await callApi(GET, { url: 'http://localhost/api/vault' });
    expect(response.status).toBe(401);
  });
});
