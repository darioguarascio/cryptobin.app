import { beforeEach, describe, expect, it } from 'vitest';
import { GET, POST, PUT } from '@/pages/api/auth/index';
import { POST as logoutPost } from '@/pages/api/auth/logout';
import { resetDatabase } from '@/test/fixtures/reset';
import {
  ALICE_HANDLE,
  BOB_HANDLE,
  FIXTURE_MASTER_PASSWORD,
  seedFixtures,
} from '@/test/fixtures/seed';
import { testCryptoFixtures } from '@/test/fixtures/crypto';
import { callApi, signInCookie } from '@/test/helpers/api';

describe('auth API (integration)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('registers a new account and sets session cookie', async () => {
    const response = await callApi(POST, {
      method: 'POST',
      url: 'http://localhost/api/auth',
      body: {
        handle: 'new-user-test',
        masterPassword: FIXTURE_MASTER_PASSWORD,
        publicKey: testCryptoFixtures.publicKey,
        encryptedPrivateKey: testCryptoFixtures.encryptedPrivateKey,
      },
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as { user: { handle: string } };
    expect(body.user.handle).toBe('new-user-test');
    expect(response.headers.get('set-cookie')).toContain('cryptobin_session=');
  });

  it('rejects duplicate handle on register', async () => {
    await seedFixtures();

    const response = await callApi(POST, {
      method: 'POST',
      url: 'http://localhost/api/auth',
      body: {
        handle: ALICE_HANDLE,
        masterPassword: FIXTURE_MASTER_PASSWORD,
        publicKey: testCryptoFixtures.publicKey,
        encryptedPrivateKey: testCryptoFixtures.encryptedPrivateKey,
      },
    });

    expect(response.status).toBe(409);
  });

  it('logs in fixture user and returns session', async () => {
    await seedFixtures();

    const cookie = await signInCookie({
      handle: ALICE_HANDLE,
      masterPassword: FIXTURE_MASTER_PASSWORD,
    });

    const sessionResponse = await callApi(GET, {
      url: 'http://localhost/api/auth',
      cookie,
    });

    expect(sessionResponse.status).toBe(200);
    const body = (await sessionResponse.json()) as { user: { handle: string } | null };
    expect(body.user?.handle).toBe(ALICE_HANDLE);
  });

  it('rejects invalid credentials', async () => {
    await seedFixtures();

    const response = await callApi(PUT, {
      method: 'PUT',
      url: 'http://localhost/api/auth',
      body: {
        handle: BOB_HANDLE,
        masterPassword: 'wrong-password-here',
      },
    });

    expect(response.status).toBe(401);
  });

  it('clears session on logout', async () => {
    await seedFixtures();
    const cookie = await signInCookie({
      handle: ALICE_HANDLE,
      masterPassword: FIXTURE_MASTER_PASSWORD,
    });

    const logoutResponse = await callApi(logoutPost, {
      method: 'POST',
      url: 'http://localhost/api/auth/logout',
      cookie,
    });

    expect(logoutResponse.status).toBe(200);

    const sessionResponse = await callApi(GET, {
      url: 'http://localhost/api/auth',
      cookie,
    });

    expect(sessionResponse.status).toBe(401);
  });

  it('returns 401 for unauthenticated session probe', async () => {
    const response = await callApi(GET, { url: 'http://localhost/api/auth' });
    expect(response.status).toBe(401);
  });
});

describe('auth registration validation (integration)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('rejects short master password', async () => {
    const response = await callApi(POST, {
      method: 'POST',
      url: 'http://localhost/api/auth',
      body: {
        handle: 'valid-handle',
        masterPassword: 'short',
        publicKey: testCryptoFixtures.publicKey,
        encryptedPrivateKey: testCryptoFixtures.encryptedPrivateKey,
      },
    });

    expect(response.status).toBe(400);
  });
});
