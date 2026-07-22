import { beforeEach, describe, expect, it } from 'vitest';
import { GET as getSecret } from '@/pages/api/secrets/[id]';
import { POST as createSecret } from '@/pages/api/secrets/index';
import { clearSecretsForTest } from '@/lib/serverSecrets';
import { callApi } from '@/test/helpers/api';

const secretPayload = {
  version: 1 as const,
  algorithm: 'AES-GCM-256' as const,
  iv: 'abcdefghijklmnop',
  ciphertext: 'abcdefghijklmnopqrstuvwxyz',
  ttlHours: 24,
};

describe('secrets API (integration)', () => {
  beforeEach(() => {
    clearSecretsForTest();
  });

  it('stores a secret and consumes it once via GET', async () => {
    const createResponse = await callApi(createSecret, {
      method: 'POST',
      url: 'http://localhost/api/secrets',
      body: secretPayload,
    });

    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as { id: string };

    const firstRead = await callApi(getSecret, {
      url: `http://localhost/api/secrets/${created.id}`,
      params: { id: created.id },
    });

    expect(firstRead.status).toBe(200);
    const payload = (await firstRead.json()) as { ciphertext: string };
    expect(payload.ciphertext).toBe(secretPayload.ciphertext);

    const secondRead = await callApi(getSecret, {
      url: `http://localhost/api/secrets/${created.id}`,
      params: { id: created.id },
    });

    expect(secondRead.status).toBe(404);
  });

  it('rejects invalid secret payload', async () => {
    const response = await callApi(createSecret, {
      method: 'POST',
      url: 'http://localhost/api/secrets',
      body: { version: 1, algorithm: 'AES-GCM-256', iv: 'x', ciphertext: 'y' },
    });

    expect(response.status).toBe(400);
  });
});
