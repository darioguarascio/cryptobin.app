import { describe, expect, it } from 'vitest';
import { storeEncryptedSecret } from './api.js';

describe('storeEncryptedSecret', () => {
  it('posts encrypted payloads to the secrets API', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ id: 'abc123', expiresAt: '2026-07-06T10:00:00.000Z' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      });
    };

    const result = await storeEncryptedSecret(
      'https://cryptobin.app/',
      {
        version: 1,
        algorithm: 'AES-GCM-256',
        iv: 'abc',
        ciphertext: 'secret',
        ttlHours: 24,
      },
      fetchImpl as typeof fetch,
    );

    expect(result.id).toBe('abc123');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://cryptobin.app/api/secrets');
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({ ttlHours: 24 });
  });

  it('surfaces API errors', async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ error: 'Invalid encrypted secret payload' }), { status: 400 });

    await expect(
      storeEncryptedSecret(
        'https://cryptobin.app',
        {
          version: 1,
          algorithm: 'AES-GCM-256',
          iv: 'abc',
          ciphertext: 'secret',
          ttlHours: 24,
        },
        fetchImpl as typeof fetch,
      ),
    ).rejects.toThrow('Invalid encrypted secret payload');
  });

  it('surfaces generic API errors', async () => {
    const fetchImpl = async () => new Response('nope', { status: 500 });

    await expect(
      storeEncryptedSecret(
        'https://cryptobin.app',
        {
          version: 1,
          algorithm: 'AES-GCM-256',
          iv: 'abc',
          ciphertext: 'secret',
          ttlHours: 24,
        },
        fetchImpl as typeof fetch,
      ),
    ).rejects.toThrow('Upload failed (500)');
  });
});
