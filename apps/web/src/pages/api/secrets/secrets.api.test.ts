import { beforeEach, describe, expect, it } from 'vitest';
import { callApi } from '@/test/helpers/api';
import { GET as getSecret } from '@/pages/api/secrets/[id]';
import { POST as createSecret } from '@/pages/api/secrets/index';
import { clearSecretsForTest } from '@/lib/serverSecrets';

describe('secrets API routes (unit)', () => {
  beforeEach(() => {
    clearSecretsForTest();
  });

  it('returns 400 when secret id param is missing', async () => {
    const response = await callApi(getSecret, {
      url: 'http://localhost/api/secrets/',
      params: {},
    });

    expect(response.status).toBe(400);
  });

  it('returns 404 for unknown secret id', async () => {
    const response = await callApi(getSecret, {
      url: 'http://localhost/api/secrets/missing',
      params: { id: 'missing' },
    });

    expect(response.status).toBe(404);
  });

  it('returns 201 with expiry when POST body is valid', async () => {
    const response = await callApi(createSecret, {
      method: 'POST',
      url: 'http://localhost/api/secrets',
      body: {
        version: 1,
        algorithm: 'AES-GCM-256',
        iv: 'abcdefghijklmnop',
        ciphertext: 'abcdefghijklmnopqrstuvwxyz',
        ttlHours: 2,
      },
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: string; expiresAt: string };
    expect(body.id.length).toBeGreaterThan(8);
    expect(body.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
